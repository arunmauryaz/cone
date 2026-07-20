<div align="center">

<img src="cone/public/cone-logo.svg" width="80" alt="CONE Logo"/>

# CONE — Paper Trading Platform

**Trade Real Markets. Risk Nothing.**

[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-purple?style=flat-square)]()

CONE is a **full-featured paper trading application** built for the Indian stock market. It lets you practice trading with real market simulations using **virtual CONE Coins** — zero real money, zero risk, 100% real experience.

[🚀 Quick Start](#-quick-start) · [✨ Features](#-features) · [🏗 Architecture](#-architecture) · [📁 Project Structure](#-project-structure) · [🔌 API Integration](#-api-integration)

---

![CONE Dashboard Preview](https://via.placeholder.com/1200x600/0a0a0f/8b5cf6?text=CONE+Dashboard+Preview)

</div>

---

## 📖 Table of Contents

- [What is CONE?](#-what-is-cone)
- [Quick Start](#-quick-start)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Pages & Components](#-pages--components)
- [State Management](#-state-management)
- [API Integration](#-api-integration)
- [Design System](#-design-system)
- [Data Flow](#-data-flow)
- [How Orders Work](#-how-orders-work)
- [Configuration](#-configuration)
- [Contributing](#-contributing)

---

## 🎯 What is CONE?

CONE is a **paper trading simulator** — a practice trading application where:

- Everything looks and works **exactly like a real trading terminal** (Zerodha/Upstox style)
- You trade with **CONE Coins** (virtual currency), starting with **C 1,00,000**
- Prices are **real-time simulated** using a random-walk mock feed that mimics actual market behavior
- Optionally connect your **Upstox API** for real live market data
- **No real money** is ever involved — perfect for learning and strategy testing

### Who is it for?
- 📚 **Students** learning how stock markets work
- 🧪 **Traders** testing new strategies without financial risk
- 💡 **Developers** building on top of a reference trading UI
- 🎓 **Anyone** curious about the Indian stock market

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

### Option 1 — One-Click (Windows)
```
Double-click START_CONE.bat
```
That's it. It installs dependencies on first run, starts the server, and opens your browser automatically.

### Option 2 — Manual
```bash
# Clone the repository
git clone https://github.com/yourusername/cone.git
cd cone

# Install dependencies
cd cone
npm install

# Start the development server
npm run dev
```

Open **http://localhost:5173** in your browser.

### First Time Setup
1. Visit `http://localhost:5173` → you'll be redirected to `/register`
2. Create an account (username + password, stored locally in your browser)
3. You start with **C 1,00,000 CONE Coins**
4. Go to **Market** → search for any stock → click **B** to buy
5. Track your portfolio on the **Dashboard**

> ⚠️ All data is stored in your **browser's localStorage**. Clearing browser data will reset the app.

---

## ✨ Features

### 🏠 Dashboard
- **Greeting banner** with time-aware message (Good morning/afternoon/evening)
- **4 metric cards**: Total Portfolio Value, Available Balance, Today's P&L, Overall P&L
- **Portfolio equity chart** with period filters (1D / 1W / 1M / 3M / ALL)
- **Market overview** panel: NIFTY 50, SENSEX, NIFTY BANK, INDIA VIX with live prices
- **Top 5 Holdings** summary table with live P&L
- **Top 5 Positions** summary table with live unrealized P&L
- **Recent Orders** feed (last 5 orders with status badges)

### 📈 Market
- **Watchlist panel** (left) with multi-list support
- **Real-time price feed** with green/red flash animation on price change
- **Hover actions** on each stock row: Buy (B), Sell (S), Chart icon, Remove
- **Stock search** with live dropdown results
- **Top Gainers** horizontal scroll card row
- **Top Losers** horizontal scroll card row
- **Most Active** ranked table with volume and change%
- **Pinned indices** at the bottom of watchlist

### 📊 Stock Detail (`/stock/:instrumentKey`)
- **Live price header** with current price, change amount & %
- **OHLCV stats** bar (Open, High, Low, Close, Volume, Sector)
- **Candlestick/Line/Area chart** with TradingView-style controls
  - Period: 1D, 1W, 1M, 3M, 1Y
  - Chart type toggle: Candlestick 📊, Line 📈, Area 🏔️
  - Volume histogram sub-pane
  - Live dashed price line
- **Market Depth** (bid/ask ladder) with proportional fill bars
- **Quick Order panel** (right side)
- Add to Watchlist ⭐ button

### 🛒 Orders
**5 sub-tabs:**

| Tab | Description |
|-----|-------------|
| **Orders** | Open orders + executed order history with CSV export |
| **GTT** | Good Till Triggered orders with trigger/limit prices |
| **SIP** | Systematic Investment Plans (daily/weekly/monthly) |
| **Alerts** | Price alerts (above/below triggers) |

- Cancel open orders inline
- Download all orders as **CSV**
- Status badges: OPEN / COMPLETE / REJECTED / CANCELLED

### 📉 Positions
- **Summary bar**: Open count, Unrealized P&L, Today's Realized P&L
- **Live P&L** updates every second as prices move
- **Inline Exit confirmation** popup (avoids accidental clicks)
- Add to position button (opens order modal pre-filled)
- **Today's closed trades** section below

### 💼 Holdings
- **Summary bar**: Total Invested, Current Value, Total P&L, Return %
- **Sortable table** — click any column header to sort
- Buy more / Sell actions on each row
- **Footer totals row**
- Shows Day Change % alongside Net Change %

### 💰 Funds
- **Equity Funds panel** with full margin breakdown:
  - Available Cash, Used Margin, Opening Balance, Today Payin/Payout
- **Add CONE Coins modal** with quick presets (+10K, +25K, +50K, +1L) and custom input
- **Paginated transaction history** (15 per page)
- Commodity Funds panel (placeholder for future)

### 🏦 Bids & IPO
- **IPO tab**: Cards with company info, price band, GMP %, lot size, rating — Apply modal
- **Auctions tab**: T-Bill and Bond auctions table with Bid button
- **Govt. Securities tab**: Static bond table with YTM

### 📊 Analytics
- **Equity curve chart** with period filter (1M / 3M / 6M / 1Y / ALL)
- **8 performance stats**: Total Trades, Win Rate, Avg Win, Avg Loss, Profit Factor, Max Drawdown, Best Day, Worst Day
- **P&L by Stock** horizontal bar chart (top 10 symbols)
- **Monthly P&L heatmap** — colored cells by profit/loss
- **Full trade log** table (all closed trades, up to 50 shown)

### 🏆 Leaderboard
- **Period filter**: Today / This Week / This Month / All Time
- **Ranked table** with 🥇🥈🥉 medals for top 3
- **"YOU" badge** on your row, highlighted with violet border
- **Fake traders** (20 AI-generated personalities) for competition
- **Achievements grid** — 7 achievement cards, locked/unlocked states

### ⚙️ Settings
**7-category sidebar navigation:**

| Category | What you can do |
|----------|----------------|
| **API Configuration** | Enter Upstox API Key, Secret, Access Token; Test Connection |
| **Account** | Edit display name, view account stats |
| **Appearance** | Toggle dark/light mode, enable/disable price flash animations |
| **Notifications** | Toggle: Order Execution, Price Alerts, MIS Squareoff warning, Daily Summary |
| **Portfolio Reset** | Type "RESET" to wipe all trades and start fresh with C 1,00,000 |
| **Data & Privacy** | Export portfolio as JSON, delete all browser data |
| **About** | Version info, legal disclaimer |

### 🔔 Notifications
- **Filter tabs**: All / Orders / Alerts / System / Achievements
- Color-coded icon per notification type
- **Unread indicator** (dot + count badge in TopBar)
- Mark all read / Clear all buttons

### 🔍 Command Palette
- Open with **Ctrl+K** or click search bar
- Search **stocks by symbol or company name**
- **Navigate to any page** by typing its name
- Live price shown next to each stock result
- Keyboard navigation (↑ ↓ Enter Escape)

---

## 🧰 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React 18 | UI components, hooks |
| **Build Tool** | Vite 8 | Dev server, bundling, HMR |
| **Routing** | React Router DOM v6 | SPA navigation, protected routes |
| **Charts** | Lightweight Charts (TradingView) | Candlestick, Line, Area charts |
| **Icons** | Lucide React | All iconography |
| **Toasts** | React Hot Toast | Order confirmations, alerts |
| **Date Formatting** | date-fns | Relative time, date display |
| **HTTP Client** | Axios | Upstox REST API calls |
| **WebSocket** | Native browser WebSocket | Upstox live feed |
| **Protobuf** | protobufjs | Upstox binary feed decoding |
| **Styling** | Vanilla CSS (custom design system) | All styles, glassmorphism |
| **State** | React Context + useReducer | Portfolio, Market, Auth, Settings |
| **Persistence** | Browser localStorage | All user data, portfolios |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React App Shell                      │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────┐ │
│  │SettingsContext│  │  AuthContext   │  │MarketContext │ │
│  │  (API keys,  │  │  (user login,  │  │ (live prices,│ │
│  │   theme)     │  │   profile)     │  │  watchlists) │ │
│  └──────────────┘  └────────────────┘  └─────────────┘ │
│                    ┌────────────────────────────────────┐│
│                    │       PortfolioContext              ││
│                    │  (orders, holdings, positions,     ││
│                    │   wallet, GTT, SIP, alerts)        ││
│                    └────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│                     API Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   mock.js    │  │  upstox.js   │  │ websocket.js  │ │
│  │(Random-walk  │  │(REST wrapper │  │(Live feed via │ │
│  │ price feed)  │  │ w/ fallback) │  │ WebSocket)    │ │
│  └──────────────┘  └──────────────┘  └───────────────┘ │
├─────────────────────────────────────────────────────────┤
│                   Persistence Layer                      │
│                  Browser localStorage                    │
│  users · portfolio · settings · watchlists · history    │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **localStorage as database** — No backend needed. All data lives in the browser.
2. **Mock-first, API-optional** — Works fully offline with simulated prices. Real API is opt-in.
3. **Context + useReducer** — PortfolioContext uses a Redux-style reducer for predictable state transitions on complex order logic.
4. **Lazy-loaded pages** — All 12 main pages are code-split for fast initial load.
5. **Glassmorphism CSS** — Pure CSS variables and `backdrop-filter` for the premium look — no UI library.

---

## 📁 Project Structure

```
CONE/
├── START_CONE.bat              ← One-click launcher (Windows)
├── CONE_README_PLAN.md         ← Original project blueprint
│
└── cone/                       ← Vite + React app root
    ├── index.html
    ├── vite.config.js
    ├── package.json
    │
    └── src/
        ├── main.jsx            ← React entry point
        ├── App.jsx             ← Context providers + all routes
        │
        ├── api/
        │   ├── mock.js         ← Random-walk price simulator
        │   ├── upstox.js       ← Upstox REST API wrapper
        │   └── websocket.js    ← Upstox WebSocket feed manager
        │
        ├── context/
        │   ├── SettingsContext.jsx   ← API config, theme, preferences
        │   ├── AuthContext.jsx       ← Register, login, logout, profile
        │   ├── MarketContext.jsx     ← Live prices Map, feed, search
        │   └── PortfolioContext.jsx  ← Orders, holdings, positions, wallet
        │
        ├── hooks/
        │   ├── useLivePrice.js      ← Subscribe to price for one instrument
        │   └── useOrderBook.js      ← Mock bid/ask depth for one instrument
        │
        ├── components/
        │   ├── common/
        │   │   ├── GlassCard.jsx        ← Base glassmorphism card
        │   │   ├── PriceChange.jsx      ← Price delta with flash animation
        │   │   ├── Badge.jsx            ← Status/type colored pills
        │   │   ├── Spinner.jsx          ← Loading spinner
        │   │   ├── EmptyState.jsx       ← Empty list placeholder
        │   │   ├── SearchBar.jsx        ← Styled search input
        │   │   └── CommandPalette.jsx   ← Ctrl+K global search modal
        │   │
        │   ├── layout/
        │   │   ├── Layout.jsx           ← App shell (wraps all protected pages)
        │   │   ├── MarketTicker.jsx     ← Scrolling top price ticker
        │   │   ├── Sidebar.jsx          ← Collapsible left navigation
        │   │   └── TopBar.jsx           ← Top bar with search, user menu
        │   │
        │   ├── charts/
        │   │   ├── LineChart.jsx        ← Area/line chart (portfolio history)
        │   │   └── CandlestickChart.jsx ← Full trading chart with controls
        │   │
        │   └── trading/
        │       ├── MarketDepth.jsx      ← Bid/Ask order book depth
        │       └── OrderModal.jsx       ← Global order placement panel
        │
        ├── pages/
        │   ├── Auth/
        │   │   ├── Login.jsx
        │   │   └── Register.jsx
        │   ├── Dashboard.jsx
        │   ├── Market.jsx
        │   ├── StockDetail.jsx
        │   ├── Orders.jsx
        │   ├── Positions.jsx
        │   ├── Holdings.jsx
        │   ├── Funds.jsx
        │   ├── Bids.jsx
        │   ├── Analytics.jsx
        │   ├── Leaderboard.jsx
        │   ├── Settings.jsx
        │   └── Notifications.jsx
        │
        ├── utils/
        │   ├── constants.js    ← 50 stocks, fake traders, achievements, config
        │   ├── formatting.js   ← Currency, date, percent formatters
        │   ├── calculations.js ← Margin, P&L, win rate, drawdown formulas
        │   └── storage.js      ← All localStorage read/write helpers
        │
        └── styles/
            ├── index.css       ← CSS variables, reset, base styles
            ├── animations.css  ← Keyframes (flash, marquee, blobs, shimmer)
            └── components.css  ← All reusable class definitions
```

---

## 🖥 Pages & Components

### Route Map

| URL | Page | Auth Required |
|-----|------|:---:|
| `/login` | Login | ❌ |
| `/register` | Register | ❌ |
| `/dashboard` | Dashboard | ✅ |
| `/market` | Market Explorer | ✅ |
| `/stock/:instrumentKey` | Stock Detail | ✅ |
| `/orders` | Orders (5 tabs) | ✅ |
| `/positions` | Open Positions | ✅ |
| `/holdings` | CNC Holdings | ✅ |
| `/funds` | Wallet & Transactions | ✅ |
| `/bids` | IPO / Auctions | ✅ |
| `/analytics` | Performance Analytics | ✅ |
| `/leaderboard` | Trader Rankings | ✅ |
| `/settings` | App Settings | ✅ |
| `/notifications` | Notifications | ✅ |

### Global Components (always visible)

| Component | Description |
|-----------|-------------|
| `MarketTicker` | Fixed 32px bar at very top, scrolling price ticker |
| `Sidebar` | 220px collapsible nav, 64px when collapsed |
| `TopBar` | 56px bar with page title, search, user menu |
| `OrderModal` | Slide-in 340px right panel, triggered globally |
| `CommandPalette` | Ctrl+K overlay for quick navigation |

---

## 🧠 State Management

CONE uses **4 React Contexts**, each handling a distinct domain:

### 1. `SettingsContext`
```js
{
  settings: { apiKey, apiSecret, accessToken, theme, notifications, ... },
  saveSettings(partialSettings),
  testConnection(),          // Tests Upstox API connectivity
  isApiConnected: boolean,
  connectionStatus: 'none' | 'connected' | 'error'
}
```

### 2. `AuthContext`
```js
{
  user: { username, fullName, createdAt },
  isLoggedIn: boolean,
  register(fullName, username, password),  // → { ok, error }
  login(username, password),               // → { ok, error }
  logout(),
  updateProfile({ fullName })
}
```

### 3. `MarketContext`
```js
{
  prices: Map<instrumentKey, { ltp, open, high, low, close, volume, change, changePercent }>,
  isConnected: boolean,
  marketStatus: 'OPEN' | 'CLOSED',
  instruments: Stock[],
  getPrice(instrumentKey),
  searchInstruments(query),
  getTopGainers(n),
  getTopLosers(n),
  getMostActive(n)
}
```

### 4. `PortfolioContext` (most complex — uses `useReducer`)
```js
{
  // State
  wallet: { balance, usedMargin, openingBalance, todayPayin, todayPayout, transactions[] },
  holdings: Holding[],           // CNC long-term holdings
  positions: Position[],         // MIS intraday positions
  orders: Order[],               // All orders history
  gttOrders: GTTOrder[],         // Good Till Triggered orders
  sips: SIP[],                   // Systematic Investment Plans
  alerts: Alert[],               // Price alerts
  watchlists: Watchlist[],
  notifications: Notification[],
  achievements: string[],        // unlocked achievement IDs

  // Computed
  totalPortfolioValue: number,
  unreadCount: number,

  // Order actions
  placeOrder({ instrumentKey, side, qty, orderType, product, price }),
  cancelOrder(orderId),
  modifyOrder(orderId, changes),
  exitPosition(positionId),

  // Financial
  addCoins(amount),
  resetPortfolio(),

  // Watchlist CRUD
  addToWatchlist(listIdx, instrumentKey),
  removeFromWatchlist(listIdx, instrumentKey),
  createWatchlist(name),
  deleteWatchlist(idx),

  // GTT / SIP / Alerts
  addGTT(params), removeGTT(id),
  addSIP(params), removeSIP(id), pauseSIP(id), resumeSIP(id),
  addAlert(params), removeAlert(id),

  // Notifications
  markRead(id), markAllRead(), clearNotifications(),

  // Order modal (global)
  orderModal: { visible, instrumentKey, side },
  openOrderModal({ instrumentKey, side }),
  closeOrderModal()
}
```

### Reducer Action Types
```
LOAD | SET_WALLET | SET_HOLDINGS | SET_POSITIONS | SET_ORDERS |
SET_GTT | SET_SIP | SET_ALERTS | SET_WATCHLISTS | SET_NOTIFICATIONS |
SET_ACHIEVEMENTS | RESET
```

---

## 🔌 API Integration

### Default Mode: Mock Feed
Out of the box, CONE runs on a **simulated price feed** (`src/api/mock.js`):

- Each stock has a `basePrice` defined in `constants.js`
- Every second, a **random walk** algorithm updates each price:
  ```
  newPrice = prevPrice × (1 + randomFactor × volatility)
  ```
- Volatility varies by sector (e.g., IT stocks are more volatile than FMCG)
- Prices are clamped to ±20% from base to prevent runaway simulation
- Volume is also randomized per tick

### Real Data: Upstox API
To get **live NSE/BSE data**, connect your Upstox account:

1. Go to **Settings → API Configuration**
2. Enter your **API Key**, **API Secret**, and **Access Token**
3. Click **Test Connection**

Once connected:
- `src/api/upstox.js` handles REST calls (historical candles, market depth)
- `src/api/websocket.js` connects to Upstox WebSocket for live tick data
- Protobuf decoding is handled via `protobufjs` for the binary wire format

```js
// How to get Upstox credentials:
// 1. Create app at https://developer.upstox.com
// 2. Generate OAuth2 access token
// 3. Paste into CONE Settings → API Configuration
```

> **Note**: Upstox API has CORS restrictions for browser use. You may need a CORS proxy or use their official SDK in a Node.js backend for full WebSocket support.

### API Module Reference

| File | Purpose | Key Exports |
|------|---------|-------------|
| `api/mock.js` | Simulated price feed | `startMockFeed(callback, intervalMs)`, `getMockHistoricalCandles(key, interval, count)`, `getMockDepth(key)` |
| `api/upstox.js` | REST API wrapper | `fetchHistoricalCandles(key, interval, fromDate, toDate)`, `fetchMarketDepth(key)`, `fetchProfile()` |
| `api/websocket.js` | WebSocket manager | `UpstoxWebSocket` class with `connect()`, `subscribe(keys[])`, `onMessage(callback)`, `disconnect()` |

---

## 🎨 Design System

CONE uses a **pure CSS design system** with no UI framework dependency.

### CSS Variables (Dark Theme)
```css
/* Colors */
--bg-primary:       #0a0a0f    /* Page background */
--bg-secondary:     #0f0f1a    /* Slightly lighter bg */
--bg-card:          rgba(255,255,255,0.04)   /* Glass card bg */
--bg-glass:         rgba(255,255,255,0.06)   /* Glass bg */
--border-glass:     rgba(255,255,255,0.08)   /* Glass borders */
--text-primary:     #f0f0f8    /* Main text */
--text-secondary:   #b0b0c8    /* Secondary text */
--text-muted:       #6b6b8a    /* Muted/label text */
--accent-primary:   #8b5cf6    /* Violet — brand color */
--accent-secondary: #06b6d4    /* Cyan — secondary accent */
--color-buy:        #10b981    /* Green — buy/profit */
--color-sell:       #ef4444    /* Red — sell/loss */
--color-neutral:    #f59e0b    /* Amber — neutral */

/* Spacing */
--space-xs: 4px  --space-sm: 8px  --space-md: 16px
--space-lg: 24px --space-xl: 32px --space-2xl: 48px

/* Layout */
--sidebar-width:     220px
--sidebar-collapsed: 64px
--topbar-height:     56px
--ticker-height:     32px
--order-panel-width: 340px
```

### Reusable CSS Classes

| Class | Description |
|-------|-------------|
| `.glass-card` | Glassmorphism container with backdrop blur |
| `.glass-card.gradient` | Card with subtle violet→cyan gradient border |
| `.glass-card.glow` | Card with violet box-shadow glow |
| `.glass-card.hoverable` | Card with hover lift + border highlight |
| `.btn` | Base button styles |
| `.btn-primary` | Violet gradient button |
| `.btn-buy` | Green buy button |
| `.btn-sell` | Red sell button |
| `.btn-ghost` | Transparent outline button |
| `.btn-icon` | Square icon-only button |
| `.btn-sm / .btn-lg / .btn-full` | Size modifiers |
| `.input` | Styled text input |
| `.select` | Styled dropdown |
| `.data-table` | Full-width styled table |
| `.tab-bar / .tab-item` | Horizontal tab navigation |
| `.pill-group / .pill` | Rounded toggle button group |
| `.toggle-switch` | iOS-style toggle |
| `.stepper / .stepper-btn` | Qty increment/decrement control |
| `.overlay-backdrop` | Full-screen modal backdrop |
| `.alert-info/warning/danger/success` | Colored alert boxes |
| `.flash-up / .flash-down` | Green/red price flash animation |
| `.skeleton` | Shimmer loading placeholder |
| `.page-enter` | Fade-in-up page transition |
| `.modal-enter` | Scale-in modal animation |
| `.slide-in-right` | Slide from right (order panel) |
| `.ticker-track` | Infinite horizontal scroll |
| `.pulse` | Pulsing dot (market status) |
| `.blob-1 / .blob-2` | Animated gradient background blobs |
| `.fade-in` | Simple opacity fade |

### Typography
- **Primary text**: `Inter` (Google Fonts)
- **Numbers / Prices**: `Space Grotesk` (monospace-style, all prices)
- **Headings**: `Space Grotesk`

---

## 🔄 Data Flow

### Price Update Cycle (every 1 second)
```
startMockFeed() in mock.js
    │
    ▼ every 1000ms
Random Walk Algorithm
    │
    ▼
MarketContext.setPrices(Map)
    │
    ├──▶ useLivePrice(key) hook  ──▶  Any component showing a price
    │
    ├──▶ MarketTicker.jsx        ──▶  Top scrolling bar updates
    │
    └──▶ PortfolioContext        ──▶  P&L recalculated, alerts checked
```

### Order Execution Flow
```
User clicks "BUY" button
    │
    ▼
openOrderModal({ instrumentKey, side: 'BUY' })
    │
    ▼
OrderModal.jsx (340px right panel opens)
User fills: product, qty, orderType, price
    │
    ▼
handleSubmit() → validates:
  ✓ qty > 0
  ✓ wallet.balance >= required margin
  ✓ for SELL/CNC: holdings qty >= sell qty
    │
    ▼
Confirmation overlay shown
    │
    ▼
User confirms → placeOrder() in PortfolioContext
    │
    ├─ MARKET order ──▶ Execute immediately at current LTP
    │                    dispatch COMPLETE order
    │                    update wallet (debit margin)
    │                    update holdings (CNC) or positions (MIS)
    │
    └─ LIMIT/SL order ─▶ dispatch OPEN order
                          GTT monitor checks every tick
                          when price crosses limit → auto-execute
    │
    ▼
toast.success("Order placed!")
appendPortfolioHistory() → chart updates
Achievement check → unlock if criteria met
```

---

## 💹 How Orders Work

### Product Types

| Product | Description | Behavior in CONE |
|---------|-------------|-----------------|
| **CNC** (Cash & Carry) | Delivery-based, no leverage | Buys added to Holdings, held until manually sold |
| **MIS** (Margin Intraday Square-off) | Intraday with 5× leverage | Added to Positions, shown in Positions page |

### Order Types

| Type | Description |
|------|-------------|
| **MARKET** | Execute immediately at current LTP |
| **LIMIT** | Execute only when price reaches your limit |
| **SL** | Stop Loss with limit price (triggers at trigger, executes at limit) |
| **SL-M** | Stop Loss Market (triggers at trigger, executes at market) |

### Margin Calculation
```js
// For CNC:    required = qty × price (full amount)
// For MIS:    required = qty × price × 0.20 (5× leverage = 20% margin)
// Brokerage:  CNC = 0   |   MIS = min(20, qty × price × 0.0003)
```

### P&L Calculation
```js
// Unrealized P&L (open positions/holdings):
unrealizedPnL = (currentLTP - avgCost) × qty

// Realized P&L (on SELL):
realizedPnL = (sellPrice - avgCost) × soldQty - brokerage

// Portfolio Total Value:
totalValue = wallet.balance
           + Σ(holding.qty × currentLTP)
           + Σ(position.qty × currentLTP)  [for long positions]
```

---

## 📦 Utility Functions

### `utils/formatting.js`
| Function | Input | Output |
|----------|-------|--------|
| `formatCurrency(n, showSign)` | `1234567.5` | `"C 12,34,567.50"` |
| `formatPercent(n)` | `12.345` | `"+12.35%"` |
| `formatNumber(n)` | `1234567` | `"12,34,567"` |
| `fmtPrice(n)` | `3850.25` | `"3,850.25"` |
| `formatDate(iso)` | ISO string | `"20 Jul 2026"` |
| `formatDateTime(iso)` | ISO string | `"20 Jul, 09:30 AM"` |
| `formatLongDate()` | — | `"Sunday, 20 July 2026"` |
| `getGreeting()` | — | `"Good morning"` / `"afternoon"` / `"evening"` |
| `formatRelativeTime(ts)` | timestamp | `"2 minutes ago"` |

### `utils/calculations.js`
| Function | Description |
|----------|-------------|
| `calcRequiredMargin(price, qty, product)` | Returns margin needed for an order |
| `calcBrokerage(product, price, qty)` | Returns brokerage fee |
| `calcUnrealizedPnL(ltp, avgCost, qty)` | Returns open P&L |
| `calcPortfolioTotalValue(wallet, holdings, positions, prices)` | Total portfolio worth |
| `calcTodayPnL(orders, positions, prices)` | Today's realized + unrealized P&L |
| `calcWinRate(closedTrades[])` | Win % from trade history |
| `calcProfitFactor(closedTrades[])` | Gross profit / Gross loss |
| `calcMaxDrawdown(history[])` | Max % drop from peak |
| `isMarketOpen()` | `true` if Mon–Fri 09:15–15:30 IST |
| `generateId(prefix)` | Unique ID like `order_1721456789_abc123` |

---

## 🔧 Configuration

### `src/utils/constants.js`
Key constants you can customize:

```js
export const STARTING_BALANCE = 100000;   // Initial CONE Coins (C 1,00,000)
export const MAX_BALANCE      = 1000000;  // Max you can add (C 10,00,000)
export const APP_VERSION      = '1.0.0';

// 50 pre-defined stocks (add more here):
export const MOCK_STOCKS = [
  { instrumentKey: 'NSE_EQ|TCS', tradingsymbol: 'TCS', basePrice: 3850, sector: 'IT', ... },
  // ... 49 more stocks
];

// Default watchlist items shown on first login:
export const DEFAULT_WATCHLIST_STOCKS = [
  'NSE_EQ|RELIANCE', 'NSE_EQ|TCS', 'NSE_EQ|HDFC', ...
];
```

### Adding New Stocks
Add an entry to `MOCK_STOCKS` in `constants.js`:
```js
{
  instrumentKey: 'NSE_EQ|YOURSTOCK',   // Must be unique
  tradingsymbol: 'YOURSTOCK',
  name: 'Your Company Ltd.',
  exchange: 'NSE',
  segment: 'NSE_EQ',
  lotSize: 1,
  tickSize: 0.05,
  basePrice: 500,                       // Starting simulation price
  sector: 'IT'                          // For sector coloring
}
```

### Vite Config
```js
// vite.config.js
export default {
  plugins: [react()],
  server: { port: 5173, open: false }
}
```

---

## 📊 localStorage Schema

All data is namespaced under `cone_` prefix:

| Key | Description |
|-----|-------------|
| `cone_users` | Array of all registered user objects |
| `cone_current_user` | Currently logged-in username |
| `cone_portfolio_{username}` | Wallet, holdings, positions, orders, GTT, SIP, alerts |
| `cone_settings_{username}` | API keys, theme, notification preferences |
| `cone_watchlists_{username}` | Array of watchlist objects with stock arrays |
| `cone_portfolio_history_{username}` | Array of `{ timestamp, totalValue }` for chart |
| `cone_notifications_{username}` | Notification feed array |
| `cone_achievements_{username}` | Array of unlocked achievement IDs |
| `cone_sidebar_collapsed` | Boolean — sidebar collapse state |
| `cone_instruments_cache` | Cached Upstox instrument list |

---

## 🏅 Achievements System

7 achievements track your trading milestones:

| Achievement | Criteria |
|-------------|---------|
| 🚀 **First Trade** | Place your first order |
| 💎 **Diamond Hands** | Hold a position for 7+ days |
| 🎯 **Sharp Shooter** | Achieve 70%+ win rate (min 10 trades) |
| 📈 **Bull Run** | Portfolio up 20%+ from start |
| 🔥 **Hot Streak** | 5 winning trades in a row |
| 🏦 **Big Spender** | Single trade value > C 50,000 |
| ⚡ **Speed Trader** | Place 10 trades in one day |

---

## 🐛 Known Limitations

1. **No real-time WebSocket in browser** — Upstox WebSocket requires server-side proxy due to CORS; mock feed is the default
2. **localStorage only** — Data is per-browser, not synced across devices
3. **No Options/F&O** — Only equities are supported in this version
4. **Simulated prices** — Mock prices don't perfectly replicate real market microstructure
5. **IPO applications are simulated** — No real allotment logic

---

## 🛠 Development Scripts

```bash
cd cone

npm run dev      # Start dev server at http://localhost:5173
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

**CONE is for educational and entertainment purposes only.**
It is not a real trading platform. No real financial transactions occur.
Past performance in paper trading does not guarantee real-world trading results.

---

## 🙏 Acknowledgements

- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) — charting library
- [Lucide React](https://lucide.dev) — icons
- [Upstox Developer API](https://developer.upstox.com) — market data provider
- Inspired by [Zerodha Kite](https://kite.zerodha.com) and [Upstox Pro](https://upstox.com) UI/UX

---

<div align="center">

Built with ❤️ using React + Vite

**CONE — Trade Real Markets. Risk Nothing.**

</div>
