use reqwest::{Client, redirect::Policy};
use sha1::{Digest, Sha1};
use std::time::Duration;

const RANGE_API: &str = "https://api.pwnedpasswords.com";
const MAX_RANGE_RESPONSE_BYTES: usize = 256 * 1024;
const USER_AGENT: &str = "ForgeHarbor Auth";

#[derive(Clone)]
pub struct BreachedPasswordChecker {
    client: Client,
    range_api: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum BreachCheckError {
    Unavailable,
    InvalidResponse,
}

impl BreachedPasswordChecker {
    pub fn new() -> Result<Self, reqwest::Error> {
        Self::with_range_api(RANGE_API)
    }

    fn with_range_api(range_api: &str) -> Result<Self, reqwest::Error> {
        let _ = rustls::crypto::ring::default_provider().install_default();
        let client = Client::builder()
            .timeout(Duration::from_secs(4))
            .redirect(Policy::none())
            .build()?;
        Ok(Self {
            client,
            range_api: range_api.trim_end_matches('/').to_string(),
        })
    }

    pub async fn is_compromised(&self, password: &str) -> Result<bool, BreachCheckError> {
        let (prefix, suffix) = hash_range(password);
        let request = self
            .range_request(&prefix)
            .map_err(|_| BreachCheckError::Unavailable)?;
        let response = self
            .client
            .execute(request)
            .await
            .map_err(|_| BreachCheckError::Unavailable)?;
        if !response.status().is_success() {
            return Err(BreachCheckError::Unavailable);
        }
        if response
            .content_length()
            .is_some_and(|length| length > MAX_RANGE_RESPONSE_BYTES as u64)
        {
            return Err(BreachCheckError::InvalidResponse);
        }
        let capacity = response
            .content_length()
            .unwrap_or(8 * 1024)
            .min(MAX_RANGE_RESPONSE_BYTES as u64) as usize;
        let mut body = Vec::with_capacity(capacity);
        let mut response = response;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| BreachCheckError::Unavailable)?
        {
            if body.len().saturating_add(chunk.len()) > MAX_RANGE_RESPONSE_BYTES {
                return Err(BreachCheckError::InvalidResponse);
            }
            body.extend_from_slice(&chunk);
        }
        let body = std::str::from_utf8(&body).map_err(|_| BreachCheckError::InvalidResponse)?;
        range_contains_suffix(body, &suffix)
    }

    fn range_request(&self, prefix: &str) -> Result<reqwest::Request, reqwest::Error> {
        self.client
            .get(format!("{}/range/{prefix}", self.range_api))
            .header("Add-Padding", "true")
            .header(reqwest::header::USER_AGENT, USER_AGENT)
            .build()
    }
}

fn hash_range(password: &str) -> (String, String) {
    let hash = format!("{:X}", Sha1::digest(password.as_bytes()));
    (hash[..5].to_string(), hash[5..].to_string())
}

fn range_contains_suffix(body: &str, target: &str) -> Result<bool, BreachCheckError> {
    let mut saw_record = false;
    let mut found = false;
    for line in body.lines().filter(|line| !line.is_empty()) {
        let (suffix, count) = line
            .trim_end_matches('\r')
            .split_once(':')
            .ok_or(BreachCheckError::InvalidResponse)?;
        if suffix.len() != 35 || !suffix.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err(BreachCheckError::InvalidResponse);
        }
        let count = count
            .parse::<u64>()
            .map_err(|_| BreachCheckError::InvalidResponse)?;
        saw_record = true;
        found |= suffix.eq_ignore_ascii_case(target) && count > 0;
    }
    if !saw_record {
        return Err(BreachCheckError::InvalidResponse);
    }
    Ok(found)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_only_the_k_anonymity_prefix_for_the_request_path() {
        let (prefix, suffix) = hash_range("password");
        assert_eq!(prefix, "5BAA6");
        assert_eq!(suffix, "1E4C9B93F3F0682250B6CF8331B7EE68FD8");
        assert_eq!(prefix.len(), 5);
    }

    #[test]
    fn parses_exposure_counts_and_rejects_malformed_range_data() {
        let suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";
        assert!(range_contains_suffix(&format!("{suffix}:12\r\n"), suffix).unwrap());
        assert!(!range_contains_suffix(&format!("{suffix}:0\n"), suffix).unwrap());
        assert!(!range_contains_suffix(&format!("{}:1\n", "A".repeat(35)), suffix).unwrap());
        assert_eq!(
            range_contains_suffix("not-a-range", suffix),
            Err(BreachCheckError::InvalidResponse)
        );
        assert_eq!(
            range_contains_suffix("", suffix),
            Err(BreachCheckError::InvalidResponse)
        );
    }

    #[test]
    fn request_contains_only_the_hash_prefix_and_padding_header() {
        let checker = BreachedPasswordChecker::new().unwrap();
        let (prefix, _) = hash_range("password");
        let request = checker.range_request(&prefix).unwrap();
        assert_eq!(request.url().path(), "/range/5BAA6");
        assert_eq!(request.headers().get("add-padding").unwrap(), "true");
        assert_eq!(
            request.headers().get("user-agent").unwrap(),
            "ForgeHarbor Auth"
        );
    }
}
