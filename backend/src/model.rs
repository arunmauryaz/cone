use crate::error::{id, iso, now_ms};
use cone_engine::{Engine, Money};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

pub const STARTING_BALANCE: i64 = 10_000_000;
pub const MAX_CASH: i64 = 100_000_000;

#[derive(Clone, Serialize, Deserialize)]
pub struct Order {
    pub request: Value,
    pub id: String,
    pub instrument: String,
    pub side: String,
    pub product: String,
    pub kind: String,
    pub qty: u32,
    pub limit: i64,
    pub trigger: i64,
    pub activated: bool,
    pub reserved: i64,
    pub status: String,
    pub created_ms: u64,
    pub executed_ms: Option<u64>,
    pub fill_price: Option<i64>,
    pub pnl: Option<i64>,
    pub fee: i64,
    pub error: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Book {
    pub engine: Engine,
    pub orders: Vec<Order>,
    pub watchlists: Vec<Value>,
    pub alerts: Vec<Value>,
    pub gtt: Vec<Value>,
    pub sips: Vec<Value>,
    pub notifications: Vec<Value>,
    pub transactions: Vec<Value>,
    pub history: Vec<Value>,
    pub settings: Value,
    pub payin: i64,
}

impl Book {
    pub fn new() -> Self {
        Self {
            engine: Engine::new(Money::from_minor(STARTING_BALANCE))
                .expect("Valid opening balance"),
            orders: vec![],
            watchlists: vec![json!({"id":id(),"name":"Main Watchlist","stocks":[]})],
            alerts: vec![],
            gtt: vec![],
            sips: vec![],
            notifications: vec![],
            transactions: vec![],
            history: vec![json!({"timestamp":now_ms(),"totalValue":100000.0})],
            settings: json!({"theme":"slate-dark","refreshInterval":500}),
            payin: 0,
        }
    }
    pub fn notify(&mut self, title: &str, message: &str, kind: &str) {
        let preference = match kind {
            "order" => "orderExecution",
            "alert" => "priceAlerts",
            _ => "system",
        };
        if self.settings["notifications"][preference] == false {
            return;
        }
        self.notifications.insert(0, json!({"id":id(),"title":title,"message":message,"type":kind,"read":false,"timestamp":iso(now_ms())}));
        self.notifications.truncate(200);
    }
    pub fn ledger(&mut self, amount: i64, description: String) {
        self.transactions.insert(0, json!({"id":id(),"timestamp":iso(now_ms()),"type":if amount>=0 {"CREDIT"} else {"DEBIT"},"amount":amount.unsigned_abs() as f64/100.0,"amountMinor":amount,"balance":crate::error::coins(self.engine.account().available_cash().minor()),"balanceMinor":self.engine.account().available_cash().minor(),"description":description}));
    }
}

impl Default for Book {
    fn default() -> Self {
        Self::new()
    }
}
