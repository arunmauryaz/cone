use crate::EngineError;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Signed hundredths of a CONE Coin. Never use floating point for accounting.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct Money(i64);

impl Money {
    pub const ZERO: Self = Self(0);

    pub const fn from_minor(minor: i64) -> Self {
        Self(minor)
    }

    pub const fn minor(self) -> i64 {
        self.0
    }

    pub(crate) fn add(self, other: Self) -> Result<Self, EngineError> {
        self.0
            .checked_add(other.0)
            .map(Self)
            .ok_or(EngineError::Overflow)
    }

    pub(crate) fn sub(self, other: Self) -> Result<Self, EngineError> {
        self.0
            .checked_sub(other.0)
            .map(Self)
            .ok_or(EngineError::Overflow)
    }

    pub(crate) fn mul(self, qty: u32) -> Result<Self, EngineError> {
        self.0
            .checked_mul(i64::from(qty))
            .map(Self)
            .ok_or(EngineError::Overflow)
    }

    /// Allocate basis/margin on partial close. Any fractional minor unit stays
    /// with the remaining position; the final close releases the exact residue.
    pub(crate) fn portion(self, qty: u32, total: u32) -> Self {
        Self((i128::from(self.0) * i128::from(qty) / i128::from(total)) as i64)
    }
}

impl fmt::Display for Money {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let amount = self.0.unsigned_abs();
        let sign = if self.0 < 0 { "-" } else { "" };
        write!(f, "{sign}C {}.{:02}", amount / 100, amount % 100)
    }
}
