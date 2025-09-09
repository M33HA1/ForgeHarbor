use actix_web::{
    dev::{ServiceRequest, Payload},
    web, App, Error, FromRequest, HttpMessage, HttpResponse, HttpServer, Result,
    middleware::Logger,
};
use actix_cors::Cors;
use actix_web_httpauth::extractors::bearer::BearerAuth;
use serde::{Deserialize, Serialize};
use mongodb::{bson::doc, Client, Collection, Database};
use jsonwebtoken::{encode, decode, Header, Algorithm, Validation, EncodingKey, DecodingKey};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use uuid::Uuid;
use chrono::{DateTime, Utc, Duration};
use std::{env, future::{self, Ready}};
use std::fs;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct User {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    id: Option<mongodb::bson::oid::ObjectId>,
    user_id: String,
    email: String,
    password_hash: String,
    created_at: DateTime<Utc>,
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
    access_token: String,
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

// JWT Token Structure
#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    email: String,
    iss: String,
    aud: String,
    exp: usize,
    iat: usize,
}

// App State
#[derive(Clone)]
struct AppState {
    db: Database,
    jwt_encoding_key: EncodingKey,
    jwt_decoding_key: DecodingKey,
    argon2: Argon2<'static>,
}

impl AppState {
    fn users_collection(&self) -> Collection<User> {
        self.db.collection("users")
    }
}

#[derive(Clone)]
struct AuthUser {
    user_id: String,
    email: String,
}

impl FromRequest for AuthUser {
    type Error = Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &actix_web::HttpRequest, _: &mut Payload) -> Self::Future {
        let auth_result = req.extensions().get::<AuthUser>().cloned();
        future::ready(
            auth_result.ok_or_else(|| {
                actix_web::error::ErrorUnauthorized("Authentication required")
            })
        )
    }
}

async fn health() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().body("Service is Healthy!"))
}

async fn signup(
    state: web::Data<AppState>,
    req: web::Json<SignupRequest>,
) -> Result<HttpResponse> {
    let collection = state.users_collection();
    println!("New signup attempt for email: {}", req.email);

    // Check if user already exists
    match collection.find_one(doc! { "email": &req.email }).await {
        Ok(Some(_)) => {
            println!("User with email {} already exists", req.email);
            return Ok(HttpResponse::Conflict().json(ErrorResponse {
                error: "User with this email already exists".to_string(),
            }));
        }
        Ok(None) => {
            println!("Email {} is available", req.email);
        }
        Err(e) => {
            println!("Database error during signup: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Database error".to_string(),
            }));
        }
    }

    println!("Hashing password securely...");
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = match state.argon2.hash_password(req.password.as_bytes(), &salt) {
        Ok(hash) => {
            println!("Password hashed successfully");
            hash.to_string()
        }
        Err(e) => {
            println!("Password hashing failed: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Password hashing failed".to_string(),
            }));
        }
    };

    let user = User {
        id: None,
        user_id: Uuid::new_v4().to_string(),
        email: req.email.clone(),
        password_hash,
        created_at: Utc::now(),
    };

    match collection.insert_one(&user).await {
        Ok(_) => {
            println!("User created successfully: {}", req.email);
            Ok(HttpResponse::Created().json(serde_json::json!({
                "message": "User created successfully",
                "user_id": user.user_id
            })))
        }
        Err(e) => {
            println!("Failed to save user: {}", e);
            Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Failed to create user".to_string(),
            }))
        }
    }
}

async fn login(
    state: web::Data<AppState>,
    req: web::Json<LoginRequest>,
) -> Result<HttpResponse> {
    let collection = state.users_collection();
    println!("Login attempt for email: {}", req.email);

    let user = match collection.find_one(doc! { "email": &req.email }).await {
        Ok(Some(user)) => {
            println!("User found: {}", req.email);
            user
        }
        Ok(None) => {
            println!("User not found: {}", req.email);
            return Ok(HttpResponse::Unauthorized().json(ErrorResponse {
                error: "Invalid email or password".to_string(),
            }));
        }
        Err(e) => {
            println!("Database error during login: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Database error".to_string(),
            }));
        }
    };

    println!("Verifying password...");
    let parsed_hash = match PasswordHash::new(&user.password_hash) {
        Ok(hash) => hash,
        Err(e) => {
            println!("Invalid stored password hash: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Internal authentication error".to_string(),
            }));
        }
    };

    match state.argon2.verify_password(req.password.as_bytes(), &parsed_hash) {
        Ok(_) => {
            println!("Password verified for: {}", req.email);
        }
        Err(_) => {
            println!("Invalid password for: {}", req.email);
            return Ok(HttpResponse::Unauthorized().json(ErrorResponse {
                error: "Invalid email or password".to_string(),
            }));
        }
    }

    println!("Creating JWT token...");
    let now = Utc::now();
    let claims = Claims {
        sub: user.user_id.clone(),
        email: user.email.clone(),
        iss: env::var("JWT_ISSUER").unwrap_or_else(|_| "forgeharbor".to_string()),
        aud: env::var("JWT_AUDIENCE").unwrap_or_else(|_| "forgeharbor-users".to_string()),
        exp: (now + Duration::hours(1)).timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    let token = match encode(&Header::new(Algorithm::RS256), &claims, &state.jwt_encoding_key) {
        Ok(token) => {
            println!("JWT token created for: {}", req.email);
            token
        }
        Err(e) => {
            println!("JWT token creation failed: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Token generation failed".to_string(),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(LoginResponse {
        access_token: token,
        expires_in: 3600,
    }))
}

async fn me(user: AuthUser) -> Result<HttpResponse> {
    println!("User info requested: {}", user.email);
    Ok(HttpResponse::Ok().json(UserResponse {
        user_id: user.user_id,
        email: user.email,
    }))
}

async fn jwks(_state: web::Data<AppState>) -> Result<HttpResponse> {
    // Read the public key from the same location we loaded it during startup
    let jwt_public_key_paths = [
        "../../config/jwt-public.pem",     // From apps/auth/rs/ to config/
        "../config/jwt-public.pem",       // From apps/ to config/
        "config/jwt-public.pem",          // From project root
        "jwt-public.pem",                 // Current directory fallback
    ];

    let public_key_pem = jwt_public_key_paths
        .iter()
        .find_map(|path| {
            match fs::read_to_string(path) {
                Ok(content) => Some(content),
                Err(_) => None,
            }
        })
        .ok_or_else(|| {
            println!("JWKS endpoint: JWT public key file not found");
            actix_web::error::ErrorInternalServerError("Missing public key")
        })?;

    println!("JWKS endpoint accessed - providing public key");

    Ok(HttpResponse::Ok()
        .content_type("application/json")
        .json(serde_json::json!({
            "keys": [{
                "kty": "RSA",
                "use": "sig",
                "alg": "RS256",
                "pem": public_key_pem
            }]
        })))
}

// JWT Middleware
async fn jwt_middleware(
    req: ServiceRequest,
    credentials: BearerAuth,
) -> Result<ServiceRequest, (Error, ServiceRequest)> {
    let token = credentials.token();
    println!("Verifying JWT token...");

    let state = req.app_data::<web::Data<AppState>>().unwrap();
    let decoding_key = &state.jwt_decoding_key;

    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[env::var("JWT_ISSUER").unwrap_or_else(|_| "forgeharbor".to_string())]);
    validation.set_audience(&[env::var("JWT_AUDIENCE").unwrap_or_else(|_| "forgeharbor-users".to_string())]);

    match decode::<Claims>(token, &decoding_key, &validation) {
        Ok(token_data) => {
            println!("Valid JWT token for user: {}", token_data.claims.email);
            req.extensions_mut().insert(AuthUser {
                user_id: token_data.claims.sub,
                email: token_data.claims.email,
            });
            Ok(req)
        }
        Err(e) => {
            println!("Invalid JWT token: {}", e);
            Err((actix_web::error::ErrorUnauthorized("Invalid token"), req))
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::from_filename("../../config/.env").ok();  // force load
    tracing_subscriber::fmt::init();

    let mongo_uri = env::var("MONGO_URI").expect("MONGO_URI must be set in .env file");
    println!("Connecting to MongoDB at: {}", mongo_uri);

    let client = Client::with_uri_str(&mongo_uri).await
        .expect("Failed to connect to MongoDB - is Docker running?");
    let db = client.database("forgeharbor");

    match db.run_command(doc! {"ping": 1}).await {
        Ok(_) => println!("MongoDB connection successful!"),
        Err(e) => {
            println!("MongoDB connection failed: {}", e);
            return Err(std::io::Error::new(std::io::ErrorKind::ConnectionRefused, "Database connection failed"));
        }
    }

    // JWT Keys - Load from config directory
    println!("Loading JWT keys from config directory...");
    
    let jwt_private_key_paths = [
        "../../config/jwt-private.pem",    // From apps/auth/rs/ to config/
        "../config/jwt-private.pem",      // From apps/ to config/
        "config/jwt-private.pem",         // From project root
        "jwt-private.pem",                // Current directory fallback
    ];

    let jwt_public_key_paths = [
        "../../config/jwt-public.pem",     // From apps/auth/rs/ to config/
        "../config/jwt-public.pem",       // From apps/ to config/
        "config/jwt-public.pem",          // From project root
        "jwt-public.pem",                 // Current directory fallback
    ];

    let private_key_pem = jwt_private_key_paths
        .iter()
        .find_map(|path| {
            match fs::read_to_string(path) {
                Ok(content) => {
                    println!("Found JWT private key at: {}", path);
                    Some(content)
                }
                Err(_) => {
                    println!("JWT private key not found at: {}", path);
                    None
                }
            }
        })
        .expect("JWT private key file not found. Please ensure jwt-private.pem is in the config/ directory");

    let public_key_pem = jwt_public_key_paths
        .iter()
        .find_map(|path| {
            match fs::read_to_string(path) {
                Ok(content) => {
                    println!("Found JWT public key at: {}", path);
                    Some(content)
                }
                Err(_) => {
                    println!("JWT public key not found at: {}", path);
                    None
                }
            }
        })
        .expect("JWT public key file not found. Please ensure jwt-public.pem is in the config/ directory");

    let jwt_encoding_key = EncodingKey::from_rsa_pem(private_key_pem.as_bytes())
        .expect("Invalid JWT private key format");

    let jwt_decoding_key = DecodingKey::from_rsa_pem(public_key_pem.as_bytes())
        .expect("Invalid JWT public key format");

    println!("JWT keys loaded successfully!");

    let argon2 = Argon2::default();
    println!("Argon2 password hasher initialized!");

    let app_state = web::Data::new(AppState {
        db,
        jwt_encoding_key,
        jwt_decoding_key,
        argon2,
    });

    println!("Auth service starting on http://localhost:8080");

    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .wrap(Logger::default())
            .wrap(
                Cors::default()
                    .allow_any_origin()
                    .allow_any_method()
                    .allow_any_header()
            )
            .route("/health", web::get().to(health))
            .route("/auth/signup", web::post().to(signup))
            .route("/auth/login", web::post().to(login))
            .route("/auth/jwks", web::get().to(jwks))
            .service(
                web::scope("")
                    .wrap(actix_web_httpauth::middleware::HttpAuthentication::bearer(jwt_middleware))
                    .route("/auth/me", web::get().to(me))
            )
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}