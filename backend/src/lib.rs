//! CONE HTTP/WebSocket host, SQLite persistence and market providers.
pub mod automation;
pub mod error;
pub mod history;
pub mod live_archive;
pub mod market;
pub mod model;
pub mod orders;
pub mod provider;
pub mod replay;
pub mod service;
pub mod store;
pub mod upstox_proto;
pub mod watchlists;

use axum::{
    Json, Router,
    body::Bytes,
    extract::{
        DefaultBodyLimit, Path, Query, State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    http::{HeaderMap, Method, StatusCode},
    response::IntoResponse,
    routing::get,
};
use error::{ApiError, Result};
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    path::PathBuf,
    sync::{Arc, Mutex, RwLock},
    time::{Duration, Instant},
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

#[derive(Clone)]
pub struct Config {
    pub bind: String,
    pub database: PathBuf,
    pub origins: Vec<String>,
    pub market_mode: String,
    pub catalog: Vec<Value>,
    pub web_dir: Option<PathBuf>,
    // Never serialize or log this configuration.
    pub upstox_token: Option<String>,
}
impl Config {
    pub fn from_env() -> Result<Self> {
        let mode = std::env::var("CONE_MARKET_PROVIDER").unwrap_or_else(|_| "upstox".into());
        if mode != "upstox" {
            return Err(ApiError::bad("Unknown CONE_MARKET_PROVIDER"));
        }
        let catalog = if let Ok(path) = std::env::var("CONE_INSTRUMENTS_FILE") {
            serde_json::from_str(&std::fs::read_to_string(path).map_err(ApiError::internal)?)?
        } else {
            vec![]
        };
        let token = std::env::var("CONE_UPSTOX_ACCESS_TOKEN")
            .ok()
            .filter(|s| !s.is_empty());
        Ok(Self{bind:std::env::var("CONE_BIND").unwrap_or_else(|_|"127.0.0.1:8000".into()),database:std::env::var("CONE_DATABASE_PATH").unwrap_or_else(|_|"data/cone.sqlite3".into()).into(),origins:std::env::var("CONE_ALLOWED_ORIGINS").unwrap_or_else(|_|"http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000".into()).split(',').map(|s|s.trim().to_string()).collect(),market_mode:mode,catalog,web_dir:std::env::var("CONE_WEB_DIR").ok().map(PathBuf::from),upstox_token:token})
    }
}

pub struct AppState {
    pub store: store::Store,
    pub live_archive: live_archive::LiveArchive,
    pub market: RwLock<market::Market>,
    pub config: Config,
    broadcast: tokio::sync::broadcast::Sender<String>,
    pub provider: Mutex<provider::Settings>,
    pub replay: Mutex<replay::Replay>,
    pub interests: Mutex<provider::Interests>,
    pub catalogue_status: Mutex<String>,
    auth_limit: Mutex<BTreeMap<String, (Instant, u32)>>,
    auth_workers: Arc<tokio::sync::Semaphore>,
}
impl AppState {
    pub fn open(config: Config) -> Result<Arc<Self>> {
        let provider_settings = provider::load(&config);
        let market = market::Market::new(
            provider::catalogue_for(&config, &provider_settings.mode),
            &provider_settings.mode,
        )?;
        let store = store::Store::open(&config.database)?;
        let (broadcast, _) = tokio::sync::broadcast::channel(16);
        let state = Arc::new(Self {
            store,
            live_archive: live_archive::LiveArchive::open(
                &config.database.with_file_name("live-market.sqlite3"),
            )?,
            market: RwLock::new(market),
            config,
            broadcast,
            provider: Mutex::new(provider_settings),
            replay: Mutex::new(replay::Replay::default()),
            interests: Mutex::new(BTreeMap::new()),
            catalogue_status: Mutex::new("not-loaded".into()),
            auth_limit: Mutex::new(BTreeMap::new()),
            auth_workers: Arc::new(tokio::sync::Semaphore::new(4)),
        });
        let replay = replay::restore(&state)?;
        if state.provider.lock().map_err(ApiError::internal)?.data_mode == "replay" {
            replay::rebuild(&state, &replay)?;
        }
        *state.replay.lock().map_err(ApiError::internal)? = replay;
        Ok(state)
    }
    pub fn market_snapshot(&self) -> Result<market::Market> {
        self.market
            .read()
            .map(|m| m.clone())
            .map_err(ApiError::internal)
    }
    fn check_login_rate(&self, username: &str) -> Result<()> {
        if username.len() > 100 {
            return Err(ApiError::bad("Username too long"));
        }
        let mut attempts = self.auth_limit.lock().map_err(ApiError::internal)?;
        attempts.retain(|_, (at, _)| at.elapsed() < Duration::from_secs(60));
        if attempts.len() >= 10_000 {
            return Err(ApiError(
                StatusCode::TOO_MANY_REQUESTS,
                "Too many authentication requests".into(),
            ));
        }
        let entry = attempts
            .entry(username.to_lowercase())
            .or_insert((Instant::now(), 0));
        entry.1 += 1;
        if entry.1 > 10 {
            return Err(ApiError(
                StatusCode::TOO_MANY_REQUESTS,
                "Try signing in again in a minute".into(),
            ));
        }
        Ok(())
    }
}

pub fn router(state: Arc<AppState>) -> Result<Router> {
    let origins = state
        .config
        .origins
        .iter()
        .map(|s| s.parse())
        .collect::<std::result::Result<Vec<axum::http::HeaderValue>, _>>()
        .map_err(ApiError::internal)?;
    let cors = CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
            axum::http::HeaderName::from_static("idempotency-key"),
        ]);
    let mut app = Router::new()
        .route("/health", get(health))
        .route("/ws/market", get(ws))
        .route("/api/{*path}", axum::routing::any(api));
    if let Some(dir) = &state.config.web_dir {
        app = app.fallback_service(
            tower_http::services::ServeDir::new(dir)
                .not_found_service(tower_http::services::ServeFile::new(dir.join("index.html"))),
        );
    } else {
        app = app.route("/", get(health));
    }
    Ok(app
        .layer(DefaultBodyLimit::max(64 * 1024))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state))
}
async fn health(State(state): State<Arc<AppState>>) -> Result<Json<Value>> {
    let m = state.market.read().map_err(ApiError::internal)?;
    Ok(Json(
        json!({"app":"CONE Rust backend","status":"ONLINE","version":"0.1.0","marketProvider":m.mode,"marketStatus":m.status,"instruments":m.stocks.len()}),
    ))
}
fn bearer(headers: &HeaderMap) -> Result<String> {
    headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(str::to_owned)
        .ok_or_else(ApiError::unauthorized)
}

async fn api(
    State(state): State<Arc<AppState>>,
    Path(path): Path<String>,
    Query(query): Query<BTreeMap<String, String>>,
    method: Method,
    headers: HeaderMap,
    bytes: Bytes,
) -> Result<Json<Value>> {
    let mut req: Value = if bytes.is_empty() {
        json!({})
    } else {
        serde_json::from_slice(&bytes).map_err(|_| ApiError::bad("Invalid JSON body"))?
    };
    if !req.is_object() {
        return Err(ApiError::bad("Expected a JSON object"));
    }
    if let Some(key) = headers.get("idempotency-key").and_then(|v| v.to_str().ok()) {
        if req.get("id").is_some() && req["id"] != key {
            return Err(ApiError::bad("Conflicting idempotency keys"));
        }
        req["id"] = json!(key);
    }
    if path == "market/candles" && method == Method::GET {
        state.store.authenticate(&bearer(&headers)?)?;
        let key = query
            .get("instrumentKey")
            .ok_or_else(|| ApiError::bad("instrumentKey required"))?;
        state.market_snapshot()?.stock(key)?;
        let interval = query
            .get("interval")
            .map(String::as_str)
            .unwrap_or("1minute");
        let count = query
            .get("count")
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(400)
            .clamp(1, 1000);
        return Ok(Json(if state.market_snapshot()?.mode == "replay" {
            state
                .replay
                .lock()
                .map_err(ApiError::internal)?
                .candles(key, interval, count)?
        } else {
            state.live_archive.candles(key, interval, count)?
        }));
    }
    if path.starts_with("market/") && method == Method::GET {
        return Ok(Json(market_read(&state.market_snapshot()?, &path, &query)?));
    }
    if method == Method::POST && matches!(path.as_str(), "auth/register" | "auth/login") {
        state.check_login_rate(req["username"].as_str().unwrap_or_default())?;
        let permit = state
            .auth_workers
            .clone()
            .try_acquire_owned()
            .map_err(|_| {
                ApiError(
                    StatusCode::TOO_MANY_REQUESTS,
                    "Authentication busy; retry shortly".into(),
                )
            })?;
        let value = tokio::task::spawn_blocking(move || {
            let _permit = permit;
            if path == "auth/register" {
                state.store.register(&req)
            } else {
                state.store.login(&req)
            }
        })
        .await
        .map_err(ApiError::internal)??;
        return Ok(Json(value));
    }
    let token = bearer(&headers)?;
    if path == "replay" || path == "replay/workspaces" {
        let user = state.store.authenticate(&token)?;
        if !state
            .config
            .bind
            .parse::<std::net::SocketAddr>()
            .is_ok_and(|s| s.ip().is_loopback())
        {
            return Err(ApiError::bad(
                "Replay controls require a loopback-bound service",
            ));
        }
        let action = req["action"].as_str().unwrap_or_default();
        let _operation = if method != Method::GET
            && matches!(
                action,
                "load" | "extend" | "edit" | "activate" | "rename" | "delete"
            ) {
            Some(replay::WORKSPACE_OPS.lock().await)
        } else {
            None
        };
        return Ok(Json(if method == Method::GET {
            if path == "replay/workspaces" {
                replay::workspaces(&state, user, query.get("id").map(String::as_str))?
            } else {
                state.replay.lock().map_err(ApiError::internal)?.view()
            }
        } else if matches!(action, "load" | "extend" | "edit") {
            replay::load(&state, &req).await?
        } else if matches!(action, "activate" | "rename" | "delete") {
            replay::workspace_action(&state, &req)?
        } else {
            replay::control(&state, &req)?
        }));
    }

    let profile_permit = if method == Method::PUT && path == "auth/profile" {
        Some(
            state
                .auth_workers
                .clone()
                .try_acquire_owned()
                .map_err(|_| {
                    ApiError(
                        StatusCode::TOO_MANY_REQUESTS,
                        "Account update busy; retry shortly".into(),
                    )
                })?,
        )
    } else {
        None
    };
    let result=tokio::task::spawn_blocking(move||->Result<Value>{
        let _profile_permit=profile_permit;
        let user=state.store.authenticate(&token)?;
        match (method.as_str(),path.as_str()) {
            ("GET","auth/me")=>return state.store.user(user),
            ("POST","auth/logout")=>{state.store.logout(&token)?;return Ok(json!({"success":true}));},
            ("PUT","auth/profile")=>return state.store.profile(user,&req),
            ("GET","settings/provider")=>return provider::view(&state),
            ("PUT","settings/provider")=>return provider::configure(&state,&req),
            ("PUT","market/interest")=>return provider::interest(&state,user,&req),
            _=>{}
        }
        let market=state.market_snapshot()?;
        if method==Method::GET&&path=="analytics/leaderboard" {
            if market.mode=="replay"{return Err(ApiError::bad("Leaderboard is unavailable during replay"));}
            let mut rows=Vec::new();
            for (username,book) in state.store.public_accounts()? {
                let Some(value)=book.engine.account().equity(&market.marks()).ok() else{continue;};
                let contributed=i128::from(crate::model::STARTING_BALANCE)+i128::from(book.payin);
                let profit=i128::from(value.minor())-contributed;
                rows.push(json!({"username":username,"value":error::coins(value.minor()),"returnPercent":profit as f64/contributed as f64*100.0,"tradeCount":book.engine.executions().len()}));
            }
            rows.sort_by(|a,b|b["returnPercent"].as_f64().unwrap_or_default().total_cmp(&a["returnPercent"].as_f64().unwrap_or_default()));rows.truncate(100);
            for (i,row) in rows.iter_mut().enumerate(){row["rank"]=json!(i+1);}
            return Ok(json!(rows));
        }
        if method==Method::GET {
            if market.mode=="replay"&&path!="settings" {let _session=state.replay.lock().map_err(ApiError::internal)?;let current=state.market_snapshot()?;if current.mode!="replay"{return Err(ApiError::bad("Mode changed; retry"));}let book=state.store.read_replay(user)?;return service::read(&book,method.as_str(),&path,&current)?.ok_or_else(ApiError::not_found);}
            let book=state.store.read(user)?;return service::read(&book,method.as_str(),&path,&market)?.ok_or_else(ApiError::not_found);
        }
        if market.mode=="replay"&&path!="settings" {
          if path.contains("gtt")||path.contains("sips")||path.contains("alerts"){return Err(ApiError::bad("Scheduled automation is available in Live mode; replay supports direct and pending orders"));}
          {
            let _session=state.replay.lock().map_err(ApiError::internal)?;
            if _session.loading{return Err(ApiError::bad("Workspace dates are being updated; wait for loading to finish"));}
            if path.starts_with("orders")||(path.starts_with("portfolio/")&&!path.starts_with("portfolio/watchlists")){if _session.ended||_session.cursor>=_session.frames.len(){return Err(ApiError::bad("Workspace is complete. Extend its end date to continue trading."));}
            if path=="portfolio/reset"{return Err(ApiError::bad("Delete the workspace to remove its portfolio"));}}
            let current=state.market_snapshot()?;
            if current.mode!="replay"{return Err(ApiError::bad("Replay mode changed; retry"));}
            state.store.transact_replay(user,|book|service::mutate(book,method.as_str(),&path,&req,&current))
          }
        }else{state.store.transact(user,|book|service::mutate(book,method.as_str(),&path,&req,&market))}
    }).await.map_err(ApiError::internal)??;
    Ok(Json(result))
}

fn market_read(m: &market::Market, path: &str, q: &BTreeMap<String, String>) -> Result<Value> {
    let limit = q
        .get("limit")
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(5)
        .clamp(1, 100);
    match path {
        "market/stocks" => Ok(json!(m.stocks)),
        "market/prices" => Ok(m.views()),
        "market/search" => {
            let query = q.get("q").map(|s| s.to_lowercase()).unwrap_or_default();
            Ok(json!(
                m.stocks
                    .iter()
                    .filter(|s| s["tradingsymbol"]
                        .as_str()
                        .unwrap_or_default()
                        .to_lowercase()
                        .contains(&query)
                        || s["name"]
                            .as_str()
                            .unwrap_or_default()
                            .to_lowercase()
                            .contains(&query))
                    .take(20)
                    .collect::<Vec<_>>()
            ))
        }
        "market/movers" => {
            let mut rows = m
                .prices
                .values()
                .filter(|p| p.view["segment"] == "NSE_EQ")
                .map(|p| p.view.clone())
                .collect::<Vec<_>>();
            rows.sort_by(|a, b| {
                b["changePercent"]
                    .as_f64()
                    .unwrap_or_default()
                    .total_cmp(&a["changePercent"].as_f64().unwrap_or_default())
            });
            let gainers = rows.iter().take(limit).cloned().collect::<Vec<_>>();
            let losers = rows.iter().rev().take(limit).cloned().collect::<Vec<_>>();
            rows.sort_by_key(|v| std::cmp::Reverse(v["volume"].as_u64().unwrap_or_default()));
            Ok(
                json!({"gainers":gainers,"losers":losers,"mostActive":rows.into_iter().take(limit).collect::<Vec<_>>()}),
            )
        }
        _ => {
            if let Some(key) = path.strip_prefix("market/depth/") {
                return m
                    .prices
                    .get(key)
                    .map(|p| p.depth.clone())
                    .ok_or_else(ApiError::not_found);
            }
            if let Some(key) = path.strip_prefix("market/stock/") {
                return m
                    .prices
                    .get(key)
                    .map(|p| p.view.clone())
                    .ok_or_else(ApiError::not_found);
            }
            Err(ApiError::not_found())
        }
    }
}

async fn ws(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    upgrade: WebSocketUpgrade,
) -> Result<impl IntoResponse> {
    if headers
        .get("origin")
        .and_then(|h| h.to_str().ok())
        .is_some_and(|origin| !state.config.origins.iter().any(|o| o == origin))
    {
        return Err(ApiError(StatusCode::FORBIDDEN, "Origin not allowed".into()));
    }
    Ok(upgrade
        .max_message_size(1024)
        .on_upgrade(move |socket| stream(socket, state)))
}
async fn stream(mut socket: WebSocket, state: Arc<AppState>) {
    let mut receiver = state.broadcast.subscribe();
    let initial = state.market_snapshot().map(|m| {
        json!({"type":"SNAPSHOT","prices":m.views(),"source":m.mode,"sessionId":m.session_id,"status":m.status,"catalogueVersion":format!("{}:{}",m.mode,m.stocks.len())}).to_string()
    });
    let Ok(initial) = initial else { return };
    if socket.send(Message::Text(initial.into())).await.is_err() {
        return;
    }
    loop {
        tokio::select! {
            tick=receiver.recv()=>{match tick {Ok(text)=>{if socket.send(Message::Text(text.into())).await.is_err(){break;}},Err(tokio::sync::broadcast::error::RecvError::Lagged(_))=>continue,Err(_)=>break}},
            message=socket.recv()=>{match message {Some(Ok(Message::Ping(data)))=>{if socket.send(Message::Pong(data)).await.is_err(){break;}},Some(Ok(Message::Close(_)))|None|Some(Err(_))=>break,_=>{}}}
        }
    }
}

/// One shared provider poll per tick, independent of connected user count.
pub async fn run_market(state: Arc<AppState>) {
    let provider_task = tokio::spawn(provider::run(state.clone()));
    loop {
        if let Err(e) = replay::tick(&state) {
            tracing::error!(error=%e.1,"Replay tick failed");
        }
        if let Ok(market) = state.market_snapshot() {
            let _=state.broadcast.send(json!({"type":"TICK","prices":market.views(),"source":market.mode,"sessionId":market.session_id,"status":market.status,"catalogueVersion":format!("{}:{}",market.mode,market.stocks.len())}).to_string());
        }
        let worker = state.clone();
        let processed = tokio::task::spawn_blocking(move || -> Result<()> {
            let market = worker.market_snapshot()?;
            if market.mode == "replay" {
                return Ok(());
            }
            for user in worker.store.active_accounts()? {
                if let Err(e) = worker.store.transact(user, |book| {
                    automation::squareoff(book, &market)?;
                    orders::process(book, &market)?;
                    automation::process(book, &market)?;
                    Ok(())
                }) {
                    tracing::error!(user,error=%e.1,"Account schedule failed");
                }
            }
            Ok(())
        })
        .await;
        match processed {
            Err(e) => tracing::error!(%e,"Market worker failed"),
            Ok(Err(e)) => tracing::error!(error=%e.1,"Market pass failed"),
            Ok(Ok(())) => {}
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
        if provider_task.is_finished() {
            tracing::error!("Provider worker stopped");
            break;
        }
    }
}
