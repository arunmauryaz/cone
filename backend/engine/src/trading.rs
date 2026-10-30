use crate::Money;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum EngineError {
    InvalidOpeningBalance,
    InvalidOrder,
    InvalidQuote,
    StaleQuote,
    QuoteInFuture,
    InstrumentMismatch,
    InsufficientFunds,
    InsufficientHoldings,
    DuplicateOrderId,
    MissingPrice(String),
    Overflow,
}

impl fmt::Display for EngineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{self:?}")
    }
}

impl std::error::Error for EngineError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Side {
    Buy,
    Sell,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Product {
    Cnc,
    Mis,
}

/// The host scopes IDs per account. Identical retries return the original fill.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MarketOrder {
    pub id: String,
    pub instrument: String,
    pub side: Side,
    pub product: Product,
    pub quantity: u32,
}

/// Provider-neutral quote. Hosts, not user-facing forms, supply these values.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Quote {
    pub instrument: String,
    pub price: Money,
    pub timestamp_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Holding {
    pub quantity: u32,
    pub cost_basis: Money,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Position {
    pub side: Side,
    pub quantity: u32,
    pub entry_value: Money,
    pub margin: Money,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Execution {
    pub order: MarketOrder,
    pub price: Money,
    pub timestamp_ms: u64,
    pub notional: Money,
    pub fee: Money,
    /// This fill's closed-trade profit/loss less this fill's fee.
    /// An opening MIS fill therefore has negative realized P&L equal to its fee.
    pub realized_pnl: Money,
    pub cash_delta: Money,
    pub margin_delta: Money,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Account {
    available_cash: Money,
    #[serde(default)]
    reserved_cash: Money,
    used_margin: Money,
    realized_pnl: Money,
    holdings: BTreeMap<String, Holding>,
    positions: BTreeMap<String, Position>,
}

impl Account {
    pub fn reserved_cash(&self) -> Money {
        self.reserved_cash
    }
    pub fn available_cash(&self) -> Money {
        self.available_cash
    }
    pub fn used_margin(&self) -> Money {
        self.used_margin
    }
    pub fn realized_pnl(&self) -> Money {
        self.realized_pnl
    }
    pub fn holdings(&self) -> &BTreeMap<String, Holding> {
        &self.holdings
    }
    pub fn positions(&self) -> &BTreeMap<String, Position> {
        &self.positions
    }

    /// Cash + CNC market value + MIS held margin + signed unrealized MIS P&L.
    /// Prices must be positive; the host is responsible for their freshness.
    pub fn equity(&self, prices: &BTreeMap<String, Money>) -> Result<Money, EngineError> {
        let price_for = |symbol: &String| -> Result<Money, EngineError> {
            let price = prices
                .get(symbol)
                .copied()
                .ok_or_else(|| EngineError::MissingPrice(symbol.clone()))?;
            if price <= Money::ZERO {
                return Err(EngineError::InvalidQuote);
            }
            Ok(price)
        };
        let mut total = self
            .available_cash
            .add(self.used_margin)?
            .add(self.reserved_cash)?;
        for (symbol, holding) in &self.holdings {
            total = total.add(price_for(symbol)?.mul(holding.quantity)?)?;
        }
        for (symbol, position) in &self.positions {
            let value = price_for(symbol)?.mul(position.quantity)?;
            let pnl = match position.side {
                Side::Buy => value.sub(position.entry_value)?,
                Side::Sell => position.entry_value.sub(value)?,
            };
            total = total.add(pnl)?;
        }
        Ok(total)
    }
}

/// In-memory, deterministic account aggregate. No global singleton/state.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Engine {
    account: Account,
    executions: BTreeMap<String, Execution>,
    max_quote_age_ms: u64,
}

impl Engine {
    pub fn new(opening_balance: Money) -> Result<Self, EngineError> {
        if opening_balance < Money::ZERO {
            return Err(EngineError::InvalidOpeningBalance);
        }
        Ok(Self {
            account: Account {
                available_cash: opening_balance,
                reserved_cash: Money::ZERO,
                used_margin: Money::ZERO,
                realized_pnl: Money::ZERO,
                holdings: BTreeMap::new(),
                positions: BTreeMap::new(),
            },
            executions: BTreeMap::new(),
            max_quote_age_ms: 5_000,
        })
    }

    pub fn account(&self) -> &Account {
        &self.account
    }

    /// Reserve cash for a pending order. The host persists its reservation ID.
    pub fn reserve(&mut self, amount: Money) -> Result<(), EngineError> {
        if amount < Money::ZERO {
            return Err(EngineError::InvalidOrder);
        }
        let cash = self.account.available_cash.sub(amount)?;
        if cash < Money::ZERO {
            return Err(EngineError::InsufficientFunds);
        }
        let reserved = self.account.reserved_cash.add(amount)?;
        self.account.available_cash = cash;
        self.account.reserved_cash = reserved;
        Ok(())
    }

    pub fn release(&mut self, amount: Money) -> Result<(), EngineError> {
        if amount < Money::ZERO || amount > self.account.reserved_cash {
            return Err(EngineError::InvalidOrder);
        }
        let cash = self.account.available_cash.add(amount)?;
        let reserved = self.account.reserved_cash.sub(amount)?;
        self.account.available_cash = cash;
        self.account.reserved_cash = reserved;
        Ok(())
    }

    pub fn credit(&mut self, amount: Money) -> Result<(), EngineError> {
        if amount <= Money::ZERO {
            return Err(EngineError::InvalidOrder);
        }
        self.account.available_cash = self.account.available_cash.add(amount)?;
        Ok(())
    }

    /// Validate funding with the same fill path, without modifying this engine.
    pub fn required_cash(
        &self,
        order: MarketOrder,
        quote: &Quote,
        now_ms: u64,
    ) -> Result<Money, EngineError> {
        let mut preview = Self {
            account: self.account.clone(),
            executions: BTreeMap::new(),
            max_quote_age_ms: self.max_quote_age_ms,
        };
        let fill = preview.execute_market(order, quote, now_ms)?;
        Ok(Money::ZERO.sub(fill.cash_delta)?.max(Money::ZERO))
    }
    pub fn executions(&self) -> &BTreeMap<String, Execution> {
        &self.executions
    }

    pub fn set_max_quote_age_ms(&mut self, age: u64) {
        self.max_quote_age_ms = age;
    }

    /// Fill at the supplied last traded price. This first milestone has no
    /// slippage, depth matching, pending orders, or market-session scheduler.
    /// Rejected orders never mutate account state or execution history.
    pub fn execute_market(
        &mut self,
        order: MarketOrder,
        quote: &Quote,
        now_ms: u64,
    ) -> Result<Execution, EngineError> {
        if let Some(previous) = self.executions.get(&order.id) {
            return if previous.order == order {
                Ok(previous.clone())
            } else {
                Err(EngineError::DuplicateOrderId)
            };
        }
        if order.id.trim().is_empty() || order.instrument.trim().is_empty() || order.quantity == 0 {
            return Err(EngineError::InvalidOrder);
        }
        if order.instrument != quote.instrument {
            return Err(EngineError::InstrumentMismatch);
        }
        if quote.price <= Money::ZERO {
            return Err(EngineError::InvalidQuote);
        }
        let age = now_ms
            .checked_sub(quote.timestamp_ms)
            .ok_or(EngineError::QuoteInFuture)?;
        if age > self.max_quote_age_ms {
            return Err(EngineError::StaleQuote);
        }
        let notional = quote.price.mul(order.quantity)?;
        let fee = brokerage(order.product, notional);

        // Stage only this account, not the execution history. A database adapter
        // will need an equivalent transaction and durable idempotency on commit.
        let mut next = self.account.clone();
        let gross_pnl = match order.product {
            Product::Cnc => fill_cnc(&mut next, &order, notional)?,
            Product::Mis => fill_mis(&mut next, &order, quote.price)?,
        };
        next.available_cash = next.available_cash.sub(fee)?;
        // Permit risk-reducing exits to realize a deficit; do not trap losing
        // positions. Opening/increasing/reversing exposure must remain funded.
        let reducing_only = (order.product == Product::Cnc && order.side == Side::Sell)
            || (order.product == Product::Mis
                && self
                    .account
                    .positions
                    .get(&order.instrument)
                    .is_some_and(|p| p.side != order.side && order.quantity <= p.quantity));
        if next.available_cash < Money::ZERO && !reducing_only {
            return Err(EngineError::InsufficientFunds);
        }
        let realized_pnl = gross_pnl.sub(fee)?;
        next.realized_pnl = next.realized_pnl.add(realized_pnl)?;
        let execution = Execution {
            order: order.clone(),
            price: quote.price,
            timestamp_ms: now_ms,
            notional,
            fee,
            realized_pnl,
            cash_delta: next.available_cash.sub(self.account.available_cash)?,
            margin_delta: next.used_margin.sub(self.account.used_margin)?,
        };
        self.account = next;
        self.executions.insert(order.id, execution.clone());
        Ok(execution)
    }
}

fn brokerage(product: Product, notional: Money) -> Money {
    if product == Product::Cnc {
        return Money::ZERO;
    }
    // MIS: min(C 20, 0.03% of value), rounded half-up to a minor unit.
    let minor = ((i128::from(notional.minor()) * 3 + 5_000) / 10_000).min(2_000);
    Money::from_minor(minor as i64)
}

fn margin(value: Money) -> Money {
    // 20% initial margin rounded up, so fractional cents never underfund it.
    Money::from_minor((i128::from(value.minor()) + 4).div_euclid(5) as i64)
}

fn fill_cnc(
    account: &mut Account,
    order: &MarketOrder,
    notional: Money,
) -> Result<Money, EngineError> {
    let existing = account.holdings.get(&order.instrument).cloned();
    match order.side {
        Side::Buy => {
            let old = existing.unwrap_or(Holding {
                quantity: 0,
                cost_basis: Money::ZERO,
            });
            let quantity = old
                .quantity
                .checked_add(order.quantity)
                .ok_or(EngineError::Overflow)?;
            let cost_basis = old.cost_basis.add(notional)?;
            account.available_cash = account.available_cash.sub(notional)?;
            account.holdings.insert(
                order.instrument.clone(),
                Holding {
                    quantity,
                    cost_basis,
                },
            );
            Ok(Money::ZERO)
        }
        Side::Sell => {
            let old = existing
                .filter(|h| h.quantity >= order.quantity)
                .ok_or(EngineError::InsufficientHoldings)?;
            let basis = old.cost_basis.portion(order.quantity, old.quantity);
            account.available_cash = account.available_cash.add(notional)?;
            if old.quantity == order.quantity {
                account.holdings.remove(&order.instrument);
            } else {
                account.holdings.insert(
                    order.instrument.clone(),
                    Holding {
                        quantity: old.quantity - order.quantity,
                        cost_basis: old.cost_basis.sub(basis)?,
                    },
                );
            }
            notional.sub(basis)
        }
    }
}

fn fill_mis(
    account: &mut Account,
    order: &MarketOrder,
    price: Money,
) -> Result<Money, EngineError> {
    let existing = account.positions.remove(&order.instrument);
    let mut remaining = order.quantity;
    let mut gross_pnl = Money::ZERO;
    let mut same_side = None;
    if let Some(mut old) = existing {
        if old.side == order.side {
            same_side = Some(old);
        } else {
            let closing = remaining.min(old.quantity);
            let basis = old.entry_value.portion(closing, old.quantity);
            let released_margin = old.margin.portion(closing, old.quantity);
            let exit_value = price.mul(closing)?;
            gross_pnl = match old.side {
                Side::Buy => exit_value.sub(basis)?,
                Side::Sell => basis.sub(exit_value)?,
            };
            account.available_cash = account
                .available_cash
                .add(released_margin)?
                .add(gross_pnl)?;
            account.used_margin = account.used_margin.sub(released_margin)?;
            remaining -= closing;
            old.quantity -= closing;
            if old.quantity > 0 {
                old.entry_value = old.entry_value.sub(basis)?;
                old.margin = old.margin.sub(released_margin)?;
                account.positions.insert(order.instrument.clone(), old);
            }
        }
    }
    if remaining > 0 {
        let value = price.mul(remaining)?;
        let new_margin = margin(value);
        let old = same_side.unwrap_or(Position {
            side: order.side,
            quantity: 0,
            entry_value: Money::ZERO,
            margin: Money::ZERO,
        });
        account.available_cash = account.available_cash.sub(new_margin)?;
        account.used_margin = account.used_margin.add(new_margin)?;
        account.positions.insert(
            order.instrument.clone(),
            Position {
                side: order.side,
                quantity: old
                    .quantity
                    .checked_add(remaining)
                    .ok_or(EngineError::Overflow)?,
                entry_value: old.entry_value.add(value)?,
                margin: old.margin.add(new_margin)?,
            },
        );
    }
    Ok(gross_pnl)
}
