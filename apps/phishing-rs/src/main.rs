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

// ===== Logic: Call Gemini =====
async fn check_phishing_with_gemini(
    url: &str,
    api_key: &str,
) -> Result<AnalysisResult, Box<dyn std::error::Error>> {
    let endpoint = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={}",
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
                let analysis: AnalysisResult = serde_json::from_str(&part.text)
                    .map_err(|e| format!("Parse JSON failed: {}. Raw: {}", e, part.text))?;
                return Ok(analysis);
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
    .bind(("0.0.0.0", 8081))?
    .run()
    .await
}