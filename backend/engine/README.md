# CONE trading core

cone-engine is the reusable Rust trading library. It has no networking, database,
UI, broker SDK or system clock dependency. The backend supplies trusted quotes,
current timestamps and durable transactions. Serde supports host-owned internal
snapshots; clients must not submit engine snapshots as commands.

## Responsibilities

- CNC market fills, holdings, partial sells and realized P&L; no delivery shorts.
- MIS longs/shorts, weighted basis, additions, partial exits and reversals.
- Available cash, 20% initial MIS margin, pending cash reservations and funding.
- Simplified fees: zero CNC; MIS min(C 20, 0.03% of complete order value).
- Equity from supplied marks, including signed short P&L and reserved funds.
- Checked arithmetic, positive quantity/price validation and quote freshness.
- Atomic in-memory rejection and account-scoped successful-order idempotency.
- Pure stop/limit eligibility with latched activation, and weekday IST sessions.

One Engine owns one account; no global singleton or shared mutable state exists.
Hosts serialize account commands and persist changes and execution IDs atomically.
The backend crate adds pending-order storage, APIs, scheduling and real persistence.

## Money and accounting

One Coin is 100 minor units. Money::from_minor(12345) means C 123.45. Negative money
is valid for P&L/debt, but invalid as a price or reservation. Whole-unit quantities
are required. The backend enforces catalogue lot and tick sizes.

Holdings and positions retain total entry value, not a rounded average. Partial
closes allocate entry value and margin proportionally, rounding down to a minor
unit. The remainder stays with the position; its final close releases it exactly.
Initial margin rounds up. Brokerage rounds half-up once per complete order,
including when reversing an existing position.

Available cash excludes both MIS position margin and pending-order reservations.
A short reserves margin without crediting its notional proceeds. Equity is:

```text
cash + pending reservations + CNC market value + MIS margin + MIS unrealized P&L
```

Realized P&L charges opening fees immediately. An exposure-reducing exit can
realize negative cash when losses exceed funds; it must remain possible to close
risk. New exposure must stay funded. Maintenance-margin liquidation, real taxes,
slippage and settlement rules are not implemented.

## Important public types and methods

| API | Purpose |
|---|---|
| Engine::new | Create one account with a nonnegative opening balance |
| Engine::execute_market | Validate and execute against a trusted Quote |
| Engine::required_cash | Preview funding through the same fill path |
| Engine::reserve / release | Pending-order cash accounting |
| Engine::credit | Positive virtual funding with overflow checks |
| Engine::account / executions | Read-only account and fill history |
| Account::equity | Mark holdings/positions; require every open symbol's price |
| should_fill | MARKET/LIMIT/SL/SL-M eligibility and latched stop state |
| indian_equity_session | Weekday cash-equity session classification |

MarketOrder contains id, instrument, side, product and quantity. Quote contains
instrument, price and timestamp_ms. The host supplies now_ms in the same time
domain. Quotes older than 5,000 ms or in the future are rejected (the maximum age
is configurable). Retrying an identical successful order returns its original
fill even when the retry quote has become stale. A conflicting successful ID is
rejected. Persistence is necessary to preserve this behavior across a restart.

The session helper classifies weekdays 09:15–15:20 IST as Open, 15:20–15:30 as
DeliveryOnly and other times as Closed. It deliberately has no holiday calendar.
The host chooses whether to enforce this policy (real market) or run unrestricted
simulation. Pure market fills do not read clocks or invoke session scheduling.

## Running and checking

From the engine package directory (backend/engine in this app, or its copied location):

```powershell
cargo run --example paper_trade
cargo test
cargo fmt -- --check
cargo clippy --all-targets -- -D warnings
```

The example uses a C 1,00,000 account, opens 10 MIS units at C 100, closes at C 110,
and ends with C 1,00,099.37 after fees, with zero used margin.

Tests cover shorts, partial basis/margin release, reversals, fees, insolvency on
exit, account isolation, duplicate IDs, malformed/stale quotes, overflow,
reservations, snapshot round-trip and IST session boundaries.

## Independent package

This folder can be copied on its own: its manifest has no parent-workspace
inheritance or external path dependencies. The full current app adds the host
in ../src; pending-order storage, accounts, feeds and SQL are not part of this
library. See [the repository engine guide](../../docs/engine.md) for client integration choices.

## Using this folder with a different interface

A Rust application can add `cone-engine = { path = "path/to/this/folder" }` to its
dependencies. The included `examples/paper_trade.rs` shows a complete fill flow.
The library does not start a server, retrieve prices, create users or open SQL.
For a new host, implement trusted quote ingestion, explicit timestamps, account
routing, serialized commands, durable transactional state/execution/reservation
storage, and whatever pending-order/scheduling/transport features the app needs.

For .NET, C++, mobile or a terminal UI, the easiest path is to retain the full Rust
backend and consume its HTTP/WebSocket API. This Rust package is not directly a
.NET assembly or a C-compatible binary library: an explicit binding is required
for in-process non-Rust reuse, and none is currently supplied. Do not duplicate
trading math in the new UI. Treat snapshots as internal trusted persistence, not
as an input format for clients; plan migrations when changing that representation.
