# CONE web interface

React 19 + Vite, JavaScript/JSX, existing CSS tokens and lightweight-charts.
The Rust backend owns connected accounts, trading and persistence. Node.js is
only the frontend toolchain; no Node.js trading server is required.

## Development

Open D:\CONE\launcher.bat shell, run the Rust backend in one terminal, and in another:

```powershell
cd D:\CONE\frontend
npm ci
npm run dev
```

Or use D:\CONE\launcher.bat. Register a fresh account. Old accounts in browser
storage and the archived Python SQLite database are not automatically imported.

Default API: http://localhost:8000; default WebSocket: ws://localhost:8000/ws/market.
Override VITE_API_URL and VITE_WS_URL when building for another host. Never store
broker secrets in Vite variables; they are public browser configuration.

## Connected mode

AuthContext uses server sessions and validates /auth/me on reload. It stores the
session token/profile, not passwords. Invalid credentials do not create an
account. PortfolioContext sends mutations to Rust and refreshes its state from
/portfolio/state. Unknown-order-response retries reuse the request ID. Financial
state is not computed or persisted as local authority. Market charts/depth use the
backend's provider; real mode does not substitute mock history or depth.

Account snapshots poll at 1.5-second intervals. Server WebSockets supply price
snapshots. Refresh preferences throttle displayed price updates without changing
the shared market clock. Browser failure does not pause server orders/schedules.

Disconnected data stays unavailable;
these are labeled and do not execute server-account trades locally. Real-mode
prices remain stale/unavailable instead. The status line makes the source visible.

## Buy and sell ticket

The global ticket opens in Quick mode with an editable quantity and tick-aligned
limit price seeded from the latest displayed quote. Editing prices is deliberate:
subsequent ticks never overwrite an entered price. Intraday switches CNC to MIS;
Market price switches LIMIT to MARKET. Quick defaults to long-term (CNC).

The ticket is a flat right-side drawer, flush with the right/bottom edges below
the header. It enters horizontally and respects reduced-motion
preferences; mobile uses the same drawer at full width. No dimmed backdrop,
colored top stripe, floating-card shadow or explanatory paragraphs are used.
The footer stays at the bottom and fields scroll on short screens. Trade actions
use solid green/red buttons with white text; selection also has aria-pressed.

Regular shares the quantity, price, side and product with Quick and adds explicit
Intraday (MIS)/Long-term (CNC) and Market, Limit, Stop-loss limit (SL), and
Stop-loss market (SL-M) controls. Only stop orders show the trigger field.
Switching a stop order to Quick selects LIMIT and omits the trigger from the
request. Closing and reopening the ticket resets it, even for the same stock.

Both modes use the same review and authenticated order endpoint. Decimal prices
are sent as strings; inactive price/trigger fields are omitted. Validation covers
integer quantity, lot/tick size, stop-limit direction and unreserved CNC holdings.
Cash and fee estimates are advisory; the Rust host and engine decide funding,
including risk-reducing MIS exits. Unknown-response retries retain the context's
existing idempotency behavior. Escape, focus containment, mobile layout and
disabled controls during submission are supported.

Stop-loss here is a separate conditional order, not an attached stop/target pair.
No MTF, Iceberg or attached bracket controls are advertised. GTT remains supported
by the backend and existing Orders view, but is not a basic ticket mode.

Settings > Appearance offers Night (pitch-black), Charcoal (charcoal-dark) and Day
(light). The header also toggles them. Legacy saved dark palettes normalize to
Night on load; the backend still accepts legacy names for client compatibility.
New choices persist through the existing settings API. Day mode uses
white page, card and input surfaces, neutral borders and readable muted text.
Notifications and navigation branding use theme tokens. Chart canvas options resolve CSS
colors through chartTheme.js and observe theme changes without reloading market
data or recreating series.

## Navigation, dashboard and market

The shared shell uses a 180px collapsible sidebar, a 56px header, and responsive
mobile navigation. The scrolling ticker and duplicate market-status banners were
removed. A compact header label identifies Live/Replay paper trading; actual
connection failures still show a warning. Search, notifications, account settings
and logout remain accessible. Day/Night changes also update canvas chart colors.

Dashboard shows portfolio value, available cash, today's P&L and total P&L from
the account snapshot, followed by one equity chart and Orders/Holdings/Positions
tabs. It does not fabricate history, instrument recommendations, or balances.
Unavailable totals display an em dash. History points are deduplicated per second
before charting. Holdings/positions link to their stocks; full records stay in
their dedicated pages. Funding-adjusted P&L still comes from the server.

Market uses one searchable equity table plus the user's saved watchlists,
replacing repeated movers cards and extra index panels. The right-hand table has
no trading buttons. Star buttons add/remove stocks in the selected left-hand list and group. The
left search also adds directly into the selected group.

Watchlist stock actions appear on hover or keyboard focus: Buy, Sell, inline
five-level market depth, chart, removal and More. More pins/unpins the stock or
moves it between groups. Touch devices show actions persistently. Hover reveals
replace row prices with the toolbar without changing row height. Chart opens
the stock page; depth comes from the shared provider through the existing hook.

Each list has collapsible named groups and an implicit Default group. New group,
rename and remove-group flows persist through the backend; removing a group
returns stocks to Default. Pinned stocks sort first within their group. Numbered
bottom tabs switch lists; the plus creates another list and the trailing menu
opens the selected list’s options menu, including Rename. Limits are 10 lists, 100 stocks/list and 20 groups/list.
Group selection/collapse state is transient; list/group membership, order and pins are
saved server-side and survive reload/restart. Mutations are serialized through
the current account snapshot so queued UI actions use refreshed metadata.
Settings navigation, theme choice and price-refresh controls are simplified;
account/profile edits, notifications, exports and guarded resets remain.

## Market views, dragging and data setup

The Stock screener view selector offers All stocks, Nifty 50/100/500, Indices
and every saved watchlist by number and name. Selecting a screener watchlist is
independent of the active left-hand watchlist tab.
Desktop Market occupies the space below the 56px app header. The watchlist is a
docked left pane, flush with the shell, with its own group scroll area and bottom
tabs. Each group has a separate border and spacing. The right Stock screener has
a bounded scrolling table, sticky column headings and a bottom pagination bar;
scrolling the table does not move the watchlist or the document. At narrow widths
the panes stack with their own bounded content areas. There are no advanced
filter buttons, column pickers or export controls. Search and the view selector
remain, along with the existing optional live-table quote toggle.

There is no Default screener filter; Default remains the ungrouped watchlist
section. Views are paginated (50 rows) and the table's live-quote checkbox is off
initially. Enabling it registers only the displayed page as temporary provider
interest. Cataloguing/searching a stock does not subscribe to its price.
Nifty filters match official constituent metadata against the available universe;
missing metadata is explicit.

Search focus opens up to 100 catalogue matches immediately; typing searches all
available cash/index metadata. Group Add item buttons focus the search and select
that destination. An empty workspace has an Add a stock action. Drag handles move
stocks within or across groups. Group headers reorder sections, including Default.
Dropping a stock/group on a numbered bottom tab moves it to that workspace in one
server transaction. Group/stock menus also expose move up/down and move-to-list
controls for keyboard/touch use. Pins retain sorting priority within each group.

Settings > Market Data selects Upstox Live or Replay and accepts
an access/Analytics token. It is sent once to the local backend, cleared from the
input, and never placed in localStorage. Status refresh shows configuration and
catalogue readiness. Source changes clear displayed prices and reload the master;
WebSocket catalogueVersion notices further changes. No fresh browser invents a
source during an outage: no browser mock-price fallback is enabled. Live charts never generate random volume.
Stock detail and the order ticket request temporary quote interest while open.

## Data modes

The UI always uses server accounts and server market data. Standalone browser
Demo mode and browser fake-price/history/depth fallbacks have been removed.
Settings > Market Data offers Upstox API with Live or the
saved Replay workspaces. See [market modes](market-modes.md) for complete behavior.

## Checks

```powershell
npm run build
npm run lint
```

Browser verification covered registration, CNC buy/sell, reload persistence, MIS
short/exit, pending reservation/cancellation, account pages and network failure
without local trade creation. Unmounted IPO/fake leaderboard and browser-broker wrapper files were moved
out of the working tree into D:\CONE-archive; they do not describe server behavior.

Stock search opens a scrollable overlay without moving groups or bottom tabs.
Outside click and Escape dismiss it. Watchlist three-dot controls open an options
menu before Rename. Stock/group Move to watchlist opens an in-panel destination
popup with Back. Hover actions switch immediately; visible keyboard focus also
exposes the toolbar without retaining clicked rows on pointer navigation.

Market includes Stock screener and Chart tabs. A watchlist Chart action opens the
selected chart in the right pane and registers temporary price interest; stock
names also select the inline chart. Open details opens the dedicated detail route. Group maximize temporarily isolates
one group; Restore or switching watchlists returns the full list. Native desktop
drag uses a group/row preview, animated insertion spacing and edge auto-scroll;
dropping above/below inserts accordingly. Existing menu moves remain available
for keyboard/touch. Reduced-motion preferences disable these transitions.

Watchlist stock names and row clicks open the inline Chart panel. Screener stock names open the full detail route. It opens by default with the first available stock in the active watchlist group order (pins first). Inline charts include OHLC, volume and depth; Open details remains the full-page route. Settings > Customization saves independent Stock screener and Chart panel visibility. Hidden screeners register no table interest, and chart interest is registered only while visible. Saved watchlist/order/position interests remain active. Stock menus use destination lists for groups and watchlists. If Chart is disabled, stock clicks open details.

Appearance also offers Charcoal (`charcoal-dark`): #181818 surfaces, #303030 borders, and #222222 raised/hover surfaces. This existing backend theme value persists per account. Canvas charts resolve the same theme tokens.

Settings search finds Customization using chart, panel or screener keywords.
The screener and chart visibility switches persist independently. Live Upstox
updates bypass display throttling; the old refresh-rate setting and bot source were removed.
Manual market refresh reconnects the browser stream and reloads local chart data.

Charts request up to 400 available bars from the active mode: locally recorded
Live bars or revealed Replay bars. They never request a Live historical backfill.
1m/5m/15m/1h/1D/1W/1M/1Y mean candle duration; month/year are calendar boundaries.
Spacing/zoom and panned time anchors are preserved for normal intervals. The year
view fits only the available years. All date labels use Asia/Kolkata. Missing
periods remain gaps; no future bars or synthetic flat bars are added in Live/Replay.

Replay session controls appear above Market charts: Play/Pause, Step 1 min and
speed. The selected session is loaded under Settings > Market Data. Session/source
changes remount the server account view and clear ticket/retry scope. Practice
balances, orders and watchlists are separate per workspace; appearance is shared. Historical depth is
explicitly unavailable. The source label distinguishes Live and Replay.


Settings > Replay workspaces manages named date ranges, create/open/results,
rename/edit/extend and confirmed deletion. A header History icon and Replay badge
make the active mode explicit. Completed/ended workspaces keep positions/results;
use Extend to continue. Unplayed/untraded ranges can be edited, while played
history can only be extended. Results are read without activating the workspace.
Closed-market gaps are skipped in playback. See [market modes](market-modes.md).
