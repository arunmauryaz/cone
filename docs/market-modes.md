# Market modes and recording

CONE uses Upstox API with two modes: Live and Replay workspaces.
Bot simulation has been removed from the UI, environment configuration and runtime. These are operator-wide modes for this installation.
The independent Rust engine still owns accounting/fill rules; it has no broker,
UI, database or system-clock dependency.

## Live: record only what this installation receives

- No historical/intraday REST requests occur when opening Live charts.
- The Upstox catalogue is metadata; downloading it does not populate chart prices.
- One shared full-mode WebSocket subscribes to the deduplicated watchlist,
  position/order/automation and visible-page interests, up to 2,000 keys.
- Initial provider snapshots, old trades, future timestamps and duplicates are
  ignored for Live recording. A quote must be a new live-feed event, with a last
  trade timestamp since the current connection, within the freshness window and
  during the supported Indian equity session.
- At night a new installation has no Live prices/candles. Connected is a transport
  status, not proof that a new trade has occurred. Old recorded candles remain
  viewable after restart; they are never reissued as fresh executable quotes.
- live-market.sqlite3 beside the configured account DB stores observed 1-minute
  OHLCV bars using SQLite WAL/FULL sync. Chart intervals aggregate those bars into
  5m/15m/30m/hour/day/week/calendar-month/calendar-year candles.
- Reconnecting resumes recording new events. Missing minutes/days remain absent;
  there is no downtime backfill or synthetic flat candle creation.
- Volume is observed provider cumulative-volume differences while connected, with
  the reported last-trade quantity used at a new connection/gap. Partial sessions
  and disconnected periods are not presented as complete exchange history.
- Only subscribed instruments are recorded. Adding a stock later starts its
  recording then. This is an observed feed archive, not an exchange tick archive.
- Live OHLC/volume shown in quotes reflects locally collected data, not historical
  daily OHLC supplied in the broker frame. Change is relative to the observed day
  opening value. Five-level depth comes from accepted live frames.

## Replay workspaces

Settings > Replay workspaces lists named projects and their date ranges, current
status, progress, equity and trade counts. Create a workspace by selecting a name,
completed past start/end dates and 1–20 instruments. Leaving the stock selection
empty uses the current watchlist. The API's one-minute historical range limit is
respected by fetching 28-day chunks; closed-market hours/weekends/holidays have no
bars and are skipped immediately during playback. A 500,000 instrument-bar guard
rejects oversized loads explicitly. No synthetic prices or missing bars are added.

Each workspace retains its own portfolio per authenticated account: cash,
holdings, positions, orders/reservations/idempotency, ledger, watchlists and equity
history. Appearance and identity remain global. A new workspace starts with fresh
virtual capital; selecting another workspace restores that workspace's state.
Live portfolios and recordings never receive replay trades or historical candles.

Market shows Play/Pause, Step 1 min, speed (1×/10×/60×), End replay and a link to
workspaces/results. The header has a visible Replay icon/badge. At 60×, one
recorded minute advances approximately each wall-clock second. The virtual clock
jumps between available minute bars, so there is no overnight waiting. Broker
historical candles cannot reconstruct genuine second-by-second ticks or historical
depth; replay deliberately shows known open/close events and minute OHLC/volume.

The initial known open can be traded. Full OHLC/volume is revealed at that minute's
end, never in advance. Market/limit/SL/SL-M fills use the currently known price;
no high/low price path is guessed. MIS rules/squareoff use the historical virtual
clock, not the user's current wall-clock hour. GTT/SIP/alerts and leaderboard remain
unavailable during Replay.

Reaching the final bar pauses the workspace and marks it Completed. End replay
marks it Ended at the current cursor. Both retain their holdings, positions, cash,
orders and results, with no forced liquidation or automatic deletion. Trading is
blocked after completion/end; financial results are valued at last revealed quotes.
The Results action shows equity, cash, orders and last holdings/positions with their
prices. It does not activate another workspace or expose future prices.

Rename a workspace at any time. Before playback/trades start, its date range can
be edited without deleting the workspace. Played/traded history cannot be rewritten;
extend the end date instead. Extension fetches only the added dates, appends bars,
reopens the workspace and preserves its cursor/portfolio/orders. A weekend-only
extension can add no bars; the workspace then remains complete until trading dates
are added. Updating an active range pauses and locks its trading controls while
loading. A failed fetch leaves the existing portfolio/dataset intact.

Delete is the sole operation that removes a workspace and its practice portfolios.
Deleting the active workspace returns the service to Live. The UI asks for deletion
confirmation. Switching workspaces, opening results, finishing or creating another
workspace never clears existing workspaces. Live/Replay account data stays isolated.

## Workspace persistence and migration

The account SQLite DB contains replay_workspaces (dataset, metadata, cursor,
speed, ended state), workspace_accounts (workspace ID + user ID + Book snapshot),
and app_meta (selected workspace/migration marker). Foreign keys cascade only on
explicit workspace deletion. Advancing a minute persists pending fills, accounting
and cursor together in one SQLite transaction; failure rolls back both prices/time
and financial state. Restart restores selection/progress, always paused.

Workspace datasets preserve selected instrument metadata so delisted/renamed
instruments can still be valued in saved results. Quotes/candle aggregation are
rebuilt only up to the saved cursor. Browser session IDs include workspace ID and
dataset revision, invalidating old chart/order retries after switching/editing.

The former single replay-session.json/replay-progress.json and replay_accounts
are imported once into a named workspace, including practice holdings/money. The
migration marker prevents a deleted legacy workspace from reappearing on restart.
The old files/tables are legacy-only and no longer drive playback. Back up the
account DB and live-market.sqlite3 with the private provider configuration.

## Provider and mode boundaries

market-provider.json still holds the write-only token, provider, data_mode and
revision. Existing files without data_mode migrate to Live automatically. Switching
providers/modes clears in-memory quotes; it never deletes the Live archive. Old
provider frames cannot enter the new mode after its revision changes.

Local provider/replay controls require authentication and a loopback-bound backend.
Publicly bound servers must be provisioned privately by their operator; there is
no public user-controlled global replay switch. Concurrent independent per-user
replay timelines are not implemented. No broker order endpoint is used.

The bot, browser demo and generated-history fallbacks are removed. Only static
quotes in isolated Rust integration tests remain; CLI/provider settings cannot
select that test fixture mode. New users begin with an empty watchlist. Existing
Live accounts and the previous replay portfolio are preserved.

## API

- GET/PUT /api/settings/provider: provider is upstox only, dataMode is live|replay.
- GET /api/replay: selected workspace's metadata/progress/status.
- GET /api/replay/workspaces: list with this user's result summaries and activeId.
- GET /api/replay/workspaces?id=ID: saved workspace + portfolio + last prices.
- PUT /api/replay action load: {name,startDate,endDate,instrumentKeys} creates and
  selects a new workspace. Legacy date is accepted as a one-day range.
- activate {id}, rename {id,name}, delete {id}, extend {id,endDate}, and edit
  {id,startDate,endDate,name?} manage workspaces. Edit requires no playback/trades.
- play/pause/step/end and optional speed:1|10|60 control the selected workspace.
- /api/market/candles reads only locally recorded Live bars or revealed Replay
  bars. Its last replay bar includes observedThrough to avoid double-counted volume.

Provider/workspace control remains local-operator configuration: authentication
and a loopback-bound service are required. Independent simultaneous per-user
playback clocks are not implemented; portfolios are isolated but clock/selection
are shared for this installation. Public deployment must be provisioned privately.
No broker trading endpoint is called.

## Storage and cleanup

Back up the account DB (including all workspace tables), live-market.sqlite3 and
private provider configuration when preserving the full installation.
Tokens must remain private. The old candle-cache/ and downloaded RELIANCE research
exports are no longer used and were removed during this migration. Do not import
those old historical bars into live-market.sqlite3. No account/password/trade
reset is part of this migration.

## Verification and limits

Unit/integration checks cover fresh-feed filtering, duplicate/snapshot rejection,
archive persistence with gaps, replay candle revelation, engine trade isolation
and paused restart. Real-account smoke tests use a separate test DB and actual
Upstox historical session. Playback controls are checked in a browser.
Active-session Live tick latency and long-running storage/load are not benchmarked.
Observed bars can be partial. No software can promise an error-free broker/network
connection; failures remain explicit and never trigger simulated substitution.
