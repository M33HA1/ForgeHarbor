use actix_cors::Cors;
use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder, Error, HttpMessage};
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

// Attempts to extract a pure JSON object string from model output that may
// include markdown code fences or explanatory text.
fn extract_json_from_text(text: &str) -> Option<String> {
    let trimmed = text.trim();

    // Handle fenced code blocks like ```json ... ``` or ``` ... ```
    if trimmed.starts_with("```") {
        // Strip opening fence and optional language tag
        let without_opening = match trimmed.find('\n') {
            Some(idx) => &trimmed[idx + 1..],
            None => return None,
        };
        // Strip closing fence if present
        if let Some(end_idx) = without_opening.rfind("```") {
            let inner = &without_opening[..end_idx];
            return Some(inner.trim().to_string());
        }
        return Some(without_opening.trim().to_string());
    }

    // Fallback: try to take substring from first '{' to last '}'
    if let (Some(start), Some(end)) = (trimmed.find('{'), trimmed.rfind('}')) {
        if end > start {
            return Some(trimmed[start..=end].to_string());
        }
    }

    None
}
// ===== Logic: Call Gemini =====
async fn check_phishing_with_gemini(
    url: &str,
    api_key: &str,
) -> Result<AnalysisResult, Box<dyn std::error::Error>> {
    let endpoint = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        "gemini-2.5-flash",
        api_key
    );

    let prompt = format!(
        "Analyze this URL for phishing. Respond ONLY with JSON: {{\"phishing\": bool, \"confidence\": float, \"reason\": string}}. URL: {}",
        url
    );

    let body = json!({ "contents": [{ "parts": [{ "text": prompt }] }] });
    let client = reqwest::Client::new();
    let res = client.post(&endpoint).json(&body).send().await?;
    let status = res.status();
    let raw_text = res.text().await?;

    if status.is_success() {
        let gemini_response: GeminiResponse = serde_json::from_str(&raw_text)?;
        if let Some(candidate) = gemini_response.candidates.first() {
            if let Some(part) = candidate.content.parts.first() {
                let candidate_text = part.text.trim();
                // Try direct parse first
                if let Ok(parsed) = serde_json::from_str::<AnalysisResult>(candidate_text) {
                    return Ok(parsed);
                }
                // Try to extract JSON from fenced/verbose output
                if let Some(json_str) = extract_json_from_text(candidate_text) {
                    let parsed: AnalysisResult = serde_json::from_str(&json_str)
                        .map_err(|e| format!("Parse JSON failed: {}. Raw: {}", e, candidate_text))?;
                    return Ok(parsed);
                }
            }
        }
        Err("No valid response content".into())
    } else {
        Err(format!("Gemini API error {}: {}", status, raw_text).into())
    }
}

// ===== Handlers =====
#[post("/v1/url/check")]
async fn check_url_handler(
    req: web::Json<CheckUrlRequest>,
    state: web::Data<AppState>,
    user: AuthUser,
) -> impl Responder {
    match check_phishing_with_gemini(&req.url, &state.gemini_key).await {
        Ok(analysis) => {
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
            },
        }),
    }
}

#[get("/health")]
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
    // match dotenvy::from_path("../../config/.env") {
    //     Ok(_) => println!("Successfully loaded .env file from config/.env"),
    //     Err(e) => println!("Could not load .env file from config directory: {}. Ensure the file exists at ForgeHarbor/config/.env", e),
    // };

    // MongoDB
    let mongo_uri = match env::var("MONGO_URI") {
        Ok(uri) => {
            println!("MongoDB URI loaded successfully");
            uri
        },
        Err(e) => {
            eprintln!("MONGO_URI not found: {}", e);
            std::process::exit(1);
        }
    };
    
    println!("Connecting to MongoDB...");
    let client = match Client::with_uri_str(&mongo_uri).await {
        Ok(client) => {
            println!("MongoDB connection established");
            client
        },
        Err(e) => {
            eprintln!("MongoDB connection failed: {}", e);
            std::process::exit(1);
        }
    };
    let db = client.database("forgeharbor");

    // JWT Keys - Load from config directory
    println!("Loading JWT public key from config directory...");
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
    
    let jwt_decoding_key = match DecodingKey::from_rsa_pem(public_key_pem.as_bytes()) {
        Ok(key) => {
            println!("JWT decoding key created successfully");
            key
        },
        Err(e) => {
            eprintln!("Invalid JWT public key format: {}", e);
            std::process::exit(1);
        }
    };

    let gemini_key = match env::var("GEMINI_API_KEY") {
        Ok(key) => {
            println!("GEMINI_API_KEY loaded successfully");
            key
        },
        Err(e) => {
            eprintln!("GEMINI_API_KEY not found: {}", e);
            std::process::exit(1);
        }
    };

    let state = web::Data::new(AppState {
        db,
        gemini_key,
        jwt_decoding_key,
    });

    println!("phishing-rs running at http://localhost:8081");

    let server_result = HttpServer::new(move || {
        let cors = Cors::default().allow_any_origin().allow_any_method().allow_any_header();

        App::new()
            .app_data(state.clone())
            .wrap(cors)
            .service(health)
            .service(
                web::scope("")
                    .wrap(actix_web_httpauth::middleware::HttpAuthentication::bearer(jwt_middleware))
                    .service(check_url_handler)
            )
    })
    .bind(("0.0.0.0", 8081));

    match server_result {
        Ok(server) => {
            println!("Server bound successfully to 0.0.0.0:8081");
            println!("=== SERVER RUNNING ===");
            server.run().await
        }
        Err(e) => {
            eprintln!("Failed to bind server to 0.0.0.0:8081: {}", e);
            std::process::exit(1);
        }
    }
}