# Verification — current layout, 30 October 2026

## Layout and data

- Root has backend/, frontend/, docs/, data/, launcher.bat, README.md,
  AGENTS.md and .gitignore. The Rust workspace/lockfile are inside backend/.
- Engine source stays separate under backend/engine/ and does not inherit
  parent-workspace manifest settings.
- Old application and unused references are outside the project at D:\CONE-archive.
- Account database stays at data/cone.sqlite3. Initial setup configuration moved
  to ignored data/local-setup.json. No account reset or data migration was performed.
- Runtime logs are data/logs/. Development tools/build caches remain under D:\Rust.

## Checks after reorganizing

| Check | Result |
|---|---|
| Rust workspace tests using backend/Cargo.toml | 34 passed: 18 core, 1 persistence, 15 backend |
| Strict Clippy, all targets | Passed |
| Rust formatting check | Passed |
| Copy only backend/engine outside the workspace, without editing its manifest | 19 engine tests passed independently |
| Frontend production build from frontend/ | Passed |
| Frontend lint | Exit 0; existing warnings remain, including demo hooks/context exports |
| launcher.bat through its real batch entry point | Started Rust and Vite on default ports |
| Browser /health, registration screen and market WebSocket | Passed, 38-instrument SNAPSHOT, no page errors |
| Local Markdown links | Verified across overview, agent, package and detailed guides |
| Relaunch while both development ports are occupied | Launcher stopped both previous listeners, rebuilt and restarted; backend health and frontend HTTP 200 passed |

The standalone copy and build output are under D:\Rust\checks and D:\Rust\build,
not inside the project. The normal app was left running at localhost:5173.

## Existing behavioral evidence

Docked screener UI revision: production build passed and lint exited 0 with
existing warnings. Isolated Chrome verified the left pane stays at the same
header/bottom bounds while the right table scrolls and document scroll stays zero;
groups have individual borders. Named saved watchlists in the screener dropdown
filter independently of the left tabs. Nifty filtering and search passed, along
with Day/Night and 390px mobile bounds. No page errors. Screenshots were inspected.
Evidence: D:\Rust\checks\browser\verify-screener-layout.cjs and screener-docked-*.png.
No backend, quote subscriptions or trading rules changed in this revision.

Market/Upstox setup revision (30 October): all 34 Rust tests, formatting and strict
Clippy passed. Tests cover protobuf normalization against the published V3 field
schema, exact quote/depth conversion, source switching without account changes,
write-only token persistence, group/stock reorder, atomic cross-list moves and
ownership/rollback checks. Frontend build passed; lint exited 0 with existing
warnings. Isolated browser checks exercised native group/stock dragging onto
sections/rows/numbered workspace tabs, persistence after reload, focused catalogue
search, empty workspace/group add flows, stock filters, optional visible-page
quote interests, no-token Upstox setup, absence of fabricated live quotes, switch
back to simulation, and Day/Night/mobile layouts. No page errors or page overflow.

Public network checks downloaded and normalized 23,032 cash/index instrument
records from Upstox's NSE/BSE BOD files. NSE membership matching produced 50/99/499
available Nifty 50/100/500 matches in that catalogue; these are intersection counts,
not invented constituents. A public master cache was staged in root data/ so the
small simulated universe can use matching index metadata too. Authenticated price
streaming is still NOT live-account-tested: no user token was available. Evidence:
D:\Rust\checks\browser\verify-market-evolution.cjs, evolution-*.png and
D:\Rust\checks\provider-test. No default-account trades/settings were changed.

Grouped watchlist update: all 31 Rust tests, formatting and strict Clippy passed.
The new API regression checks metadata persistence after restart, account
isolation, atomic rollback for invalid groups/pins and legacy stock-removal
pruning. Frontend build passed; lint exited 0 with existing warnings. Isolated
Chrome verified no right-table trading buttons, hover and keyboard toolbars,
Buy/Sell drawers, provider depth, chart navigation, new/renamed/deleted groups,
moving stocks, pin sorting after reload, numbered watchlist creation/switching/
rename, durable stock removal and touch actions. Desktop Day/Night and mobile
screenshots were inspected; there were no page errors or mobile page overflow.
Evidence: D:\Rust\checks\browser\verify-watchlists.cjs and watchlists-*.png.
The normal launcher was restarted with the updated backend and existing database.

Dashboard/shell refresh: build passed and lint exited 0 with existing warnings.
Isolated Chrome checks covered empty/populated account summaries, history,
holdings/positions tabs, exactly two theme choices, Day/Night persistence after
reload, searchable market stocks, drawer placement under the new 56px header,
and all ten main routes at 1440px and 390px with no horizontal page overflow or
page errors. Mobile navigation worked. Day/Night screenshots were inspected.
The Quick/Regular order suite passed again, including server fills, pending
orders, stop triggers, validation, retry/error state and mobile ticket bounds.
Evidence: D:\Rust\checks\browser\verify-minimal.cjs, verify-ticket.cjs and
minimal-*.png. These checks used a separate account database; no default-user
data or engine/accounting code was changed. Theme normalization retains
compatibility with server-stored legacy palette names.

Minimal drawer revision: production build passed and lint exited 0 (existing
warnings remain). The previous Quick/Regular browser suite passed again.
Additional isolated Chrome checks verified right-edge/bottom alignment below the
header, no top stripe/shadow, solid green/red buttons, Settings-based Light mode,
white panel/input surfaces, white candlestick canvas pixels, live chart theme
switching, mobile drawer bounds and a dashboard line chart with account history.
Dark/light desktop and light mobile screenshots were inspected. No page errors.
Evidence is in D:\Rust\checks\browser\verify-drawer.cjs and drawer-*.png.

Quick/Regular ticket update: production build passed, lint exited 0 with existing
warnings, and all 30 Rust tests passed. Headless Chrome against a separate SQLite
database and ports 18000/15173 verified Quick limit cash reservation, market
buy/sell, Regular MIS short/cover, SL direction validation and pending SL/SL-M,
tick/integer validation, inactive fields omitted, same-symbol reopen reset, and
network failure without a local fill. Desktop and 390px mobile screenshots were
inspected; the ticket sits above navigation and its fields fit the viewport.
Escape dismissal and mobile hit testing passed. Test scripts/screenshots/database
are outside the repository under D:\Rust\checks\browser, not the user's account.
The existing Rust order API/core required no changes for these ticket modes.

The preserved financial/auth tests cover account isolation, concurrent spending,
SQLite rollback injection, restart recovery, idempotent order placement, pending
cash/ledger reconciliation, stop activation, GTT/OCO, alerts, SIP recurrence,
provider response normalization, funding-adjusted P&L, and changing first-user
credentials without re-seeding or losing the account.

Headless browser checks before the layout-only move covered CNC buy/sell, MIS
short/exit, pending reservation/cancellation, persisted reload, account pages,
network interruption without local mutation, lost-response retry without duplicate
fills, and username/password edits with session rotation and a new login. Those
checks used separate test data, not changes to the default user's credentials.
Historical run notes were preserved outside the repository in
D:\CONE-archive\before-layout-verification.md.

## Not established

Live Upstox account connectivity (no token supplied), thousand-user throughput,
multi-instance scheduler ownership, exchange holidays, full taxes/settlement,
maintenance-margin liquidation, authenticated provider WebSocket behavior under
real account credentials and downloaded broker historical candles. The V3 adapter
is implemented and fixture-tested; its live-account QA is pending. Read the
architecture/API guides for current boundaries.

Search/menu refinement: production build and lint passed (existing warnings). Headless Chrome verified search leaves group bounds unchanged, absolute scrollable results, Escape dismissal, three-dot menu before rename, immediate pointer transfer after a clicked row action, and no page errors. Check script: D:\Rust\checks\browser\verify-search-overlay.cjs. No account or trading data changed.

Market interaction update: build and lint passed (existing lint warnings). Headless Chrome verified maximize/restore, Chart action staying on /market with a rendered chart, drag insertion spacing and cleanup, hover transfer, search overlay, and mobile width. Drag preview checks used synthetic drag events; real cross-watchlist persistence retains the previously verified endpoint. No account trades or watchlists were modified by these checks. Script: D:\Rust\checks\browser\verify-market-interactions.cjs.

Inline chart/panel preferences update: all 34 backend/core/persistence tests and
strict Clippy passed; frontend build and lint passed (existing lint warnings).
Headless Chrome checked default chart selection, watchlist and screener stock
clicks staying on /market, volume/depth, Appearance visibility persistence through
the real settings API, disabled screener tabs, and mobile width. Original account
visibility preferences were restored after the check. No trades were placed.
Script: D:\Rust\checks\browser\verify-inline-chart.cjs.

Upstox account smoke check (2026-10-30, after market hours): the locally saved
Analytics Token authenticated through the existing V3 provider adapter. Provider
reported connected, catalogue ready (23,047 instruments), with six subscribed
quotes carrying Upstox provenance, OHLC, volume and five bid/ask levels. Browser
Market chart displayed stats/depth with no page errors or failed API responses.
Three-second sampling showed no quote changes after hours. This validates auth,
initial snapshot decoding and UI integration, not active-session tick throughput
or a load benchmark. No orders or account changes were made. Existing shared
connection, deduplicated interests, differential subscriptions and 2,000 full-mode
cap were retained; no broad catalogue quote subscription was enabled. Secrets
were not included in scripts or this record. Browser check script:
D:\Rust\checks\browser\verify-upstox-live.cjs.

Historical chart update: all 35 Rust tests passed, including candle validation;
strict Clippy and frontend build/lint passed (existing warnings). A real Upstox
INFY request returned 400 one-minute candles; an identical request used the saved
cache. Browser checks found the settings search/Customization toggles, confirmed
the screener hidden and a chart canvas/history response, and catalogue search.
No page errors occurred. Later live-stream reconnect failed: the saved provider
token was rejected as invalid (UDAPI100050); depth returned 404 without fresh
quotes. Cached charts remain available; moving ticks/volume need market-session
verification with a valid token. Main account screener was hidden as requested.

1Y/warning fix: frontend build and lint passed (existing warnings). Headless Chrome verified the rejected-token warning and that 1Y sends a daily-history request without the simulator toast. Actual uncached history success remains blocked by the currently rejected Upstox token. Script: D:\Rust\checks\browser\verify-year-warning.cjs.

Live refresh behavior: all 35 Rust tests, strict Clippy and frontend build passed. Browser check verified the refresh interval is disabled under Upstox, manual refresh opens a new browser WebSocket and reloads chart data, with no page errors. Incoming Upstox frames now broadcast immediately; market-session latency/throughput remains unbenchmarked. Script: D:\Rust\checks\browser\verify-refresh-mode.cjs.

Chart interval viewport: build/lint passed with existing warnings. Browser checks using real Upstox candle responses verified consistent horizontal candle spacing and roughly 106–108 visible bars across 1m/5m/15m, rather than squeezing all 400 bars into the view. Panning before switching intervals retained the right-edge time anchor within interval rounding. No page errors; screenshot visually reviewed. Script: D:\Rust\checks\browser\verify-chart-spacing.cjs.

Calendar-month/history verification (2026-10-30): all 36 Rust tests, strict Clippy
and frontend build passed; lint retains existing warnings. A real authenticated
RELIANCE daily request produced 248 candles for 2025-10-30 through 2026-10-30,
exported to ignored data/research/RELIANCE-daily-2025-10-30-to-2026-10-30.csv
and .json. Monthly aggregation returned 50 available calendar-month candles
ending 2026-10-01, with no future bars. Unit coverage checks calendar boundaries,
aggregated OHLCV and rejection of a future fixture. Browser checks verified the
month request, Oct 1 midnight IST labels, 1Y range and no page errors; year-view
screenshot visually reviewed. Script: D:\Rust\checks\browser\verify-month-year.cjs.

Year candle correction: all 37 Rust tests, strict Clippy and frontend build passed. Real RELIANCE year request returned 11 available calendar-year candles (2016–2026); boundary years are partial. Browser checks verified unique year-only crosshair labels, January 1 IST candle timestamps, and monthly labels after changing intervals. Script: D:\Rust\checks\browser\verify-year-candles.cjs. No account trades or preferences changed.

Live/Replay mode separation (2026-10-30): 40 Rust tests and strict Clippy passed.
New checks cover archive restart with two-day gaps, initial/stale/duplicate feed
rejection, replay future-bar hiding, virtual-clock fills, unchanged Live balances
and resumed-but-paused Replay state. A separate test DB/token configuration loaded
a real RELIANCE session for 2026-10-29 (375 minute events), stepped one candle,
placed a practice order and returned to Live with its original wallet/orders and
empty Live chart. Browser tests exercised date/instrument search/load, watchlist
chart, minute stepping, 5m aggregation, play/pause and mobile layout with no page
errors. Main installation was restored to Live; account-snapshot hash unchanged.
Old candle-cache/ and research exports were moved outside the active project to
D:\CONE-archive\pre-live-history-20261030 (not imported into the Live archive).
The standalone browser demo and mock fallback files were removed. Active-session
Live latency/volume and long-run storage remain unbenchmarked. The 1m API cannot
reconstruct genuine intraminute tick paths; Replay deliberately reveals minute
OHLC at the minute close and provides no fabricated depth.
Scripts: verify-mode-api.cjs, verify-mode-ui.cjs under D:\Rust\checks\browser.

Final deployment check: the main account-snapshot fingerprint remained unchanged.
Live initially returned no candles/quotes after hours as required. The user then
loaded their own 2026-10-27 Replay session in the main application; that selection
was preserved. Isolated test-server credentials were cleared using the settings
API, and test servers stopped. Normal app remains on 8000/5173. Local Markdown
links verified across 12 documents. Frontend build passed; lint has pre-existing
Fast Refresh/unused-import warnings.

Named replay workspaces (2026-10-30): all 44 Rust tests, formatting, strict Clippy
and frontend production build passed. Lint exits successfully with existing
warnings. New financial tests cover workspace isolation, retained results,
legacy migration, empty read-only replay before workspace selection, and atomic rollback of a pending fill together with its cursor.
Real Upstox tests in a separate database loaded a two-day RELIANCE range (750
minute events) and a 32-day range (8,250 events), verified practice trades remain
isolated, ended results remain available, and extension to 1,125 events preserves
cursor/holdings and reopens correctly after selecting another workspace.
Bot-provider selection is rejected. Browser tests covered named creation,
weekend-gap skipping, workspace watchlists, minute stepping, results, rename and
extension, editing unused ranges, explicit deletion, Replay badge and 390px mobile
layout, with no page errors. Desktop/mobile screenshots were reviewed.
Scripts: D:\Rust\checks\browser\verify-workspace-api.cjs and
verify-workspace-ui.cjs. These used only an isolated test account/database.

The main app was restarted through its launcher. Its existing 2026-10-27 replay
migrated at cursor 80/375, paused. Exact account-snapshot fingerprints confirmed
both the normal Live book and migrated replay book remained unchanged. No main
account trades, settings, watchlists or balances were reset. Old single-session
files remain migration references only. Test-server broker credentials were
cleared after checks. Runtime remains on the normal 8000/5173 ports.
