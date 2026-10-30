# CONE HTTP and WebSocket contract

Base: http://127.0.0.1:8000. Requests/responses are JSON. Errors use
`{"detail":"message"}` with an HTTP error status. All paths below start with /api
unless stated otherwise. The 64 KiB request limit is enforced by the server.

## Authentication

Public: health, market data, register and login. Everything else requires:

```text
Authorization: Bearer <token-from-register-or-login>
```

Session identity selects the account. A userId query/body field cannot select
another user. Sessions expire in 24 hours. Re-authenticate after a 401; logout
revokes the session. Do not treat a browser username as authorization.

| Method | Path | Body / result |
|---|---|---|
| POST | /auth/register | {username, fullName, password} -> {success,user,token} |
| POST | /auth/login | {username,password} -> {success,user,token} |
| GET | /auth/me | Authenticated user profile |
| PUT | /auth/profile | {fullName?,username?,currentPassword?,newPassword?} -> {success,user,token?} |
| POST | /auth/logout | Revoke current session |

Usernames: 3–40 ASCII letters/digits/underscores/hyphens, case-insensitive.
Password: 8–128 bytes. Display name: nonempty, at most 100 bytes. Login does not
create users. Username/password changes require currentPassword. New passwords require 8–128
bytes. Changes preserve account identity and portfolio, revoke all old sessions
and return a replacement token; clients must save it before their next request.

## Money and time

Incoming price, trigger and funding amounts accept decimal strings or numbers
with no more than two fractional digits. Use strings for native clients to avoid
binary floating-point conversion. Example: "123.45". Zero, negatives, exponent
strings and out-of-range amounts are rejected. Accounting always uses integers.

Legacy UI-facing `price`, `balance`, `avgCost` and similar fields are major-unit
numbers for display. `wallet.minorUnits` contains exact integer balances;
`priceMinor`, `triggerMinor`, `feeMinor` and `realizedPnLMinor` are exact integer
order values. One Coin equals 100 minor units. Average unit cost can have more
precision than a minor unit; the engine keeps total basis rather than a rounded
average. Do not reconstruct authoritative balances from UI display values.

Order timestamps and notification timestamps are ISO 8601. History timestamps
are Unix milliseconds. Market `lastUpdate` and candle `time` are Unix seconds.

## Market data (public)

| Method | Path | Query / result |
|---|---|---|
| GET | /health (no /api prefix) | Server and provider status |
| GET | /market/stocks | Instrument catalogue array |
| GET | /market/prices | Map keyed by local instrumentKey |
| GET | /market/stock/{encoded instrumentKey} | Instrument quote |
| GET | /market/depth/{encoded instrumentKey} | {bids,asks,source} |
| GET | /market/candles | instrumentKey, interval, count (1–1000) |
| GET | /market/movers | limit -> {gainers,losers,mostActive} |
| GET | /market/search | q -> up to 20 matching instruments |

Candle intervals: 1minute, 5minute, 15minute, 30minute, 1hour, day, week; Upstox additionally supports month and year.
Candles are {time,open,high,low,close,volume}. Chart requests require an
account session. Live returns only locally recorded bars; Replay returns only
revealed completed-minute bars, aggregated into the requested interval. No generated price/history mode is available. Intervals: 1minute, 5minute, 15minute,
30minute, 1hour, day, week, month/year (Live and Replay). Replay's last bar may
include observedThrough (virtual milliseconds) to prevent double-counted UI volume.

## Orders

```json
{
  "id": "client-generated-unique-request-id",
  "instrumentKey": "NSE_EQ|TCS",
  "side": "BUY",
  "product": "CNC",
  "orderType": "LIMIT",
  "qty": 1,
  "price": "4000.00"
}
```

`side`: BUY/SELL. `product`: CNC/MIS (default CNC). `orderType`: MARKET (default),
LIMIT, SL or SL-M. `qty`: positive integer, at most 1,000,000, following lot size.
Non-market prices and triggers must match the catalogue tick size. SL BUY limit
must be >= trigger; SL SELL limit must be <= trigger.

- MARKET ignores any supplied price and uses the server quote.
- LIMIT requires price and only fills at or better than it.
- SL requires price and triggerPrice. Trigger activation latches until filled.
- SL-M requires triggerPrice, then fills at the current market quote.

| Method | Path | Action |
|---|---|---|
| GET | /orders | Newest-first order records |
| POST | /orders | Place/queue order; returns {success,order} |
| PUT | /orders/{id} | Change qty/price/triggerPrice via atomic cancel/replace |
| DELETE | /orders/{id} | Cancel an OPEN order and release reservation |

Statuses: OPEN, COMPLETE, CANCELLED, REJECTED. Invalid initial requests return an
error and are not inserted as orders. Pending trigger-time failure is retained as
REJECTED with rejectionReason. Modified orders have a new ID and replacesOrderId;
the old record stays CANCELLED. Maximum 500 OPEN orders per account.

Supply a stable id (or clientOrderId, or Idempotency-Key header) and reuse it when
retrying an uncertain placement. Same ID and identical JSON request returns the
original record, even after restart. Same ID with a different request returns
409. If a client omits an ID, the backend generates one and cannot identify a
lost-response retry. Idempotency is account-scoped and currently applies to order
placement, not every CRUD/funding request. Reset creates a fresh account history.

A confirmed execution and a failed UI refresh are different events; refresh
state after reconnect rather than blindly issuing a new order ID.

## Portfolio and wallet

| Method | Path | Body / result |
|---|---|---|
| GET | /portfolio/state | Complete UI snapshot |
| GET | /portfolio/summary | Wallet, equity and realized P&L |
| GET | /portfolio/holdings | CNC holdings |
| GET | /portfolio/positions | MIS positions; signed qty, BUY positive/SELL negative |
| POST | /portfolio/positions/{id}/exit | Close this account's position at market |
| POST | /portfolio/positions/exit-all | Atomic closure of current MIS positions |
| GET | /portfolio/transactions | Wallet ledger |
| POST | /portfolio/funds/add | {amount:"1000.00"}; maximum available cash C 10,00,000 |
| POST | /portfolio/reset | Reset account/trades/schedules, retain watchlists/preferences |

Encode IDs in path segments. MIS IDs use MIS:{instrumentKey}. Snapshot fields:
wallet, holdings, positions, orders, watchlists, alerts, gttOrders, sips,
notifications, achievements, history, totalPortfolioValue, realizedPnL,
marketSource and marketStatus. Equity may be null if an open instrument has no
mark, for example before live feed availability. Available cash excludes both
open-position margin and pending-order cash reservations. Native clients should
use null as unavailable rather than guessing a market value.

Execution records are durable. History is capped at 5,000 account-change samples;
notifications at 200. The ledger and order audit remain in the aggregate.

## Watchlists

| Method | Path | Body |
|---|---|---|
| GET | /portfolio/watchlists | Array with id/name/stocks and optional groups/pinned |
| POST | /portfolio/watchlists | {name} -> {success,watchlist:{id,name,stocks}} |
| PUT | /portfolio/watchlists/{id} | {name?,stocks?:[instrumentKey,...],groups?,pinned?} |
| PUT | /portfolio/watchlists/{id}/move | Atomic stock/group move or reorder |
| DELETE | /portfolio/watchlists/{id} | Remove watchlist |

Maximum 10 lists, 100 unique instruments each. Symbols must exist in the catalogue.

`groups` is an ordered array of `{id,name,stocks:[instrumentKey,...]}` (maximum
20). IDs are unique, 1–64 ASCII letters/digits/hyphens/underscores. Trimmed group
names are 1–50 bytes. Each stock must belong to the parent watchlist and may be
assigned to at most one explicit group. Unassigned stocks form the UI's implicit
Default group. Removing a group does not remove its stocks from the watchlist.
`pinned` is a unique array of watchlist instrument keys (maximum 100); the UI
sorts pinned rows before other rows within their group.

Fields may be updated together in one transaction. Invalid membership, duplicate
assignments or malformed metadata reject the entire change. Legacy clients can
continue sending stocks alone: removed stocks are automatically pruned from
existing groups and pins. Old lists without metadata behave as empty groups/pins;
there is no database reset or schema migration. Metadata is account-scoped.

`groupOrder?:[groupId,...]` controls section order; the empty-string ID denotes
the implicit Default group. New IDs append and removed group IDs are pruned.
A move body is `{kind:"stock"|"group",item,targetListId,targetGroupId?,beforeId?}`.
For a stock, item is its instrumentKey; targetGroupId defaults to Default and
beforeId is another stock key (omitted/null appends). For a group, item is its ID
(empty string moves Default members); within the same list beforeId is a group
ID. Across lists the explicit group moves with its members and pins. Both list
updates commit together; capacity, ownership or target errors preserve both.

## Alerts, GTT and SIP

| Method | Path | Action |
|---|---|---|
| GET/POST | /orders/alerts | List/create price alerts |
| DELETE | /orders/alerts/{id} | Remove alert |
| GET/POST | /orders/gtt | List/create GTT or OCO |
| DELETE | /orders/gtt/{id} | Cancel ACTIVE GTT |
| GET/POST | /orders/sips | List/create SIP |
| DELETE | /orders/sips/{id} | Remove SIP |
| PATCH | /orders/sips/{id}/status | {active:true/false} |

Alert body: {instrumentKey,condition:"above"|"below",target:"4000.00"}.
GTE/LTE and targetPrice aliases are accepted. Maximum 200 alerts.

Single GTT: {instrumentKey,side,product,qty,triggerPrice,limitPrice,condition?}.
OCO: {instrumentKey,product,qty,side,legs:[{triggerPrice,limitPrice,condition,side?},
{triggerPrice,limitPrice,condition,side?}]}. Exactly two legs are required. Omitted
condition is chosen from the trigger's position relative to current LTP. GTT
triggers create LIMIT child orders. Maximum 200 GTT parents. Cash is checked and
reserved when the child is placed, not when the parent is created.

SIP: {instrumentKey,qty,frequency:"daily"|"weekly"|"monthly",startDate?:"YYYY-MM-DD"}.
Quantity-based CNC buys only. No amount-based fractional share investment. Maximum
100 SIPs. See README.md for recurrence, catch-up, failure and session behavior.

## Notifications, preferences and analytics

| Method | Path | Body / result |
|---|---|---|
| GET | /notifications | Newest-first notification records |
| POST | /notifications/{id}/read | Mark read |
| POST | /notifications/read-all | Mark all read |
| DELETE | /notifications | Clear notification inbox |
| GET | /settings | User UI preferences plus provider status, no secrets |
| PUT/POST | /settings | theme, refreshInterval, notifications and UI booleans |
| GET | /settings/provider | provider, status, configured, tokenSaved, editable, instruments, catalogueStatus, transport, subscriptionLimit |
| PUT | /settings/provider | Local operator setup: {provider?:"upstox",accessToken?,clearToken?} |
| PUT | /market/interest | Authenticated temporary quote interest: {clientId,instrumentKeys:[...]} |
| GET | /analytics/metrics | Win rate, P&L, drawdown and equity |
| GET | /analytics/equity-curve | Retained account-change history |
| GET | /analytics/leaderboard | Top 100 real-account usernames, equity, returns and trades |

All-time leaderboard returns subtract starting balance and contributed funds;
funding alone cannot create performance. No fake traders are injected. Empty
profit-factor denominator is represented as null. Provider selection/credentials
are shared operator configuration, separate from ordinary account preferences.
Provider writes require a loopback-bound service; public binds return 403.
Token values are write-only and never returned. Empty accessToken retains the
saved token; clearToken removes it. A source change clears quote caches without
resetting users/accounts. See backend.md for the ignored local configuration file.

Interest client IDs are 1–64 characters, maximum 100 valid instrument keys per
client and 1,000 active clients per service. A heartbeat refreshes its 45-second
expiry; an empty array removes it. Multiple viewers share provider subscriptions.
Watchlists/account schedules remain subscribed independently of browser interest.
This endpoint does not place a real or simulated order.

## WebSocket (public market data only)

Connect ws://127.0.0.1:8000/ws/market (or WSS behind a TLS proxy).

```json
{"type":"SNAPSHOT","source":"upstox","status":"connected","prices":{"NSE_EQ|TCS":{"ltp":4210.0}}}
```

An immediate SNAPSHOT is followed by TICK messages with the same shape.
`catalogueVersion` also identifies source/catalogue-size changes so clients can
refresh the master list without repeatedly downloading it. Each prices value includes instrument metadata, OHLC, volume, change, changePercent,
lastUpdate and source. Snapshots contain retained quote values, not the entire
instrument master when only a subset is subscribed. Native clients
may connect without an Origin header; browser Origins must be allowed. The stream
contains no account information. Slow readers may skip ticks; each tick is a full
snapshot. Clients should reconnect and replace their price map from the snapshot.

UI settings accept optional booleans showStockScreener and showMarketChart (both default enabled when absent). These are account preferences, not provider-wide subscription switches.


## Live recording and Replay workspaces

Provider is upstox only. dataMode is live|replay; legacy bot settings migrate to
Upstox Live without fabricated quotes. Provider/replay writes remain local
operator controls and require account authentication.

GET /api/replay returns selected workspace {id,name,startDate,endDate,loaded,
playing,loading,cursor,total,speed,finished,status}; status is paused, playing,
completed or ended. GET /api/replay/workspaces returns {activeId,workspaces:[...]}
with this user's equity/cash/trade summaries. With ?id=ID it returns
{workspace,portfolio,prices} valued at that workspace's last revealed point.

PUT /api/replay accepts:
- {action:"load",name,startDate,endDate,instrumentKeys:[...]}: create/select a new
  workspace, 1–20 stocks, completed historical dates. date is a legacy one-day alias.
- {action:"activate"|"delete",id}, {action:"rename",id,name}
- {action:"extend",id,endDate}: append later dates, retaining cursor and trades.
- {action:"edit",id,startDate,endDate,name?}: change an unused/unplayed range only.
- {action:"play"|"pause"|"step"|"end",speed?:1|10|60}: current playback control.

Completion/end retains all records and blocks trading until extension. Delete
cascades only that workspace's portfolios. Selected workspace watchlists are also
isolated; appearance/authentication remain global. Finished Replay portfolio/reset
is unsupported: delete the workspace explicitly instead. Prices from future
frames and full datasets are never returned through the market/results API.

Historical requests are chunked at 28 calendar days; gaps skip directly to the next
available minute. No tick interpolation/depth is invented. See
[market-modes.md](market-modes.md) for storage, migration and virtual-clock rules.
