/* ============================================================
   CONE — Constants & Static Data
   src/utils/constants.js
   ============================================================ */

export const STARTING_BALANCE = 100000;
export const MAX_BALANCE = 1000000;
export const APP_NAME = 'CONE';
export const APP_TAGLINE = 'Trade Real Markets. Risk Nothing.';
export const APP_VERSION = '1.0.0';

/* ============================================================
   MOCK STOCKS — 50 NSE instruments
   ============================================================ */
export const MOCK_STOCKS = [
  // Large Cap IT
  { instrumentKey: 'NSE_EQ|TCS',        tradingsymbol: 'TCS',        name: 'Tata Consultancy Services', exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 3850, sector: 'IT' },
  { instrumentKey: 'NSE_EQ|INFY',       tradingsymbol: 'INFY',       name: 'Infosys',                   exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 1560, sector: 'IT' },
  { instrumentKey: 'NSE_EQ|WIPRO',      tradingsymbol: 'WIPRO',      name: 'Wipro',                     exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 480,  sector: 'IT' },
  { instrumentKey: 'NSE_EQ|HCLTECH',    tradingsymbol: 'HCLTECH',    name: 'HCL Technologies',          exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 1730, sector: 'IT' },
  { instrumentKey: 'NSE_EQ|TECHM',      tradingsymbol: 'TECHM',      name: 'Tech Mahindra',             exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 1590, sector: 'IT' },
  // Large Cap Banking
  { instrumentKey: 'NSE_EQ|HDFC',       tradingsymbol: 'HDFCBANK',   name: 'HDFC Bank',                 exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 1680, sector: 'Banking' },
  { instrumentKey: 'NSE_EQ|ICICIBANK',  tradingsymbol: 'ICICIBANK',  name: 'ICICI Bank',                exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 1120, sector: 'Banking' },
  { instrumentKey: 'NSE_EQ|SBIN',       tradingsymbol: 'SBIN',       name: 'State Bank of India',       exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 825,  sector: 'Banking' },
  { instrumentKey: 'NSE_EQ|KOTAKBANK',  tradingsymbol: 'KOTAKBANK',  name: 'Kotak Mahindra Bank',       exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 1890, sector: 'Banking' },
  { instrumentKey: 'NSE_EQ|AXISBANK',   tradingsymbol: 'AXISBANK',   name: 'Axis Bank',                 exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 1150, sector: 'Banking' },
  { instrumentKey: 'NSE_EQ|PNB',        tradingsymbol: 'PNB',        name: 'Punjab National Bank',      exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 98,   sector: 'Banking' },
  // Energy & Infra
  { instrumentKey: 'NSE_EQ|RELIANCE',   tradingsymbol: 'RELIANCE',   name: 'Reliance Industries',       exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 2450, sector: 'Energy' },
  { instrumentKey: 'NSE_EQ|ONGC',       tradingsymbol: 'ONGC',       name: 'ONGC',                      exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 275,  sector: 'Energy' },
  { instrumentKey: 'NSE_EQ|GAIL',       tradingsymbol: 'GAIL',       name: 'GAIL India',                exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 195,  sector: 'Energy' },
  { instrumentKey: 'NSE_EQ|IOC',        tradingsymbol: 'IOC',        name: 'Indian Oil Corp',           exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 165,  sector: 'Energy' },
  { instrumentKey: 'NSE_EQ|LT',         tradingsymbol: 'LT',         name: 'Larsen & Toubro',           exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 3600, sector: 'Infra' },
  { instrumentKey: 'NSE_EQ|RVNL',       tradingsymbol: 'RVNL',       name: 'RVNL',                      exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 430,  sector: 'Infra' },
  // Power
  { instrumentKey: 'NSE_EQ|NTPC',       tradingsymbol: 'NTPC',       name: 'NTPC',                      exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 380,  sector: 'Power' },
  { instrumentKey: 'NSE_EQ|POWERGRID',  tradingsymbol: 'POWERGRID',  name: 'Power Grid Corp',           exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 320,  sector: 'Power' },
  { instrumentKey: 'NSE_EQ|NHPC',       tradingsymbol: 'NHPC',       name: 'NHPC',                      exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 92,   sector: 'Power' },
  // FMCG & Consumer
  { instrumentKey: 'NSE_EQ|NESTLEIND',  tradingsymbol: 'NESTLEIND',  name: 'Nestle India',              exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 2430, sector: 'FMCG' },
  { instrumentKey: 'NSE_EQ|ASIANPAINT', tradingsymbol: 'ASIANPAINT', name: 'Asian Paints',              exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 2890, sector: 'FMCG' },
  { instrumentKey: 'NSE_EQ|DABUR',      tradingsymbol: 'DABUR',      name: 'Dabur India',               exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 530,  sector: 'FMCG' },
  { instrumentKey: 'NSE_EQ|BRITANNIA',  tradingsymbol: 'BRITANNIA',  name: 'Britannia Industries',      exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 5100, sector: 'FMCG' },
  { instrumentKey: 'NSE_EQ|GODREJCP',   tradingsymbol: 'GODREJCP',   name: 'Godrej Consumer Products',  exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 1280, sector: 'FMCG' },
  // Auto
  { instrumentKey: 'NSE_EQ|MARUTI',     tradingsymbol: 'MARUTI',     name: 'Maruti Suzuki',             exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 12500,sector: 'Auto' },
  // Finance
  { instrumentKey: 'NSE_EQ|BAJFINANCE', tradingsymbol: 'BAJFINANCE', name: 'Bajaj Finance',             exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 7200, sector: 'Finance' },
  { instrumentKey: 'NSE_EQ|BAJAJFINSV', tradingsymbol: 'BAJAJFINSV', name: 'Bajaj Finserv',             exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 1680, sector: 'Finance' },
  { instrumentKey: 'NSE_EQ|MUTHOOTFIN', tradingsymbol: 'MUTHOOTFIN', name: 'Muthoot Finance',           exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 1950, sector: 'Finance' },
  { instrumentKey: 'NSE_EQ|IRFC',       tradingsymbol: 'IRFC',       name: 'IRFC',                      exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 175,  sector: 'Finance' },
  // Pharma
  { instrumentKey: 'NSE_EQ|SUNPHARMA',  tradingsymbol: 'SUNPHARMA',  name: 'Sun Pharmaceutical',        exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 1680, sector: 'Pharma' },
  { instrumentKey: 'NSE_EQ|DRREDDY',    tradingsymbol: 'DRREDDY',    name: "Dr Reddy's Labs",           exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 6400, sector: 'Pharma' },
  // Consumer/Retail
  { instrumentKey: 'NSE_EQ|TITAN',      tradingsymbol: 'TITAN',      name: 'Titan Company',             exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 3450, sector: 'Consumer' },
  { instrumentKey: 'NSE_EQ|ZOMATO',     tradingsymbol: 'ZOMATO',     name: 'Zomato',                    exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 245,  sector: 'Consumer' },
  { instrumentKey: 'NSE_EQ|VOLTAS',     tradingsymbol: 'VOLTAS',     name: 'Voltas',                    exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 1480, sector: 'Consumer' },
  { instrumentKey: 'NSE_EQ|PAGEIND',    tradingsymbol: 'PAGEIND',    name: 'Page Industries',           exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 42500,sector: 'Consumer' },
  // Healthcare
  { instrumentKey: 'NSE_EQ|APOLLOHOSP', tradingsymbol: 'APOLLOHOSP', name: 'Apollo Hospitals',          exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 6800, sector: 'Healthcare' },
  // Defence
  { instrumentKey: 'NSE_EQ|BEL',        tradingsymbol: 'BEL',        name: 'Bharat Electronics',        exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 295,  sector: 'Defence' },
  { instrumentKey: 'NSE_EQ|HAL',        tradingsymbol: 'HAL',        name: 'Hindustan Aeronautics',     exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 4800, sector: 'Defence' },
  // PSU
  { instrumentKey: 'NSE_EQ|BHEL',       tradingsymbol: 'BHEL',       name: 'BHEL',                      exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 285,  sector: 'PSU' },
  { instrumentKey: 'NSE_EQ|COALINDIA',  tradingsymbol: 'COALINDIA',  name: 'Coal India',                exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 465,  sector: 'Mining' },
  // Cement
  { instrumentKey: 'NSE_EQ|ULTRACEMCO', tradingsymbol: 'ULTRACEMCO', name: 'UltraTech Cement',          exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 10800,sector: 'Cement' },
  // Chemical
  { instrumentKey: 'NSE_EQ|PIDILITE',   tradingsymbol: 'PIDILITE',   name: 'Pidilite Industries',       exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 2980, sector: 'Chemical' },
  // Telecom
  { instrumentKey: 'NSE_EQ|TATACOMM',   tradingsymbol: 'TATACOMM',   name: 'Tata Communications',       exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 1920, sector: 'Telecom' },
  // Travel
  { instrumentKey: 'NSE_EQ|IRCTC',      tradingsymbol: 'IRCTC',      name: 'IRCTC',                     exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 825,  sector: 'Travel' },
  // Conglomerate / Ports
  { instrumentKey: 'NSE_EQ|ADANIENT',   tradingsymbol: 'ADANIENT',   name: 'Adani Enterprises',         exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 2650, sector: 'Conglomerate' },
  { instrumentKey: 'NSE_EQ|ADANIPORTS', tradingsymbol: 'ADANIPORTS', name: 'Adani Ports',               exchange: 'NSE', segment: 'NSE_EQ', lotSize: 1, tickSize: 0.05, basePrice: 1320, sector: 'Ports' },
  // Indices (for ticker/overview — not tradeable directly)
  { instrumentKey: 'NSE_INDEX|NIFTY50',   tradingsymbol: 'NIFTY 50',   name: 'Nifty 50',   exchange: 'NSE', segment: 'INDICES', lotSize: 50, tickSize: 0.05, basePrice: 24500, sector: 'Index' },
  { instrumentKey: 'NSE_INDEX|SENSEX',    tradingsymbol: 'SENSEX',     name: 'BSE Sensex', exchange: 'BSE', segment: 'INDICES', lotSize: 1,  tickSize: 0.05, basePrice: 80600, sector: 'Index' },
  { instrumentKey: 'NSE_INDEX|BANKNIFTY', tradingsymbol: 'NIFTY BANK', name: 'Bank Nifty', exchange: 'NSE', segment: 'INDICES', lotSize: 15, tickSize: 0.05, basePrice: 52800, sector: 'Index' },
  { instrumentKey: 'NSE_INDEX|INDIAVIX',  tradingsymbol: 'INDIA VIX',  name: 'India VIX',  exchange: 'NSE', segment: 'INDICES', lotSize: 1,  tickSize: 0.025, basePrice: 12.5, sector: 'Index' },
];

export const EQUITY_STOCKS = MOCK_STOCKS.filter(s => s.segment === 'NSE_EQ');
export const INDEX_STOCKS   = MOCK_STOCKS.filter(s => s.segment === 'INDICES');

/* ============================================================
   SECTOR COLORS
   ============================================================ */
export const SECTOR_COLORS = {
  IT:           '#6366f1',
  Banking:      '#3b82f6',
  Energy:       '#f97316',
  Infra:        '#84cc16',
  Power:        '#eab308',
  FMCG:         '#ec4899',
  Auto:         '#14b8a6',
  Finance:      '#8b5cf6',
  Pharma:       '#06b6d4',
  Consumer:     '#f59e0b',
  Healthcare:   '#10b981',
  Defence:      '#64748b',
  PSU:          '#a78bfa',
  Mining:       '#78716c',
  Cement:       '#94a3b8',
  Chemical:     '#34d399',
  Telecom:      '#fb7185',
  Travel:       '#fbbf24',
  Conglomerate: '#c084fc',
  Ports:        '#67e8f9',
  Index:        '#8888aa',
};

/* ============================================================
   FAKE LEADERBOARD TRADERS
   ============================================================ */
export const FAKE_TRADERS = [
  { username: 'BullMaster_Ravi',   seed: 42,  avatar: '#6366f1' },
  { username: 'NiftyNinja99',       seed: 7,   avatar: '#10b981' },
  { username: 'StonkQueen_Priya',  seed: 13,  avatar: '#f97316' },
  { username: 'AlgoAlok',           seed: 99,  avatar: '#3b82f6' },
  { username: 'DivyaTrader',        seed: 55,  avatar: '#ec4899' },
  { username: 'IndexHero_Raj',     seed: 23,  avatar: '#8b5cf6' },
  { username: 'ZeroLoss_Meena',    seed: 31,  avatar: '#06b6d4' },
  { username: 'F0_Fiend',          seed: 18,  avatar: '#f59e0b' },
  { username: 'PaperPro_Aakash',   seed: 64,  avatar: '#14b8a6' },
  { username: 'ChartMaster_V',     seed: 77,  avatar: '#a78bfa' },
  { username: 'GreenPortfolio',    seed: 11,  avatar: '#34d399' },
  { username: 'Sensex_Siddharth', seed: 88,  avatar: '#fb7185' },
  { username: 'RiskFreeRoshan',   seed: 44,  avatar: '#fbbf24' },
  { username: 'TechTrader_Neha',  seed: 33,  avatar: '#67e8f9' },
  { username: 'MarketMogul_K',    seed: 56,  avatar: '#c084fc' },
  { username: 'CandleKing_P',     seed: 72,  avatar: '#84cc16' },
  { username: 'NIFTY_Narayan',    seed: 19,  avatar: '#eab308' },
  { username: 'SwingTrader_S',    seed: 85,  avatar: '#64748b' },
  { username: 'LongHold_Lakshmi', seed: 37,  avatar: '#78716c' },
];

/* ============================================================
   ACHIEVEMENTS
   ============================================================ */
export const ACHIEVEMENTS = {
  first_trade:   { id: 'first_trade',   name: 'First Trade',     icon: '🎯', description: 'Place your first order' },
  bull_run:      { id: 'bull_run',      name: 'Bull Run',        icon: '📈', description: 'Portfolio up 10%+' },
  diamond_hands: { id: 'diamond_hands', name: 'Diamond Hands',   icon: '💎', description: 'Hold a stock for 30+ days' },
  top_trader:    { id: 'top_trader',    name: 'Top Trader',      icon: '🏆', description: 'Reach #1 on leaderboard' },
  speed_demon:   { id: 'speed_demon',   name: 'Speed Demon',     icon: '⚡', description: '10 orders in a single day' },
  strategist:    { id: 'strategist',    name: 'Strategist',      icon: '🧠', description: '5 different stocks in holdings' },
  millionaire:   { id: 'millionaire',   name: 'Millionaire',     icon: '💰', description: 'Portfolio reaches C 2,00,000' },
};

/* ============================================================
   DEFAULT WATCHLIST
   ============================================================ */
export const DEFAULT_WATCHLIST_STOCKS = [
  'NSE_EQ|RELIANCE',
  'NSE_EQ|TCS',
  'NSE_EQ|INFY',
  'NSE_EQ|HDFC',
  'NSE_EQ|SBIN',
  'NSE_EQ|MARUTI',
  'NSE_EQ|ZOMATO',
  'NSE_EQ|BAJFINANCE',
];

/* ============================================================
   MARKET HOURS (IST)
   ============================================================ */
export const MARKET_OPEN_HOUR    = 9;
export const MARKET_OPEN_MINUTE  = 15;
export const MARKET_CLOSE_HOUR   = 15;
export const MARKET_CLOSE_MINUTE = 30;
export const MIS_SQUAREOFF_HOUR   = 15;
export const MIS_SQUAREOFF_MINUTE = 20;

/* ============================================================
   SEEDED RANDOM (for consistent fake trader values)
   ============================================================ */
export function seededRandom(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function traderPortfolioValue(seed, daysOffset = 0) {
  const r = seededRandom(seed + daysOffset * 7);
  return Math.round(STARTING_BALANCE * (0.85 + r * 0.65));
}
