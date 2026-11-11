use actix_cors::Cors;
use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder, Error, HttpMessage, body::MessageBody, dev::ServiceResponse, middleware::{Next, from_fn}};
use actix_web::dev::{ServiceRequest, Payload};
use actix_web::FromRequest;
use actix_web_httpauth::extractors::bearer::BearerAuth;
// use dotenvy::dotenv;
use futures_util::future::{self, Ready};
use serde::{Deserialize, Serialize};
use serde_json::json;
use mongodb::{bson::doc, Client, Collection, Database};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use chrono::Utc;
use std::{env, fs};

async fn cookie_bearer_middleware(
    mut req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<impl MessageBody>, Error> {
    if !req.headers().contains_key("authorization") {
        if let Some(cookie) = req.request().cookie("fh_access") {
            let value = actix_web::http::header::HeaderValue::from_str(&format!("Bearer {}", cookie.value()))
                .map_err(actix_web::error::ErrorBadRequest)?;
            req.headers_mut().insert(actix_web::http::header::AUTHORIZATION, value);
        }
    }
    next.call(req).await
}

// ===== Models =====

#[derive(Debug, Deserialize)]
pub struct CheckUrlRequest {
    pub url: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AnalysisResult {
    pub phishing: bool,
    pub confidence: f32,
    pub reason: String,
    #[serde(default)]
    pub risk_level: String,
}

#[derive(Serialize)]
pub struct UrlApiResponse {
    pub status: String,
    pub result: AnalysisResult,
}

// DB Scan record
#[derive(Debug, Serialize, Deserialize)]
pub struct ScanRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    id: Option<mongodb::bson::oid::ObjectId>,
    user_id: String,
    scan_type: String,
    input: String,
    result: AnalysisResult,
    created_at: chrono::DateTime<Utc>,
}

// ===== Auth Claims =====
#[derive(Debug, Deserialize)]
struct Claims {
    sub: String,
    #[allow(dead_code)]
    email: String,
    #[allow(dead_code)]
    iss: String,
    #[allow(dead_code)]
    aud: String,
    #[allow(dead_code)]
    exp: usize,
    #[allow(dead_code)]
    iat: usize,
}

// Extracted AuthUser
#[derive(Clone)]
struct AuthUser {
    user_id: String,
    #[allow(dead_code)]
    email: String,
}

impl FromRequest for AuthUser {
    type Error = Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &actix_web::HttpRequest, _: &mut Payload) -> Self::Future {
        let auth_result = req.extensions().get::<AuthUser>().cloned();
        future::ready(
            auth_result.ok_or_else(|| actix_web::error::ErrorUnauthorized("Authentication required"))
        )
    }
}

// ===== AppState =====
#[derive(Clone)]
struct AppState {
    db: Database,
    gemini_key: String,
    jwt_decoding_key: DecodingKey,
}

impl AppState {
    fn scans_collection(&self) -> Collection<ScanRecord> {
        self.db.collection("scans")
    }
}

// ===== Gemini API structs =====
#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Vec<Candidate>,
}

#[derive(Debug, Deserialize)]
struct Candidate {
    content: Content,
}

#[derive(Debug, Deserialize)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Debug, Deserialize)]
struct Part {
    text: String,
}

// ===== Logic: Call Gemini =====
async fn check_phishing_with_gemini(
    url: &str,
    api_key: &str,
) -> Result<AnalysisResult, Box<dyn std::error::Error>> {
    let prompt = format!(
        "Analyze this URL for phishing. Respond ONLY with JSON: {{\"phishing\": bool, \"confidence\": float, \"reason\": string}}. URL: {}",
        url
    );

    let body = json!({ "contents": [{ "parts": [{ "text": prompt }] }] });
    let client = gemini_client()?;
    let request = build_gemini_request(&client, api_key, &body)?;
    let res = client.execute(request).await?;
    let status = res.status();
    let raw_text = res.text().await?;

    if status.is_success() {
        let gemini_response: GeminiResponse = serde_json::from_str(&raw_text)?;
        if let Some(candidate) = gemini_response.candidates.first() {
            if let Some(part) = candidate.content.parts.first() {
                // Extract JSON from markdown code blocks if present
                let json_text = if part.text.trim().starts_with("```json") {
                    part.text
                        .trim()
                        .strip_prefix("```json")
                        .and_then(|s| s.strip_suffix("```"))
                        .unwrap_or(&part.text)
                        .trim()
                } else if part.text.trim().starts_with("```") {
                    part.text
                        .trim()
                        .strip_prefix("```")
                        .and_then(|s| s.strip_suffix("```"))
                        .unwrap_or(&part.text)
                        .trim()
                } else {
                    &part.text
                };
                
                let analysis: AnalysisResult = serde_json::from_str(json_text)
                    .map_err(|e| format!("Parse JSON failed: {}. Raw: {}", e, part.text))?;
                return Ok(analysis);
            }
        }
        Err("No valid response content".into())
    } else {
        Err(format!("Gemini API error {}: {}", status, raw_text).into())
    }
}

fn gemini_client() -> Result<reqwest::Client, reqwest::Error> {
    // Reqwest 0.13 with rustls-no-provider requires explicit provider selection.
    let _ = rustls::crypto::ring::default_provider().install_default();
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
}

fn build_gemini_request(
    client: &reqwest::Client,
    api_key: &str,
    body: &serde_json::Value,
) -> Result<reqwest::Request, reqwest::Error> {
    client
        .post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent")
        .header("x-goog-api-key", api_key)
        .json(body)
        .build()
}

// ===== Handlers =====
#[post("/phishing/v1/url/check")]
async fn check_url_handler(
    req: web::Json<CheckUrlRequest>,
    state: web::Data<AppState>,
    user: AuthUser,
) -> impl Responder {
    match check_phishing_with_gemini(&req.url, &state.gemini_key).await {
        Ok(mut analysis) => {
            analysis.risk_level = if analysis.phishing { "high" } else { "low" }.to_string();
            // save to DB
            let record = ScanRecord {
                id: None,
                user_id: user.user_id.clone(),
                scan_type: "url".to_string(),
                input: req.url.clone(),
                result: analysis.clone(),
                created_at: Utc::now(),
            };
            if let Err(e) = state.scans_collection().insert_one(&record).await {
                eprintln!("DB insert error: {}", e);
            }

            HttpResponse::Ok().json(UrlApiResponse {
                status: "success".to_string(),
                result: analysis,
            })
        }
        Err(e) => HttpResponse::InternalServerError().json(UrlApiResponse {
            status: "error".to_string(),
            result: AnalysisResult {
                phishing: true,
                confidence: 0.0,
                reason: e.to_string(),
                risk_level: "unknown".to_string(),
            },
        }),
    }
}

#[get("/phishing/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().body("phishing-rs is healthy")
}

// ===== JWT Middleware =====
async fn jwt_middleware(
    req: ServiceRequest,
    credentials: BearerAuth,
) -> Result<ServiceRequest, (Error, ServiceRequest)> {
    let token = credentials.token();

    let state = req.app_data::<web::Data<AppState>>().unwrap();
    let decoding_key = &state.jwt_decoding_key;

    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[env::var("JWT_ISSUER").unwrap_or("forgeharbor".into())]);
    validation.set_audience(&[env::var("JWT_AUDIENCE").unwrap_or("forgeharbor-users".into())]);

    match decode::<Claims>(token, decoding_key, &validation) {
        Ok(token_data) => {
            req.extensions_mut().insert(AuthUser {
                user_id: token_data.claims.sub,
                email: token_data.claims.email,
            });
            Ok(req)
        }
        Err(e) => {
            eprintln!("JWT validation failed: {}", e);
            Err((actix_web::error::ErrorUnauthorized("Invalid token"), req))
        }
    }
}

// ===== Main =====
#[actix_web::main]
async fn main() -> std::io::Result<()> {

    // Uncomment this when running locally as docker loads env via env_path flag
    // println!("Attempting to load .env file from config directory...");
    // match dotenvy::from_path("../config/.env") {
    //     Ok(_) => println!("Successfully loaded .env file from config/.env"),
    //     Err(e) => println!("Could not load .env file from config directory: {}. Ensure the file exists at ForgeHarbor/config/.env", e),
    // };

    // MongoDB
    let mongo_uri = env::var("MONGO_URI").expect("MONGO_URI must be set in your config/.env file");
    let client = Client::with_uri_str(&mongo_uri).await.expect("MongoDB connect failed");
    let db = client.database("forgeharbor");

    // JWT Keys - Load from config directory
    println!("Loading JWT public key from config directory...");
    let public_key_pem = fs::read_to_string("./config/jwt-public.pem")
        .expect("JWT public key file not found. Please ensure jwt-public.pem is in the config/ directory");
    let jwt_decoding_key = DecodingKey::from_rsa_pem(public_key_pem.as_bytes())
        .expect("Invalid JWT public key format");
    println!("JWT public key loaded successfully!");

    let state = web::Data::new(AppState {
        db,
        gemini_key: env::var("GEMINI_API_KEY").expect("GEMINI_API_KEY missing from your config/.env file"),
        jwt_decoding_key,
    });

    println!("phishing-rs running at http://localhost:8081");

    HttpServer::new(move || {
        let cors = build_cors();

        App::new()
            .app_data(state.clone())
            .wrap(cors)
            .service(health)
            .service(
                web::scope("")
                    .wrap(actix_web_httpauth::middleware::HttpAuthentication::bearer(jwt_middleware))
                    .wrap(from_fn(cookie_bearer_middleware))
                    .service(check_url_handler)
            )
    })
    .bind(("0.0.0.0", 8081))?
    .run()
    .await
}

#[cfg(test)]
mod tests {
    use super::{build_gemini_request, gemini_client};

    #[test]
    fn gemini_api_key_is_sent_in_header_not_url() {
        let client = gemini_client().expect("TLS provider and client must initialize");
        let request = build_gemini_request(&client, "test-key", &serde_json::json!({})).unwrap();
        assert_eq!(request.url().query(), None);
        assert_eq!(request.headers().get("x-goog-api-key").unwrap(), "test-key");
    }
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
