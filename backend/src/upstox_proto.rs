//! Fields used from Upstox MarketDataFeed V3; unknown protobuf fields are skipped.
//! Schema: https://assets.upstox.com/feed/market-data-feed/v3/MarketDataFeed.proto
use prost::Message;
use std::collections::HashMap;
#[derive(Clone, PartialEq, Message)]
pub struct FeedResponse {
    #[prost(int32, tag = "1")]
    pub feed_type: i32,
    #[prost(map = "string, message", tag = "2")]
    pub feeds: HashMap<String, Feed>,
    #[prost(int64, tag = "3")]
    pub current_ts: i64,
}
#[derive(Clone, PartialEq, Message)]
pub struct Feed {
    #[prost(message, optional, tag = "1")]
    pub ltpc: Option<Ltpc>,
    #[prost(message, optional, tag = "2")]
    pub full: Option<Full>,
}
#[derive(Clone, PartialEq, Message)]
pub struct Full {
    #[prost(message, optional, tag = "1")]
    pub market: Option<MarketFull>,
    #[prost(message, optional, tag = "2")]
    pub index: Option<IndexFull>,
}
#[derive(Clone, PartialEq, Message)]
pub struct Ltpc {
    #[prost(double, tag = "1")]
    pub ltp: f64,
    #[prost(int64, tag = "2")]
    pub ltt: i64,
    #[prost(double, tag = "4")]
    pub cp: f64,
    #[prost(int64, tag = "3")]
    pub quantity: i64,
}
#[derive(Clone, PartialEq, Message)]
pub struct MarketFull {
    #[prost(message, optional, tag = "1")]
    pub ltpc: Option<Ltpc>,
    #[prost(message, optional, tag = "2")]
    pub level: Option<Level>,
    #[prost(message, optional, tag = "4")]
    pub ohlc: Option<MarketOhlc>,
    #[prost(int64, tag = "6")]
    pub volume: i64,
}
#[derive(Clone, PartialEq, Message)]
pub struct IndexFull {
    #[prost(message, optional, tag = "1")]
    pub ltpc: Option<Ltpc>,
    #[prost(message, optional, tag = "2")]
    pub ohlc: Option<MarketOhlc>,
}
#[derive(Clone, PartialEq, Message)]
pub struct Level {
    #[prost(message, repeated, tag = "1")]
    pub quotes: Vec<LevelQuote>,
}
#[derive(Clone, PartialEq, Message)]
pub struct LevelQuote {
    #[prost(int64, tag = "1")]
    pub bid_qty: i64,
    #[prost(double, tag = "2")]
    pub bid: f64,
    #[prost(int64, tag = "3")]
    pub ask_qty: i64,
    #[prost(double, tag = "4")]
    pub ask: f64,
}
#[derive(Clone, PartialEq, Message)]
pub struct MarketOhlc {
    #[prost(message, repeated, tag = "1")]
    pub bars: Vec<Ohlc>,
}
#[derive(Clone, PartialEq, Message)]
pub struct Ohlc {
    #[prost(string, tag = "1")]
    pub interval: String,
    #[prost(double, tag = "2")]
    pub open: f64,
    #[prost(double, tag = "3")]
    pub high: f64,
    #[prost(double, tag = "4")]
    pub low: f64,
    #[prost(double, tag = "5")]
    pub close: f64,
}

pub fn normalize(bytes: &[u8]) -> crate::error::Result<serde_json::Value> {
    use serde_json::json;
    let response = FeedResponse::decode(bytes)
        .map_err(|_| crate::error::ApiError::bad("Invalid Upstox feed frame"))?;
    let mut data = serde_json::Map::new();
    for (key, feed) in response.feeds {
        let market = feed.full.as_ref().and_then(|f| f.market.as_ref());
        let index = feed.full.as_ref().and_then(|f| f.index.as_ref());
        let ltpc = feed
            .ltpc
            .as_ref()
            .or_else(|| market.and_then(|m| m.ltpc.as_ref()))
            .or_else(|| index.and_then(|m| m.ltpc.as_ref()));
        let Some(p) = ltpc else { continue };
        if !p.ltp.is_finite() || p.ltp <= 0.0 {
            continue;
        }
        let ohlc = market
            .and_then(|m| m.ohlc.as_ref())
            .or_else(|| index.and_then(|m| m.ohlc.as_ref()))
            .and_then(|o| o.bars.iter().find(|b| b.interval == "1d"));
        let depth = market.and_then(|m| m.level.as_ref());
        let side = |buy: bool| -> Vec<serde_json::Value> {
            depth.map(|d|d.quotes.iter().take(5).map(|q|json!({"price":if buy{q.bid}else{q.ask},"quantity":if buy{q.bid_qty}else{q.ask_qty}})).collect()).unwrap_or_default()
        };
        let ts = if p.ltt > 0 {
            p.ltt
        } else {
            response.current_ts
        };
        if ts <= 0 {
            continue;
        }
        data.insert(key.clone(),json!({"instrument_token":key,"last_price":p.ltp,"lastQuantity":p.quantity,"timestamp":crate::error::iso(ts as u64),"ohlc":{"open":ohlc.map(|o|o.open),"high":ohlc.map(|o|o.high),"low":ohlc.map(|o|o.low),"close":p.cp},"volume":market.map(|m|m.volume),"depth":{"buy":side(true),"sell":side(false)}}));
    }
    Ok(json!({"data":data,"feedType":response.feed_type}))
}
