use actix_cors::Cors;
use actix_multipart::Multipart;
use actix_web::{get, post, web, App, Error, HttpMessage, HttpResponse, HttpServer, Responder};
use actix_web::dev::{ServiceRequest, Payload};
use actix_web::FromRequest;
use actix_web_httpauth::extractors::bearer::BearerAuth;
use chrono::Utc;
use futures_util::future::{self, Ready};
use futures_util::{StreamExt, TryStreamExt};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use mongodb::{Client, Collection, Database};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use std::{env, fs};
use tokio::time::sleep;
use dotenvy::dotenv;

// ===== Models =====

// This is the result returned to the user and stored in the DB.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AnalysisResult {
    pub malicious: bool,
    pub vendor_positives: u32,
    pub total_vendors: u32,
    pub report_url: String, // Link to the VirusTotal GUI report
}

// The final JSON response wrapper for the API.
#[derive(Serialize)]
pub struct FileApiResponse {
    pub status: String,
    pub result: AnalysisResult,
}

// The record structure for saving to MongoDB's 'scans' collection.
#[derive(Debug, Serialize, Deserialize)]
pub struct ScanRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    id: Option<mongodb::bson::oid::ObjectId>,
    user_id: String,
    scan_type: String, // Will be "file"
    input: String,     // The original filename
    result: AnalysisResult,
    created_at: chrono::DateTime<Utc>,
}

// ===== Auth & State =====

#[derive(Debug, Deserialize)]
struct Claims {
    sub: String, // User ID
    email: String,
    #[allow(dead_code)] iss: String,
    #[allow(dead_code)] aud: String,
    #[allow(dead_code)] exp: usize,
    #[allow(dead_code)] iat: usize,
}

// User info extracted from the JWT.
#[derive(Clone)]
struct AuthUser {
    user_id: String,
    #[allow(dead_code)] email: String,
}

impl FromRequest for AuthUser {
    type Error = Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &actix_web::HttpRequest, _: &mut Payload) -> Self::Future {
        let extensions = req.extensions();
        let auth_result = extensions.get::<AuthUser>().cloned();
        future::ready(
            auth_result.ok_or_else(|| actix_web::error::ErrorUnauthorized("Authentication required")),
        )
    }
}

// Centralized application state.
#[derive(Clone)]
struct AppState {
    db: Database,
    vt_api_key: String,
    jwt_decoding_key: DecodingKey,
}

impl AppState {
    fn scans_collection(&self) -> Collection<ScanRecord> {
        self.db.collection("scans")
    }
}

// ===== VirusTotal API Structs =====

#[derive(Debug, Deserialize)]
struct VirusTotalUploadResponse {
    data: VirusTotalAnalysisId,
}
#[derive(Debug, Deserialize)]
struct VirusTotalAnalysisId {
    id: String,
}

#[derive(Debug, Deserialize)]
struct VirusTotalReportResponse {
    data: VirusTotalReportData,
}
#[derive(Debug, Deserialize)]
struct VirusTotalReportData {
    attributes: VirusTotalReportAttributes,
}
#[derive(Debug, Deserialize)]
struct VirusTotalReportAttributes {
    stats: VirusTotalStats,
}
#[derive(Debug, Deserialize)]
struct VirusTotalStats {
    malicious: u32,
    suspicious: u32,
    undetected: u32,
    harmless: u32,
}

// ===== Core Logic: VirusTotal Communication =====

async fn analyze_file_with_virustotal(
    file_bytes: Vec<u8>,
    filename: &str,
    api_key: &str,
) -> Result<AnalysisResult, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();
    headers.insert("x-apikey", HeaderValue::from_str(api_key)?);
    headers.insert(ACCEPT, HeaderValue::from_static("application/json"));

    // 1. Upload the file to VirusTotal
    let file_part = reqwest::multipart::Part::bytes(file_bytes).file_name(filename.to_string());
    let form = reqwest::multipart::Form::new().part("file", file_part);

    let upload_res = client
        .post("https://www.virustotal.com/api/v3/files")
        .headers(headers.clone())
        .multipart(form)
        .send()
        .await?;

    if !upload_res.status().is_success() {
        return Err(format!("VirusTotal upload failed: {}", upload_res.text().await?).into());
    }

    let upload_json: VirusTotalUploadResponse = upload_res.json().await?;
    let analysis_id = upload_json.data.id;

    // Extract report URL (SHA256 is the first part of analysis_id)
    let report_id = analysis_id.split('-').next().unwrap_or_default();
    let gui_report_url = format!("https://www.virustotal.com/gui/file/{}", report_id);

    // 2. Wait and retrieve the analysis report
    sleep(Duration::from_secs(20)).await;

    let report_url = format!("https://www.virustotal.com/api/v3/analyses/{}", analysis_id);
    let report_res = client.get(&report_url).headers(headers).send().await?;

    if !report_res.status().is_success() {
        return Err(format!("VirusTotal report retrieval failed: {}", report_res.text().await?).into());
    }

    let report_json: VirusTotalReportResponse = report_res.json().await?;
    let stats = report_json.data.attributes.stats;

    let positives = stats.malicious + stats.suspicious;
    let total_vendors = positives + stats.undetected + stats.harmless;

    Ok(AnalysisResult {
        malicious: positives > 0,
        vendor_positives: positives,
        total_vendors,
        report_url: gui_report_url,
    })
}

// ===== API Handlers =====

#[post("/v1/file/analyze")]
async fn analyze_file_handler(
    mut payload: Multipart,
    state: web::Data<AppState>,
    user: AuthUser,
) -> impl Responder {
    let mut file_bytes = Vec::new();
    let filename;

    if let Ok(Some(mut field)) = payload.try_next().await {
        filename = field
            .content_disposition()
            .and_then(|cd| cd.get_filename())
            .unwrap_or("unknown_file")
            .to_string();

        while let Some(chunk_result) = field.next().await {
            match chunk_result {
                Ok(chunk) => file_bytes.extend_from_slice(&chunk),
                Err(e) => {
                    eprintln!("Error reading chunk: {}", e);
                    return HttpResponse::InternalServerError().json(serde_json::json!({
                        "status": "error",
                        "message": "Error processing file upload"
                    }));
                }
            }
        }
    } else {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "status": "error",
            "message": "File part is missing in multipart request"
        }));
    }

    if file_bytes.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "status": "error",
            "message": "Uploaded file is empty"
        }));
    }

    match analyze_file_with_virustotal(file_bytes, &filename, &state.vt_api_key).await {
        Ok(analysis) => {
            let record = ScanRecord {
                id: None,
                user_id: user.user_id,
                scan_type: "file".to_string(),
                input: filename,
                result: analysis.clone(),
                created_at: Utc::now(),
            };

            if let Err(e) = state.scans_collection().insert_one(record).await {
                eprintln!("Database insert failed: {}", e);
            }

            HttpResponse::Ok().json(FileApiResponse {
                status: "success".to_string(),
                result: analysis,
            })
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "status": "error",
            "message": e.to_string()
        })),
    }
}

#[get("/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().body("malware-rs is healthy")
}

// ===== JWT Middleware =====

async fn jwt_middleware(
    req: ServiceRequest,
    credentials: BearerAuth,
) -> Result<ServiceRequest, (Error, ServiceRequest)> {
    let token = credentials.token();
    let state = req.app_data::<web::Data<AppState>>().unwrap();

    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[env::var("JWT_ISSUER").unwrap_or("forgeharbor".into())]);
    validation.set_audience(&[env::var("JWT_AUDIENCE").unwrap_or("forgeharbor-users".into())]);

    match decode::<Claims>(token, &state.jwt_decoding_key, &validation) {
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
// ===== Main Function =====

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Starting malware-rs service...");

    // Uncomment this when running locally as docker loads env via env_path flag
    // println!("Attempting to load .env file from config directory...");
    // match dotenvy::from_path("../config/.env") {
    //     Ok(_) => println!("Successfully loaded .env file from config/.env"),
    //     Err(e) => println!("Could not load .env file from config directory: {}. Ensure the file exists at ForgeHarbor/config/.env", e),
    // };

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

    let vt_api_key = match env::var("VIRUSTOTAL_API_KEY") {
        Ok(key) => {
            println!("VirusTotal API key loaded successfully");
            key
        },
        Err(e) => {
            eprintln!("VIRUSTOTAL_API_KEY not found: {}", e);
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

    println!("Loading JWT public key...");
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

    let state = web::Data::new(AppState {
        db,
        vt_api_key,
        jwt_decoding_key,
    });

    println!("Starting HTTP server on 0.0.0.0:8082...");

    HttpServer::new(move || {
        let cors = Cors::default().allow_any_origin().allow_any_method().allow_any_header();

        App::new()
            .app_data(state.clone())
            .wrap(cors)
            .service(health)
            .service(
                web::scope("")
                    .wrap(actix_web_httpauth::middleware::HttpAuthentication::bearer(jwt_middleware))
                    .service(analyze_file_handler),
            )
    })
    .bind(("0.0.0.0", 8082))?
    .run()
    .await
}
