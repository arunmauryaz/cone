//! Historical replay: minute-close events, virtual clock, separate practice accounts.
use crate::{
    AppState,
    error::{ApiError, Result},
    market::Market,
    provider,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    time::{Duration, Instant},
};
#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Replay {
    pub date: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub end_date: String,
    #[serde(default)]
    pub ended: bool,
    #[serde(default)]
    pub instruments: Vec<Value>,
    #[serde(default)]
    pub revision: u64,
    #[serde(default)]
    pub id: String,
    pub frames: Vec<(u64, Vec<(String, Value)>)>,
    pub cursor: usize,
    pub speed: u32,
    #[serde(skip)]
    pub playing: bool,
    #[serde(skip)]
    pub loading: bool,
    #[serde(skip)]
    pub last: Option<Instant>,
}
impl Replay {
    pub fn view(&self) -> Value {
        json!({"id":self.id,"name":self.name,"date":self.date,"startDate":self.date,"endDate":if self.end_date.is_empty(){&self.date}else{&self.end_date},"loaded":!self.frames.is_empty(),"playing":self.playing,"loading":self.loading,"cursor":self.cursor,"total":self.frames.len(),"speed":self.speed,"finished":self.ended||(!self.frames.is_empty()&&self.cursor>=self.frames.len()),"status":if self.ended{"ended"}else if !self.frames.is_empty()&&self.cursor>=self.frames.len(){"completed"}else if self.playing{"playing"}else{"paused"}})
    }
    pub fn candles(&self, key: &str, interval: &str, count: usize) -> Result<Value> {
        let rows = self
            .frames
            .iter()
            .take(self.cursor)
            .flat_map(|(_, rows)| {
                rows.iter()
                    .filter(|(k, _)| k == key)
                    .map(|(_, v)| v.clone())
            })
            .collect();
        let mut bars = crate::live_archive::aggregate(rows, interval, count)?;
        let through = self
            .frames
            .iter()
            .take(self.cursor)
            .rev()
            .find(|(_, events)| events.iter().any(|(k, _)| k == key))
            .map(|(time, _)| time + 59999);
        if let Some(bar) = bars.as_array_mut().and_then(|a| a.last_mut()) {
            bar["observedThrough"] = json!(through);
        }
        Ok(bars)
    }
}
pub fn restore(state: &AppState) -> Result<Replay> {
    if state.store.meta_get("workspace-migrated")?.is_none() {
        let path = state.config.database.with_file_name("replay-session.json");
        if let Ok(bytes) = std::fs::read(path) {
            let mut r: Replay = serde_json::from_slice(&bytes)?;
            if !r.frames.is_empty() {
                if r.id.is_empty() {
                    r.id = uuid::Uuid::new_v4().to_string();
                }
                if r.name.is_empty() {
                    r.name = format!("Replay {}", r.date);
                }
                if r.end_date.is_empty() {
                    r.end_date = r.date.clone();
                }
                if let Ok(bytes) =
                    std::fs::read(state.config.database.with_file_name("replay-progress.json"))
                {
                    if let Ok(v) = serde_json::from_slice::<Value>(&bytes) {
                        if v["id"].as_str() == Some(r.id.as_str()) {
                            r.cursor =
                                (v["cursor"].as_u64().unwrap_or(0) as usize).min(r.frames.len());
                            r.speed = v["speed"].as_u64().unwrap_or(60) as u32;
                        }
                    }
                }
                state.store.workspace_import_legacy(&r)?;
            }
        }
        state.store.meta_set("workspace-migrated", "1")?;
    }
    if let Some(id) = state.store.meta_get("active-replay")? {
        return Ok(state.store.workspace_get(&id)?.unwrap_or_default());
    }
    Ok(Replay::default())
}
fn save(state: &AppState, r: &Replay) -> Result<()> {
    state.store.workspace_progress(r)
}
fn publish_quotes(
    m: &mut Market,
    events: &[(String, Value)],
    clock: u64,
    open_only: bool,
) -> Result<()> {
    let mut rows = serde_json::Map::new();
    for (key, bar) in events {
        let stock = m.stock(key)?;
        let provider = stock["providerKey"]
            .as_str()
            .ok_or_else(|| ApiError::bad("No provider mapping"))?;
        let p = if open_only {
            &bar["open"]
        } else {
            &bar["close"]
        };
        rows.insert(provider.into(),json!({"instrument_token":provider,"last_price":p,"timestamp":crate::error::iso(clock),"ohlc":{"open":bar["open"],"high":if open_only{p}else{&bar["high"]},"low":if open_only{p}else{&bar["low"]},"close":bar["open"]},"volume":if open_only{json!(0)}else{bar["volume"].clone()},"depth":{"buy":[],"sell":[]}}));
    }
    m.apply_upstox(&json!({"data":rows}), clock)?;
    for (key, bar) in events {
        if let Some(price) = m.prices.get_mut(key) {
            let mut candle = bar.clone();
            if open_only {
                for f in ["high", "low", "close"] {
                    candle[f] = bar["open"].clone();
                }
                candle["volume"] = json!(0);
            }
            price.view["replayCandle"] = candle;
        }
    }
    m.mode = "replay".into();
    m.replay_time = Some(clock);
    for price in m.prices.values_mut() {
        price.view["source"] = json!("replay");
        price.depth = json!({"bids":[],"asks":[],"source":"replay"});
    }
    Ok(())
}
pub fn market_for(state: &AppState, r: &Replay, full_catalogue: bool) -> Result<Market> {
    let mut stocks: BTreeMap<String, Value> = if full_catalogue || r.instruments.is_empty() {
        provider::catalogue_for(&state.config, "upstox")
    } else {
        vec![]
    }
    .into_iter()
    .filter_map(|s| Some((s["instrumentKey"].as_str()?.to_string(), s)))
    .collect();
    for stock in &r.instruments {
        if let Some(key) = stock["instrumentKey"].as_str() {
            stocks.insert(key.into(), stock.clone());
        }
    }
    let mut m = Market::new(stocks.into_values().collect(), "upstox")?;
    m.mode = "replay".into();
    m.session_id = format!("{}:{}", r.id, r.revision);
    m.status = "connected".into();
    if r.cursor == 0 {
        if let Some((time, events)) = r.frames.first() {
            publish_quotes(&mut m, events, *time, true)?;
        }
    } else {
        let mut latest: BTreeMap<String, (u64, Value)> = BTreeMap::new();
        for (time, events) in r.frames.iter().take(r.cursor) {
            for (key, bar) in events {
                latest.insert(key.clone(), (*time, bar.clone()));
            }
        }
        let mut grouped: BTreeMap<u64, Vec<(String, Value)>> = BTreeMap::new();
        for (key, (time, bar)) in latest {
            grouped.entry(time).or_default().push((key, bar));
        }
        for (time, events) in grouped {
            publish_quotes(&mut m, &events, time + 59999, false)?;
        }
    }
    Ok(m)
}
pub fn rebuild(state: &AppState, r: &Replay) -> Result<()> {
    let market = market_for(state, r, true)?;
    state.store.workspace_activate(r)?;
    *state.market.write().map_err(ApiError::internal)? = market;
    Ok(())
}
struct LoadingGuard<'a> {
    state: &'a AppState,
    id: String,
}
impl Drop for LoadingGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut r) = self.state.replay.lock() {
            if r.id == self.id {
                r.loading = false;
            }
        }
    }
}
pub async fn load(state: &AppState, input: &Value) -> Result<Value> {
    let loading_id = input["id"].as_str().unwrap_or_default().to_string();
    let _loading = LoadingGuard {
        state,
        id: loading_id.clone(),
    };
    let editing = input["action"] == "edit";
    let extension = if input["action"] == "extend" || editing {
        let id = input["id"]
            .as_str()
            .ok_or_else(|| ApiError::bad("Workspace ID required"))?;
        {
            let mut r = state.replay.lock().map_err(ApiError::internal)?;
            if r.id == id {
                r.playing = false;
                r.loading = true;
                save(state, &r)?;
            }
        }
        Some(
            state
                .store
                .workspace_get(id)?
                .ok_or_else(ApiError::not_found)?,
        )
    } else {
        None
    };
    let mut request = input.clone();
    if let Some(old) = &extension {
        let end = chrono::NaiveDate::parse_from_str(
            if old.end_date.is_empty() {
                &old.date
            } else {
                &old.end_date
            },
            "%Y-%m-%d",
        )
        .map_err(ApiError::internal)?;
        let requested = input["endDate"]
            .as_str()
            .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
            .ok_or_else(|| ApiError::bad("Select an extended end date"))?;
        if editing && (old.cursor > 0 || state.store.workspace_has_activity(&old.id)?) {
            return Err(ApiError::bad(
                "Played/traded history cannot be rewritten. Extend the end date instead.",
            ));
        }
        if !editing && requested <= end {
            return Err(ApiError::bad(
                "New end date must be later; played history cannot be rewritten",
            ));
        }
        if !editing {
            request["startDate"] = json!((end + chrono::Duration::days(1)).to_string());
        }
        request["name"] = json!(input["name"].as_str().unwrap_or(&old.name));
        let keys: std::collections::BTreeSet<String> = old
            .frames
            .iter()
            .flat_map(|(_, v)| v.iter().map(|(k, _)| k.clone()))
            .collect();
        request["instrumentKeys"] = json!(keys);
    }
    let req = &request;
    let settings = state.provider.lock().map_err(ApiError::internal)?.clone();
    if settings.mode != "upstox" || settings.token.is_empty() {
        return Err(ApiError::bad("Configure Upstox before loading replay"));
    }
    let date = req
        .get("startDate")
        .unwrap_or(&req["date"])
        .as_str()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
        .ok_or_else(|| ApiError::bad("Select a historical date"))?;
    let end = match req.get("endDate") {
        Some(v) => v
            .as_str()
            .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
            .ok_or_else(|| ApiError::bad("Select a valid end date"))?,
        None => date,
    };
    if end < date {
        return Err(ApiError::bad("End date must follow start date"));
    }
    let name = req["name"].as_str().unwrap_or("Replay workspace").trim();
    if name.is_empty() || name.len() > 80 {
        return Err(ApiError::bad("Enter a workspace name (maximum 80 bytes)"));
    }
    let today = (chrono::Utc::now() + chrono::Duration::minutes(330)).date_naive();
    if end >= today {
        return Err(ApiError::bad(
            "Replay requires a completed past trading day",
        ));
    }
    let keys = req["instrumentKeys"]
        .as_array()
        .filter(|a| !a.is_empty() && a.len() <= 20)
        .ok_or_else(|| ApiError::bad("Select 1–20 replay instruments"))?;
    let unique: std::collections::BTreeSet<&str> = keys
        .iter()
        .map(|v| {
            v.as_str()
                .ok_or_else(|| ApiError::bad("Invalid instrument key"))
        })
        .collect::<Result<_>>()?;
    if unique.len() != keys.len() {
        return Err(ApiError::bad("Duplicate replay instruments"));
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("CONE/0.1 paper-trading")
        .build()
        .map_err(ApiError::internal)?;
    let mut metadata = Vec::new();
    let mut frames: BTreeMap<u64, Vec<(String, Value)>> = BTreeMap::new();
    for key in keys {
        let key = key
            .as_str()
            .ok_or_else(|| ApiError::bad("Invalid instrument key"))?;
        let stock = extension
            .as_ref()
            .and_then(|r| r.instruments.iter().find(|s| s["instrumentKey"] == key))
            .cloned()
            .or_else(|| state.market_snapshot().ok()?.catalogue.get(key).cloned())
            .ok_or_else(|| ApiError::bad("Unknown replay instrument"))?;
        let provider = stock["providerKey"]
            .as_str()
            .ok_or_else(|| ApiError::bad("No Upstox mapping"))?
            .to_string();
        metadata.push(stock);
        let mut chunk_start = date;
        while chunk_start <= end {
            let chunk_end = (chunk_start + chrono::Duration::days(27)).min(end);
            let mut url = reqwest::Url::parse("https://api.upstox.com/v3/historical-candle/")
                .map_err(ApiError::internal)?;
            url.path_segments_mut()
                .map_err(|_| ApiError::bad("Invalid replay URL"))?
                .pop_if_empty()
                .extend([
                    provider.as_str(),
                    "minutes",
                    "1",
                    &chunk_end.to_string(),
                    &chunk_start.to_string(),
                ]);
            let response = client
                .get(url)
                .bearer_auth(&settings.token)
                .send()
                .await
                .map_err(|_| ApiError::bad("Upstox replay connection failed"))?;
            if !response.status().is_success() {
                return Err(ApiError::bad(format!(
                    "Upstox replay returned HTTP {}",
                    response.status().as_u16()
                )));
            }
            let body: Value = response
                .json()
                .await
                .map_err(|_| ApiError::bad("Invalid replay data"))?;
            for bar in crate::history::normalize(&body)? {
                let time = bar["time"].as_u64().unwrap_or(0) * 1000;
                let session = cone_engine::indian_equity_session(time);
                let day = (chrono::DateTime::from_timestamp_millis(time as i64).unwrap()
                    + chrono::Duration::minutes(330))
                .date_naive();
                if day >= date && day <= end && session != cone_engine::Session::Closed {
                    frames.entry(time).or_default().push((key.into(), bar));
                }
            }
            if frames.values().map(Vec::len).sum::<usize>() > 500_000 {
                return Err(ApiError::bad(
                    "Range is too large; choose fewer instruments or a shorter range",
                ));
            }
            chunk_start = chunk_end + chrono::Duration::days(1);
        }
    }
    if frames.is_empty() && extension.is_none() {
        return Err(ApiError::bad(
            "No candles for that session; choose another trading day",
        ));
    }
    let guard = state.provider.lock().map_err(ApiError::internal)?;
    if guard.revision != settings.revision {
        return Err(ApiError::bad(
            "Provider changed during replay loading; retry",
        ));
    }
    drop(guard);
    let mut new = Replay {
        id: uuid::Uuid::new_v4().to_string(),
        date: date.to_string(),
        end_date: end.to_string(),
        name: name.to_string(),
        ended: false,
        revision: 0,
        instruments: metadata,
        frames: frames.into_iter().collect(),
        cursor: 0,
        speed: 60,
        playing: false,
        loading: false,
        last: None,
    };
    let activate = if let Some(old) = extension {
        let active = state.market_snapshot()?.mode == "replay"
            && state.replay.lock().map_err(ApiError::internal)?.id == old.id;
        if editing {
            new.id = old.id;
            new.speed = old.speed;
            new.revision = old.revision + 1;
        } else {
            let mut combined = old;
            combined.revision += 1;
            if combined.instruments.is_empty() {
                combined.instruments = new.instruments;
            }
            combined.frames.extend(new.frames);
            combined.name = new.name;
            combined.end_date = end.to_string();
            combined.ended = false;
            combined.playing = false;
            combined.last = None;
            new = combined;
        }
        active
    } else {
        true
    };
    state.store.workspace_put(&new)?;
    if activate {
        {
            let mut previous = state.replay.lock().map_err(ApiError::internal)?;
            previous.playing = false;
            save(state, &previous)?;
        }
        provider::configure(state, &json!({"provider":"upstox","dataMode":"replay"}))?;
        let mut session = state.replay.lock().map_err(ApiError::internal)?;
        rebuild(state, &new)?;
        *session = new;
        save(state, &session)?;
        Ok(session.view())
    } else {
        Ok(new.view())
    }
}
pub fn control(state: &AppState, req: &Value) -> Result<Value> {
    if state.market_snapshot()?.mode != "replay" {
        return Err(ApiError::bad("Select Historical replay first"));
    }
    let mut r = state.replay.lock().map_err(ApiError::internal)?;
    if r.loading {
        return Err(ApiError::bad(
            "Workspace dates are being updated; wait for loading to finish",
        ));
    }
    if r.frames.is_empty() {
        return Err(ApiError::bad("Load a past session first"));
    }
    if (r.ended || r.cursor >= r.frames.len())
        && matches!(req["action"].as_str(), Some("play" | "step"))
    {
        return Err(ApiError::bad(
            "Workspace is complete. Extend its end date to continue.",
        ));
    }
    if let Some(speed) = req["speed"].as_u64() {
        if ![1, 10, 60].contains(&speed) {
            return Err(ApiError::bad("Replay speed must be 1, 10 or 60"));
        }
        r.speed = speed as u32;
    }
    match req["action"].as_str().unwrap_or("pause") {
        "play" => {
            r.playing = true;
            r.last = Some(Instant::now());
        }
        "pause" => r.playing = false,
        "end" => {
            r.playing = false;
            r.ended = true;
        }
        "step" => {
            r.playing = false;
            advance(state, &mut r)?;
        }
        _ => return Err(ApiError::bad("Unknown replay action")),
    };
    if req["action"] != "step" {
        save(state, &r)?;
    }
    Ok(r.view())
}
fn advance(state: &AppState, r: &mut Replay) -> Result<()> {
    let Some((time, events)) = r.frames.get(r.cursor) else {
        r.playing = false;
        return Ok(());
    };
    let mut current = state.market.write().map_err(ApiError::internal)?;
    if current.mode != "replay" || current.session_id != format!("{}:{}", r.id, r.revision) {
        return Err(ApiError::bad("Replay selection changed; retry"));
    }
    let old = current.clone();
    publish_quotes(&mut current, events, time + 59999, false)?;
    let market = current.clone();
    drop(current);
    let previous_playing = r.playing;
    r.cursor += 1;
    if r.cursor >= r.frames.len() {
        r.playing = false;
    }
    if let Err(error) = state.store.workspace_apply_step(r, &market) {
        r.cursor -= 1;
        r.playing = previous_playing;
        let mut current = state.market.write().map_err(ApiError::internal)?;
        if current.session_id == market.session_id && current.mode == "replay" {
            *current = old;
        }
        return Err(error);
    }
    Ok(())
}
pub fn tick(state: &AppState) -> Result<()> {
    if state.market_snapshot()?.mode != "replay" {
        return Ok(());
    }
    let mut r = state.replay.lock().map_err(ApiError::internal)?;
    if r.playing
        && r.last.is_none_or(|t| {
            t.elapsed() >= Duration::from_secs_f64(60.0 / f64::from(r.speed.max(1)))
        })
    {
        advance(state, &mut r)?;
        r.last = Some(Instant::now());
    }
    Ok(())
}

pub static WORKSPACE_OPS: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
pub fn workspaces(state: &AppState, user: i64, id: Option<&str>) -> Result<Value> {
    let active = state.replay.lock().map_err(ApiError::internal)?;
    if let Some(id) = id {
        let r = state
            .store
            .workspace_get(id)?
            .ok_or_else(ApiError::not_found)?;
        let market = market_for(state, &r, false)?;
        let book = state.store.workspace_book(id, user)?;
        return Ok(
            json!({"workspace":if active.id==id{active.view()}else{r.view()},"portfolio":crate::service::snapshot(&book,&market)?,"prices":market.views()}),
        );
    }
    let mut list = state.store.workspace_list()?;
    for item in &mut list {
        if item["id"] == active.id {
            *item = active.view();
        } else {
            item["playing"] = json!(false);
            if item["status"] == "playing" {
                item["status"] = json!("paused");
            }
        }
        let id = item["id"].as_str().unwrap_or_default();
        let r = state
            .store
            .workspace_get(id)?
            .ok_or_else(ApiError::not_found)?;
        let market = market_for(state, &r, false)?;
        let book = state.store.workspace_book(id, user)?;
        let equity = book
            .engine
            .account()
            .equity(&market.marks())
            .ok()
            .map(|v| crate::error::coins(v.minor()));
        item["results"] = json!({"equity":equity,"cash":crate::error::coins(book.engine.account().available_cash().minor()),"holdings":book.engine.account().holdings().len(),"positions":book.engine.account().positions().len(),"trades":book.engine.executions().len(),"orders":book.orders.len()});
    }
    Ok(json!({"activeId":active.id,"workspaces":list}))
}
pub fn workspace_action(state: &AppState, req: &Value) -> Result<Value> {
    let id = req["id"]
        .as_str()
        .ok_or_else(|| ApiError::bad("Workspace ID required"))?;
    let mut selected = state
        .store
        .workspace_get(id)?
        .ok_or_else(ApiError::not_found)?;
    match req["action"].as_str().unwrap_or_default() {
        "activate" => {
            {
                let mut current = state.replay.lock().map_err(ApiError::internal)?;
                current.playing = false;
                save(state, &current)?;
            }
            provider::configure(state, &json!({"provider":"upstox","dataMode":"replay"}))?;
            let mut current = state.replay.lock().map_err(ApiError::internal)?;
            selected.playing = false;
            rebuild(state, &selected)?;
            *current = selected;
            Ok(current.view())
        }
        "rename" => {
            let name = req["name"].as_str().unwrap_or_default().trim();
            if name.is_empty() || name.len() > 80 {
                return Err(ApiError::bad("Enter a workspace name (maximum 80 bytes)"));
            }
            let mut current = state.replay.lock().map_err(ApiError::internal)?;
            if current.id == id {
                current.name = name.into();
                state.store.workspace_put(&current)?;
                Ok(current.view())
            } else {
                selected.name = name.into();
                state.store.workspace_put(&selected)?;
                Ok(selected.view())
            }
        }
        "delete" => {
            let mut current = state.replay.lock().map_err(ApiError::internal)?;
            if current.id == id {
                provider::configure(state, &json!({"provider":"upstox","dataMode":"live"}))?;
                *current = Replay::default();
                state.store.meta_set("active-replay", "")?;
                state.store.workspace_activate(&current)?;
            }
            state.store.workspace_delete(id)?;
            Ok(json!({"success":true}))
        }
        _ => Err(ApiError::bad("Unknown workspace action")),
    }
}
