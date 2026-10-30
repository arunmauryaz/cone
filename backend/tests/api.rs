use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use cone_backend::{AppState, Config, automation, error::now_ms, market, orders, router};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use std::{path::Path, sync::Arc};
use tower::ServiceExt;

#[test]
fn configurable_first_user_changes_credentials_without_reseeding_or_losing_portfolio() {
    let tmp = tempfile::tempdir().unwrap();
    let db = tmp.path().join("local.sqlite3");
    let store = cone_backend::store::Store::open(&db).unwrap();
    store.ensure_initial_user("first_user", "seed123").unwrap();
    let login = store
        .login(&json!({"username":"first_user","password":"seed123"}))
        .unwrap();
    let old_token = login["token"].as_str().unwrap();
    let user = store.authenticate(old_token).unwrap();
    store
        .transact(user, |book| {
            book.engine.credit(cone_engine::Money::from_minor(123))?;
            Ok(())
        })
        .unwrap();
    assert!(
        store
            .profile(
                user,
                &json!({"username":"renamed","currentPassword":"wrong"})
            )
            .is_err()
    );
    assert!(
        store
            .profile(
                user,
                &json!({"newPassword":"short","currentPassword":"seed123"})
            )
            .is_err()
    );
    let changed=store.profile(user,&json!({"fullName":"Updated Trader","username":"renamed","currentPassword":"seed123","newPassword":"changed-password-123"})).unwrap();
    assert_eq!(changed["user"]["id"], user);
    assert!(store.authenticate(old_token).is_err());
    assert_eq!(
        store
            .authenticate(changed["token"].as_str().unwrap())
            .unwrap(),
        user
    );
    drop(store);
    let store = cone_backend::store::Store::open(&db).unwrap();
    store.ensure_initial_user("first_user", "seed123").unwrap();
    assert!(
        store
            .login(&json!({"username":"first_user","password":"seed123"}))
            .is_err()
    );
    assert!(
        store
            .login(&json!({"username":"renamed","password":"changed-password-123"}))
            .is_ok()
    );
    assert_eq!(
        store
            .read(user)
            .unwrap()
            .engine
            .account()
            .available_cash()
            .minor(),
        10_000_123
    );
    assert_eq!(store.public_accounts().unwrap().len(), 1);
}

fn state(path: &Path) -> Arc<AppState> {
    AppState::open(Config {
        bind: "127.0.0.1:0".into(),
        database: path.into(),
        origins: vec!["http://localhost:5173".into()],
        market_mode: "fixture".into(),
        catalog: market::fixture_catalog().unwrap(),
        web_dir: None,
        upstox_token: None,
    })
    .unwrap()
}
async fn call(
    state: Arc<AppState>,
    method: &str,
    path: &str,
    token: Option<&str>,
    body: Value,
) -> (StatusCode, Value) {
    let mut req = Request::builder()
        .method(method)
        .uri(path)
        .header("Content-Type", "application/json");
    if let Some(token) = token {
        req = req.header("Authorization", format!("Bearer {token}"));
    }
    let response = router(state)
        .unwrap()
        .oneshot(req.body(Body::from(body.to_string())).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let raw = response.into_body().collect().await.unwrap().to_bytes();
    (
        status,
        serde_json::from_slice(&raw)
            .unwrap_or_else(|_| json!({"raw":String::from_utf8_lossy(&raw)})),
    )
}
async fn register(state: Arc<AppState>, username: &str) -> String {
    let (status, v) = call(
        state,
        "POST",
        "/api/auth/register",
        None,
        json!({"username":username,"fullName":"Test Trader","password":"test-password-123"}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{v}");
    v["token"].as_str().unwrap().into()
}
fn set_price(state: &AppState, price: i64) {
    let mut market = state.market.write().unwrap();
    let p = market.prices.get_mut("NSE_EQ|TCS").unwrap();
    p.minor = price;
    p.timestamp = now_ms();
    p.view["ltp"] = json!(price as f64 / 100.0);
}
fn order(id: &str, kind: &str, side: &str, qty: u32, price: i64) -> Value {
    json!({"id":id,"instrumentKey":"NSE_EQ|TCS","side":side,"product":"CNC","qty":qty,"orderType":kind,"price":price as f64/100.0})
}

#[tokio::test]
async fn watchlist_groups_pins_validate_atomically_and_survive_restart() {
    let tmp = tempfile::tempdir().unwrap();
    let db = tmp.path().join("groups.sqlite3");
    let s = state(&db);
    let token = register(s.clone(), "groups_owner").await;
    let other = register(s.clone(), "groups_other").await;
    let (_, created) = call(
        s.clone(),
        "POST",
        "/api/portfolio/watchlists",
        Some(&token),
        json!({"name":"Research"}),
    )
    .await;
    let list_id = created["watchlist"]["id"].as_str().unwrap();
    let path = format!("/api/portfolio/watchlists/{list_id}");
    let request = json!({"stocks":["NSE_EQ|TCS","NSE_EQ|INFY"],"groups":[{"id":"it","name":"IT","stocks":["NSE_EQ|TCS"]}],"pinned":["NSE_EQ|TCS"]});
    assert_eq!(
        call(s.clone(), "PUT", &path, Some(&token), request.clone())
            .await
            .0,
        StatusCode::OK
    );
    assert_eq!(
        call(
            s.clone(),
            "PUT",
            &path,
            Some(&other),
            json!({"name":"stolen"})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    let (_, before) = call(
        s.clone(),
        "GET",
        "/api/portfolio/watchlists",
        Some(&token),
        json!({}),
    )
    .await;
    for invalid in [
        json!({"name":"bad","groups":[{"id":"one","name":"One","stocks":["NSE_EQ|TCS"]},{"id":"two","name":"Two","stocks":["NSE_EQ|TCS"]}]}),
        json!({"groups":[{"id":"one","name":"One","stocks":["NSE_EQ|RELIANCE"]}]}),
        json!({"pinned":["NSE_EQ|RELIANCE"]}),
        json!({"groups":null}),
        json!({"groups":[{"id":"bad id","name":"One","stocks":[]}]}),
        json!({"groups":[{"id":"one","name":" ","stocks":[]}]}),
        json!({"groups": (0..21).map(|i|json!({"id":format!("g{i}"),"name":"Group","stocks":[]})).collect::<Vec<_>>()}),
    ] {
        assert_eq!(
            call(s.clone(), "PUT", &path, Some(&token), invalid).await.0,
            StatusCode::BAD_REQUEST
        );
        let (_, after) = call(
            s.clone(),
            "GET",
            "/api/portfolio/watchlists",
            Some(&token),
            json!({}),
        )
        .await;
        assert_eq!(before, after);
    }
    drop(s);
    let s = state(&db);
    let (_, persisted) = call(
        s.clone(),
        "GET",
        "/api/portfolio/watchlists",
        Some(&token),
        json!({}),
    )
    .await;
    assert_eq!(persisted, before);
    // Legacy clients can remove stocks without knowing about groups or pins.
    assert_eq!(
        call(
            s.clone(),
            "PUT",
            &path,
            Some(&token),
            json!({"stocks":["NSE_EQ|INFY"]})
        )
        .await
        .0,
        StatusCode::OK
    );
    let (_, pruned) = call(
        s.clone(),
        "GET",
        "/api/portfolio/watchlists",
        Some(&token),
        json!({}),
    )
    .await;
    let list = pruned
        .as_array()
        .unwrap()
        .iter()
        .find(|w| w["id"] == list_id)
        .unwrap();
    assert_eq!(list["groups"][0]["stocks"], json!([]));
    assert_eq!(list["pinned"], json!([]));
}

#[tokio::test]
async fn watchlist_drag_moves_are_atomic_ordered_and_account_scoped() {
    let tmp = tempfile::tempdir().unwrap();
    let s = state(&tmp.path().join("drag.sqlite3"));
    let token = register(s.clone(), "drag_owner").await;
    let other = register(s.clone(), "drag_other").await;
    let (_, a) = call(
        s.clone(),
        "POST",
        "/api/portfolio/watchlists",
        Some(&token),
        json!({"name":"A"}),
    )
    .await;
    let (_, b) = call(
        s.clone(),
        "POST",
        "/api/portfolio/watchlists",
        Some(&token),
        json!({"name":"B"}),
    )
    .await;
    let a = a["watchlist"]["id"].as_str().unwrap().to_owned();
    let b = b["watchlist"]["id"].as_str().unwrap().to_owned();
    let path = format!("/api/portfolio/watchlists/{a}");
    let setup = json!({"stocks":["NSE_EQ|TCS","NSE_EQ|INFY","NSE_EQ|RELIANCE"],"groups":[{"id":"alpha","name":"Alpha","stocks":["NSE_EQ|TCS","NSE_EQ|INFY"]},{"id":"beta","name":"Beta","stocks":["NSE_EQ|RELIANCE"]}],"pinned":["NSE_EQ|INFY"]});
    assert_eq!(
        call(s.clone(), "PUT", &path, Some(&token), setup).await.0,
        StatusCode::OK
    );
    let movement = format!("{path}/move");
    assert_eq!(call(s.clone(),"PUT",&movement,Some(&token),json!({"kind":"stock","item":"NSE_EQ|INFY","targetListId":a,"targetGroupId":"alpha","beforeId":"NSE_EQ|TCS"})).await.0,StatusCode::OK);
    assert_eq!(
        call(
            s.clone(),
            "PUT",
            &movement,
            Some(&token),
            json!({"kind":"group","item":"beta","targetListId":a,"beforeId":"alpha"})
        )
        .await
        .0,
        StatusCode::OK
    );
    let (_, lists) = call(
        s.clone(),
        "GET",
        "/api/portfolio/watchlists",
        Some(&token),
        json!({}),
    )
    .await;
    let source = lists
        .as_array()
        .unwrap()
        .iter()
        .find(|w| w["id"] == a)
        .unwrap();
    assert_eq!(source["groupOrder"], json!(["", "beta", "alpha"]));
    assert_eq!(
        source["groups"][0]["stocks"],
        json!(["NSE_EQ|INFY", "NSE_EQ|TCS"])
    );
    assert_eq!(
        call(
            s.clone(),
            "PUT",
            &movement,
            Some(&other),
            json!({"kind":"group","item":"alpha","targetListId":b})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        call(
            s.clone(),
            "PUT",
            &movement,
            Some(&token),
            json!({"kind":"group","item":"alpha","targetListId":b,"targetGroupId":"missing"})
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        call(
            s.clone(),
            "GET",
            "/api/portfolio/watchlists",
            Some(&token),
            json!({})
        )
        .await
        .1,
        lists
    );
    assert_eq!(
        call(
            s.clone(),
            "PUT",
            &movement,
            Some(&token),
            json!({"kind":"group","item":"alpha","targetListId":b})
        )
        .await
        .0,
        StatusCode::OK
    );
    let (_, lists) = call(
        s.clone(),
        "GET",
        "/api/portfolio/watchlists",
        Some(&token),
        json!({}),
    )
    .await;
    let target = lists
        .as_array()
        .unwrap()
        .iter()
        .find(|w| w["id"] == b)
        .unwrap();
    let source = lists
        .as_array()
        .unwrap()
        .iter()
        .find(|w| w["id"] == a)
        .unwrap();
    assert_eq!(
        target["groups"][0]["stocks"],
        json!(["NSE_EQ|INFY", "NSE_EQ|TCS"])
    );
    assert_eq!(target["pinned"], json!(["NSE_EQ|INFY"]));
    assert_eq!(source["stocks"], json!(["NSE_EQ|RELIANCE"]));
    assert_eq!(source["pinned"], json!([]));
}

#[tokio::test]
async fn provider_switches_clear_prices_preserve_accounts_and_never_return_tokens() {
    let tmp = tempfile::tempdir().unwrap();
    let db = tmp.path().join("provider.sqlite3");
    let s = state(&db);
    let token = register(s.clone(), "provider_owner").await;
    let (_, before) = call(
        s.clone(),
        "GET",
        "/api/portfolio/state",
        Some(&token),
        json!({}),
    )
    .await;
    let mut catalogue = s.config.catalog.clone();
    for stock in &mut catalogue {
        stock["providerKey"] = stock["instrumentKey"].clone();
    }
    std::fs::write(
        db.with_file_name("upstox-instruments.json"),
        serde_json::to_vec(&catalogue).unwrap(),
    )
    .unwrap();
    let (status, view) = call(
        s.clone(),
        "PUT",
        "/api/settings/provider",
        Some(&token),
        json!({"provider":"upstox","accessToken":"fixture-secret-token"}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{view}");
    assert_eq!(view["configured"], true);
    assert!(!view.to_string().contains("fixture-secret"));
    assert!(s.market.read().unwrap().prices.is_empty());
    assert_eq!(
        call(
            s.clone(),
            "POST",
            "/api/orders",
            Some(&token),
            order("unavailable", "MARKET", "BUY", 1, 1)
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        call(
            s.clone(),
            "PUT",
            "/api/market/interest",
            Some(&token),
            json!({"clientId":"test","instrumentKeys":["NSE_EQ|TCS"]})
        )
        .await
        .0,
        StatusCode::OK
    );
    assert!(
        cone_backend::provider::wanted(&s)
            .unwrap()
            .iter()
            .any(|k| k.starts_with("NSE_EQ|"))
    );
    drop(s);
    let s = state(&db);
    assert_eq!(
        cone_backend::provider::view(&s).unwrap()["provider"],
        "upstox"
    );
    let (status, _) = call(
        s.clone(),
        "PUT",
        "/api/settings/provider",
        Some(&token),
        json!({"provider":"simulated"}),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(s.market.read().unwrap().prices.is_empty());
    let (_, after) = call(
        s.clone(),
        "GET",
        "/api/portfolio/state",
        Some(&token),
        json!({}),
    )
    .await;
    assert_eq!(after["wallet"], before["wallet"]);
    assert_eq!(after["orders"], before["orders"]);
    let (_, view) = call(
        s.clone(),
        "PUT",
        "/api/settings/provider",
        Some(&token),
        json!({"clearToken":true}),
    )
    .await;
    assert_eq!(view["tokenSaved"], false);
}

#[test]
fn upstox_catalogue_and_protobuf_normalize_real_schema_without_synthetic_prices() {
    use cone_backend::upstox_proto::*;
    use prost::Message;
    let raw = json!([{"segment":"NSE_EQ","instrument_key":"NSE_EQ|ISIN","trading_symbol":"TEST","name":"Test","instrument_type":"EQ","exchange":"NSE","lot_size":1,"tick_size":5}, {"segment":"NSE_FO","instrument_key":"NSE_FO|123","trading_symbol":"FUTURE"}]);
    let catalogue = cone_backend::provider::catalogue(raw.as_array().unwrap());
    assert_eq!(catalogue.len(), 1);
    assert_eq!(catalogue[0]["tickSize"], 0.05);
    assert_eq!(catalogue[0]["basePrice"], 0);
    let frame = FeedResponse {
        feed_type: 1,
        current_ts: now_ms() as i64,
        feeds: std::collections::HashMap::from([(
            "NSE_EQ|ISIN".into(),
            Feed {
                ltpc: None,
                full: Some(Full {
                    market: Some(MarketFull {
                        ltpc: Some(Ltpc {
                            quantity: 1,
                            ltp: 123.45,
                            ltt: now_ms() as i64,
                            cp: 120.0,
                        }),
                        level: Some(Level {
                            quotes: vec![LevelQuote {
                                bid_qty: 10,
                                bid: 123.4,
                                ask_qty: 12,
                                ask: 123.5,
                            }],
                        }),
                        volume: 1000,
                        ohlc: None,
                    }),
                    index: None,
                }),
            },
        )]),
    };
    let response = normalize(&frame.encode_to_vec()).unwrap();
    let mut market = market::Market::new(catalogue, "upstox").unwrap();
    assert_eq!(market.apply_upstox(&response, now_ms()).unwrap(), 1);
    assert_eq!(market.quote("NSE_EQ|TEST").unwrap().price.minor(), 12345);
    assert_eq!(market.prices["NSE_EQ|TEST"].depth["bids"][0]["qty"], 10);
    assert!(market.prices["NSE_EQ|TEST"].depth["bids"][0]["orders"].is_null());
    assert!(normalize(&[255, 255, 255]).is_err());
}

#[tokio::test]
async fn authentication_is_real_and_accounts_are_isolated() {
    let tmp = tempfile::tempdir().unwrap();
    let s = state(&tmp.path().join("db.sqlite"));
    let alice = register(s.clone(), "alice").await;
    let bob = register(s.clone(), "bob").await;
    assert_eq!(
        call(
            s.clone(),
            "POST",
            "/api/auth/login",
            None,
            json!({"username":"alice","password":"wrong"})
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        call(s.clone(), "GET", "/api/portfolio/state", None, json!({}))
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        call(
            s.clone(),
            "POST",
            "/api/auth/register",
            None,
            json!({"username":"ALICE","fullName":"Other","password":"password-123"})
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    set_price(&s, 10000);
    assert_eq!(
        call(
            s.clone(),
            "POST",
            "/api/orders?userId=2",
            Some(&alice),
            order("buy", "MARKET", "BUY", 10, 1)
        )
        .await
        .0,
        StatusCode::OK
    );
    let (_, alice_state) = call(
        s.clone(),
        "GET",
        "/api/portfolio/state?userId=2",
        Some(&alice),
        json!({}),
    )
    .await;
    let (_, bob_state) = call(
        s.clone(),
        "GET",
        "/api/portfolio/state?userId=1",
        Some(&bob),
        json!({}),
    )
    .await;
    assert_eq!(alice_state["holdings"][0]["qty"], 10);
    assert!(bob_state["holdings"].as_array().unwrap().is_empty());
    assert_eq!(alice_state["wallet"]["balance"], 99000.0);
    assert_eq!(bob_state["wallet"]["balance"], 100000.0);
    assert_eq!(
        call(
            s.clone(),
            "POST",
            "/api/auth/logout",
            Some(&alice),
            json!({})
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        call(s, "GET", "/api/auth/me", Some(&alice), json!({}))
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
}

#[tokio::test]
async fn execution_and_idempotency_survive_restart_and_use_server_prices() {
    let tmp = tempfile::tempdir().unwrap();
    let db = tmp.path().join("db.sqlite");
    let s = state(&db);
    let token = register(s.clone(), "trader").await;
    set_price(&s, 10000);
    let request = order("durable", "MARKET", "BUY", 10, 1);
    let (status, result) = call(
        s.clone(),
        "POST",
        "/api/orders",
        Some(&token),
        request.clone(),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{result}");
    assert_eq!(result["order"]["price"], 100.0);
    drop(s);
    let s = state(&db);
    assert_eq!(
        call(s.clone(), "POST", "/api/orders", Some(&token), request)
            .await
            .0,
        StatusCode::OK
    );
    let (_, v) = call(
        s.clone(),
        "GET",
        "/api/portfolio/state",
        Some(&token),
        json!({}),
    )
    .await;
    assert_eq!(v["orders"].as_array().unwrap().len(), 1);
    assert_eq!(v["wallet"]["balance"], 99000.0);
    assert_eq!(
        call(
            s,
            "POST",
            "/api/orders",
            Some(&token),
            order("durable", "MARKET", "BUY", 11, 1)
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
}

#[tokio::test]
async fn pending_orders_reserve_cash_cancel_and_latch_stop_activation() {
    let tmp = tempfile::tempdir().unwrap();
    let s = state(&tmp.path().join("db.sqlite"));
    let token = register(s.clone(), "pending").await;
    set_price(&s, 20000);
    assert_eq!(
        call(
            s.clone(),
            "POST",
            "/api/orders",
            Some(&token),
            order("limit", "LIMIT", "BUY", 10, 10000)
        )
        .await
        .0,
        StatusCode::OK
    );
    let (_, v) = call(
        s.clone(),
        "GET",
        "/api/portfolio/state",
        Some(&token),
        json!({}),
    )
    .await;
    assert_eq!(v["wallet"]["reservedMargin"], 1000.0);
    assert_eq!(v["wallet"]["balance"], 99000.0);
    assert_eq!(v["totalPortfolioValue"], 100000.0);
    assert_eq!(
        call(
            s.clone(),
            "DELETE",
            "/api/orders/limit",
            Some(&token),
            json!({})
        )
        .await
        .0,
        StatusCode::OK
    );
    let mut stop = order("stop", "SL", "BUY", 1, 25100);
    stop["triggerPrice"] = json!(250.0);
    assert_eq!(
        call(s.clone(), "POST", "/api/orders", Some(&token), stop)
            .await
            .0,
        StatusCode::OK
    );
    let user = s.store.authenticate(&token).unwrap();
    set_price(&s, 26000);
    let m = s.market_snapshot().unwrap();
    s.store.transact(user, |b| orders::process(b, &m)).unwrap();
    assert!(s.store.read(user).unwrap().orders[1].activated);
    set_price(&s, 24000);
    let m = s.market_snapshot().unwrap();
    s.store.transact(user, |b| orders::process(b, &m)).unwrap();
    let b = s.store.read(user).unwrap();
    assert_eq!(b.orders[1].status, "COMPLETE");
    assert_eq!(b.engine.account().reserved_cash().minor(), 0);
    assert_eq!(b.engine.account().available_cash().minor(), 9_976_000);
}

#[tokio::test]
async fn database_failure_rolls_back_account_and_order_together() {
    let tmp = tempfile::tempdir().unwrap();
    let db = tmp.path().join("db.sqlite");
    let s = state(&db);
    let token = register(s.clone(), "rollback").await;
    set_price(&s, 10000);
    let conn = rusqlite::Connection::open(db).unwrap();
    conn.execute_batch("CREATE TRIGGER injected_failure BEFORE UPDATE ON accounts BEGIN SELECT RAISE(ABORT,'injected'); END;").unwrap();
    assert_eq!(
        call(
            s.clone(),
            "POST",
            "/api/orders",
            Some(&token),
            order("fail", "MARKET", "BUY", 1, 10000)
        )
        .await
        .0,
        StatusCode::INTERNAL_SERVER_ERROR
    );
    let user = s.store.authenticate(&token).unwrap();
    let book = s.store.read(user).unwrap();
    assert!(book.orders.is_empty());
    assert!(book.engine.executions().is_empty());
    assert_eq!(book.engine.account().available_cash().minor(), 10_000_000);
}

#[tokio::test]
async fn concurrent_orders_cannot_double_spend() {
    let tmp = tempfile::tempdir().unwrap();
    let s = state(&tmp.path().join("db.sqlite"));
    let token = register(s.clone(), "concurrent").await;
    set_price(&s, 1_000_000);
    let mut tasks = vec![];
    for n in 0..20 {
        let s = s.clone();
        let token = token.clone();
        tasks.push(tokio::spawn(async move {
            call(
                s,
                "POST",
                "/api/orders",
                Some(&token),
                order(&format!("order-{n}"), "MARKET", "BUY", 1, 1),
            )
            .await
            .0
        }));
    }
    let mut successes = 0;
    for task in tasks {
        if task.await.unwrap() == StatusCode::OK {
            successes += 1;
        }
    }
    assert_eq!(successes, 10);
    let user = s.store.authenticate(&token).unwrap();
    let b = s.store.read(user).unwrap();
    assert_eq!(b.engine.account().available_cash().minor(), 0);
    assert_eq!(b.orders.len(), 10);
}

#[tokio::test]
async fn gtt_oco_alerts_and_sips_execute_without_browser() {
    let tmp = tempfile::tempdir().unwrap();
    let s = state(&tmp.path().join("db.sqlite"));
    let token = register(s.clone(), "scheduled").await;
    set_price(&s, 10000);
    let gtt = json!({"instrumentKey":"NSE_EQ|TCS","side":"BUY","qty":1,"product":"CNC","legs":[{"triggerPrice":110,"limitPrice":110,"condition":"above"},{"triggerPrice":90,"limitPrice":90,"condition":"below"}]});
    assert_eq!(
        call(s.clone(), "POST", "/api/orders/gtt", Some(&token), gtt)
            .await
            .0,
        StatusCode::OK
    );
    assert_eq!(
        call(
            s.clone(),
            "POST",
            "/api/orders/alerts",
            Some(&token),
            json!({"instrumentKey":"NSE_EQ|TCS","condition":"above","target":110})
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        call(
            s.clone(),
            "POST",
            "/api/orders/sips",
            Some(&token),
            json!({"instrumentKey":"NSE_EQ|TCS","qty":1,"frequency":"monthly"})
        )
        .await
        .0,
        StatusCode::OK
    );
    set_price(&s, 11000);
    let user = s.store.authenticate(&token).unwrap();
    let market = s.market_snapshot().unwrap();
    s.store
        .transact(user, |b| automation::process(b, &market))
        .unwrap();
    s.store
        .transact(user, |b| automation::process(b, &market))
        .unwrap();
    let b = s.store.read(user).unwrap();
    assert_eq!(b.orders.len(), 2);
    assert_eq!(b.gtt[0]["status"], "TRIGGERED");
    assert_eq!(b.gtt[0]["legs"][1]["status"], "CANCELLED");
    assert_eq!(b.alerts[0]["active"], false);
    assert!(b.sips[0]["nextMs"].as_u64().unwrap() > now_ms());
}

#[test]
fn provider_mapping_keeps_missing_quotes_stale_and_never_substitutes_simulation() {
    let catalog = vec![
        json!({"instrumentKey":"NSE_EQ|TCS","providerKey":"NSE_EQ|TESTISIN","tradingsymbol":"TCS","name":"TCS","segment":"NSE_EQ","basePrice":100,"tickSize":0.05,"lotSize":1}),
    ];
    let mut m = market::Market::new(catalog, "upstox").unwrap();
    assert!(m.prices.is_empty());
    let fixture = json!({"data":{"NSE_EQ:TCS":{"instrument_token":"NSE_EQ|TESTISIN","last_price":100.049999237,"ohlc":{"open":100,"high":101,"low":99,"close":100},"volume":1000,"depth":{"buy":[{"price":100,"quantity":10,"orders":1}],"sell":[]}}}});
    assert_eq!(m.apply_upstox(&fixture, 1000).unwrap(), 1);
    assert_eq!(m.quote("NSE_EQ|TCS").unwrap().price.minor(), 10005);
    m.apply_upstox(&json!({"data":{}}), 20000).unwrap();
    assert_eq!(m.quote("NSE_EQ|TCS").unwrap().timestamp_ms, 1000);
    assert_eq!(m.mode, "upstox");
}

#[test]
fn decimal_and_calendar_boundaries() {
    use cone_backend::error::minor;
    assert_eq!(minor(&json!("0.01")).unwrap(), 1);
    assert_eq!(minor(&json!("100000.10")).unwrap(), 10_000_010);
    for value in [
        json!(-1),
        json!(0),
        json!("1.001"),
        json!("NaN"),
        json!("9223372036854775807"),
    ] {
        assert!(minor(&value).is_err());
    }
    let start = chrono::DateTime::parse_from_rfc3339("2028-01-31T09:15:00+05:30")
        .unwrap()
        .timestamp_millis() as u64;
    let feb = automation::next_due(start, "monthly", 31, start);
    let march = automation::next_due(feb, "monthly", 31, feb);
    assert!(cone_backend::error::iso(feb).starts_with("2028-02-29"));
    assert!(cone_backend::error::iso(march).starts_with("2028-03-31"));
}

#[tokio::test]
async fn pending_ledger_reconciles_and_failed_modify_preserves_reservation() {
    let tmp = tempfile::tempdir().unwrap();
    let s = state(&tmp.path().join("db.sqlite"));
    let token = register(s.clone(), "ledger").await;
    set_price(&s, 20000);
    assert_eq!(
        call(
            s.clone(),
            "POST",
            "/api/orders",
            Some(&token),
            order("reserved", "LIMIT", "BUY", 10, 10000)
        )
        .await
        .0,
        StatusCode::OK
    );
    let before = s.store.read(s.store.authenticate(&token).unwrap()).unwrap();
    assert_eq!(
        call(
            s.clone(),
            "PUT",
            "/api/orders/reserved",
            Some(&token),
            json!({"qty":1000000})
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    let after = s.store.read(s.store.authenticate(&token).unwrap()).unwrap();
    assert_eq!(before.engine.account(), after.engine.account());
    assert_eq!(before.orders.len(), after.orders.len());
    assert_eq!(before.transactions, after.transactions);
    assert_eq!(
        call(
            s.clone(),
            "DELETE",
            "/api/orders/reserved",
            Some(&token),
            json!({})
        )
        .await
        .0,
        StatusCode::OK
    );
    let book = s.store.read(s.store.authenticate(&token).unwrap()).unwrap();
    let changes: i64 = book
        .transactions
        .iter()
        .map(|t| t["amountMinor"].as_i64().unwrap())
        .sum();
    assert_eq!(
        10_000_000 + changes,
        book.engine.account().available_cash().minor()
    );
    assert_eq!(book.engine.account().reserved_cash().minor(), 0);
}

#[tokio::test]
async fn funding_is_not_profit_and_daily_realized_includes_opening_fees() {
    let tmp = tempfile::tempdir().unwrap();
    let s = state(&tmp.path().join("db.sqlite"));
    let token = register(s.clone(), "funding").await;
    set_price(&s, 10000);
    assert_eq!(
        call(
            s.clone(),
            "POST",
            "/api/portfolio/funds/add",
            Some(&token),
            json!({"amount":"1000.01"})
        )
        .await
        .0,
        StatusCode::OK
    );
    let mut request = order("mis", "MARKET", "BUY", 1, 1);
    request["product"] = json!("MIS");
    assert_eq!(
        call(s.clone(), "POST", "/api/orders", Some(&token), request)
            .await
            .0,
        StatusCode::OK
    );
    let (_, snapshot) = call(
        s.clone(),
        "GET",
        "/api/portfolio/state",
        Some(&token),
        json!({}),
    )
    .await;
    assert_eq!(snapshot["wallet"]["todayPayin"], 1000.01);
    assert_eq!(snapshot["todayPnL"]["realized"], -0.03);
    assert_eq!(snapshot["returnPnL"], -0.03);
    let (_, ranking) = call(
        s,
        "GET",
        "/api/analytics/leaderboard",
        Some(&token),
        json!({}),
    )
    .await;
    assert_eq!(ranking.as_array().unwrap().len(), 1);
    assert_eq!(ranking[0]["username"], "funding");
    assert!(ranking[0]["returnPercent"].as_f64().unwrap() < 0.0);
}

#[tokio::test]
async fn replay_reveals_only_completed_minutes_and_keeps_live_money_untouched() {
    let tmp = tempfile::tempdir().unwrap();
    let state = state(&tmp.path().join("test.sqlite3"));
    let stock = json!({"instrumentKey":"NSE_EQ|TCS","providerKey":"NSE_EQ|TEST","tradingsymbol":"TCS","name":"Fixture equity","segment":"NSE_EQ","exchange":"NSE","tickSize":0.05,"lotSize":1,"tradable":true});
    std::fs::write(
        tmp.path().join("upstox-instruments.json"),
        serde_json::to_vec(&vec![stock]).unwrap(),
    )
    .unwrap();
    let auth=state.store.register(&json!({"username":"replay_test","password":"test-password-123","fullName":"Replay tester"})).unwrap();
    let user = state
        .store
        .authenticate(auth["token"].as_str().unwrap())
        .unwrap();
    let before = serde_json::to_value(state.store.read(user).unwrap()).unwrap();
    cone_backend::provider::configure(
        &state,
        &json!({"provider":"upstox","dataMode":"replay","accessToken":"fixture-not-a-real-token"}),
    )
    .unwrap();
    let start = chrono::DateTime::parse_from_rfc3339("2026-10-29T10:00:00+05:30")
        .unwrap()
        .timestamp_millis() as u64;
    let session = cone_backend::replay::Replay {
        name: "Test".into(),
        instruments: vec![],
        revision: 0,
        end_date: "2026-10-29".into(),
        ended: false,
        id: "fixture".into(),
        date: "2026-10-29".into(),
        frames: vec![
            (
                start,
                vec![(
                    "NSE_EQ|TCS".into(),
                    json!({"time":start/1000,"open":100,"high":110,"low":90,"close":105,"volume":10}),
                )],
            ),
            (
                start + 60000,
                vec![(
                    "NSE_EQ|TCS".into(),
                    json!({"time":start/1000+60,"open":105,"high":120,"low":100,"close":115,"volume":20}),
                )],
            ),
        ],
        cursor: 0,
        speed: 60,
        playing: false,
        loading: false,
        last: None,
    };
    std::fs::write(
        tmp.path().join("replay-session.json"),
        serde_json::to_vec(&session).unwrap(),
    )
    .unwrap();
    cone_backend::replay::rebuild(&state, &session).unwrap();
    *state.replay.lock().unwrap() = session;
    assert_eq!(
        state
            .market_snapshot()
            .unwrap()
            .quote("NSE_EQ|TCS")
            .unwrap()
            .price
            .minor(),
        10000
    );
    assert_eq!(
        state.market_snapshot().unwrap().prices["NSE_EQ|TCS"].view["high"],
        100
    );
    assert_eq!(
        state
            .replay
            .lock()
            .unwrap()
            .candles("NSE_EQ|TCS", "1minute", 100)
            .unwrap(),
        json!([])
    );
    cone_backend::replay::control(&state, &json!({"action":"step"})).unwrap();
    let rows = state
        .replay
        .lock()
        .unwrap()
        .candles("NSE_EQ|TCS", "1minute", 100)
        .unwrap();
    assert_eq!(rows.as_array().unwrap().len(), 1);
    assert_eq!(rows[0]["close"], 105);
    let market = state.market_snapshot().unwrap();
    state.store.transact_replay(user,|b|{orders::place(b,&json!({"id":"replay-buy","instrumentKey":"NSE_EQ|TCS","side":"BUY","product":"CNC","qty":1,"orderType":"MARKET"}),&market)?;Ok(())}).unwrap();
    assert_eq!(
        state
            .store
            .read_replay(user)
            .unwrap()
            .engine
            .account()
            .holdings()["NSE_EQ|TCS"]
            .quantity,
        1
    );
    assert_eq!(
        serde_json::to_value(state.store.read(user).unwrap()).unwrap(),
        before
    );
    assert_eq!(cone_backend::replay::restore(&state).unwrap().cursor, 1);
    assert!(!cone_backend::replay::restore(&state).unwrap().playing);
    drop(market);
    drop(state);
    let restored = AppState::open(Config {
        bind: "127.0.0.1:0".into(),
        database: tmp.path().join("test.sqlite3"),
        origins: vec![],
        market_mode: "fixture".into(),
        catalog: market::fixture_catalog().unwrap(),
        web_dir: None,
        upstox_token: None,
    })
    .unwrap();
    assert_eq!(restored.market_snapshot().unwrap().mode, "replay");
    assert_eq!(
        restored
            .store
            .read_replay(user)
            .unwrap()
            .engine
            .account()
            .holdings()["NSE_EQ|TCS"]
            .quantity,
        1
    );
}

#[tokio::test]
async fn named_workspaces_keep_results_separate_through_finish_switch_extend_and_delete() {
    let tmp = tempfile::tempdir().unwrap();
    let s = state(&tmp.path().join("workspaces.sqlite3"));
    let stock = json!({"instrumentKey":"NSE_EQ|TCS","providerKey":"NSE_EQ|TEST","tradingsymbol":"TCS","name":"Fixture","segment":"NSE_EQ","exchange":"NSE","tickSize":0.05,"lotSize":1,"tradable":true});
    std::fs::write(
        tmp.path().join("upstox-instruments.json"),
        serde_json::to_vec(&vec![stock.clone()]).unwrap(),
    )
    .unwrap();
    let auth=s.store.register(&json!({"username":"workspace_test","password":"test-password-123","fullName":"Workspace tester"})).unwrap();
    let token = auth["token"].as_str().unwrap();
    let user = s.store.authenticate(token).unwrap();
    let live = serde_json::to_value(s.store.read(user).unwrap()).unwrap();
    cone_backend::provider::configure(&s, &json!({"provider":"upstox","dataMode":"replay"}))
        .unwrap();
    let start = chrono::DateTime::parse_from_rfc3339("2026-10-27T09:15:00+05:30")
        .unwrap()
        .timestamp_millis() as u64;
    let bar = |time: u64, p: u64| json!({"time":time/1000,"open":p,"high":p,"low":p,"close":p,"volume":1});
    let mut a = cone_backend::replay::Replay {
        id: "a".into(),
        name: "Alpha".into(),
        date: "2026-10-27".into(),
        end_date: "2026-10-29".into(),
        instruments: vec![stock.clone()],
        frames: vec![
            (start, vec![("NSE_EQ|TCS".into(), bar(start, 100))]),
            (
                start + 172800000,
                vec![("NSE_EQ|TCS".into(), bar(start + 172800000, 110))],
            ),
        ],
        speed: 60,
        ..Default::default()
    };
    let b = cone_backend::replay::Replay {
        id: "b".into(),
        name: "Beta".into(),
        frames: vec![
            (start, vec![("NSE_EQ|TCS".into(), bar(start, 200))]),
            (
                start + 60000,
                vec![("NSE_EQ|TCS".into(), bar(start + 60000, 210))],
            ),
        ],
        ..a.clone()
    };
    s.store.workspace_put(&a).unwrap();
    s.store.workspace_put(&b).unwrap();
    cone_backend::replay::workspace_action(&s, &json!({"action":"activate","id":"a"})).unwrap();
    let buy = |id: &str, qty: u32| json!({"id":id,"instrumentKey":"NSE_EQ|TCS","side":"BUY","product":"CNC","qty":qty,"orderType":"MARKET"});
    assert_eq!(
        call(
            s.clone(),
            "POST",
            "/api/orders",
            Some(token),
            buy("a-buy", 1)
        )
        .await
        .0,
        StatusCode::OK
    );
    cone_backend::replay::control(&s, &json!({"action":"step"})).unwrap();
    cone_backend::replay::control(&s, &json!({"action":"step"})).unwrap();
    assert_eq!(
        s.market_snapshot().unwrap().now_ms(),
        start + 172800000 + 59999
    );
    assert_eq!(
        call(
            s.clone(),
            "POST",
            "/api/orders",
            Some(token),
            buy("after-end", 1)
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    let report = cone_backend::replay::workspaces(&s, user, Some("a")).unwrap();
    assert_eq!(report["workspace"]["status"], "completed");
    assert_eq!(report["portfolio"]["holdings"][0]["qty"], 1);
    cone_backend::replay::workspace_action(&s, &json!({"action":"activate","id":"b"})).unwrap();
    assert!(
        s.store
            .read_replay(user)
            .unwrap()
            .engine
            .account()
            .holdings()
            .is_empty()
    );
    assert_eq!(
        call(
            s.clone(),
            "POST",
            "/api/orders",
            Some(token),
            buy("b-buy", 2)
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        s.store
            .workspace_book("a", user)
            .unwrap()
            .engine
            .account()
            .holdings()["NSE_EQ|TCS"]
            .quantity,
        1
    );
    cone_backend::replay::workspace_action(
        &s,
        &json!({"action":"rename","id":"a","name":"Alpha extended"}),
    )
    .unwrap();
    a = s.store.workspace_get("a").unwrap().unwrap();
    let cursor = a.cursor;
    a.frames.push((
        start + 172860000,
        vec![("NSE_EQ|TCS".into(), bar(start + 172860000, 120))],
    ));
    a.end_date = "2026-10-30".into();
    s.store.workspace_put(&a).unwrap();
    cone_backend::replay::workspace_action(&s, &json!({"action":"activate","id":"a"})).unwrap();
    assert_eq!(s.replay.lock().unwrap().cursor, cursor);
    assert_eq!(
        s.store
            .read_replay(user)
            .unwrap()
            .engine
            .account()
            .holdings()["NSE_EQ|TCS"]
            .quantity,
        1
    );
    cone_backend::replay::control(&s, &json!({"action":"step"})).unwrap();
    cone_backend::replay::workspace_action(&s, &json!({"action":"activate","id":"b"})).unwrap();
    cone_backend::replay::control(&s, &json!({"action":"end"})).unwrap();
    assert_eq!(
        s.store
            .read_replay(user)
            .unwrap()
            .engine
            .account()
            .holdings()["NSE_EQ|TCS"]
            .quantity,
        2
    );
    cone_backend::replay::workspace_action(&s, &json!({"action":"delete","id":"a"})).unwrap();
    assert!(s.store.workspace_get("a").unwrap().is_none());
    assert!(
        s.store
            .workspace_book("a", user)
            .unwrap()
            .engine
            .account()
            .holdings()
            .is_empty()
    );
    assert_eq!(
        s.store
            .read_replay(user)
            .unwrap()
            .engine
            .account()
            .holdings()["NSE_EQ|TCS"]
            .quantity,
        2
    );
    assert_eq!(
        serde_json::to_value(s.store.read(user).unwrap()).unwrap(),
        live
    );
    drop(s);
    let restored = state(&tmp.path().join("workspaces.sqlite3"));
    assert_eq!(restored.replay.lock().unwrap().id, "b");
    assert!(restored.replay.lock().unwrap().ended);
    assert_eq!(
        restored
            .store
            .read_replay(user)
            .unwrap()
            .engine
            .account()
            .holdings()["NSE_EQ|TCS"]
            .quantity,
        2
    );
}

#[test]
fn replay_without_a_workspace_has_empty_read_only_portfolio() {
    let tmp = tempfile::tempdir().unwrap();
    let s = state(&tmp.path().join("empty-replay.sqlite3"));
    let auth = s.store.register(&json!({"username":"empty_replay","password":"test-password-123","fullName":"Empty replay"})).unwrap();
    let user = auth["user"]["id"].as_i64().unwrap();
    assert!(
        s.store
            .read_replay(user)
            .unwrap()
            .engine
            .account()
            .holdings()
            .is_empty()
    );
    assert!(s.store.transact_replay(user, |_| Ok(())).is_err());
}

#[test]
fn legacy_single_replay_migrates_once_without_losing_practice_money() {
    let tmp = tempfile::tempdir().unwrap();
    let db = tmp.path().join("legacy.sqlite3");
    let store = cone_backend::store::Store::open(&db).unwrap();
    let auth = store
        .register(
            &json!({"username":"legacy_replay","password":"test-password-123","fullName":"Legacy"}),
        )
        .unwrap();
    let user = store.authenticate(auth["token"].as_str().unwrap()).unwrap();
    let mut book = cone_backend::model::Book::new();
    book.engine
        .credit(cone_engine::Money::from_minor(123))
        .unwrap();
    drop(store);
    let conn = rusqlite::Connection::open(&db).unwrap();
    conn.execute(
        "INSERT INTO replay_accounts VALUES(?1,?2,0)",
        rusqlite::params![user, serde_json::to_string(&book).unwrap()],
    )
    .unwrap();
    drop(conn);
    let stock = json!({"instrumentKey":"NSE_EQ|TCS","providerKey":"NSE_EQ|TEST","tradingsymbol":"TCS","name":"Fixture","segment":"NSE_EQ","exchange":"NSE","tickSize":0.05,"lotSize":1});
    std::fs::write(
        tmp.path().join("upstox-instruments.json"),
        serde_json::to_vec(&vec![stock]).unwrap(),
    )
    .unwrap();
    std::fs::write(tmp.path().join("replay-session.json"),json!({"id":"legacy","date":"2026-10-27","frames":[[1793072700000u64,[["NSE_EQ|TCS",{"time":1793072700,"open":100,"high":100,"low":100,"close":100,"volume":1}]]]],"cursor":0,"speed":60}).to_string()).unwrap();
    let s = state(&db);
    assert_eq!(s.store.workspace_list().unwrap().len(), 1);
    assert_eq!(
        s.store
            .workspace_book("legacy", user)
            .unwrap()
            .engine
            .account()
            .available_cash()
            .minor(),
        10_000_123
    );
    s.store.workspace_delete("legacy").unwrap();
    drop(s);
    let reopened = state(&db);
    assert!(reopened.store.workspace_list().unwrap().is_empty());
}

#[test]
fn replay_cursor_and_pending_fill_rollback_together_on_storage_failure() {
    let tmp = tempfile::tempdir().unwrap();
    let s = state(&tmp.path().join("atomic.sqlite3"));
    let stock = json!({"instrumentKey":"NSE_EQ|TCS","providerKey":"NSE_EQ|TEST","tradingsymbol":"TCS","name":"Fixture","segment":"NSE_EQ","exchange":"NSE","tickSize":0.05,"lotSize":1});
    std::fs::write(
        tmp.path().join("upstox-instruments.json"),
        serde_json::to_vec(&vec![stock.clone()]).unwrap(),
    )
    .unwrap();
    let auth = s
        .store
        .register(
            &json!({"username":"atomic_replay","password":"test-password-123","fullName":"Atomic"}),
        )
        .unwrap();
    let user = s
        .store
        .authenticate(auth["token"].as_str().unwrap())
        .unwrap();
    let start = chrono::DateTime::parse_from_rfc3339("2026-10-27T09:15:00+05:30")
        .unwrap()
        .timestamp_millis() as u64;
    let r = cone_backend::replay::Replay {
        id: "atomic".into(),
        name: "Atomic".into(),
        date: "2026-10-27".into(),
        end_date: "2026-10-27".into(),
        instruments: vec![stock],
        frames: vec![(
            start,
            vec![(
                "NSE_EQ|TCS".into(),
                json!({"time":start/1000,"open":100,"high":100,"low":90,"close":90,"volume":1}),
            )],
        )],
        speed: 60,
        ..Default::default()
    };
    s.store.workspace_put(&r).unwrap();
    cone_backend::replay::rebuild(&s, &r).unwrap();
    *s.replay.lock().unwrap() = r;
    let m = s.market_snapshot().unwrap();
    s.store.transact_replay(user,|b|{orders::place(b,&json!({"id":"pending-atomic","instrumentKey":"NSE_EQ|TCS","side":"BUY","product":"CNC","qty":1,"orderType":"LIMIT","price":"95.00"}),&m)?;Ok(())}).unwrap();
    let before = serde_json::to_value(s.store.read_replay(user).unwrap()).unwrap();
    let conn = rusqlite::Connection::open(tmp.path().join("atomic.sqlite3")).unwrap();
    conn.execute_batch("CREATE TRIGGER fail_replay_cursor BEFORE UPDATE OF cursor ON replay_workspaces BEGIN SELECT RAISE(FAIL,'fixture rollback'); END;").unwrap();
    assert!(cone_backend::replay::control(&s, &json!({"action":"step"})).is_err());
    assert_eq!(s.replay.lock().unwrap().cursor, 0);
    assert_eq!(
        s.market_snapshot()
            .unwrap()
            .quote("NSE_EQ|TCS")
            .unwrap()
            .price
            .minor(),
        10000
    );
    assert_eq!(
        serde_json::to_value(s.store.read_replay(user).unwrap()).unwrap(),
        before
    );
    conn.execute_batch("DROP TRIGGER fail_replay_cursor;")
        .unwrap();
    cone_backend::replay::control(&s, &json!({"action":"step"})).unwrap();
    assert_eq!(
        s.store
            .read_replay(user)
            .unwrap()
            .engine
            .account()
            .holdings()["NSE_EQ|TCS"]
            .quantity,
        1
    );
    assert_eq!(s.store.workspace_get("atomic").unwrap().unwrap().cursor, 1);
}
