use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug)]
pub struct ApiError(pub StatusCode, pub String);
pub type Result<T> = std::result::Result<T, ApiError>;

impl ApiError {
    pub fn bad(message: impl Into<String>) -> Self {
        Self(StatusCode::BAD_REQUEST, message.into())
    }
    pub fn unauthorized() -> Self {
        Self(
            StatusCode::UNAUTHORIZED,
            "Sign in with a valid session".into(),
        )
    }
    pub fn not_found() -> Self {
        Self(StatusCode::NOT_FOUND, "Not found".into())
    }
    pub fn internal(error: impl std::fmt::Display) -> Self {
        tracing::error!(%error, "Backend operation failed");
        Self(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Backend operation failed".into(),
        )
    }
}
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({"detail":self.1}))).into_response()
    }
}
impl From<rusqlite::Error> for ApiError {
    fn from(e: rusqlite::Error) -> Self {
        Self::internal(e)
    }
}
impl From<serde_json::Error> for ApiError {
    fn from(e: serde_json::Error) -> Self {
        Self::internal(e)
    }
}
impl From<cone_engine::EngineError> for ApiError {
    fn from(e: cone_engine::EngineError) -> Self {
        Self::bad(e.to_string())
    }
}

pub fn text<'a>(v: &'a serde_json::Value, key: &str) -> Result<&'a str> {
    v.get(key)
        .and_then(|x| x.as_str())
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| ApiError::bad(format!("{key} is required")))
}

/// Decimal conversion through text, never binary floating-point accounting.
pub fn minor(v: &serde_json::Value) -> Result<i64> {
    let raw = match v {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        _ => return Err(ApiError::bad("Expected decimal amount")),
    };
    if raw.starts_with('-') || raw.starts_with('+') {
        return Err(ApiError::bad("Amount must be positive"));
    }
    let (whole, fraction) = raw.split_once('.').unwrap_or((&raw, ""));
    if whole.is_empty()
        || !whole.bytes().all(|b| b.is_ascii_digit())
        || !fraction.bytes().all(|b| b.is_ascii_digit())
        || fraction.len() > 2
    {
        return Err(ApiError::bad(
            "Use decimal amounts with at most two fractional digits",
        ));
    }
    let whole: i64 = whole
        .parse()
        .map_err(|_| ApiError::bad("Amount too large"))?;
    let fraction: i64 = format!("{fraction:0<2}")
        .parse()
        .map_err(|_| ApiError::bad("Invalid amount"))?;
    let amount = whole
        .checked_mul(100)
        .and_then(|n| n.checked_add(fraction))
        .filter(|n| *n > 0)
        .ok_or_else(|| ApiError::bad("Amount must be positive and within range"))?;
    Ok(amount)
}
pub fn now_ms() -> u64 {
    chrono::Utc::now().timestamp_millis() as u64
}
pub fn iso(ms: u64) -> String {
    chrono::DateTime::from_timestamp_millis(ms as i64)
        .unwrap_or_default()
        .to_rfc3339()
}
pub fn coins(minor: i64) -> f64 {
    minor as f64 / 100.0
}
pub fn id() -> String {
    uuid::Uuid::new_v4().simple().to_string()
}
