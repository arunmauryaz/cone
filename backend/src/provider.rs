//! One operator-owned market data connection. No broker trading endpoints.
use crate::{
    AppState,
    error::{ApiError, Result, now_ms},
    market,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::PathBuf,
    sync::Arc,
    time::{Duration, Instant},
};

#[derive(Clone, Serialize, Deserialize)]
pub struct Settings {
    pub mode: String,
    #[serde(default = "live_mode")]
    pub data_mode: String,
    #[serde(default)]
    pub token: String,
    #[serde(default)]
    pub revision: u64,
}
fn live_mode() -> String {
    "live".into()
}
pub type Interests = BTreeMap<(i64, String), (Instant, Vec<String>)>;
pub fn settings_path(state: &AppState) -> PathBuf {
    state.config.database.with_file_name("market-provider.json")
}
pub fn load(config: &crate::Config) -> Settings {
    let path = config.database.with_file_name("market-provider.json");
    let mut settings = std::fs::read(path)
        .ok()
        .and_then(|b| serde_json::from_slice::<Settings>(&b).ok())
        .unwrap_or(Settings {
            mode: config.market_mode.clone(),
            data_mode: "live".into(),
            token: config.upstox_token.clone().unwrap_or_default(),
            revision: 0,
        });
    if settings.mode != "upstox" && config.market_mode != "fixture" {
        settings.mode = "upstox".into();
        settings.data_mode = "live".into();
    }
    settings
}
pub fn view(state: &AppState) -> Result<Value> {
    let settings = state.provider.lock().map_err(ApiError::internal)?;
    let market = state.market.read().map_err(ApiError::internal)?;
    let editable = state
        .config
        .bind
        .parse::<std::net::SocketAddr>()
        .is_ok_and(|a| a.ip().is_loopback());
    Ok(
        json!({"provider":settings.mode,"dataMode":settings.data_mode,"status":market.status,"configured":!settings.token.is_empty(),"tokenSaved":!settings.token.is_empty(),"editable":editable,"instruments":market.stocks.len(),"transport":"websocket-v3","subscriptionLimit":2000,"catalogueStatus":state.catalogue_status.lock().map_err(ApiError::internal)?.clone()}),
    )
}
pub fn configure(state: &AppState, req: &Value) -> Result<Value> {
    if !state
        .config
        .bind
        .parse::<std::net::SocketAddr>()
        .is_ok_and(|a| a.ip().is_loopback())
    {
        return Err(ApiError(
            axum::http::StatusCode::FORBIDDEN,
            "Provider setup is available only on a loopback-bound local service".into(),
        ));
    }
    let mut guard = state.provider.lock().map_err(ApiError::internal)?;
    let mut settings = guard.clone();
    if let Some(mode) = req.get("provider") {
        let mode = mode
            .as_str()
            .ok_or_else(|| ApiError::bad("Invalid provider"))?;
        if mode != "upstox" {
            return Err(ApiError::bad("Unknown provider"));
        }
        settings.mode = mode.into();
    }
    if let Some(mode) = req.get("dataMode") {
        let mode = mode
            .as_str()
            .ok_or_else(|| ApiError::bad("Invalid data mode"))?;
        if !["live", "replay"].contains(&mode) {
            return Err(ApiError::bad("Unknown data mode"));
        }
        settings.data_mode = mode.into();
    }
    if let Some(token) = req.get("accessToken") {
        let token = token
            .as_str()
            .ok_or_else(|| ApiError::bad("Invalid token"))?
            .trim();
        if token.len() > 8192 || token.bytes().any(|b| b.is_ascii_control()) {
            return Err(ApiError::bad("Invalid token"));
        }
        if !token.is_empty() {
            settings.token = token.into();
        }
    }
    if req["clearToken"] == true {
        settings.token.clear();
    }
    settings.revision = settings.revision.saturating_add(1);
    // Lock order is provider -> market. Discard old-source prices immediately.
    let stocks = catalogue_for(&state.config, &settings.mode);
    let mut market = market::Market::new(stocks, &settings.mode)?;
    if settings.mode == "upstox" && settings.data_mode == "replay" {
        market.mode = "replay".into();
    }
    market.status = if settings.mode == "upstox" {
        if settings.token.is_empty() {
            "not-configured"
        } else {
            "connecting"
        }
    } else {
        "connected"
    }
    .into();
    let path = settings_path(state);
    let temp = path.with_extension("json.tmp");
    std::fs::write(&temp, serde_json::to_vec(&settings)?).map_err(ApiError::internal)?;
    std::fs::rename(temp, path).map_err(ApiError::internal)?;
    *state.market.write().map_err(ApiError::internal)? = market;
    *guard = settings;
    let replay = settings_mode_replay(&guard);
    drop(guard);
    if replay {
        let mut r = state.replay.lock().map_err(ApiError::internal)?;
        r.playing = false;
        crate::replay::rebuild(state, &r)?;
    }
    view(state)
}
pub fn interest(state: &AppState, user: i64, req: &Value) -> Result<Value> {
    let client = req["clientId"]
        .as_str()
        .filter(|s| !s.is_empty() && s.len() <= 64)
        .ok_or_else(|| ApiError::bad("Invalid client ID"))?;
    let keys = req["instrumentKeys"]
        .as_array()
        .filter(|a| a.len() <= 100)
        .ok_or_else(|| ApiError::bad("Maximum 100 visible instruments"))?;
    let market = state.market.read().map_err(ApiError::internal)?;
    let mut selected = Vec::new();
    for key in keys {
        let key = key
            .as_str()
            .ok_or_else(|| ApiError::bad("Invalid instrument"))?;
        market.stock(key)?;
        selected.push(key.to_owned());
    }
    drop(market);
    let mut interests = state.interests.lock().map_err(ApiError::internal)?;
    interests.retain(|_, (time, _)| time.elapsed() < Duration::from_secs(45));
    if interests.len() >= 1000 && !interests.contains_key(&(user, client.into())) {
        return Err(ApiError::bad("Too many active quote viewers"));
    }
    if selected.is_empty() {
        interests.remove(&(user, client.into()));
    } else {
        interests.insert((user, client.into()), (Instant::now(), selected));
    }
    Ok(json!({"success":true}))
}
pub fn wanted(state: &AppState) -> Result<BTreeSet<String>> {
    let mut keys = BTreeSet::new();
    for (_, book) in state.store.public_accounts()? {
        for list in &book.watchlists {
            for key in list["stocks"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|k| k.as_str())
            {
                keys.insert(key.to_owned());
            }
        }
        keys.extend(book.engine.account().holdings().keys().cloned());
        keys.extend(book.engine.account().positions().keys().cloned());
        keys.extend(
            book.orders
                .iter()
                .filter(|o| o.status == "OPEN")
                .map(|o| o.instrument.clone()),
        );
        for items in [&book.alerts, &book.gtt, &book.sips] {
            for item in items {
                if item["active"] == true || item["status"] == "ACTIVE" {
                    if let Some(key) = item["instrumentKey"].as_str() {
                        keys.insert(key.into());
                    }
                }
            }
        }
    }
    let mut interests = state.interests.lock().map_err(ApiError::internal)?;
    interests.retain(|_, (time, _)| time.elapsed() < Duration::from_secs(45));
    for (_, selected) in interests.values() {
        keys.extend(selected.iter().cloned());
    }
    let market = state.market.read().map_err(ApiError::internal)?;
    let providers = market
        .stocks
        .iter()
        .filter(|s| keys.contains(s["instrumentKey"].as_str().unwrap_or_default()))
        .filter_map(|s| s["providerKey"].as_str().map(str::to_owned))
        .collect::<BTreeSet<_>>();
    if providers.len() > 2000 {
        return Err(ApiError::bad("Upstox full-feed subscription limit reached"));
    }
    Ok(providers)
}
fn cache_path(state: &AppState) -> PathBuf {
    state
        .config
        .database
        .with_file_name("upstox-instruments.json")
}
pub fn catalogue_for(config: &crate::Config, mode: &str) -> Vec<Value> {
    let cached = std::fs::read(config.database.with_file_name("upstox-instruments.json"))
        .ok()
        .and_then(|b| serde_json::from_slice::<Vec<Value>>(&b).ok());
    if mode == "upstox" {
        return cached.unwrap_or_else(|| {
            config
                .catalog
                .iter()
                .filter(|s| s["providerKey"].as_str().is_some())
                .cloned()
                .collect()
        });
    }
    let mut stocks = config.catalog.clone();
    if let Some(cached) = cached {
        let membership = cached
            .iter()
            .filter_map(|s| s["instrumentKey"].as_str().map(|k| (k, &s["indices"])))
            .collect::<BTreeMap<_, _>>();
        for stock in &mut stocks {
            if let Some(indices) =
                membership.get(stock["instrumentKey"].as_str().unwrap_or_default())
            {
                stock["indices"] = (*indices).clone();
            }
        }
    }
    stocks
}

pub fn catalogue(raw: &[Value]) -> Vec<Value> {
    let mut seen = BTreeSet::new();
    raw.iter().filter_map(|s|{
        let segment=s["segment"].as_str()?;
        if !["NSE_EQ","BSE_EQ","NSE_INDEX","BSE_INDEX"].contains(&segment){return None;}
        let symbol=s["trading_symbol"].as_str().filter(|s|!s.trim().is_empty())?;let provider=s["instrument_key"].as_str()?;
        let key=if segment.ends_with("EQ"){format!("{segment}|{symbol}")}else{provider.to_owned()};if !seen.insert(key.clone()){return None;}
        Some(json!({"instrumentKey":key,"providerKey":provider,"tradingsymbol":symbol,"name":s["name"].as_str().filter(|s|!s.trim().is_empty()).unwrap_or(symbol),"exchange":s["exchange"],"segment":segment,"basePrice":0,"lotSize":s["lot_size"].as_u64().unwrap_or(1).max(1),"tickSize":s["tick_size"].as_f64().unwrap_or(5.0)/100.0,"tradable":segment.ends_with("EQ")&&s["instrument_type"]=="EQ","sector":"","isin":s["isin"],"indices":[]}))
    }).collect()
}
async fn download_catalogue(state: &AppState, client: &reqwest::Client) -> Result<()> {
    use std::io::Read;
    let mut rows = Vec::new();
    for exchange in ["NSE", "BSE"] {
        let response = client
            .get(format!(
                "https://assets.upstox.com/market-quote/instruments/exchange/{exchange}.json.gz"
            ))
            .send()
            .await
            .map_err(ApiError::internal)?
            .error_for_status()
            .map_err(ApiError::internal)?;
        let bytes = response.bytes().await.map_err(ApiError::internal)?;
        let mut decoded = Vec::new();
        flate2::read::GzDecoder::new(&bytes[..])
            .take(200_000_000)
            .read_to_end(&mut decoded)
            .map_err(ApiError::internal)?;
        rows.extend(serde_json::from_slice::<Vec<Value>>(&decoded)?);
    }
    let mut stocks = catalogue(&rows);
    if stocks.is_empty() {
        return Err(ApiError::bad("No Upstox instruments found"));
    }
    // Index membership is exchange metadata, not fabricated from quote data.
    for (name, file) in [
        ("Nifty 50", "ind_nifty50list.csv"),
        ("Nifty 100", "ind_nifty100list.csv"),
        ("Nifty 500", "ind_nifty500list.csv"),
    ] {
        if let Ok(response) = client
            .get(format!(
                "https://www.niftyindices.com/IndexConstituent/{file}"
            ))
            .send()
            .await
        {
            if response.status().is_success() {
                if let Ok(bytes) = response.bytes().await {
                    let mut csv = csv::Reader::from_reader(&bytes[..]);
                    if let Ok(headers) = csv.headers() {
                        if let Some(column) = headers.iter().position(|h| h == "ISIN Code") {
                            let isins = csv
                                .records()
                                .filter_map(|r| r.ok())
                                .filter_map(|r| r.get(column).map(str::to_owned))
                                .collect::<BTreeSet<_>>();
                            for stock in &mut stocks {
                                if stock["segment"] == "NSE_EQ"
                                    && isins.contains(stock["isin"].as_str().unwrap_or_default())
                                {
                                    stock["indices"].as_array_mut().unwrap().push(json!(name));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    std::fs::write(cache_path(state), serde_json::to_vec(&stocks)?).map_err(ApiError::internal)?;
    let settings = state.provider.lock().map_err(ApiError::internal)?;
    if settings.mode == "upstox" {
        let mut current = state.market.write().map_err(ApiError::internal)?;
        if current.mode == "replay" {
            let keys: BTreeSet<String> = stocks
                .iter()
                .filter_map(|s| s["instrumentKey"].as_str().map(str::to_string))
                .collect();
            stocks.extend(
                current
                    .stocks
                    .iter()
                    .filter(|s| !keys.contains(s["instrumentKey"].as_str().unwrap_or_default()))
                    .cloned(),
            );
        }
        let catalogue = market::Market::new(stocks, "upstox")?;
        current.stocks = catalogue.stocks;
        current.catalogue = catalogue.catalogue;
        current.provider_keys = catalogue.provider_keys;
    }
    *state.catalogue_status.lock().map_err(ApiError::internal)? = "ready".into();
    Ok(())
}

pub async fn run(state: Arc<AppState>) {
    let Ok(client) = reqwest::Client::builder()
        .user_agent("CONE/0.1 paper-trading")
        .timeout(Duration::from_secs(25))
        .build()
    else {
        return;
    };
    let mut loaded_key = None;
    let mut attempted_key = None;
    let mut catalogue_attempt = Instant::now() - Duration::from_secs(600);
    loop {
        let settings = match state.provider.lock() {
            Ok(s) => s.clone(),
            Err(_) => return,
        };
        if settings.mode != "upstox" {
            tokio::time::sleep(Duration::from_secs(1)).await;
            continue;
        }
        let day = (chrono::Utc::now() + chrono::Duration::minutes(330)).date_naive();
        let key = (settings.revision, day);
        if loaded_key != Some(key)
            && (attempted_key != Some(key)
                || catalogue_attempt.elapsed() >= Duration::from_secs(300))
        {
            attempted_key = Some(key);
            catalogue_attempt = Instant::now();
            *state.catalogue_status.lock().unwrap() = "downloading".into();
            match download_catalogue(&state, &client).await {
                Ok(()) => {
                    loaded_key = Some(key);
                }
                Err(error) => {
                    tracing::warn!(error=%error.1,"Upstox catalogue refresh failed");
                    *state.catalogue_status.lock().unwrap() = "download-failed".into();
                }
            }
        }
        if state
            .provider
            .lock()
            .is_ok_and(|s| s.revision != settings.revision)
        {
            continue;
        }
        if settings.data_mode != "live" {
            tokio::time::sleep(Duration::from_secs(1)).await;
            continue;
        }
        if settings.token.is_empty() {
            if let Ok(mut m) = state.market.write() {
                m.status = "not-configured".into();
            }
            tokio::time::sleep(Duration::from_secs(3)).await;
            continue;
        }
        let result = stream(&state, &client, &settings).await;
        if result.is_err() {
            if let Ok(mut m) = state.market.write() {
                if m.mode == "upstox" {
                    m.status = "disconnected".into();
                }
            }
        }
        tokio::time::sleep(Duration::from_secs(3)).await;
    }
}
async fn stream(
    state: &Arc<AppState>,
    client: &reqwest::Client,
    settings: &Settings,
) -> Result<()> {
    let response = client
        .get("https://api.upstox.com/v3/feed/market-data-feed/authorize")
        .bearer_auth(&settings.token)
        .send()
        .await
        .map_err(|_| ApiError::bad("Upstox authorization connection failed"))?;
    if !response.status().is_success() {
        if let Ok(mut m) = state.market.write() {
            m.status = "authentication-failed".into();
        }
        return Ok(());
    }
    let body: Value = response
        .json()
        .await
        .map_err(|_| ApiError::bad("Invalid Upstox authorization response"))?;
    let url = body["data"]["authorized_redirect_uri"]
        .as_str()
        .filter(|s| s.starts_with("wss://"))
        .ok_or_else(|| ApiError::bad("Missing Upstox stream URL"))?;
    let (mut socket, _) = tokio_tungstenite::connect_async(url)
        .await
        .map_err(|_| ApiError::bad("Upstox stream connection failed"))?;
    let connected = Instant::now();
    let connection_start = now_ms();
    if let Ok(mut market) = state.market.write() {
        market.status = "connected".into();
    }
    let mut last_seen: BTreeMap<String, (u64, u64)> = BTreeMap::new();
    let connected_day = (chrono::Utc::now() + chrono::Duration::minutes(330)).date_naive();
    let catalogue_failed = state
        .catalogue_status
        .lock()
        .map_err(ApiError::internal)?
        .as_str()
        == "download-failed";
    let mut subscribed = BTreeSet::new();
    let mut timer = tokio::time::interval(Duration::from_secs(2));
    loop {
        tokio::select! {
            _=timer.tick()=>{
                if state.provider.lock().map_err(ApiError::internal)?.revision!=settings.revision{return Ok(());}
                if (chrono::Utc::now()+chrono::Duration::minutes(330)).date_naive()!=connected_day || (catalogue_failed&&connected.elapsed()>=Duration::from_secs(300)){return Ok(());}
                let worker=state.clone();let next=tokio::task::spawn_blocking(move||wanted(&worker)).await.map_err(ApiError::internal)??;
                for (method,keys) in [("unsub",subscribed.difference(&next).cloned().collect::<Vec<_>>()),("sub",next.difference(&subscribed).cloned().collect::<Vec<_>>())] {
                    for chunk in keys.chunks(100){let message=json!({"guid":uuid::Uuid::new_v4().to_string(),"method":method,"data":{"mode":"full","instrumentKeys":chunk}}).to_string();socket.send(tokio_tungstenite::tungstenite::Message::Binary(message.into_bytes().into())).await.map_err(|_|ApiError::bad("Upstox subscription failed"))?;}
                }
                subscribed=next;
            },
            frame=socket.next()=>{match frame{
                Some(Ok(tokio_tungstenite::tungstenite::Message::Binary(bytes)))=>{let guard=state.provider.lock().map_err(ApiError::internal)?;if guard.revision!=settings.revision{return Ok(());}
                    let mut data=crate::upstox_proto::normalize(&bytes)?;filter_live(state,&mut data,connection_start,&mut last_seen)?;if data["data"].as_object().is_some_and(|d|!d.is_empty()) {
                    let mut market=state.market.write().map_err(ApiError::internal)?;
                    market.apply_upstox(&data,now_ms())?;
                    let _=state.broadcast.send(json!({"type":"TICK","prices":market.views(),"source":market.mode,"status":market.status,"catalogueVersion":format!("{}:{}",market.mode,market.stocks.len())}).to_string());
                }},
                Some(Ok(tokio_tungstenite::tungstenite::Message::Ping(bytes)))=>{socket.send(tokio_tungstenite::tungstenite::Message::Pong(bytes)).await.map_err(|_|ApiError::bad("Upstox stream ping failed"))?;},
                Some(Ok(tokio_tungstenite::tungstenite::Message::Close(_)))|None|Some(Err(_))=>return Err(ApiError::bad("Upstox stream disconnected")),_=>{}
            }}
        }
    }
}

/// Ignore initial snapshots and stale/duplicate trades: Live starts with a new trade.
fn filter_live(
    state: &AppState,
    data: &mut Value,
    started: u64,
    last: &mut BTreeMap<String, (u64, u64)>,
) -> Result<()> {
    if data["feedType"] != 1 {
        data["data"] = json!({});
        return Ok(());
    }
    filter_live_at(state, data, started, last, now_ms())
}
fn filter_live_at(
    state: &AppState,
    data: &mut Value,
    started: u64,
    last: &mut BTreeMap<String, (u64, u64)>,
    now: u64,
) -> Result<()> {
    let market = state.market.read().map_err(ApiError::internal)?;
    let mapping = market.provider_keys.clone();
    drop(market);
    let mut storage_error = None;
    if let Some(rows) = data["data"].as_object_mut() {
        rows.retain(|provider,row|{
  let Some(key)=mapping.get(provider) else{return false};
  let Some(time)=row["timestamp"].as_str().and_then(|s|chrono::DateTime::parse_from_rfc3339(s).ok()).map(|d|d.timestamp_millis().max(0) as u64) else{return false};
  if time<started||time>now+1000||now.saturating_sub(time)>5000||cone_engine::indian_equity_session(time)==cone_engine::Session::Closed||last.get(key).is_some_and(|(t,_)|*t>=time){return false;}
  let volume=row["volume"].as_u64().unwrap_or(0);
  let delta=last.get(key).filter(|(t,v)|time.saturating_sub(*t)<5000&&volume>=*v).map(|(_,v)|volume-*v).unwrap_or_else(||row["lastQuantity"].as_u64().unwrap_or(0));
  let price=row["last_price"].as_f64().unwrap_or(0.0);
  if let Err(error)=state.live_archive.record(key,time,price,delta){storage_error=Some(error);return false;}
  last.insert(key.clone(),(time,volume));
  // Expose only this installation's observed OHLC/volume, not broker day backfill.
  if let Ok(bars)=state.live_archive.day_summary(key,time){if let Some(bar)=bars.as_array().and_then(|a|a.last()){row["ohlc"]=json!({"open":bar["open"],"high":bar["high"],"low":bar["low"],"close":bar["open"]});row["volume"]=bar["volume"].clone();}}
  true
 });
    }
    if let Some(error) = storage_error {
        return Err(error);
    }
    Ok(())
}

fn settings_mode_replay(s: &Settings) -> bool {
    s.mode == "upstox" && s.data_mode == "replay"
}

#[cfg(test)]
mod live_tests {
    use super::*;
    #[test]
    fn ignores_snapshots_stale_and_duplicate_trades() {
        let dir = tempfile::tempdir().unwrap();
        let stock = json!({"instrumentKey":"NSE_EQ|TEST","providerKey":"NSE_EQ|TOKEN","tradingsymbol":"TEST","name":"Fixture","basePrice":100,"segment":"NSE_EQ"});
        let state = AppState::open(crate::Config {
            bind: "127.0.0.1:0".into(),
            database: dir.path().join("account.sqlite3"),
            origins: vec![],
            market_mode: "fixture".into(),
            catalog: vec![stock.clone()],
            web_dir: None,
            upstox_token: None,
        })
        .unwrap();
        *state.market.write().unwrap() = market::Market::new(vec![stock], "upstox").unwrap();
        let now = chrono::DateTime::parse_from_rfc3339("2026-10-30T10:00:00+05:30")
            .unwrap()
            .timestamp_millis() as u64;
        let row = json!({"instrument_token":"NSE_EQ|TOKEN","last_price":100,"timestamp":crate::error::iso(now),"volume":1000,"lastQuantity":2});
        let mut snapshot = json!({"feedType":0,"data":{"NSE_EQ|TOKEN":row.clone()}});
        filter_live(&state, &mut snapshot, now, &mut BTreeMap::new()).unwrap();
        assert_eq!(snapshot["data"], json!({}));
        let mut past = json!({"feedType":1,"data":{"NSE_EQ|TOKEN":row.clone()}});
        let mut seen = BTreeMap::new();
        filter_live_at(&state, &mut past, now + 1, &mut seen, now + 2).unwrap();
        assert_eq!(past["data"], json!({}));
        let mut fresh = json!({"feedType":1,"data":{"NSE_EQ|TOKEN":row.clone()}});
        filter_live_at(&state, &mut fresh, now, &mut seen, now + 2).unwrap();
        assert!(fresh["data"].get("NSE_EQ|TOKEN").is_some());
        let mut duplicate = json!({"feedType":1,"data":{"NSE_EQ|TOKEN":row}});
        filter_live_at(&state, &mut duplicate, now, &mut seen, now + 3).unwrap();
        assert_eq!(duplicate["data"], json!({}));
        let bars = state
            .live_archive
            .candles("NSE_EQ|TEST", "1minute", 10)
            .unwrap();
        assert_eq!(bars.as_array().unwrap().len(), 1);
        assert_eq!(bars[0]["volume"], 2);
    }
}
