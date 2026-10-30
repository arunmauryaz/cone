//! Deterministic paper trading rules. No network, database, UI, or system clock.
//!
//! One [`Engine`] owns one account. Hosts serialize commands per account and
//! supply trusted market quotes and timestamps. Persistence belongs to the host.

mod conditions;
mod session;
pub use session::{Session, indian_equity_session};
mod money;
pub use conditions::{OrderKind, should_fill};
mod trading;

pub use money::Money;
pub use trading::{
    Account, Engine, EngineError, Execution, Holding, MarketOrder, Position, Product, Quote, Side,
};
