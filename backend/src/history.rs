//! On-demand broker candles, separate from executable quotes and accounting.
use crate::error::{ApiError, Result, now_ms};
use chrono::Datelike;
use serde_json::{Value, json};
use std::collections::BTreeMap;

pub fn normalize(body: &Value) -> Result<Vec<Value>> {
    let rows = body["data"]["candles"]
        .as_array()
        .ok_or_else(|| ApiError::bad("Invalid Upstox candle response"))?;
    let mut bars = BTreeMap::new();
    for row in rows {
        let Some(time) = row[0]
            .as_str()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.timestamp())
        else {
            continue;
        };
        let nums: Option<Vec<f64>> = (1..=5)
            .map(|i| row[i].as_f64().filter(|v| v.is_finite() && *v >= 0.0))
            .collect();
        let Some(n) = nums else { continue };
        if time > (now_ms() / 1000) as i64
            || time <= 0
            || n[..4].contains(&0.0)
            || n[1] < n[0].max(n[3])
            || n[2] > n[0].min(n[3])
            || n[2] > n[1]
        {
            continue;
        }
        bars.insert(
            time,
            json!({"time":time,"open":n[0],"high":n[1],"low":n[2],"close":n[3],"volume":n[4]}),
        );
    }
    Ok(bars.into_values().collect())
}
pub fn calendar_bars(rows: Vec<Value>, yearly: bool) -> Vec<Value> {
    let mut months: BTreeMap<i64, Value> = BTreeMap::new();
    for row in rows {
        let Some(t) = row["time"]
            .as_i64()
            .and_then(|t| chrono::DateTime::from_timestamp(t, 0))
        else {
            continue;
        };
        let date = (t + chrono::Duration::minutes(330)).date_naive();
        let date = if yearly {
            date.with_month(1)
                .and_then(|d| d.with_day(1))
                .unwrap_or(date)
        } else {
            date
        };
        let Some(start) = date.with_day(1).and_then(|d| d.and_hms_opt(0, 0, 0)) else {
            continue;
        };
        let stamp = start.and_utc().timestamp() - 19800;
        if let Some(bar) = months.get_mut(&stamp) {
            bar["high"] = json!(
                bar["high"]
                    .as_f64()
                    .unwrap_or(0.0)
                    .max(row["high"].as_f64().unwrap_or(0.0))
            );
            bar["low"] = json!(
                bar["low"]
                    .as_f64()
                    .unwrap_or(f64::MAX)
                    .min(row["low"].as_f64().unwrap_or(f64::MAX))
            );
            bar["close"] = row["close"].clone();
            bar["volume"] = json!(
                bar["volume"].as_f64().unwrap_or(0.0) + row["volume"].as_f64().unwrap_or(0.0)
            );
        } else {
            let mut bar = row;
            bar["time"] = json!(stamp);
            months.insert(stamp, bar);
        }
    }
    months.into_values().collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn yearly_combines_only_available_calendar_years() {
        let input = json!({"data":{"candles":[["2025-12-31T00:00:00+05:30",10,12,9,11,5],["2026-01-01T00:00:00+05:30",11,14,10,13,7],["2026-10-01T00:00:00+05:30",13,15,12,14,8]]}});
        let rows = calendar_bars(normalize(&input).unwrap(), true);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[1]["open"].as_f64(), Some(11.0));
        assert_eq!(rows[1]["close"].as_f64(), Some(14.0));
        assert_eq!(rows[1]["volume"].as_f64(), Some(15.0));
        assert_eq!(
            chrono::DateTime::from_timestamp(rows[1]["time"].as_i64().unwrap() + 19800, 0)
                .unwrap()
                .date_naive()
                .to_string(),
            "2026-01-01"
        );
    }
    #[test]
    fn monthly_uses_calendar_boundaries_and_actual_daily_ohlcv() {
        let input = json!({"data":{"candles":[["2026-09-30T00:00:00+05:30",10,12,9,11,5],["2026-10-01T00:00:00+05:30",11,14,10,13,7],["2026-10-02T00:00:00+05:30",13,15,12,14,8],["2099-01-01T00:00:00+05:30",1,2,1,2,1]]}});
        let rows = calendar_bars(normalize(&input).unwrap(), false);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[1]["open"].as_f64(), Some(11.0));
        assert_eq!(rows[1]["high"].as_f64(), Some(15.0));
        assert_eq!(rows[1]["low"].as_f64(), Some(10.0));
        assert_eq!(rows[1]["close"].as_f64(), Some(14.0));
        assert_eq!(rows[1]["volume"].as_f64(), Some(15.0));
        assert_eq!(
            chrono::DateTime::from_timestamp(rows[1]["time"].as_i64().unwrap() + 19800, 0)
                .unwrap()
                .date_naive()
                .to_string(),
            "2026-10-01"
        );
    }
    #[test]
    fn candles_sort_deduplicate_and_reject_invalid_ohlc() {
        let body = json!({"data":{"candles":[["2026-10-29T09:16:00+05:30",100,102,99,101,20],["2026-10-29T09:15:00+05:30",98,101,97,100,10],["bad",1,2,1,2,0],["2026-10-29T09:17:00+05:30",100,90,99,101,20]]}});
        let rows = normalize(&body).unwrap();
        assert_eq!(rows.len(), 2);
        assert!(rows[0]["time"].as_i64() < rows[1]["time"].as_i64());
        assert_eq!(rows[0]["volume"].as_f64(), Some(10.0));
    }
}
