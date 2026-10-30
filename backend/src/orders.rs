use crate::{
    error::{ApiError, Result, coins, id, iso, minor, text},
    market::Market,
    model::{Book, Order},
};
use cone_engine::{MarketOrder, Money, OrderKind, Product, Side, should_fill};
use serde_json::{Value, json};

pub fn side(value: &str) -> Result<Side> {
    match value {
        "BUY" => Ok(Side::Buy),
        "SELL" => Ok(Side::Sell),
        _ => Err(ApiError::bad("side must be BUY or SELL")),
    }
}
pub fn product(value: &str) -> Result<Product> {
    match value {
        "CNC" => Ok(Product::Cnc),
        "MIS" => Ok(Product::Mis),
        _ => Err(ApiError::bad("product must be CNC or MIS")),
    }
}
fn kind(value: &str) -> Result<OrderKind> {
    match value {
        "MARKET" => Ok(OrderKind::Market),
        "LIMIT" => Ok(OrderKind::Limit),
        "SL" => Ok(OrderKind::StopLimit),
        "SL-M" => Ok(OrderKind::StopMarket),
        _ => Err(ApiError::bad("Unknown order type")),
    }
}
fn request_order(o: &Order) -> Result<MarketOrder> {
    Ok(MarketOrder {
        id: o.id.clone(),
        instrument: o.instrument.clone(),
        side: side(&o.side)?,
        product: product(&o.product)?,
        quantity: o.qty,
    })
}

pub fn parse(req: &Value, market: &Market) -> Result<Order> {
    let instrument = text(req, "instrumentKey")?;
    let stock = market.stock(instrument)?;
    if (stock["segment"] != "NSE_EQ" && stock["segment"] != "BSE_EQ") || stock["tradable"] == false
    {
        return Err(ApiError::bad(
            "Only equity instruments can be traded; indices are display-only",
        ));
    }
    let qty = req["qty"]
        .as_u64()
        .filter(|n| *n > 0 && *n <= 1_000_000)
        .ok_or_else(|| ApiError::bad("qty must be a whole number from 1 to 1000000"))?
        as u32;
    let lot = stock["lotSize"].as_u64().unwrap_or(1).max(1);
    if (qty as u64) % lot != 0 {
        return Err(ApiError::bad("Quantity must be a multiple of lot size"));
    }
    let side_value = text(req, "side")?;
    side(side_value)?;
    let product_value = req["product"].as_str().unwrap_or("CNC");
    product(product_value)?;
    let order_kind = req["orderType"].as_str().unwrap_or("MARKET");
    kind(order_kind)?;
    let limit = if matches!(order_kind, "LIMIT" | "SL") {
        minor(&req["price"])?
    } else {
        0
    };
    let trigger = if matches!(order_kind, "SL" | "SL-M") {
        minor(&req["triggerPrice"])?
    } else {
        0
    };
    let tick = (stock["tickSize"].as_f64().unwrap_or(0.05) * 100.0)
        .round()
        .max(1.0) as i64;
    if limit % tick != 0 || trigger % tick != 0 {
        return Err(ApiError::bad("Price must follow the instrument tick size"));
    }
    if order_kind == "SL"
        && ((side_value == "BUY" && limit < trigger) || (side_value == "SELL" && limit > trigger))
    {
        return Err(ApiError::bad(
            "Stop-limit price must be executable after its trigger",
        ));
    }
    let order_id = req["id"]
        .as_str()
        .or(req["clientOrderId"].as_str())
        .map(str::to_owned)
        .unwrap_or_else(id);
    if order_id.len() > 128
        || order_id.is_empty()
        || !order_id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
    {
        return Err(ApiError::bad("Invalid client order ID"));
    }
    Ok(Order {
        request: req.clone(),
        id: order_id,
        instrument: instrument.into(),
        side: side_value.into(),
        product: product_value.into(),
        kind: order_kind.into(),
        qty,
        limit,
        trigger,
        activated: false,
        reserved: 0,
        status: "OPEN".into(),
        created_ms: market.now_ms(),
        executed_ms: None,
        fill_price: None,
        pnl: None,
        fee: 0,
        error: None,
    })
}

pub fn place(book: &mut Book, req: &Value, market: &Market) -> Result<String> {
    let mut order = parse(req, market)?;
    if let Some(previous) = book.orders.iter().find(|o| o.id == order.id) {
        if previous.request == order.request {
            return Ok(previous.id.clone());
        }
        return Err(ApiError(
            axum::http::StatusCode::CONFLICT,
            "Order ID already used with a different request".into(),
        ));
    }
    if book.orders.iter().filter(|o| o.status == "OPEN").count() >= 500 {
        return Err(ApiError::bad("Maximum 500 pending orders per account"));
    }
    if order.product == "CNC" && order.side == "SELL" {
        let held = book
            .engine
            .account()
            .holdings()
            .get(&order.instrument)
            .map(|h| h.quantity)
            .unwrap_or(0) as u64;
        let reserved: u64 = book
            .orders
            .iter()
            .filter(|o| {
                o.status == "OPEN"
                    && o.product == "CNC"
                    && o.side == "SELL"
                    && o.instrument == order.instrument
            })
            .map(|o| o.qty as u64)
            .sum();
        if reserved + order.qty as u64 > held {
            return Err(ApiError::bad("Insufficient unreserved holdings"));
        }
    }
    let quote = market.quote(&order.instrument)?;
    let now = market.now_ms();
    if ["upstox", "replay"].contains(&market.mode.as_str()) {
        match cone_engine::indian_equity_session(now) {
            cone_engine::Session::Closed => {
                return Err(ApiError::bad("Indian equity session is closed"));
            }
            cone_engine::Session::DeliveryOnly if order.product == "MIS" => {
                let reducing = book
                    .engine
                    .account()
                    .positions()
                    .get(&order.instrument)
                    .is_some_and(|p| {
                        Some(p.side) != side(&order.side).ok() && order.qty <= p.quantity
                    });
                if !reducing {
                    return Err(ApiError::bad(
                        "New MIS exposure is disabled after 15:20 IST",
                    ));
                }
            }
            _ => {}
        }
    }
    if now.saturating_sub(quote.timestamp_ms) > 5_000 {
        return Err(ApiError::bad("Market quote is stale"));
    }
    if should_fill(
        kind(&order.kind)?,
        side(&order.side)?,
        quote.price.minor(),
        order.limit,
        order.trigger,
        &mut order.activated,
    ) {
        execute(book, &mut order, market)?;
    } else {
        let mut estimate = quote.clone();
        if order.limit > 0 {
            estimate.price = Money::from_minor(order.limit);
        }
        let cash = book
            .engine
            .required_cash(request_order(&order)?, &estimate, now)?;
        book.engine.reserve(cash)?;
        order.reserved = cash.minor();
        if order.reserved > 0 {
            book.ledger(
                -order.reserved,
                format!("Cash reserved for order {}", order.id),
            );
        }
        book.notify(
            "Order pending",
            &format!("{} {} {}", order.side, order.qty, order.instrument),
            "order",
        );
    }
    let order_id = order.id.clone();
    book.orders.push(order);
    sample_equity(book, market);
    Ok(order_id)
}

fn execute(book: &mut Book, order: &mut Order, market: &Market) -> Result<()> {
    if order.reserved > 0 {
        book.engine.release(Money::from_minor(order.reserved))?;
        book.ledger(
            order.reserved,
            format!("Cash reservation released for order {}", order.id),
        );
        order.reserved = 0;
    }
    let before = book
        .engine
        .account()
        .positions()
        .get(&order.instrument)
        .map(|p| (p.side, p.quantity));
    let execution = book.engine.execute_market(
        request_order(order)?,
        &market.quote(&order.instrument)?,
        market.now_ms(),
    )?;
    order.status = "COMPLETE".into();
    order.fill_price = Some(execution.price.minor());
    order.executed_ms = Some(execution.timestamp_ms);
    order.fee = execution.fee.minor();
    let closes = if order.product == "CNC" {
        order.side == "SELL"
    } else {
        before.is_some_and(|(s, _)| Some(s) != side(&order.side).ok())
    };
    order.pnl = if closes {
        Some(execution.realized_pnl.minor())
    } else {
        None
    };
    book.ledger(
        execution.cash_delta.minor(),
        format!(
            "{} {} {} ({}) @ {}",
            order.side, order.qty, order.instrument, order.product, execution.price
        ),
    );
    book.notify(
        "Order filled",
        &format!(
            "{} {} {} @ {}",
            order.side, order.qty, order.instrument, execution.price
        ),
        "order",
    );
    Ok(())
}

pub fn cancel(book: &mut Book, id: &str) -> Result<()> {
    let order = book
        .orders
        .iter_mut()
        .find(|o| o.id == id)
        .ok_or_else(ApiError::not_found)?;
    if order.status != "OPEN" {
        return Err(ApiError::bad("Only open orders can be cancelled"));
    }
    let released = order.reserved;
    book.engine.release(Money::from_minor(released))?;
    order.reserved = 0;
    order.status = "CANCELLED".into();
    if released > 0 {
        book.ledger(
            released,
            format!("Cash reservation cancelled for order {id}"),
        );
    }
    Ok(())
}

pub fn modify(book: &mut Book, id: &str, req: &Value, market: &Market) -> Result<()> {
    let old = book
        .orders
        .iter()
        .find(|o| o.id == id)
        .cloned()
        .ok_or_else(ApiError::not_found)?;
    if old.status != "OPEN" {
        return Err(ApiError::bad("Only open orders can be modified"));
    }
    // Store transaction rolls this entire replacement back if validation fails.
    cancel(book, id)?;
    let mut replacement = old.request.clone();
    for field in ["qty", "price", "triggerPrice"] {
        if req.get(field).is_some() {
            replacement[field] = req[field].clone();
        }
    }
    replacement["id"] = json!(format!("modified-{}", crate::error::id()));
    replacement["replacesOrderId"] = json!(id);
    place(book, &replacement, market)?;
    Ok(())
}

pub fn process(book: &mut Book, market: &Market) -> Result<bool> {
    if ["upstox", "replay"].contains(&market.mode.as_str())
        && cone_engine::indian_equity_session(market.now_ms()) == cone_engine::Session::Closed
    {
        return Ok(false);
    }
    let mut changed = false;
    for index in 0..book.orders.len() {
        if book.orders[index].status != "OPEN" {
            continue;
        }
        let mut order = book.orders[index].clone();
        let Ok(quote) = market.quote(&order.instrument) else {
            continue;
        };
        if market.now_ms().saturating_sub(quote.timestamp_ms) > 5_000 {
            continue;
        }
        let old_activation = order.activated;
        if should_fill(
            kind(&order.kind)?,
            side(&order.side)?,
            quote.price.minor(),
            order.limit,
            order.trigger,
            &mut order.activated,
        ) {
            if let Err(error) = execute(book, &mut order, market) {
                order.status = "REJECTED".into();
                order.error = Some(error.1.clone());
                book.notify("Order rejected", &error.1, "error");
            }
            changed = true;
        }
        changed |= old_activation != order.activated;
        book.orders[index] = order;
    }
    if changed {
        sample_equity(book, market);
    }
    Ok(changed)
}

pub fn view(order: &Order, market: &Market) -> Value {
    let stock = market.stock(&order.instrument).ok();
    json!({"id":order.id,"instrumentKey":order.instrument,"tradingsymbol":stock.map(|s|s["tradingsymbol"].clone()),"exchange":"NSE","side":order.side,"product":order.product,"orderType":order.kind,"qty":order.qty,"price":coins(order.fill_price.unwrap_or(order.limit)),"priceMinor":order.fill_price.unwrap_or(order.limit),"triggerPrice":coins(order.trigger),"triggerMinor":order.trigger,"status":order.status,"createdAt":iso(order.created_ms),"executedAt":order.executed_ms.map(iso),"realizedPnL":order.pnl.map(coins),"realizedPnLMinor":order.pnl,"brokerage":coins(order.fee),"feeMinor":order.fee,"rejectionReason":order.error,"reservedCash":coins(order.reserved),"replacesOrderId":order.request.get("replacesOrderId")})
}

pub fn sample_equity(book: &mut Book, market: &Market) {
    if let Ok(value) = book.engine.account().equity(&market.marks()) {
        book.history
            .push(json!({"timestamp":market.now_ms(),"totalValue":coins(value.minor())}));
        if book.history.len() > 5000 {
            book.history.drain(..book.history.len() - 5000);
        }
    }
}
