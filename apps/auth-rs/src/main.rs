use actix_web::{
    web, App, HttpRequest, HttpResponse, HttpServer, Result,
    middleware::Logger,
};
use actix_cors::Cors;
use serde::{Deserialize, Serialize};
use mongodb::{
    bson::doc,
    error::{ErrorKind, WriteFailure},
    options::{Collation, CollationStrength, IndexOptions},
    Client, Collection, Database, IndexModel,
};
use jsonwebtoken::{encode, decode, Header, Algorithm, Validation, EncodingKey, DecodingKey};
mod credentials;
mod breached_passwords;
mod passwords;
use breached_passwords::BreachedPasswordChecker;
use credentials::{validate_login, validate_signup, AUTH_JSON_LIMIT};
use passwords::{PasswordError, PasswordJobs};
use uuid::Uuid;
use chrono::{DateTime, Utc, Duration};
use std::env;
use std::fs;
use std::net::IpAddr;
use std::collections::HashSet;
use redis::aio::ConnectionManager;
use sha2::{Digest, Sha256};
use base64::{engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD}, Engine};

const LOGIN_MAX_ATTEMPTS: i64 = 5;
const LOGIN_IP_MAX_ATTEMPTS: i64 = 60;
const LOGIN_WINDOW_SECONDS: i64 = 900;
const SIGNUP_IP_MAX_ATTEMPTS: i64 = 20;
const SIGNUP_WINDOW_SECONDS: i64 = 900;
const LOGIN_RATE_LIMIT_SCRIPT: &str = r#"
local account_count = redis.call('INCR', KEYS[1])
if account_count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ip_count = redis.call('INCR', KEYS[2])
if ip_count == 1 then
  redis.call('EXPIRE', KEYS[2], ARGV[1])
end
local retry_after = 0
if account_count > tonumber(ARGV[2]) then
  retry_after = math.max(retry_after, redis.call('TTL', KEYS[1]))
end
if ip_count > tonumber(ARGV[3]) then
  retry_after = math.max(retry_after, redis.call('TTL', KEYS[2]))
end
return { account_count, ip_count, retry_after }
"#;
const SIGNUP_RATE_LIMIT_SCRIPT: &str = r#"
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return { count, redis.call('TTL', KEYS[1]) }
"#;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct User {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    id: Option<mongodb::bson::oid::ObjectId>,
    user_id: String,
    email: String,
    password_hash: String,
    created_at: DateTime<Utc>,
    #[serde(default)]
    mfa: MFAState,
}

#[derive(Debug, Default, Serialize, Deserialize, Clone)]
struct MFAState {
    #[serde(default)]
    enabled: bool,
    #[serde(default)]
    version: String,
}

// API Request/Response Types
#[derive(Deserialize)]
struct SignupRequest {
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Serialize)]
struct LoginResponse {
    expires_in: u64,
}

#[derive(Serialize)]
struct UserResponse {
    user_id: String,
    email: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Clone, Serialize)]
struct JsonWebKey {
    kty: &'static str,
    #[serde(rename = "use")]
    key_use: &'static str,
    alg: &'static str,
    kid: String,
    n: String,
    e: String,
}

#[derive(Clone, Serialize)]
struct JsonWebKeySet {
    keys: Vec<JsonWebKey>,
}

// JWT Token Structure
#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    email: String,
    #[serde(default)]
    jti: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    auth_version: Option<String>,
    iss: String,
    aud: String,
    exp: usize,
    iat: usize,
}

// App State
#[derive(Clone)]
struct AppState {
    db: Database,
    redis: ConnectionManager,
    jwt_encoding_key: EncodingKey,
    jwt_decoding_key: DecodingKey,
    password_jobs: PasswordJobs,
    breached_passwords: BreachedPasswordChecker,
    trusted_proxy_ips: HashSet<IpAddr>,
    jwks: JsonWebKeySet,
}

impl AppState {
    fn users_collection(&self) -> Collection<User> {
        self.db.collection("users")
    }
}

async fn health() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().body("Service is Healthy!"))
}

async fn signup(
    state: web::Data<AppState>,
    request: HttpRequest,
    req: web::Json<SignupRequest>,
) -> Result<HttpResponse> {
    let mut req = req.into_inner();
    if let Err(message) = validate_signup(&req.email, &req.password) {
        return Ok(HttpResponse::BadRequest().json(ErrorResponse { error: message.to_string() }));
    }
    req.email = normalize_email(&req.email);
    let client_ip = client_ip_from_request(&request, &state.trusted_proxy_ips);
    let signup_key = signup_rate_limit_key(&client_ip);
    let (signup_count, retry_after) = {
        let mut connection = state.redis.clone();
        match consume_signup_attempt(&mut connection, &signup_key).await {
            Ok(result) => result,
            Err(_) => {
                eprintln!("Signup rate limiter unavailable");
                return Ok(HttpResponse::ServiceUnavailable().json(ErrorResponse {
                    error: "Registration temporarily unavailable".to_string(),
                }));
            }
        }
    };
    if signup_count > SIGNUP_IP_MAX_ATTEMPTS {
        return Ok(HttpResponse::TooManyRequests()
            .insert_header(("Retry-After", retry_after.max(1).to_string()))
            .json(ErrorResponse { error: "Too many registration attempts. Try again later.".to_string() }));
    }
    let collection = state.users_collection();
    println!("Signup request received");

    // Check if user already exists
    match collection
        .find_one(doc! { "email": &req.email })
        .collation(email_collation())
        .await
    {
        Ok(Some(_)) => {
            println!("Signup rejected: email already registered");
            return Ok(HttpResponse::Conflict().json(ErrorResponse {
                error: "User with this email already exists".to_string(),
            }));
        }
        Ok(None) => {
            println!("Signup email is available");
        }
        Err(_) => {
            eprintln!("Database error during signup");
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Database error".to_string(),
            }));
        }
    }

    match state.breached_passwords.is_compromised(&req.password).await {
        Ok(true) => {
            return Ok(HttpResponse::BadRequest().json(ErrorResponse {
                error: "Choose a password that has not appeared in known data breaches.".to_string(),
            }));
        }
        Ok(false) => {}
        Err(_) => {
            eprintln!("Compromised password screening unavailable");
            return Ok(password_screening_unavailable_response());
        }
    }

    println!("Hashing password securely...");
    let password_hash = match state.password_jobs.hash(req.password).await {
        Ok(hash) => {
            println!("Password hashed successfully");
            hash
        }
        Err(error) => {
            eprintln!("Password hashing failed");
            return Ok(password_error_response(error));
        }
    };

    let user = User {
        id: None,
        user_id: Uuid::new_v4().to_string(),
        email: req.email.clone(),
        password_hash,
        created_at: Utc::now(),
        mfa: MFAState::default(),
    };

    match collection.insert_one(&user).await {
        Ok(_) => {
            println!("User created successfully");
            Ok(HttpResponse::Created().json(serde_json::json!({
                "message": "User created successfully",
                "user_id": user.user_id
            })))
        }
        Err(error) if is_duplicate_email_error(&error) => {
            println!("Signup rejected: email already registered");
            Ok(HttpResponse::Conflict().json(ErrorResponse {
                error: "User with this email already exists".to_string(),
            }))
        }
        Err(_) => {
            eprintln!("Failed to save user");
            Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Failed to create user".to_string(),
            }))
        }
    }
}

fn is_duplicate_email_error(error: &mongodb::error::Error) -> bool {
    matches!(
        error.kind.as_ref(),
        ErrorKind::Write(WriteFailure::WriteError(write_error)) if write_error.code == 11000
    )
}

fn email_collation() -> Collation {
    Collation::builder()
        .locale("en")
        .strength(CollationStrength::Secondary)
        .build()
}

fn normalize_email(email: &str) -> String {
    email.to_ascii_lowercase()
}

async fn login(
    state: web::Data<AppState>,
    request: HttpRequest,
    req: web::Json<LoginRequest>,
) -> Result<HttpResponse> {
    let req = req.into_inner();
    if let Err(message) = validate_login(&req.email, &req.password) {
        return Ok(HttpResponse::BadRequest().json(ErrorResponse { error: message.to_string() }));
    }
    let collection = state.users_collection();
    println!("Login request received");

    let client_ip = client_ip_from_request(&request, &state.trusted_proxy_ips);
    let normalized_email = normalize_email(&req.email);
    let (account_rate_key, ip_rate_key) = login_rate_limit_keys(&normalized_email, &client_ip);
    let (account_count, ip_count, retry_after) = {
        let mut connection = state.redis.clone();
        match consume_login_attempt(&mut connection, &account_rate_key, &ip_rate_key).await {
            Ok(result) => result,
            Err(_) => {
                eprintln!("Login rate limiter unavailable");
                return Ok(HttpResponse::ServiceUnavailable().json(ErrorResponse {
                    error: "Authentication temporarily unavailable".to_string(),
                }));
            }
        }
    };
    if account_count > LOGIN_MAX_ATTEMPTS || ip_count > LOGIN_IP_MAX_ATTEMPTS {
        return Ok(HttpResponse::TooManyRequests()
            .insert_header(("Retry-After", retry_after.max(1).to_string()))
            .json(ErrorResponse {
                error: "Too many login attempts. Try again later.".to_string(),
            }));
    }

    let user = match collection
        .find_one(doc! { "email": &normalized_email })
        .collation(email_collation())
        .await
    {
        Ok(Some(user)) => {
            println!("Login user lookup succeeded");
            user
        }
        Ok(None) => {
            println!("Login user lookup failed");
            return Ok(HttpResponse::Unauthorized().json(ErrorResponse {
                error: "Invalid email or password".to_string(),
            }));
        }
        Err(_) => {
            eprintln!("Database error during login");
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Database error".to_string(),
            }));
        }
    };

    println!("Verifying password...");
    match state.password_jobs.verify(req.password, user.password_hash.clone()).await {
        Ok(true) => {
            println!("Password verification succeeded");
            let mut connection = state.redis.clone();
            if clear_login_attempts(&mut connection, &account_rate_key).await.is_err() {
                eprintln!("Could not clear successful-login rate counter");
            }
        }
        Ok(false) => {
            println!("Password verification failed");
            return Ok(HttpResponse::Unauthorized().json(ErrorResponse {
                error: "Invalid email or password".to_string(),
            }));
        }
        Err(error) => return Ok(password_error_response(error)),
    }

    // Rollback must never downgrade an enrolled account to password-only login.
    if user.mfa.enabled {
        return Ok(HttpResponse::ServiceUnavailable()
            .insert_header(("Cache-Control", "no-store"))
            .insert_header(("Set-Cookie", session_cookie("", 0)))
            .json(ErrorResponse { error: "Two-step sign-in is temporarily unavailable".to_string() }));
    }
    println!("Creating JWT token...");
    let now = Utc::now();
    let claims = Claims {
        sub: user.user_id.clone(),
        email: user.email.clone(),
        jti: Some(Uuid::new_v4().to_string()),
        auth_version: Some(user.mfa.version.clone()).filter(|v| !v.is_empty()),
        iss: env::var("JWT_ISSUER").unwrap_or_else(|_| "forgeharbor".to_string()),
        aud: env::var("JWT_AUDIENCE").unwrap_or_else(|_| "forgeharbor-users".to_string()),
        exp: (now + Duration::hours(1)).timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    let token_header = signing_header(&state.jwks.keys[0].kid);
    let token = match encode(&token_header, &claims, &state.jwt_encoding_key) {
        Ok(token) => {
            println!("JWT token created");
            token
        }
        Err(_) => {
            eprintln!("JWT token creation failed");
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Token generation failed".to_string(),
            }));
        }
    };

    Ok(HttpResponse::Ok()
        .insert_header(("Set-Cookie", session_cookie(&token, 3600)))
        .json(LoginResponse {
            expires_in: 3600,
        }))
}

fn session_cookie(token: &str, max_age_seconds: u64) -> String {
    let secure = env::var("AUTH_COOKIE_SECURE")
        .map(|value| !value.eq_ignore_ascii_case("false"))
        .unwrap_or(true);
    session_cookie_with_secure(token, max_age_seconds, secure)
}

fn session_cookie_with_secure(token: &str, max_age_seconds: u64, secure: bool) -> String {
    let secure_attribute = if secure { "; Secure" } else { "" };
    format!("fh_access={token}; Max-Age={max_age_seconds}; Path=/; HttpOnly; SameSite=Strict{secure_attribute}")
}

fn request_token(request: &HttpRequest) -> Option<String> {
    let bearer = request
        .headers()
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .filter(|value| !value.is_empty())
        .map(str::to_owned);
    bearer.or_else(|| request.cookie("fh_access").map(|cookie| cookie.value().to_owned()))
}

async fn logout(state: web::Data<AppState>, request: HttpRequest) -> Result<HttpResponse> {
    let cleared_cookie = session_cookie("", 0);
    if let Some(token) = request_token(&request) {
        if let Ok(data) = decode::<Claims>(&token, &state.jwt_decoding_key, &jwt_validation()) {
            if let Some(jti) = data.claims.jti {
                let ttl = data.claims.exp.saturating_sub(Utc::now().timestamp().max(0) as usize);
                if ttl > 0 {
                    let mut connection = state.redis.clone();
                    if revoke_token(&mut connection, &jti, ttl).await.is_err() {
                        eprintln!("Session revocation store unavailable");
                        return Ok(HttpResponse::ServiceUnavailable()
                            .insert_header(("Retry-After", "1"))
                            .insert_header(("Set-Cookie", cleared_cookie))
                            .json(ErrorResponse { error: "Logout temporarily unavailable".to_string() }));
                    }
                }
            }
        }
    }
    Ok(HttpResponse::NoContent()
        .insert_header(("Set-Cookie", cleared_cookie))
        .finish())
}

fn password_error_response(error: PasswordError) -> HttpResponse {
    match error {
        PasswordError::Busy => HttpResponse::ServiceUnavailable()
            .insert_header(("Retry-After", "1"))
            .json(ErrorResponse { error: "Authentication is busy. Try again shortly.".to_string() }),
        PasswordError::Failed => HttpResponse::InternalServerError()
            .json(ErrorResponse { error: "Internal authentication error".to_string() }),
    }
}

fn password_screening_unavailable_response() -> HttpResponse {
    HttpResponse::ServiceUnavailable()
        .insert_header(("Retry-After", "30"))
        .json(ErrorResponse {
            error: "Registration temporarily unavailable".to_string(),
        })
}

fn rate_limit_key(kind: &str, identifier: &str) -> String {
    let digest = Sha256::digest(identifier.trim().to_lowercase().as_bytes());
    format!("forgeharbor:auth:login:v1:{kind}:{digest:x}")
}

fn login_rate_limit_keys(email: &str, client_ip: &str) -> (String, String) {
    (rate_limit_key("account", email), rate_limit_key("ip", client_ip))
}

fn signup_rate_limit_key(client_ip: &str) -> String {
    let digest = Sha256::digest(client_ip.trim().to_lowercase().as_bytes());
    format!("forgeharbor:auth:signup:v1:ip:{digest:x}")
}

fn session_revocation_key(jti: &str) -> String {
    let digest = Sha256::digest(jti.as_bytes());
    format!("forgeharbor:auth:revoked:v1:jti:{digest:x}")
}

async fn revoke_token(
    connection: &mut ConnectionManager,
    jti: &str,
    ttl_seconds: usize,
) -> Result<(), redis::RedisError> {
    let ttl_seconds = ttl_seconds.min(i64::MAX as usize) as i64;
    let _: String = redis::cmd("SET")
        .arg(session_revocation_key(jti))
        .arg("1")
        .arg("EX")
        .arg(ttl_seconds)
        .query_async(connection)
        .await?;
    Ok(())
}

async fn is_token_revoked(
    connection: &mut ConnectionManager,
    jti: &str,
) -> Result<bool, redis::RedisError> {
    redis::cmd("EXISTS")
        .arg(session_revocation_key(jti))
        .query_async(connection)
        .await
}

fn parse_trusted_proxy_ips(value: &str) -> Result<HashSet<IpAddr>, ()> {
    value
        .split(',')
        .map(str::trim)
        .filter(|address| !address.is_empty())
        .map(|address| address.parse::<IpAddr>().map_err(|_| ()))
        .collect()
}

fn client_ip_from_request(request: &HttpRequest, trusted_proxy_ips: &HashSet<IpAddr>) -> String {
    let peer = request.peer_addr().map(|address| address.ip());
    let forwarded = peer
        .filter(|address| trusted_proxy_ips.contains(address))
        .and_then(|_| request.headers().get("x-forwarded-for"))
        .and_then(|value| value.to_str().ok())
        .and_then(|values| {
            values
                .split(',')
                .rev()
                .find_map(|value| value.trim().parse::<IpAddr>().ok())
        });
    forwarded
        .or(peer)
        .map(|address| address.to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

async fn consume_login_attempt(
    connection: &mut ConnectionManager,
    account_key: &str,
    ip_key: &str,
) -> Result<(i64, i64, i64), redis::RedisError> {
    redis::Script::new(LOGIN_RATE_LIMIT_SCRIPT)
        .key(account_key)
        .key(ip_key)
        .arg(LOGIN_WINDOW_SECONDS)
        .arg(LOGIN_MAX_ATTEMPTS)
        .arg(LOGIN_IP_MAX_ATTEMPTS)
        .invoke_async(connection)
        .await
}

async fn consume_signup_attempt(
    connection: &mut ConnectionManager,
    key: &str,
) -> Result<(i64, i64), redis::RedisError> {
    redis::Script::new(SIGNUP_RATE_LIMIT_SCRIPT)
        .key(key)
        .arg(SIGNUP_WINDOW_SECONDS)
        .invoke_async(connection)
        .await
}

async fn clear_login_attempts(
    connection: &mut ConnectionManager,
    key: &str,
) -> Result<(), redis::RedisError> {
    let _: i64 = redis::cmd("DEL").arg(key).query_async(connection).await?;
    Ok(())
}

async fn me(state: web::Data<AppState>, request: HttpRequest) -> Result<HttpResponse> {
    println!("Current-user request received");
    let Some(token) = request_token(&request) else {
        return Ok(HttpResponse::Unauthorized().json(ErrorResponse { error: "Authentication required".to_string() }));
    };
    let claims = match decode::<Claims>(&token, &state.jwt_decoding_key, &jwt_validation()) {
        Ok(data) if !data.claims.sub.trim().is_empty() => data.claims,
        _ => return Ok(HttpResponse::Unauthorized().json(ErrorResponse { error: "Invalid token".to_string() })),
    };
    if let Some(jti) = claims.jti.as_deref() {
        let mut connection = state.redis.clone();
        match is_token_revoked(&mut connection, jti).await {
            Ok(true) => return Ok(HttpResponse::Unauthorized().json(ErrorResponse { error: "Invalid token".to_string() })),
            Ok(false) => {}
            Err(_) => {
                eprintln!("Session revocation store unavailable");
                return Ok(HttpResponse::ServiceUnavailable()
                    .insert_header(("Retry-After", "1"))
                    .json(ErrorResponse { error: "Authentication temporarily unavailable".to_string() }));
            }
        }
    }
    let collection = state.db.collection::<User>("users");
    let version = match collection.find_one(doc! { "user_id": &claims.sub }).await {
        Ok(Some(user)) => user.mfa.version,
        Ok(None) => String::new(),
        Err(_) => return Ok(HttpResponse::ServiceUnavailable().json(ErrorResponse { error: "Authentication temporarily unavailable".to_string() })),
    };
    if claims.auth_version.as_deref().unwrap_or("") != version {
        return Ok(HttpResponse::Unauthorized().json(ErrorResponse { error: "Sign in again to verify your account".to_string() }));
    }
    Ok(HttpResponse::Ok().insert_header(("Cache-Control", "no-store")).json(UserResponse {
        user_id: claims.sub,
        email: claims.email,
    }))
}

fn jwt_validation() -> Validation {
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[env::var("JWT_ISSUER").unwrap_or_else(|_| "forgeharbor".to_string())]);
    validation.set_audience(&[env::var("JWT_AUDIENCE").unwrap_or_else(|_| "forgeharbor-users".to_string())]);
    validation
}

async fn jwks(state: web::Data<AppState>) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(&state.jwks))
}

fn rsa_public_components_from_pem(pem: &str) -> Result<(Vec<u8>, Vec<u8>), &'static str> {
    let encoded = pem
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with("-----"))
        .collect::<String>();
    let der = STANDARD.decode(encoded).map_err(|_| "Invalid JWT public key encoding")?;
    let mut offset = 0;
    let spki = read_der_value(&der, &mut offset, 0x30)?;
    if offset != der.len() {
        return Err("Trailing data in JWT public key");
    }
    let mut spki_offset = 0;
    let _algorithm = read_der_value(spki, &mut spki_offset, 0x30)?;
    let bit_string = read_der_value(spki, &mut spki_offset, 0x03)?;
    if spki_offset != spki.len() || bit_string.first() != Some(&0) {
        return Err("Invalid RSA SubjectPublicKeyInfo");
    }

    let rsa_der = &bit_string[1..];
    let mut rsa_offset = 0;
    let rsa_key = read_der_value(rsa_der, &mut rsa_offset, 0x30)?;
    if rsa_offset != rsa_der.len() {
        return Err("Trailing data in RSA public key");
    }
    let mut key_offset = 0;
    let modulus = normalize_der_integer(read_der_value(rsa_key, &mut key_offset, 0x02)?)?;
    let exponent = normalize_der_integer(read_der_value(rsa_key, &mut key_offset, 0x02)?)?;
    if key_offset != rsa_key.len() {
        return Err("Trailing data in RSA public key parameters");
    }
    Ok((modulus, exponent))
}

fn read_der_value<'a>(input: &'a [u8], offset: &mut usize, expected_tag: u8) -> Result<&'a [u8], &'static str> {
    if input.get(*offset) != Some(&expected_tag) {
        return Err("Unexpected JWT public key structure");
    }
    *offset += 1;
    let first_length = *input.get(*offset).ok_or("Truncated JWT public key")?;
    *offset += 1;
    let length = if first_length & 0x80 == 0 {
        first_length as usize
    } else {
        let length_bytes = (first_length & 0x7f) as usize;
        if length_bytes == 0 || length_bytes > 4 || input.len().saturating_sub(*offset) < length_bytes {
            return Err("Invalid JWT public key length");
        }
        let mut length = 0usize;
        for byte in &input[*offset..*offset + length_bytes] {
            length = length.checked_mul(256).and_then(|value| value.checked_add(*byte as usize))
                .ok_or("Invalid JWT public key length")?;
        }
        *offset += length_bytes;
        if length < 128 {
            return Err("Non-canonical JWT public key length");
        }
        length
    };
    let end = (*offset).checked_add(length).ok_or("Invalid JWT public key length")?;
    let value = input.get(*offset..end).ok_or("Truncated JWT public key")?;
    *offset = end;
    Ok(value)
}

fn normalize_der_integer(integer: &[u8]) -> Result<Vec<u8>, &'static str> {
    if integer.is_empty()
        || integer[0] & 0x80 != 0
        || (integer.len() > 1 && integer[0] == 0 && integer[1] & 0x80 == 0)
    {
        return Err("Invalid RSA public key integer");
    }
    let normalized = integer.strip_prefix(&[0]).unwrap_or(integer);
    if normalized.is_empty() || normalized.iter().all(|byte| *byte == 0) {
        return Err("Invalid RSA public key integer");
    }
    Ok(normalized.to_vec())
}

fn build_jwks(public_key_pem: &str) -> Result<JsonWebKeySet, &'static str> {
    let (modulus, exponent) = rsa_public_components_from_pem(public_key_pem)?;
    let n = URL_SAFE_NO_PAD.encode(modulus);
    let e = URL_SAFE_NO_PAD.encode(exponent);
    // RFC 7638 requires lexicographic member ordering in the thumbprint input.
    let thumbprint_input = serde_json::json!({"e": e, "kty": "RSA", "n": n}).to_string();
    let kid = URL_SAFE_NO_PAD.encode(Sha256::digest(thumbprint_input.as_bytes()));
    Ok(JsonWebKeySet {
        keys: vec![JsonWebKey { kty: "RSA", key_use: "sig", alg: "RS256", kid, n, e }],
    })
}

fn signing_header(key_id: &str) -> Header {
    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some(key_id.to_owned());
    header
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt::init();

    // Uncomment this when running locally as docker loads env via env_path flag
    // println!("Attempting to load .env file from config directory...");
    // match dotenvy::from_path("../config/.env") {
    //     Ok(_) => println!("Successfully loaded .env file from config/.env"),
    //     Err(e) => println!("Could not load .env file from config directory: {}. Ensure the file exists at ForgeHarbor/config/.env", e),
    // };

    let mongo_uri = env::var("MONGO_URI").expect("MONGO_URI must be set in .env file");
    println!("Connecting to MongoDB");

    let client = Client::with_uri_str(&mongo_uri).await
        .expect("Failed to connect to MongoDB - is Docker running?");
    let db = client.database("forgeharbor");

    let redis_url = env::var("REDIS_URL").expect("REDIS_URL must be set");
    let redis_client = match redis::Client::open(redis_url) {
        Ok(client) => client,
        Err(_) => {
            eprintln!("Redis URL configuration is invalid");
            return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "Redis configuration invalid"));
        }
    };
    let redis = match redis_client.get_connection_manager().await {
        Ok(connection) => connection,
        Err(_) => {
            eprintln!("Redis connection failed");
            return Err(std::io::Error::new(std::io::ErrorKind::ConnectionRefused, "Rate limiter unavailable"));
        }
    };

    match db.run_command(doc! {"ping": 1}).await {
        Ok(_) => println!("MongoDB connection successful!"),
        Err(_) => {
            eprintln!("MongoDB connection failed");
            return Err(std::io::Error::new(std::io::ErrorKind::ConnectionRefused, "Database connection failed"));
        }
    }

    let email_index = IndexModel::builder()
        .keys(doc! { "email": 1 })
        .options(
            IndexOptions::builder()
                .name("users_email_case_insensitive_unique".to_string())
                .unique(true)
                .collation(email_collation())
                .build(),
        )
        .build();
    if db.collection::<User>("users").create_index(email_index).await.is_err() {
        eprintln!("Unable to ensure case-insensitive unique Auth email index; resolve case-variant duplicate account records");
        return Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            "Auth email index setup failed",
        ));
    }
    println!("Auth email uniqueness index is ready");

    // JWT Keys - Load from config directory
    println!("Loading JWT keys from config directory...");
    let public_key_pem = match fs::read_to_string("./config/jwt-public.pem") {
        Ok(key) => {
            println!("JWT public key loaded successfully");
            key
        },
        Err(e) => {
            eprintln!("JWT public key file not found: {}", e);
            std::process::exit(1);
        }
    };

    let private_key_pem = match fs::read_to_string("./config/jwt-private.pem") {
        Ok(key) => {
            println!("JWT private key loaded successfully");
            key
        },
        Err(e) => {
            eprintln!("JWT private key file not found: {}", e);
            std::process::exit(1);
        }
    };

    let jwt_encoding_key = EncodingKey::from_rsa_pem(private_key_pem.as_bytes())
        .expect("Invalid JWT private key format");

    let jwt_decoding_key = DecodingKey::from_rsa_pem(public_key_pem.as_bytes())
        .expect("Invalid JWT public key format");
    let jwks_document = build_jwks(&public_key_pem)
        .expect("JWT public key cannot be represented as a standard RSA JWK");

    println!("JWT keys loaded successfully!");

    let password_jobs = PasswordJobs::new(2);
    println!("Bounded Argon2 worker pool initialized");
    let breached_passwords = BreachedPasswordChecker::new()
        .expect("Could not initialize compromised password screening client");
    println!("Privacy-preserving password screening initialized");

    let trusted_proxy_ips = match env::var("AUTH_TRUSTED_PROXY_IPS") {
        Ok(value) => match parse_trusted_proxy_ips(&value) {
            Ok(ips) => ips,
            Err(_) => {
                eprintln!("Auth trusted proxy IP configuration is invalid");
                return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "Trusted proxy configuration invalid"));
            }
        },
        Err(_) => HashSet::new(),
    };
    println!("Auth trusted proxy IP allowlist loaded");

    let app_state = web::Data::new(AppState {
        db,
        redis,
        jwt_encoding_key,
        jwt_decoding_key,
        password_jobs,
        breached_passwords,
        trusted_proxy_ips,
        jwks: jwks_document,
    });

    println!("Auth service starting on http://localhost:8080");

    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .app_data(web::JsonConfig::default().limit(AUTH_JSON_LIMIT).error_handler(|error, _| {
                use actix_web::ResponseError;
                let response = HttpResponse::build(error.status_code())
                    .json(ErrorResponse { error: "Invalid JSON request or request body too large".to_string() });
                actix_web::error::InternalError::from_response(error, response).into()
            }))
            .wrap(Logger::default())
            .wrap(build_cors())
            // Gateway contract: the public prefix is part of every service route.
            // Traefik does not strip it, so direct-port paths match gateway paths.
            .service(
                web::scope("/auth")
                    .route("/health", web::get().to(health))
                    .route("/signup", web::post().to(signup))
                    .route("/login", web::post().to(login))
                    .route("/logout", web::post().to(logout))
                    .route("/jwks", web::get().to(jwks))
                    .route("/me", web::get().to(me))
            )
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}

fn build_cors() -> Cors {
    let configured = env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:8088,http://localhost:3000".to_string());
    let mut cors = Cors::default()
        .allowed_methods(["GET", "POST", "OPTIONS"])
        .allowed_headers(["authorization", "content-type"]);
    for origin in configured.split(',').map(str::trim).filter(|origin| !origin.is_empty()) {
        cors = cors.allowed_origin(origin);
    }
    cors
}

#[cfg(test)]
mod rate_limit_tests {
    use super::{
        client_ip_from_request, email_collation, login_rate_limit_keys, normalize_email, parse_trusted_proxy_ips,
        signup_rate_limit_key, LOGIN_IP_MAX_ATTEMPTS, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SECONDS,
        SIGNUP_IP_MAX_ATTEMPTS, SIGNUP_WINDOW_SECONDS,
    };
    use mongodb::bson;
    use std::net::{IpAddr, SocketAddr};
    use std::str::FromStr;
    use std::collections::HashSet;

    #[test]
    fn rate_limit_keys_hide_identifiers_and_normalize_case() {
        let first = login_rate_limit_keys("  Example.User@example.invalid ", "192.0.2.10");
        let second = login_rate_limit_keys("example.user@example.invalid", "192.0.2.10");
        assert_eq!(first, second);
        assert!(!first.0.contains("example.user"));
        assert!(!first.1.contains("192.0.2.10"));
    }

    #[test]
    fn rate_limit_window_and_attempt_threshold_are_bounded() {
        assert_eq!(LOGIN_MAX_ATTEMPTS, 5);
        assert_eq!(LOGIN_IP_MAX_ATTEMPTS, 60);
        assert_eq!(LOGIN_WINDOW_SECONDS, 900);
    }

    #[test]
    fn signup_rate_limit_is_per_ip_and_bounded_to_a_fifteen_minute_window() {
        assert_eq!(SIGNUP_IP_MAX_ATTEMPTS, 20);
        assert_eq!(SIGNUP_WINDOW_SECONDS, 900);
        let key = signup_rate_limit_key("198.51.100.77");
        assert!(key.starts_with("forgeharbor:auth:signup:v1:ip:"));
        assert!(!key.contains("198.51.100.77"));
    }

    #[test]
    fn email_identity_is_ascii_case_insensitive() {
        assert_eq!(normalize_email("Codex.User@Example.Invalid"), "codex.user@example.invalid");
        let collation = bson::to_document(&email_collation()).unwrap();
        assert_eq!(collation.get_str("locale").unwrap(), "en");
        assert_eq!(collation.get_i32("strength").unwrap(), 2);
    }

    #[test]
    fn untrusted_peer_cannot_select_the_ip_rate_limit_bucket() {
        let request = actix_web::test::TestRequest::default()
            .peer_addr(SocketAddr::from(([192, 0, 2, 10], 8080)))
            .insert_header(("x-forwarded-for", "198.51.100.42, 10.0.0.4"))
            .to_http_request();
        assert_eq!(client_ip_from_request(&request, &HashSet::new()), "192.0.2.10");
    }

    #[test]
    fn explicitly_trusted_proxy_may_forward_a_client_ip() {
        let request = actix_web::test::TestRequest::default()
            .peer_addr(SocketAddr::from(([10, 0, 0, 4], 443)))
            .insert_header(("x-forwarded-for", "198.51.100.42"))
            .to_http_request();
        let trusted = HashSet::from([IpAddr::from_str("10.0.0.4").unwrap()]);
        assert_eq!(client_ip_from_request(&request, &trusted), "198.51.100.42");
    }

    #[test]
    fn malformed_trusted_proxy_allowlist_fails_closed() {
        assert!(parse_trusted_proxy_ips("10.0.0.4,not-an-ip").is_err());
        assert!(parse_trusted_proxy_ips("10.0.0.4, 2001:db8::1").is_ok());
    }
}

#[cfg(test)]
mod password_capacity_response_tests {
    use super::{password_error_response, PasswordError};
    use actix_web::http::StatusCode;

    #[test]
    fn saturated_hash_pool_returns_retryable_service_unavailable() {
        let response = password_error_response(PasswordError::Busy);
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(response.headers().get("Retry-After").unwrap(), "1");
    }

    #[test]
    fn unexpected_hash_failure_does_not_expose_stored_hash_details() {
        let response = password_error_response(PasswordError::Failed);
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }
}

#[cfg(test)]
mod password_screening_response_tests {
    use super::password_screening_unavailable_response;
    use actix_web::http::StatusCode;

    #[test]
    fn screening_outage_fails_closed_with_retry_after() {
        let response = password_screening_unavailable_response();
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(response.headers().get("Retry-After").unwrap(), "30");
    }
}

#[cfg(test)]
mod session_cookie_tests {
    use super::{request_token, session_cookie_with_secure};

    #[test]
    fn production_cookie_is_secure_http_only_and_strict_same_site() {
        let cookie = session_cookie_with_secure("signed.jwt.value", 3600, true);
        assert_eq!(cookie, "fh_access=signed.jwt.value; Max-Age=3600; Path=/; HttpOnly; SameSite=Strict; Secure");
    }

    #[test]
    fn auth_me_accepts_cookie_and_keeps_explicit_bearer_precedence() {
        let cookie_only = actix_web::test::TestRequest::default()
            .insert_header(("cookie", "other=value; fh_access=cookie-token"))
            .to_http_request();
        assert_eq!(request_token(&cookie_only).as_deref(), Some("cookie-token"));

        let both = actix_web::test::TestRequest::default()
            .insert_header(("cookie", "fh_access=cookie-token"))
            .insert_header(("authorization", "Bearer api-token"))
            .to_http_request();
        assert_eq!(request_token(&both).as_deref(), Some("api-token"));
    }
}

#[cfg(test)]
mod jwks_tests {
    use super::{build_jwks, normalize_der_integer, signing_header};
    use base64::{engine::general_purpose::STANDARD, Engine};

    fn fixture_public_key_pem() -> String {
        // Minimal valid SubjectPublicKeyInfo carrying RSA n=128 and e=3.
        let der = [
            0x30, 0x1b, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01,
            0x01, 0x01, 0x05, 0x00, 0x03, 0x0a, 0x00, 0x30, 0x07, 0x02, 0x02, 0x00, 0x80,
            0x02, 0x01, 0x03,
        ];
        format!("-----BEGIN PUBLIC KEY-----\n{}\n-----END PUBLIC KEY-----", STANDARD.encode(der))
    }

    #[test]
    fn publishes_standard_rsa_jwk_with_stable_thumbprint() {
        let jwks = build_jwks(&fixture_public_key_pem()).expect("fixture key should parse");
        let key = &jwks.keys[0];
        assert_eq!(jwks.keys.len(), 1);
        assert_eq!(key.kty, "RSA");
        assert_eq!(key.key_use, "sig");
        assert_eq!(key.alg, "RS256");
        assert_eq!(key.n, "gA");
        assert_eq!(key.e, "Aw");
        assert_eq!(key.kid.len(), 43);
        assert_eq!(signing_header(&key.kid).kid.as_deref(), Some(key.kid.as_str()));
        assert_eq!(
            serde_json::to_value(&jwks).unwrap()["keys"][0]["kid"],
            serde_json::to_value(&build_jwks(&fixture_public_key_pem()).unwrap()).unwrap()["keys"][0]["kid"]
        );
    }

    #[test]
    fn rejects_non_rsa_or_malformed_public_key_pem() {
        assert!(build_jwks("not a PEM public key").is_err());
        assert!(build_jwks("-----BEGIN RSA PUBLIC KEY-----\nAA==\n-----END RSA PUBLIC KEY-----").is_err());
        assert!(normalize_der_integer(&[0, 0x7f]).is_err());
        assert!(normalize_der_integer(&[0x80]).is_err());
    }
}

#[cfg(test)]
mod session_revocation_tests {
    use super::{session_revocation_key, Claims};

    #[test]
    fn revocation_key_hashes_the_token_id() {
        let key = session_revocation_key("fixture-jti-value");
        assert!(key.starts_with("forgeharbor:auth:revoked:v1:jti:"));
        assert!(!key.contains("fixture-jti-value"));
    }

    #[test]
    fn legacy_tokens_without_jti_remain_readable_during_rollout() {
        let claims: Claims = serde_json::from_value(serde_json::json!({
            "sub": "fixture-user",
            "email": "fixture@example.invalid",
            "iss": "forgeharbor",
            "aud": "forgeharbor-users",
            "iat": 1,
            "exp": 4_000_000_000usize
        })).unwrap();
        assert!(claims.jti.is_none());
    }
}
