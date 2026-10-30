# Engine guide — reuse without duplicating trading rules

## What this folder is

`backend/engine` is the `cone-engine` Rust library. Its source, tests, example and
Cargo manifest are self-contained. Nesting it inside backend is organization;
there is no HTTP, SQL, auth or React dependency in this package. Its own README
travels with it if the folder is copied elsewhere.

The full Rust backend is engine plus host services. Future interfaces can usually
reuse the whole backend, rather than rebuilding those services.

## Responsibility map

| Capability | Engine library | Rust backend host | Interface |
|---|---|---|---|
| Execute fills, margin and money arithmetic | Owns | Calls engine | Displays results |
| Holdings, MIS positions and equity | Owns accounting | Persists/projects state | Displays |
| Stop activation and fill eligibility | Pure functions | Stores pending lifecycle | Submits requests |
| Pending orders, GTT/OCO, SIP and alerts | Supporting rules | Owns durable orchestration | Configures/displays |
| Market provider network calls | None | Owns adapters and shared feed | Never supplies trusted execution quotes |
| Users, passwords, sessions | None | Owns | Login forms/session client |
| SQL, history and recovery | None | Owns transactions | Reads API state |
| Candles and market depth | None | Owns Live/replay data | Renders charts |
| Trading clock | Receives explicit timestamps | Reads time and schedules | Displays time/status |
| HTTP/WebSocket | None | Owns | Consumes |

Taking only the library does not also take account login, market connections,
pending-order persistence or SIP scheduling. Those are available by reusing the
backend service.

## Implemented core rules

- One account per Engine instance, no global singleton or UI state.
- Exact signed integer hundredths of a Coin; checked arithmetic and overflow errors.
- CNC buy/partial sell/full sell, total cost basis and realized P&L; no CNC shorts.
- MIS longs/shorts, additions, weighted basis, partial exits and crossing through
  zero into a reverse position.
- 20% MIS initial margin, reservation/release of pending cash, positive funding.
- Simplified brokerage: zero CNC, MIS min(C 20, 0.03% of complete order value).
- Equity including cash, holdings, MIS margin/P&L and pending cash reservations.
- Positive price/quantity validation and configurable quote freshness (default 5s).
- Atomic in-memory rejection; identical successful order retries return one fill.
- Pure MARKET/LIMIT/SL/SL-M eligibility with stop activation that stays latched.
- Weekday IST session classification, chosen/enforced by the host.
- Serializable internal snapshots for host persistence and successful-order IDs.

The full arithmetic and rounding contract is in
[the package README](../backend/engine/README.md).

## Public API and host obligations

| API | Role |
|---|---|
| Money::from_minor / minor | Exact accounting boundary |
| Engine::new | Create an account with a nonnegative opening balance |
| MarketOrder / Quote | Typed fill request and trusted market input |
| Engine::execute_market | Execute an immediate fill with validation |
| Engine::required_cash | Funding preview using the same fill path |
| Engine::reserve / release / credit | Cash controls for a trusted host |
| Engine::account / executions | Read-only state and successful executions |
| Account::equity | Value all open instruments using supplied marks |
| should_fill / OrderKind | Eligibility and latched stop activation |
| indian_equity_session / Session | Weekday trading-session policy |

One Coin equals 100 minor units. Retain total basis, not a rounded display average.
Quote timestamp_ms and now_ms must share the same millisecond time domain. The
host must source quotes; untrusted UI form values must never become market prices.

The core's successful-ID map is account-scoped. The host must serialize commands
per account, persist its snapshot together with orders/reservations/ledger and
idempotency records in one transaction, and acknowledge after commit. Serializing
a struct is not itself crash-safe storage. Internal snapshot JSON is not a public
command format; do not deserialize user-provided engine snapshots.

## Recommended reuse: a new .NET/C++/TUI client

1. Run `cone-backend` locally or on a server, using its existing database/providers.
2. Implement login, store the returned session, and use Bearer authorization.
3. Read `/api/portfolio/state` and market catalogue/prices.
4. Subscribe to `/ws/market` for SNAPSHOT/TICK messages; reconnect from snapshots.
5. Submit orders with stable IDs and retry the same ID/payload after uncertainty.
6. Build native navigation, charts, tables and platform-specific secure session
   storage. Do not reimplement balances, fills or margin in the UI.
7. For editable credentials, save the rotated token from profile changes before
   issuing the next request. Account identity is its database ID, not its username.

A .NET app can launch the same local Rust service as a child process on loopback,
or connect to an existing service. It does not need a separate .NET trading
backend. Use platform-appropriate process management, a persistent writable data
location and explicit CONE_DATABASE_PATH; do not place account data beside a
read-only installed executable.

See [the API contract](api.md) for exact paths, payloads, money/time representations,
session rotation, error semantics and idempotency. No C ABI, P/Invoke binding,
C++ wrapper or WASM package exists yet. Do not claim that a Rust rlib can be
referenced directly as a .NET assembly. Add an explicit adapter if direct
in-process non-Rust embedding is actually required.

## Reuse only the library in another Rust host

Copy **only backend/engine/** to a new location. It contains no inherited workspace
settings or path dependencies on the web app. Rust 1.85+ is declared by the crate;
use a toolchain compatible with the selected dependencies and keep a lockfile for
an application host. The present workspace is checked on the installed stable
Rust toolchain.

```powershell
# After copying the engine folder to your chosen location:
cargo test --manifest-path path/to/engine/Cargo.toml
cargo run --manifest-path path/to/engine/Cargo.toml --example paper_trade
```

For a Rust application, add `cone-engine = { path = "path/to/engine" }` in that
application's dependencies. Supply a host for durable state, providers, account
routing, pending-order lifecycle, scheduling and transport as required. A copied
library has no lockfile of its own until Cargo generates one; the current service
uses backend/Cargo.lock. Do not depend on files outside the copied folder.

Minimal flow:

```rust
use cone_engine::{Engine, MarketOrder, Money, Product, Quote, Side};
let mut engine = Engine::new(Money::from_minor(10_000_000)).unwrap();
let order = MarketOrder {
    id: "order-1".into(), instrument: "NSE_EQ|DEMO".into(),
    side: Side::Buy, product: Product::Cnc, quantity: 1,
};
let quote = Quote {
    instrument: order.instrument.clone(),
    price: Money::from_minor(10_000), timestamp_ms: 1_000,
};
let fill = engine.execute_market(order, &quote, 1_000).unwrap();
```

A library fill is full quantity at supplied LTP. `MarketOrder` is not itself a
pending LIMIT order: the host calls should_fill and manages activation/reservations
before invoking the fill path. See backend/src/orders.rs for the existing host.

## Boundaries and updates

There is no complete exchange tax/settlement model, liquidity/slippage/partial
fills, holiday calendar, derivatives engine or maintenance-margin liquidation.
Negative cash may be realized by risk-reducing exits rather than trapping a loss.
No thousand-user throughput benchmark has been established.

For changes to core semantics, update this guide and the package README, add
accounting regression tests, and update API/backend documentation if projections,
persistence or client behavior change. Test a standalone copy after changing
manifests/module boundaries. Preserve layer separation and migrations; do not
silently fork a second trading implementation for a new platform.

The host also supports historical Replay with a separate practice book. It calls
this unchanged engine with historical quotes and an explicit virtual now_ms value;
the engine itself never reads a system clock or broker history. Live archive and
replay session logic belong in backend/src. See [market modes](market-modes.md).
