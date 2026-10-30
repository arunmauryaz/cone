//! Durable paper-order scheduling. Never calls a broker order-placement API.
use crate::{
    error::{ApiError, Result, coins, id, iso, minor, now_ms, text},
    market::Market,
    model::Book,
    orders,
};
use chrono::{Datelike, TimeZone, Timelike};
use serde_json::{Value, json};

pub fn create_alert(book: &mut Book, req: &Value, market: &Market) -> Result<()> {
    if book.alerts.len() >= 200 {
        return Err(ApiError::bad("Maximum 200 alerts"));
    }
    let instrument = text(req, "instrumentKey")?;
    market.stock(instrument)?;
    let target = minor(
        req.get("target")
            .or(req.get("targetPrice"))
            .unwrap_or(&Value::Null),
    )?;
    let condition = req["condition"].as_str().unwrap_or("above");
    if !["above", "below", "GTE", "LTE"].contains(&condition) {
        return Err(ApiError::bad("Unknown alert condition"));
    }
    book.alerts.insert(0,json!({"id":id(),"instrumentKey":instrument,"tradingsymbol":market.stock(instrument)?["tradingsymbol"],"condition":if ["above","GTE"].contains(&condition){"above"}else{"below"},"target":coins(target),"targetMinor":target,"active":true,"createdAt":iso(now_ms())}));
    Ok(())
}

pub fn create_gtt(book: &mut Book, req: &Value, market: &Market) -> Result<()> {
    if book.gtt.len() >= 200 {
        return Err(ApiError::bad("Maximum 200 GTT orders"));
    }
    let instrument = text(req, "instrumentKey")?;
    let current = market.quote(instrument)?.price.minor();
    let inputs = if let Some(legs) = req["legs"].as_array() {
        if legs.len() != 2 {
            return Err(ApiError::bad("OCO needs exactly two legs"));
        }
        legs.clone()
    } else {
        vec![req.clone()]
    };
    let mut legs = vec![];
    for input in inputs {
        let trigger = minor(&input["triggerPrice"])?;
        let limit = minor(
            input
                .get("limitPrice")
                .or(input.get("price"))
                .unwrap_or(&Value::Null),
        )?;
        let order = json!({"instrumentKey":instrument,"side":input.get("side").unwrap_or(&req["side"]),"product":req.get("product").unwrap_or(&json!("CNC")),"qty":input.get("qty").unwrap_or(&req["qty"]),"orderType":"LIMIT","price":coins(limit)});
        orders::parse(&order, market)?;
        let condition = input["condition"]
            .as_str()
            .unwrap_or(if trigger >= current { "above" } else { "below" });
        if !["above", "below"].contains(&condition) {
            return Err(ApiError::bad("GTT condition must be above or below"));
        }
        legs.push(
            json!({"request":order,"triggerMinor":trigger,"condition":condition,"status":"ACTIVE"}),
        );
    }
    let first = &legs[0];
    book.gtt.insert(0,json!({"id":id(),"instrumentKey":instrument,"tradingsymbol":market.stock(instrument)?["tradingsymbol"],"side":first["request"]["side"],"qty":first["request"]["qty"],"triggerPrice":coins(first["triggerMinor"].as_i64().unwrap()),"limitPrice":first["request"]["price"],"status":"ACTIVE","createdAt":iso(now_ms()),"legs":legs}));
    Ok(())
}

pub fn create_sip(book: &mut Book, req: &Value, market: &Market) -> Result<()> {
    if book.sips.len() >= 100 {
        return Err(ApiError::bad("Maximum 100 SIPs"));
    }
    let instrument = text(req, "instrumentKey")?;
    let frequency = req["frequency"]
        .as_str()
        .unwrap_or("monthly")
        .to_lowercase();
    if !["daily", "weekly", "monthly"].contains(&frequency.as_str()) {
        return Err(ApiError::bad("Unknown SIP frequency"));
    }
    let qty = req["qty"].as_u64().unwrap_or(1);
    let request = json!({"instrumentKey":instrument,"side":"BUY","product":"CNC","qty":qty,"orderType":"MARKET"});
    orders::parse(&request, market)?;
    let now = now_ms();
    let offset = chrono::FixedOffset::east_opt(19800).unwrap();
    let due = if let Some(date) = req["startDate"].as_str().filter(|s| !s.is_empty()) {
        let date = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
            .map_err(|_| ApiError::bad("Invalid startDate"))?;
        offset
            .from_local_datetime(&date.and_hms_opt(9, 15, 0).unwrap())
            .single()
            .ok_or_else(|| ApiError::bad("Invalid start date"))?
            .timestamp_millis()
            .max(0) as u64
    } else {
        now
    };
    if due.saturating_add(86_400_000) < now || due > now + 5 * 366 * 86_400_000 {
        return Err(ApiError::bad(
            "Start date must be today or within five years",
        ));
    }
    book.sips.insert(0,json!({"id":id(),"instrumentKey":instrument,"tradingsymbol":market.stock(instrument)?["tradingsymbol"],"qty":qty,"frequency":frequency,"active":true,"nextMs":due.max(now),"nextExecutionDate":iso(due.max(now)),"createdAt":iso(now),"anchorDay":offset.timestamp_millis_opt(due as i64).single().unwrap().day()}));
    Ok(())
}

pub fn next_due(previous: u64, frequency: &str, anchor: u32, now: u64) -> u64 {
    let offset = chrono::FixedOffset::east_opt(19800).unwrap();
    let mut date = offset
        .timestamp_millis_opt(previous as i64)
        .single()
        .unwrap();
    // Skip missed instalments; execute at most one per scheduler pass.
    loop {
        date = match frequency {
            "daily" => date + chrono::Duration::days(1),
            "weekly" => date + chrono::Duration::weeks(1),
            _ => {
                let next = date
                    .date_naive()
                    .with_day(1)
                    .unwrap()
                    .checked_add_months(chrono::Months::new(1))
                    .unwrap();
                let following = next.checked_add_months(chrono::Months::new(1)).unwrap();
                let days = (following - next).num_days() as u32;
                offset
                    .with_ymd_and_hms(
                        next.year(),
                        next.month(),
                        anchor.min(days),
                        date.hour(),
                        date.minute(),
                        date.second(),
                    )
                    .single()
                    .unwrap()
            }
        };
        if date.timestamp_millis() as u64 > now {
            return date.timestamp_millis() as u64;
        }
    }
}

fn crossed(condition: &str, price: i64, target: i64) -> bool {
    if condition == "above" {
        price >= target
    } else {
        price <= target
    }
}

pub fn process(book: &mut Book, market: &Market) -> Result<bool> {
    let now = now_ms();
    let mut changed = false;
    for i in 0..book.alerts.len() {
        let a = &book.alerts[i];
        if a["active"] != true {
            continue;
        }
        let Ok(q) = market.quote(a["instrumentKey"].as_str().unwrap_or_default()) else {
            continue;
        };
        if now.saturating_sub(q.timestamp_ms) > 5000 {
            continue;
        }
        if crossed(
            a["condition"].as_str().unwrap_or("above"),
            q.price.minor(),
            a["targetMinor"].as_i64().unwrap_or(i64::MAX),
        ) {
            let message = format!(
                "{} reached {}",
                a["tradingsymbol"].as_str().unwrap_or("Instrument"),
                q.price
            );
            book.alerts[i]["active"] = json!(false);
            book.alerts[i]["triggeredAt"] = json!(iso(now));
            book.notify("Price alert", &message, "alert");
            changed = true;
        }
    }
    if market.mode == "upstox"
        && cone_engine::indian_equity_session(now) == cone_engine::Session::Closed
    {
        return Ok(changed);
    }
    for i in 0..book.gtt.len() {
        let g = book.gtt[i].clone();
        if g["status"] != "ACTIVE" {
            continue;
        }
        let Ok(q) = market.quote(g["instrumentKey"].as_str().unwrap_or_default()) else {
            continue;
        };
        if now.saturating_sub(q.timestamp_ms) > 5000 {
            continue;
        }
        if let Some(legs) = g["legs"].as_array() {
            for (index, leg) in legs.iter().enumerate() {
                if !crossed(
                    leg["condition"].as_str().unwrap_or("above"),
                    q.price.minor(),
                    leg["triggerMinor"].as_i64().unwrap_or(i64::MAX),
                ) {
                    continue;
                }
                let mut req = leg["request"].clone();
                req["id"] = json!(format!(
                    "gtt-{}-{index}",
                    g["id"].as_str().unwrap_or_default()
                ));
                // Isolate an unsuccessful child placement so its reservations
                // cannot leak into other schedules in the same account pass.
                let mut candidate = book.clone();
                match orders::place(&mut candidate, &req, market) {
                    Ok(child) => {
                        *book = candidate;
                        book.gtt[i]["status"] = json!("TRIGGERED");
                        book.gtt[i]["orderId"] = json!(child);
                    }
                    Err(e) => {
                        book.gtt[i]["status"] = json!("REJECTED");
                        book.gtt[i]["error"] = json!(e.1);
                        book.notify("GTT rejected", &e.1, "error");
                    }
                }
                for n in 0..legs.len() {
                    book.gtt[i]["legs"][n]["status"] =
                        json!(if n == index { "TRIGGERED" } else { "CANCELLED" });
                }
                changed = true;
                break;
            }
        }
    }
    for i in 0..book.sips.len() {
        let sip = book.sips[i].clone();
        let due = sip["nextMs"].as_u64().unwrap_or(u64::MAX);
        if sip["active"] != true || due > now {
            continue;
        }
        let key = sip["instrumentKey"].as_str().unwrap_or_default();
        if market.quote(key).is_err() {
            continue;
        }
        if market
            .quote(key)
            .is_ok_and(|q| now.saturating_sub(q.timestamp_ms) > 5000)
        {
            continue;
        }
        let req = json!({"id":format!("sip-{}-{due}",sip["id"].as_str().unwrap_or_default()),"instrumentKey":key,"side":"BUY","product":"CNC","qty":sip["qty"],"orderType":"MARKET"});
        let mut candidate = book.clone();
        match orders::place(&mut candidate, &req, market) {
            Ok(_) => *book = candidate,
            Err(e) => book.notify("SIP instalment failed", &e.1, "error"),
        };
        let next = next_due(
            due,
            sip["frequency"].as_str().unwrap_or("monthly"),
            sip["anchorDay"].as_u64().unwrap_or(1) as u32,
            now,
        );
        book.sips[i]["nextMs"] = json!(next);
        book.sips[i]["nextExecutionDate"] = json!(iso(next));
        changed = true;
    }
    Ok(changed)
}

/// Live-market MIS squareoff. Simulator games intentionally have no clock gate.
pub fn squareoff(book: &mut Book, market: &Market) -> Result<()> {
    if !["upstox", "replay"].contains(&market.mode.as_str())
        || cone_engine::indian_equity_session(market.now_ms()) != cone_engine::Session::DeliveryOnly
    {
        return Ok(());
    }
    let pending = book
        .orders
        .iter()
        .filter(|o| o.status == "OPEN" && o.product == "MIS")
        .map(|o| o.id.clone())
        .collect::<Vec<_>>();
    for id in pending {
        orders::cancel(book, &id)?;
    }
    let positions = book.engine.account().positions().clone();
    for (key, p) in positions {
        let req = json!({"id":id(),"instrumentKey":key,"side":if p.side==cone_engine::Side::Buy{"SELL"}else{"BUY"},"product":"MIS","qty":p.quantity,"orderType":"MARKET"});
        let mut candidate = book.clone();
        if orders::place(&mut candidate, &req, market).is_ok() {
            *book = candidate;
        }
    }
    Ok(())
}
