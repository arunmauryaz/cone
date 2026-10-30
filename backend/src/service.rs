use crate::{
    automation,
    error::{ApiError, Result, coins, id, minor, text},
    market::Market,
    model::{Book, MAX_CASH},
    orders,
};
use cone_engine::Side;
use serde_json::{Value, json};

pub fn snapshot(book: &Book, market: &Market) -> Result<Value> {
    let account = book.engine.account();
    let equity = account
        .equity(&market.marks())
        .ok()
        .map(|v| coins(v.minor()));
    let holdings=account.holdings().iter().map(|(key,h)|{
        let stock=market.stock(key).ok();let current=market.prices.get(key).map(|p|p.minor);
        json!({"id":format!("CNC:{key}"),"instrumentKey":key,"tradingsymbol":stock.map(|s|s["tradingsymbol"].clone()),"exchange":"NSE","qty":h.quantity,"avgCost":coins(h.cost_basis.minor())/h.quantity as f64,"investedValue":coins(h.cost_basis.minor()),"costBasisMinor":h.cost_basis.minor(),"ltp":current.map(coins),"currentValue":current.map(|p|coins(p)*h.quantity as f64)})
    }).collect::<Vec<_>>();
    let positions=account.positions().iter().map(|(key,p)|{
        let stock=market.stock(key).ok();let sign=if p.side==Side::Buy {1i64}else{-1};
        json!({"id":format!("MIS:{key}"),"instrumentKey":key,"tradingsymbol":stock.map(|s|s["tradingsymbol"].clone()),"exchange":"NSE","product":"MIS","side":if sign>0{"BUY"}else{"SELL"},"qty":p.quantity as i64*sign,"avgCost":coins(p.entry_value.minor())/p.quantity as f64,"margin":coins(p.margin.minor()),"marginMinor":p.margin.minor(),"entryValueMinor":p.entry_value.minor()})
    }).collect::<Vec<_>>();
    let today = (market.now_ms() / 1000 + 19800) / 86400;
    let today_payin: i64 = book
        .transactions
        .iter()
        .filter(|t| t["description"] == "CONE Coins added")
        .filter(|t| {
            t["timestamp"]
                .as_str()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .is_some_and(|d| (d.timestamp().max(0) as u64 + 19800) / 86400 == today)
        })
        .filter_map(|t| t["amountMinor"].as_i64())
        .sum();
    let wallet = json!({"balance":coins(account.available_cash().minor()),"usedMargin":coins(account.used_margin().minor()),"reservedMargin":coins(account.reserved_cash().minor()),"openingBalance":100000.0,"todayPayin":coins(today_payin),"todayPayout":0,"transactions":book.transactions,"minorUnits":{"balance":account.available_cash().minor(),"usedMargin":account.used_margin().minor(),"reservedMargin":account.reserved_cash().minor()}});
    let orders = book
        .orders
        .iter()
        .rev()
        .map(|o| orders::view(o, market))
        .collect::<Vec<_>>();
    let realized_today: i128 = book
        .engine
        .executions()
        .values()
        .filter(|e| (e.timestamp_ms / 1000 + 19800) / 86400 == today)
        .map(|e| i128::from(e.realized_pnl.minor()))
        .sum();
    let unrealized_mis = account
        .positions()
        .iter()
        .map(|(key, p)| {
            let current = market
                .prices
                .get(key)
                .map(|q| q.minor)
                .unwrap_or_else(|| p.entry_value.minor() / p.quantity as i64);
            let difference =
                i128::from(current) * i128::from(p.quantity) - i128::from(p.entry_value.minor());
            if p.side == Side::Buy {
                difference
            } else {
                -difference
            }
        })
        .sum::<i128>();
    let today_pnl = json!({"realized":realized_today as f64/100.0,"unrealized":unrealized_mis as f64/100.0,"total":realized_today as f64/100.0+unrealized_mis as f64/100.0});
    let contributed = i128::from(crate::model::STARTING_BALANCE) + i128::from(book.payin);
    let return_pnl = account
        .equity(&market.marks())
        .ok()
        .map(|m| (i128::from(m.minor()) - contributed) as f64 / 100.0);
    let mut achievements = vec![];
    if !book.engine.executions().is_empty() {
        achievements.push("first_trade");
    }
    Ok(
        json!({"wallet":wallet,"holdings":holdings,"positions":positions,"orders":orders,"watchlists":book.watchlists,"alerts":book.alerts,"gttOrders":book.gtt,"sips":book.sips,"notifications":book.notifications,"achievements":achievements,"history":book.history,"todayPnL":today_pnl,"returnPnL":return_pnl,"netContributions":contributed as f64/100.0,"totalPortfolioValue":equity,"totalPortfolioValueMinor":account.equity(&market.marks()).ok().map(|m|m.minor()),"realizedPnL":coins(account.realized_pnl().minor()),"realizedPnLMinor":account.realized_pnl().minor(),"marketSource":market.mode,"marketStatus":market.status}),
    )
}

pub fn metrics(book: &Book, market: &Market) -> Result<Value> {
    let closed: Vec<i64> = book
        .orders
        .iter()
        .filter(|o| o.status == "COMPLETE")
        .filter_map(|o| o.pnl)
        .collect();
    let wins = closed.iter().filter(|n| **n > 0).count();
    let losses = closed.iter().filter(|n| **n < 0).count();
    let gross_profit: i128 = closed.iter().filter(|n| **n > 0).map(|n| *n as i128).sum();
    let gross_loss: i128 = closed
        .iter()
        .filter(|n| **n < 0)
        .map(|n| -(*n as i128))
        .sum();
    let mut peak = 0.0_f64;
    let mut drawdown = 0.0_f64;
    for h in &book.history {
        let value = h["totalValue"].as_f64().unwrap_or_default();
        peak = peak.max(value);
        if peak > 0.0 {
            drawdown = drawdown.max((peak - value) / peak * 100.0);
        }
    }
    Ok(
        json!({"totalTrades":closed.len(),"wins":wins,"losses":losses,"winRate":if closed.is_empty(){0.0}else{wins as f64/closed.len() as f64*100.0},"profitFactor":if gross_loss>0{Some(gross_profit as f64/gross_loss as f64)}else{None},"realizedPnL":coins(book.engine.account().realized_pnl().minor()),"totalPortfolioValue":book.engine.account().equity(&market.marks()).ok().map(|m|coins(m.minor())),"maxDrawdown":drawdown}),
    )
}

pub fn read(book: &Book, method: &str, path: &str, market: &Market) -> Result<Option<Value>> {
    if method != "GET" {
        return Ok(None);
    }
    Ok(Some(match path {
        "portfolio/state" => snapshot(book, market)?,
        "portfolio/summary" => {
            let state = snapshot(book, market)?;
            json!({"wallet":state["wallet"],"totalPortfolioValue":state["totalPortfolioValue"],"realizedPnL":state["realizedPnL"]})
        }
        "portfolio/holdings" => snapshot(book, market)?["holdings"].clone(),
        "portfolio/positions" => snapshot(book, market)?["positions"].clone(),
        "portfolio/transactions" => json!(book.transactions),
        "portfolio/watchlists" => json!(book.watchlists),
        "orders" => json!(
            book.orders
                .iter()
                .rev()
                .map(|o| orders::view(o, market))
                .collect::<Vec<_>>()
        ),
        "orders/alerts" => json!(book.alerts),
        "orders/gtt" => json!(book.gtt),
        "orders/sips" => json!(book.sips),
        "notifications" => json!(book.notifications),
        "settings" => {
            let mut s = book.settings.clone();
            s["marketDataType"] = json!(market.mode);
            s["providerStatus"] = json!(market.status);
            s
        }
        "analytics/metrics" => metrics(book, market)?,
        "analytics/equity-curve" => json!(book.history),
        _ => return Ok(None),
    }))
}

pub fn mutate(
    book: &mut Book,
    method: &str,
    path: &str,
    req: &Value,
    market: &Market,
) -> Result<Value> {
    match (method, path) {
        ("POST", "orders") => {
            let order_id = orders::place(book, req, market)?;
            return Ok(
                json!({"success":true,"order":orders::view(book.orders.iter().find(|o|o.id==order_id).unwrap(),market)}),
            );
        }
        ("POST", "portfolio/funds/add") => {
            let amount = minor(&req["amount"])?;
            let next = book
                .engine
                .account()
                .available_cash()
                .minor()
                .checked_add(amount)
                .ok_or_else(|| ApiError::bad("Amount too large"))?;
            if next > MAX_CASH {
                return Err(ApiError::bad("Maximum available balance is C 10,00,000"));
            }
            book.engine.credit(cone_engine::Money::from_minor(amount))?;
            book.payin = book
                .payin
                .checked_add(amount)
                .ok_or_else(|| ApiError::bad("Funding total overflow"))?;
            book.ledger(amount, "CONE Coins added".into());
            orders::sample_equity(book, market);
        }
        ("POST", "portfolio/reset") => {
            let watchlists = book.watchlists.clone();
            let settings = book.settings.clone();
            *book = Book::new();
            book.watchlists = watchlists;
            book.settings = settings;
            book.notify(
                "Portfolio reset",
                "Starting again with C 1,00,000",
                "system",
            );
        }
        ("POST", "portfolio/positions/exit-all") => {
            let positions = book.engine.account().positions().clone();
            for (key, p) in positions {
                orders::place(
                    book,
                    &json!({"id":id(),"instrumentKey":key,"side":if p.side==Side::Buy{"SELL"}else{"BUY"},"product":"MIS","qty":p.quantity,"orderType":"MARKET"}),
                    market,
                )?;
            }
        }
        ("POST", "portfolio/watchlists") => {
            if book.watchlists.len() >= 10 {
                return Err(ApiError::bad("Maximum 10 watchlists"));
            }
            let name = text(req, "name")?.trim();
            if name.len() > 50 {
                return Err(ApiError::bad("Watchlist name too long"));
            }
            book.watchlists
                .push(json!({"id":id(),"name":name,"stocks":[]}));
            return Ok(json!({"success":true,"watchlist":book.watchlists.last()}));
        }
        ("POST", "orders/alerts") => automation::create_alert(book, req, market)?,
        ("POST", "orders/gtt") => automation::create_gtt(book, req, market)?,
        ("POST", "orders/sips") => automation::create_sip(book, req, market)?,
        ("POST", "notifications/read-all") => {
            for n in &mut book.notifications {
                n["read"] = json!(true);
            }
        }
        ("DELETE", "notifications") => book.notifications.clear(),
        ("PUT", "settings") | ("POST", "settings") => {
            if let Some(theme) = req["theme"].as_str() {
                if ![
                    "slate-dark",
                    "pitch-black",
                    "charcoal-dark",
                    "ocean-dark",
                    "midnight-blue",
                    "forest-dark",
                    "light",
                    "default",
                    "dark",
                ]
                .contains(&theme)
                {
                    return Err(ApiError::bad("Unknown theme"));
                }
                book.settings["theme"] = json!(theme);
            }
            if let Some(interval) = req["refreshInterval"].as_u64() {
                if !(100..=3_600_000).contains(&interval) {
                    return Err(ApiError::bad("Refresh interval must be 100â€“3600000 ms"));
                }
                book.settings["refreshInterval"] = json!(interval);
            }
            if let Some(preferences) = req["notifications"].as_object() {
                for key in [
                    "orderExecution",
                    "priceAlerts",
                    "misSqOff",
                    "dailySummary",
                    "browser",
                ] {
                    if let Some(value) = preferences.get(key).and_then(|v| v.as_bool()) {
                        if !book.settings["notifications"].is_object() {
                            book.settings["notifications"] = json!({});
                        }
                        book.settings["notifications"][key] = json!(value);
                    }
                }
            }
            for key in [
                "soundEnabled",
                "confirmOrders",
                "priceFlash",
                "compactMode",
                "showStockScreener",
                "showMarketChart",
            ] {
                if let Some(value) = req[key].as_bool() {
                    book.settings[key] = json!(value);
                }
            }
        }
        _ => {
            let segments: Vec<&str> = path.split('/').collect();
            match segments.as_slice() {
                ["orders", order_id] if method == "DELETE" => orders::cancel(book, order_id)?,
                ["orders", order_id] if method == "PUT" => {
                    orders::modify(book, order_id, req, market)?
                }
                ["portfolio", "positions", position_id, "exit"] if method == "POST" => {
                    let key = position_id.strip_prefix("MIS:").unwrap_or(position_id);
                    let p = book
                        .engine
                        .account()
                        .positions()
                        .get(key)
                        .cloned()
                        .ok_or_else(ApiError::not_found)?;
                    orders::place(
                        book,
                        &json!({"id":id(),"instrumentKey":key,"side":if p.side==Side::Buy{"SELL"}else{"BUY"},"product":"MIS","qty":p.quantity,"orderType":"MARKET"}),
                        market,
                    )?;
                }
                ["portfolio", "watchlists", list_id, "move"] if method == "PUT" => {
                    return crate::watchlists::move_item(book, list_id, req);
                }
                ["portfolio", "watchlists", list_id] => {
                    let index = book
                        .watchlists
                        .iter()
                        .position(|w| w["id"] == *list_id)
                        .ok_or_else(ApiError::not_found)?;
                    if method == "DELETE" {
                        book.watchlists.remove(index);
                    } else if method == "PUT" {
                        if let Some(name) = req["name"].as_str() {
                            if name.trim().is_empty() || name.len() > 50 {
                                return Err(ApiError::bad("Invalid watchlist name"));
                            }
                            book.watchlists[index]["name"] = json!(name);
                        }
                        if let Some(stocks) = req["stocks"].as_array() {
                            if stocks.len() > 100 {
                                return Err(ApiError::bad("Maximum 100 instruments per watchlist"));
                            }
                            let mut keys = std::collections::BTreeSet::new();
                            for stock in stocks {
                                let key = stock
                                    .as_str()
                                    .ok_or_else(|| ApiError::bad("Invalid instrument"))?;
                                market.stock(key)?;
                                if !keys.insert(key) {
                                    return Err(ApiError::bad("Duplicate watchlist instrument"));
                                }
                            }
                            book.watchlists[index]["stocks"] = json!(stocks);
                        }
                        crate::watchlists::update_metadata(&mut book.watchlists[index], req)?;
                    } else {
                        return Err(ApiError::not_found());
                    }
                }
                ["orders", "alerts", item_id] if method == "DELETE" => {
                    let index = book
                        .alerts
                        .iter()
                        .position(|x| x["id"] == *item_id)
                        .ok_or_else(ApiError::not_found)?;
                    book.alerts.remove(index);
                }
                ["orders", "gtt", item_id] if method == "DELETE" => {
                    let g = book
                        .gtt
                        .iter_mut()
                        .find(|x| x["id"] == *item_id)
                        .ok_or_else(ApiError::not_found)?;
                    if g["status"] != "ACTIVE" {
                        return Err(ApiError::bad("GTT is no longer active"));
                    }
                    g["status"] = json!("CANCELLED");
                    if let Some(legs) = g["legs"].as_array_mut() {
                        for leg in legs {
                            leg["status"] = json!("CANCELLED");
                        }
                    }
                }
                ["orders", "sips", item_id] if method == "DELETE" => {
                    let index = book
                        .sips
                        .iter()
                        .position(|x| x["id"] == *item_id)
                        .ok_or_else(ApiError::not_found)?;
                    book.sips.remove(index);
                }
                ["orders", "sips", item_id, "status"] if method == "PATCH" => {
                    let s = book
                        .sips
                        .iter_mut()
                        .find(|x| x["id"] == *item_id)
                        .ok_or_else(ApiError::not_found)?;
                    let active = req["active"]
                        .as_bool()
                        .or_else(|| req["status"].as_str().map(|s| s == "ACTIVE"))
                        .ok_or_else(|| ApiError::bad("active is required"))?;
                    s["active"] = json!(active);
                }
                ["notifications", item_id, "read"] if method == "POST" => {
                    let n = book
                        .notifications
                        .iter_mut()
                        .find(|x| x["id"] == *item_id)
                        .ok_or_else(ApiError::not_found)?;
                    n["read"] = json!(true);
                }
                _ => return Err(ApiError::not_found()),
            }
        }
    }
    Ok(json!({"success":true}))
}
