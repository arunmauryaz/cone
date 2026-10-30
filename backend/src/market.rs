use crate::error::{ApiError, Result, coins, minor, now_ms};
use cone_engine::{Money, Quote};
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::Arc};

#[derive(Clone)]
pub struct Price {
    pub minor: i64,
    pub timestamp: u64,
    pub view: Value,
    pub depth: Value,
}
#[derive(Clone)]
pub struct Market {
    pub stocks: Arc<Vec<Value>>,
    pub catalogue: Arc<BTreeMap<String, Value>>,
    pub provider_keys: Arc<BTreeMap<String, String>>,
    pub prices: BTreeMap<String, Price>,
    pub mode: String,
    pub status: String,
    pub replay_time: Option<u64>,
    pub session_id: String,
}

impl Market {
    pub fn new(stocks: Vec<Value>, mode: &str) -> Result<Self> {
        if (stocks.is_empty() && mode != "upstox") || stocks.len() > 50000 {
            return Err(ApiError::bad("Instrument catalogue needs 1–50000 entries"));
        }
        let mut seen = std::collections::BTreeSet::new();
        for s in &stocks {
            let key = crate::error::text(s, "instrumentKey")?;
            if !seen.insert(key) {
                return Err(ApiError::bad("Duplicate instrument key"));
            }
            crate::error::text(s, "tradingsymbol")?;
            crate::error::text(s, "name")?;
            if mode != "upstox" {
                minor(&s["basePrice"])?;
            }
            if mode == "upstox" {
                crate::error::text(s, "providerKey")?;
            }
        }
        let mut market = Self {
            catalogue: Arc::new(
                stocks
                    .iter()
                    .filter_map(|s| Some((s["instrumentKey"].as_str()?.into(), s.clone())))
                    .collect(),
            ),
            provider_keys: Arc::new(
                stocks
                    .iter()
                    .filter_map(|s| {
                        Some((
                            s["providerKey"].as_str()?.into(),
                            s["instrumentKey"].as_str()?.into(),
                        ))
                    })
                    .collect(),
            ),
            stocks: Arc::new(stocks),
            prices: BTreeMap::new(),
            mode: mode.into(),
            status: "starting".into(),
            replay_time: None,
            session_id: String::new(),
        };
        if mode == "fixture" {
            market.seed_fixture()?;
        }
        Ok(market)
    }
    pub fn now_ms(&self) -> u64 {
        self.replay_time.unwrap_or_else(now_ms)
    }
    pub fn stock(&self, key: &str) -> Result<&Value> {
        self.catalogue.get(key).ok_or_else(ApiError::not_found)
    }
    pub fn quote(&self, key: &str) -> Result<Quote> {
        let p = self
            .prices
            .get(key)
            .ok_or_else(|| ApiError::bad("No market quote available"))?;
        Ok(Quote {
            instrument: key.into(),
            price: Money::from_minor(p.minor),
            timestamp_ms: p.timestamp,
        })
    }
    pub fn views(&self) -> Value {
        self.prices
            .iter()
            .map(|(k, p)| (k.clone(), p.view.clone()))
            .collect::<serde_json::Map<_, _>>()
            .into()
    }
    pub fn marks(&self) -> BTreeMap<String, Money> {
        self.prices
            .iter()
            .map(|(k, p)| (k.clone(), Money::from_minor(p.minor)))
            .collect()
    }
    // Deterministic static quotes for isolated Rust integration tests only.
    fn seed_fixture(&mut self) -> Result<()> {
        let now = now_ms();
        for stock in self.stocks.iter() {
            let key = stock["instrumentKey"].as_str().unwrap_or_default();
            let price = minor(&stock["basePrice"])?;
            let mut view = stock.clone();
            for(k,v)in json!({"ltp":coins(price),"open":coins(price),"high":coins(price),"low":coins(price),"close":coins(price),"change":0,"changePercent":0,"volume":0,"lastUpdate":now as f64/1000.0,"source":"fixture"}).as_object().unwrap(){view[k]=v.clone();}
            self.prices.insert(
                key.into(),
                Price {
                    minor: price,
                    timestamp: now,
                    view,
                    depth: json!({"bids":[],"asks":[],"source":"fixture"}),
                },
            );
        }
        self.status = "connected".into();
        Ok(())
    }
    /// Normalize provider data at the boundary; floats never enter accounting.
    /// Missing instruments retain their old timestamp and become untradeable.
    pub fn apply_upstox(&mut self, response: &Value, received: u64) -> Result<usize> {
        let data = response["data"]
            .as_object()
            .ok_or_else(|| ApiError::bad("Invalid Upstox response"))?;
        let mut count = 0;
        let by_provider = data
            .values()
            .filter_map(|v| v["instrument_token"].as_str().map(|key| (key, v)))
            .collect::<BTreeMap<_, _>>();
        let selected = by_provider
            .keys()
            .filter_map(|p| self.provider_keys.get(*p))
            .filter_map(|key| self.catalogue.get(key))
            .cloned()
            .collect::<Vec<_>>();
        for s in selected {
            let provider = s["providerKey"].as_str().unwrap_or_default();
            let Some(raw) = by_provider.get(provider) else {
                continue;
            };
            let Some(ltp) = raw["last_price"]
                .as_f64()
                .filter(|n| n.is_finite() && *n > 0.0 && *n < 1e12)
            else {
                continue;
            };
            let price = (ltp * 100.0).round() as i64;
            let key = s["instrumentKey"].as_str().unwrap_or_default();
            let timestamp = raw["timestamp"]
                .as_str()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|t| t.timestamp_millis().max(0) as u64)
                .unwrap_or(received);
            let close = raw["ohlc"]["close"].as_f64().unwrap_or(ltp);
            let mut view = s.clone();
            for (k,v) in json!({"ltp":coins(price),"open":raw["ohlc"]["open"],"high":raw["ohlc"]["high"],"low":raw["ohlc"]["low"],"close":close,"volume":raw["volume"],"change":ltp-close,"changePercent":if close>0.0 {(ltp-close)/close*100.0}else{0.0},"lastUpdate":timestamp as f64/1000.0,"source":"upstox"}).as_object().unwrap() {view[k]=v.clone();}
            let levels = |side: &str| -> Vec<Value> {
                raw["depth"][side].as_array().map(|a|a.iter().take(5).map(|v|json!({"price":v["price"],"qty":v["quantity"],"orders":v["orders"]})).collect()).unwrap_or_default()
            };
            self.prices.insert(
                key.into(),
                Price {
                    minor: price,
                    timestamp,
                    view,
                    depth: json!({"bids":levels("buy"),"asks":levels("sell"),"source":"upstox"}),
                },
            );
            count += 1;
        }
        self.status = if count > 0 {
            "connected"
        } else {
            "unavailable"
        }
        .into();
        Ok(count)
    }
}

pub fn fixture_catalog() -> Result<Vec<Value>> {
    Ok(serde_json::from_str(include_str!(
        "../tests/fixtures/instruments.json"
    ))?)
}
