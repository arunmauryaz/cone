//! Durable candles observed by this installation, never broker backfill.
use crate::error::{ApiError, Result};
use chrono::{Datelike, TimeZone};
use rusqlite::{Connection, params};
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::Path, sync::Mutex};
pub struct LiveArchive(Mutex<Connection>);
impl LiveArchive {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS bars(instrument TEXT NOT NULL,time INTEGER NOT NULL,open REAL NOT NULL,high REAL NOT NULL,low REAL NOT NULL,close REAL NOT NULL,volume INTEGER NOT NULL,PRIMARY KEY(instrument,time));")?;
        Ok(Self(Mutex::new(conn)))
    }
    pub fn record(&self, key: &str, time: u64, price: f64, volume: u64) -> Result<()> {
        let bucket = time / 60000 * 60;
        let conn = self.0.lock().map_err(ApiError::internal)?;
        conn.execute("INSERT INTO bars VALUES(?1,?2,?3,?3,?3,?3,?4) ON CONFLICT(instrument,time) DO UPDATE SET high=max(high,excluded.high),low=min(low,excluded.low),close=excluded.close,volume=volume+excluded.volume",params![key,bucket,price,volume])?;
        Ok(())
    }
    pub fn day_summary(&self, key: &str, time: u64) -> Result<Value> {
        let day = bucket((time / 1000) as i64, "day")?;
        let conn = self.0.lock().map_err(ApiError::internal)?;
        let mut stmt=conn.prepare("SELECT time,open,high,low,close,volume FROM bars WHERE instrument=?1 AND time>=?2 AND time<?3 ORDER BY time")?;
        let rows=stmt.query_map(params![key,day,day+86400],|r|Ok(json!({"time":r.get::<_,i64>(0)?,"open":r.get::<_,f64>(1)?,"high":r.get::<_,f64>(2)?,"low":r.get::<_,f64>(3)?,"close":r.get::<_,f64>(4)?,"volume":r.get::<_,u64>(5)?})))?.collect::<std::result::Result<Vec<_>,_>>()?;
        aggregate(rows, "day", 1)
    }
    pub fn candles(&self, key: &str, interval: &str, count: usize) -> Result<Value> {
        let conn = self.0.lock().map_err(ApiError::internal)?;
        let mut stmt = conn.prepare(
            "SELECT time,open,high,low,close,volume FROM bars WHERE instrument=?1 ORDER BY time",
        )?;
        let rows=stmt.query_map([key],|r|Ok(json!({"time":r.get::<_,i64>(0)?,"open":r.get::<_,f64>(1)?,"high":r.get::<_,f64>(2)?,"low":r.get::<_,f64>(3)?,"close":r.get::<_,f64>(4)?,"volume":r.get::<_,u64>(5)?})))?.collect::<std::result::Result<Vec<_>,_>>()?;
        aggregate(rows, interval, count)
    }
}
pub fn bucket(time: i64, interval: &str) -> Result<i64> {
    let zone = chrono::FixedOffset::east_opt(19800).unwrap();
    let date = zone
        .timestamp_opt(time, 0)
        .single()
        .ok_or_else(|| ApiError::bad("Invalid candle timestamp"))?
        .date_naive();
    let midnight = date.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp() - 19800;
    Ok(match interval {
        "1minute" => time / 60 * 60,
        "5minute" | "15minute" | "30minute" | "1hour" => {
            let sec = match interval {
                "5minute" => 300,
                "15minute" => 900,
                "30minute" => 1800,
                _ => 3600,
            };
            let anchor = midnight + 33300;
            anchor + (time - anchor).div_euclid(sec) * sec
        }
        "day" => midnight,
        "week" => midnight - i64::from(date.weekday().num_days_from_monday()) * 86400,
        "month" => {
            date.with_day(1)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap()
                .and_utc()
                .timestamp()
                - 19800
        }
        "year" => {
            date.with_day(1)
                .unwrap()
                .with_month(1)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap()
                .and_utc()
                .timestamp()
                - 19800
        }
        _ => return Err(ApiError::bad("Unsupported candle interval")),
    })
}
pub fn aggregate(rows: Vec<Value>, interval: &str, count: usize) -> Result<Value> {
    let mut bars: BTreeMap<i64, Value> = BTreeMap::new();
    for mut row in rows {
        let time = bucket(
            row["time"]
                .as_i64()
                .ok_or_else(|| ApiError::bad("Missing candle time"))?,
            interval,
        )?;
        if let Some(bar) = bars.get_mut(&time) {
            bar["high"] = json!(
                bar["high"]
                    .as_f64()
                    .unwrap()
                    .max(row["high"].as_f64().unwrap())
            );
            bar["low"] = json!(
                bar["low"]
                    .as_f64()
                    .unwrap()
                    .min(row["low"].as_f64().unwrap())
            );
            bar["close"] = row["close"].clone();
            bar["volume"] = json!(
                bar["volume"].as_f64().unwrap_or(0.0) + row["volume"].as_f64().unwrap_or(0.0)
            );
        } else {
            row["time"] = json!(time);
            bars.insert(time, row);
        }
    }
    let skip = bars.len().saturating_sub(count);
    Ok(json!(bars.into_values().skip(skip).collect::<Vec<_>>()))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restart_preserves_gaps_without_inventing_bars() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("live.sqlite3");
        {
            let db = LiveArchive::open(&path).unwrap();
            db.record("a", 1793331900000, 100.0, 3).unwrap();
            db.record("a", 1793504700000, 110.0, 4).unwrap();
        }
        let db = LiveArchive::open(&path).unwrap();
        let rows = db.candles("a", "1minute", 100).unwrap();
        assert_eq!(rows.as_array().unwrap().len(), 2);
        assert_eq!(
            rows[1]["time"].as_i64().unwrap() - rows[0]["time"].as_i64().unwrap(),
            172800
        );
    }
}
