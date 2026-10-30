use crate::Side;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OrderKind {
    Market,
    Limit,
    StopLimit,
    StopMarket,
}

/// Stop activation latches, including when a later tick returns across trigger.
/// Values use integer minor units. Validation belongs to the order entry path.
pub fn should_fill(
    kind: OrderKind,
    side: Side,
    ltp: i64,
    limit: i64,
    trigger: i64,
    activated: &mut bool,
) -> bool {
    if matches!(kind, OrderKind::StopLimit | OrderKind::StopMarket) {
        *activated |= match side {
            Side::Buy => ltp >= trigger,
            Side::Sell => ltp <= trigger,
        };
        if !*activated {
            return false;
        }
    }
    match kind {
        OrderKind::Market | OrderKind::StopMarket => true,
        OrderKind::Limit | OrderKind::StopLimit => match side {
            Side::Buy => ltp <= limit,
            Side::Sell => ltp >= limit,
        },
    }
}
