/* ============================================================
   CONE — Calculations
   src/utils/calculations.js
   ============================================================ */

import { STARTING_BALANCE } from './constants.js';

/**
 * Calculate required margin for an order
 */
export function calcRequiredMargin(ltp, qty, product) {
  if (!ltp || !qty || qty <= 0) return 0;
  switch (product) {
    case 'CNC':      return ltp * qty;               // Full amount
    case 'MIS':      return (ltp * qty) / 5;         // 20% (5x leverage)
    case 'NRML':     return (ltp * qty) * 0.15;      // ~15% SPAN
    case 'OPT_BUY':  return ltp * qty;               // Full premium
    case 'OPT_SELL': return (ltp * qty) * 0.20;
    default:         return ltp * qty;
  }
}

/**
 * Calculate brokerage
 */
export function calcBrokerage(product, ltp, qty) {
  if (!ltp || !qty || qty <= 0) return 0;
  const turnover = ltp * qty;
  if (product === 'CNC') return 0;
  if (product === 'MIS') return Math.min(turnover * 0.0003, 20);
  return 20; // F&O flat
}

/**
 * Weighted average cost (for multiple buys)
 */
export function calcNewAvgCost(prevAvg, prevQty, newPrice, newQty) {
  if (prevQty + newQty === 0) return 0;
  return ((prevAvg * prevQty) + (newPrice * newQty)) / (prevQty + newQty);
}

/**
 * Unrealized P&L
 */
export function calcUnrealizedPnL(ltp, avgCost, qty) {
  if (!ltp || !avgCost) return 0;
  return (ltp - avgCost) * qty;
}

/**
 * Realized P&L (after close)
 */
export function calcRealizedPnL(exitPrice, entryPrice, qty, brokerage = 0) {
  return (exitPrice - entryPrice) * qty - brokerage;
}

/**
 * Total portfolio value
 */
export function calcPortfolioTotalValue(wallet, holdings, positions, pricesMap) {
  const holdingsValue = holdings.reduce((sum, h) => {
    const price = pricesMap?.get?.(h.instrumentKey)?.ltp ?? h.avgCost;
    return sum + price * h.qty;
  }, 0);

  const unrealizedPnL = positions.reduce((sum, p) => {
    const price = pricesMap?.get?.(p.instrumentKey)?.ltp ?? p.avgCost;
    return sum + calcUnrealizedPnL(price, p.avgCost, p.qty);
  }, 0);

  return (wallet?.balance ?? 0) + holdingsValue + unrealizedPnL;
}

/**
 * Today's P&L = realized (today) + unrealized (positions)
 */
export function calcTodayPnL(orders, positions, pricesMap) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const realized = orders
    .filter(o => o.status === 'COMPLETE' && new Date(o.executedAt) >= today && o.realizedPnL != null)
    .reduce((sum, o) => sum + (o.realizedPnL || 0), 0);

  const unrealized = positions.reduce((sum, p) => {
    const price = pricesMap?.get?.(p.instrumentKey)?.ltp ?? p.avgCost;
    return sum + calcUnrealizedPnL(price, p.avgCost, p.qty);
  }, 0);

  return { realized, unrealized, total: realized + unrealized };
}

/**
 * Win rate percentage
 */
export function calcWinRate(closedTrades) {
  if (!closedTrades?.length) return 0;
  const wins = closedTrades.filter(t => (t.realizedPnL || 0) > 0).length;
  return (wins / closedTrades.length) * 100;
}

/**
 * Profit factor
 */
export function calcProfitFactor(closedTrades) {
  let totalWin = 0, totalLoss = 0;
  closedTrades.forEach(t => {
    if ((t.realizedPnL || 0) > 0) totalWin  += t.realizedPnL;
    else                            totalLoss += Math.abs(t.realizedPnL || 0);
  });
  if (totalLoss === 0) return totalWin > 0 ? Infinity : 0;
  return totalWin / totalLoss;
}

/**
 * Max drawdown from portfolio history
 */
export function calcMaxDrawdown(history) {
  if (!history?.length) return 0;
  let peak = -Infinity, maxDD = 0;
  history.forEach(({ totalValue }) => {
    if (totalValue > peak) peak = totalValue;
    const dd = peak > 0 ? ((peak - totalValue) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
  });
  return maxDD;
}

/**
 * Overall P&L vs starting balance
 */
export function calcOverallPnL(currentTotalValue) {
  return currentTotalValue - STARTING_BALANCE;
}

/**
 * Holdings current value
 */
export function calcHoldingsValue(holdings, pricesMap) {
  return holdings.reduce((sum, h) => {
    const price = pricesMap?.get?.(h.instrumentKey)?.ltp ?? h.avgCost;
    return sum + price * h.qty;
  }, 0);
}

/**
 * Is market open right now (IST)?
 */
export function isMarketOpen() {
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' });
  if (['Sat', 'Sun'].includes(day)) return false;

  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Kolkata' });
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = h * 60 + m;
  return totalMin >= 9 * 60 + 15 && totalMin < 15 * 60 + 30;
}

/**
 * Is MIS squareoff time (>= 3:20 PM IST on weekdays)?
 */
export function isMISSquareoffTime() {
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' });
  if (['Sat', 'Sun'].includes(day)) return false;

  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Kolkata' });
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = h * 60 + m;
  return totalMin >= 15 * 60 + 20;
}

/**
 * Generate a unique ID
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
