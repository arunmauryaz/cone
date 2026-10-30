/// Weekday Indian cash-equity session policy. Exchange holidays must be supplied
/// by a future calendar adapter; simulated game markets need not use this policy.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Session {
    Closed,
    Open,
    DeliveryOnly,
}

pub fn indian_equity_session(timestamp_ms: u64) -> Session {
    let seconds = timestamp_ms / 1000 + 19_800;
    let days = seconds / 86_400;
    let weekday = (days + 3) % 7; // 1970-01-01 was Thursday; Monday is zero.
    let minute = seconds % 86_400 / 60;
    if weekday >= 5 || !(555..930).contains(&minute) {
        Session::Closed
    } else if minute >= 920 {
        Session::DeliveryOnly
    } else {
        Session::Open
    }
}
