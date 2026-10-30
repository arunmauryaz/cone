# CONE Rust backend

The backend hosts cone-engine for any UI. It is a standalone Rust service; React
and Node.js are not required to execute orders or run the scheduler.

## Module boundaries

| File | Responsibility |
|---|---|
| main.rs | Configuration, listener, tracing, graceful Ctrl+C shutdown |
| lib.rs | Axum routes, auth boundary, WebSocket broadcast, shared provider loop |
| store.rs | Schema setup, passwords, sessions, SQLite transactions |
| market.rs | Catalogue indexes and normalized Live/replay quotes |
| orders.rs | Pending-order lifecycle, reservations and calls into cone-engine |
| automation.rs | GTT/OCO, alerts, SIP recurrence and live MIS squareoff |
| service.rs | Account commands and UI-facing portfolio/analytics projections |
| model.rs | Persistent account aggregate and audit records |
| watchlists.rs | Validate saved groups/pins and prune removed stocks |
| provider.rs | Local provider configuration, master cache and shared Upstox V3 stream |
| upstox_proto.rs | Decode the official V3 protobuf price/depth fields |
| error.rs | Structured errors, decimal input parsing, timestamps |
| data/instruments.json | Initial equity/index universe copied from the old app |

Trading arithmetic, fills, margin accounting, stop activation and session
classification reside in the engine crate. Network I/O, orchestration and durable
state belong to this host. Native clients should consume the API; there is not
yet a C ABI or .NET native binding for the Rust library.

Watchlist groups and pin order are presentation metadata stored in the same
account aggregate as each flat watchlist. Optional `groups` and `pinned` fields
need no schema migration; legacy accounts retain all stocks. Updates validate
membership, unique group IDs and exclusive group assignment inside the account
transaction. Invalid updates roll back names/stocks/metadata together. Old
clients removing a stock also remove its group and pin references. Deleting a
group retains flat membership. See api.md for limits and wire format. These
features do not change cone-engine or trading execution.

Quick and Regular web tickets both submit ordinary orders to the same API.
Quick uses LIMIT (entered price) or MARKET; Regular additionally exposes SL and
SL-M triggers. They do not create separate engines or execution rules. CNC/MIS,
tick/lot sizes, cash reservations and stop activation remain server-authoritative.
Stop orders are independent orders; attached entry/stop/target brackets, MTF and
Iceberg are not implemented.

## Running

From the workspace root:

```powershell
. D:\Rust\env.ps1
cargo run --manifest-path backend/Cargo.toml -p cone-backend --locked
```

GET /health reports the backend and provider state. Default bind is loopback
127.0.0.1:8000. The service creates a new data/cone.sqlite3; it never opens or
rewrites the old Python database automatically.

Configuration is through environment variables, listed in .env.example. A .env
file is not automatically loaded. CONE_BIND can bind a VPS network address;
CONE_ALLOWED_ORIGINS must include exact web origins. A native HTTP client needs no
CORS configuration. CONE_WEB_DIR optionally serves Vite's built files, including
SPA route fallback, from the same server.

## Identity and account isolation

Registration creates identity and its starting account in one transaction.
Usernames are case-insensitive. Passwords are salted Argon2id hashes. Login never
creates a user, ignores an incorrect password, or trusts browser identity.

Sessions are random 256-bit bearer values, expire after 24 hours, can be revoked
by logout, and are stored only as SHA-256 digests in SQLite. Protected routes derive
the account from the authenticated session; userId in query/body is never an
account selector. Authentication work runs on blocking workers with a four-worker
concurrency bound and per-username request throttling. Requests have a 64 KiB
body limit. Public endpoints expose only market data and health, including the
market WebSocket; private account data never appears on that socket.

The profile endpoint supports display-name, username and password changes. Changing
credentials verifies the current password, checks name uniqueness, atomically
updates the database and revokes old sessions. A replacement token keeps the
saving browser signed in. Password recovery is not implemented.

## Atomic persistence

SQLite uses foreign keys, WAL, FULL synchronous mode and a busy timeout. Schema
version 1 is tracked through PRAGMA user_version. Tables:

- users: identity, password hash and creation time.
- sessions: hashed token, account identity and expiry.
- accounts: serialized account aggregate and scheduler activity marker.

Every trading command starts BEGIN IMMEDIATE, reads the latest aggregate,
executes against a private in-memory copy, and commits its updated engine state,
orders, reservations, ledger and notifications together. Errors roll back the
transaction. The server reloads state from SQLite rather than maintaining a second
uncommitted account cache. Durable order IDs survive restarts. No-op scheduler
passes avoid rewriting unchanged snapshots.

One process currently serializes database operations on a mutex-protected SQLite
connection. Blocking work is off the Tokio networking executor. This is a safe
local/small-server baseline, not a benchmarked distributed system. Multi-instance
hosting needs a suitable database transaction design, one scheduler owner per
account, and deployment tests. Replacing storage does not require changing the
trading language.

Back up SQLite using its online backup facilities, or stop the service and copy
its database with any outstanding WAL/SHM files together. Backups must preserve
account state, execution history and session/identity tables consistently. Snapshot
format is internal persistence, not a client API or an import format for untrusted
JSON. Schema/snapshot migrations must be explicit when the format changes.

## Order lifecycle

MARKET executes at the server's current quote. Browser-supplied market prices
cannot override the fill. LIMIT fills only at or better than its limit. SL
activation latches; it subsequently acts as a limit. SL-M fills at market after
activation. Quotes older than five seconds are rejected for execution.

Pending orders reserve cash using the core's execution preview. CNC sell orders
also reserve available share quantity across the pending book. Cancellation
releases reservations. Triggered orders release their reservation and execute
with current funding validation; a price gap or changed position can therefore
cause rejection. GTT orders reserve nothing until their trigger places a child.
OCO cancels the other leg when one leg triggers, including if child placement
fails. Trigger failures are recorded and notified rather than retried endlessly.

Order modification is an atomic cancellation/replacement: the old order remains
CANCELLED for audit, and the replacement has a new ID and replacesOrderId in its
request. A failed replacement rolls the whole change back.

All fills are full quantity at LTP. Depth-based liquidity, slippage, partial fills,
exchange taxes, settlement and maintenance-margin liquidation remain future work.

## Market providers

Upstox is the only provider. Settings > Market Data chooses Live or Replay; bot
simulation has been removed.
This shared feed is operator configuration, not a per-trader broker account.
The independent trading library never contacts Upstox or places real orders.

`provider.rs` owns configuration, catalogue refresh, subscription selection and
one reconnecting Upstox Market Data Feed V3 WebSocket. `upstox_proto.rs` decodes
only the published protobuf fields needed for prices, OHLC and five-level depth;
unknown fields are ignored. Subscription messages are binary JSON in `full` mode.
The regular full-feed cap is 2,000 unique keys; exceeding it refuses the set rather
than silently dropping protected positions. Authentication failures and network
failures are visible statuses. No simulated quotes replace missing live data.

Use a standard access token or the free read-only Analytics Token. Local setup
accepts it once through the authenticated provider endpoint and writes it to
ignored `data/market-provider.json`, beside the configured database. It is not
stored in browser storage, user preferences, snapshots, API responses or logs.
The file contains a credential; keep its directory private. Setup writes are
allowed only when CONE is bound to loopback. Publicly bound deployments must
configure their operator-owned provider outside the public user UI. Environment
variables remain initial defaults; a saved local provider file takes precedence.

The catalogue downloads NSE/BSE BOD JSON gzip files from Upstox assets and caches
cash-segment/index metadata as `upstox-instruments.json`. It refreshes on provider
configuration revision, restart in live mode, and the next IST date. Failures
retry after five minutes; a valid existing cache remains usable. Equity aliases
such as NSE_EQ|TCS are preserved and mapped to actual ISIN-based provider keys.
Only instruments marked tradable can be submitted; derivatives and other asset
classes are not treated as equity trades. Unsupported cash-segment listings may
be browsed as display-only. The metadata cap is 50,000 entries; it is not the
stream subscription cap. Snapshots share catalogue storage via Arc.

Nifty 50/100/500 membership comes from NSE Indices constituent CSV files, matched
by ISIN to the Upstox catalogue. This is index metadata, not another price feed.
Filters show available matching instruments; unavailable members are not invented.
Source lists may have fewer available members than the headline index size. Missing NSE metadata leaves those filters
empty with an explicit message.

Subscriptions are the deduplicated union of all saved watchlists, holdings,
positions, open orders, active GTT/alerts/SIPs, and temporary visible-page or
stock-detail interests. Browser interests expire in 45 seconds and refresh every
15 seconds; closing a page removes its interest. The table is paginated at 50
rows and its live-quote toggle defaults off. Removing table interests never
unsubscribes an instrument still required by an account or schedule. One shared
connection serves connected clients; browsing symbols does not request one quote
per row. The browser receives periodic snapshots and immediate Live updates; no artificial display delay may be throttled.

Switching sources clears prior-source quotes immediately and preserves account
records. Five-second freshness checks still gate Live fills. Live charts read only
locally recorded bars. Explicit Replay loads a selected past session and isolates
its practice book/virtual clock; no Live historical REST backfill occurs.
See [market modes](market-modes.md) for recording, restart and replay details.

Official references: [feed and limits](https://upstox.com/developer/api-documentation/v3/get-market-data-feed/),
[Analytics Token](https://upstox.com/developer/api-documentation/analytics-token/),
[instruments](https://upstox.com/developer/api-documentation/instruments/),
[REST rate limits](https://upstox.com/developer/api-documentation/rate-limiting/).

## Sessions and schedules

Live equity orders use weekday
09:15–15:30 IST sessions. From 15:20, new MIS exposure is refused, pending MIS orders
are cancelled, and open MIS positions are squared off when fresh prices are
available. Holidays, broker outages and missed squareoff during downtime require
additional exchange calendar/risk handling; the system does not fabricate exits.

SIPs are quantity-based CNC market buys, with daily/weekly/monthly calendar
recurrence. An omitted start date is due on the next scheduler pass. Explicit dates
use 09:15 IST. Monthly schedules preserve their anchor day across short months.
Missed periods execute at most one catch-up installment, then advance into the
future. Insufficient-funds failures notify and advance instead of hammering the
account each tick. Live schedules wait for the weekday session. Paused SIPs do not
run. Orders, GTTs, alerts and SIPs remain durable across restarts.

## API and client behavior

See [API contract](api.md). The API keeps the old /api/* and /ws/market route style, with real
session authorization. Connected React accounts use server snapshots and commands;
network failure does not enable browser-based execution or fake-price fallbacks.
The bot and standalone browser demo were removed. Live updates have no artificial
display throttle; Replay speed advances only the virtual clock.

Runtime data is kept separate from source and development caches. No migration
from browser base64 passwords or the old Python SHA-256 account database is
attempted. Accounts should be registered afresh for this version.

## Checks

```powershell
cargo test --manifest-path backend/Cargo.toml --workspace --locked
cargo fmt --manifest-path backend/Cargo.toml --all -- --check
cargo clippy --manifest-path backend/Cargo.toml --workspace --all-targets --locked -- -D warnings
```

Tests include injected SQLite write failure, restart recovery and concurrent
spending, not just request/response examples. Throughput with thousands of active
accounts and real-provider credentials has not been established.

## First-user provisioning

No username/password literals are built into the executable. The local launcher
reads ignored data/local-setup.json and passes CONE_INITIAL_USERNAME and
CONE_INITIAL_PASSWORD. With CONE_LOCAL_ADMIN=true on a loopback address, those inputs
create the first ordinary user only in an empty database. Existing databases are
left unchanged, even when that first user renames the account. Passwords are
hashed before storage. Setup configuration is never consulted during login.

Account UI preferences include showStockScreener and showMarketChart booleans; they do not disable protected watchlist/position/order feed interests.


Current market implementation is described in [market-modes.md](market-modes.md).
`live_archive.rs` records received bars; `replay.rs` loads/reveals an explicit past
session; `history.rs` validates broker candles. `replay_workspaces` and `workspace_accounts` retain per-workspace practice state;
legacy singleton replay data migrates once without resetting Live account snapshots.
Provider/local-catalogue lookup maps are shared with Arc and indexed by local and
provider keys, avoiding a full catalogue scan for every incoming quote.

Workspace completion retains financial state. Cursor advancement and pending fills
commit atomically in the account DB; finished results remain available until
explicit deletion. Range extension preserves positions/cursor; unused ranges may
be edited. Selected instrument metadata is saved with each dataset. Candle data
requests use 28-day Upstox chunks; no closed-hour waits or invented prices occur.
