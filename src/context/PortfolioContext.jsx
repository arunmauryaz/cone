/* ============================================================
   CONE — Portfolio Context (most complex)
   src/context/PortfolioContext.jsx
   ============================================================ */

import {
  createContext, useContext, useReducer, useEffect,
  useCallback, useMemo, useRef, useState
} from 'react';
import toast from 'react-hot-toast';
import {
  getPortfolio, savePortfolio,
  getWatchlists, saveWatchlists,
  getNotifications, saveNotifications,
  getAchievements, saveAchievements,
  appendPortfolioHistory,
  defaultPortfolioState,
  addNotification as storageAddNotification,
} from '../utils/storage.js';
import {
  calcRequiredMargin, calcBrokerage, calcNewAvgCost,
  calcUnrealizedPnL, calcRealizedPnL, calcPortfolioTotalValue,
  generateId, isMISSquareoffTime,
} from '../utils/calculations.js';
import { useAuth } from './AuthContext.jsx';
import { useMarket } from './MarketContext.jsx';
import { STARTING_BALANCE, ACHIEVEMENTS } from '../utils/constants.js';

/* ============================================================
   REDUCER
   ============================================================ */
function portfolioReducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { ...state, ...action.payload };

    case 'SET_WALLET':
      return { ...state, wallet: { ...state.wallet, ...action.payload } };

    case 'ADD_ORDER': {
      const orders = [action.payload, ...state.orders].slice(0, 500);
      return { ...state, orders };
    }
    case 'UPDATE_ORDER': {
      const orders = state.orders.map(o => o.id === action.payload.id ? { ...o, ...action.payload } : o);
      return { ...state, orders };
    }

    case 'SET_HOLDINGS':
      return { ...state, holdings: action.payload };

    case 'SET_POSITIONS':
      return { ...state, positions: action.payload };

    case 'ADD_GTT':
      return { ...state, gttOrders: [action.payload, ...state.gttOrders] };
    case 'UPDATE_GTT': {
      const gttOrders = state.gttOrders.map(g => g.id === action.payload.id ? { ...g, ...action.payload } : g);
      return { ...state, gttOrders };
    }
    case 'REMOVE_GTT': {
      const gttOrders = state.gttOrders.filter(g => g.id !== action.id);
      return { ...state, gttOrders };
    }

    case 'ADD_SIP':
      return { ...state, sips: [action.payload, ...state.sips] };
    case 'UPDATE_SIP': {
      const sips = state.sips.map(s => s.id === action.payload.id ? { ...s, ...action.payload } : s);
      return { ...state, sips };
    }
    case 'REMOVE_SIP': {
      const sips = state.sips.filter(s => s.id !== action.id);
      return { ...state, sips };
    }

    case 'ADD_ALERT':
      return { ...state, alerts: [action.payload, ...state.alerts] };
    case 'UPDATE_ALERT': {
      const alerts = state.alerts.map(a => a.id === action.payload.id ? { ...a, ...action.payload } : a);
      return { ...state, alerts };
    }
    case 'REMOVE_ALERT': {
      const alerts = state.alerts.filter(a => a.id !== action.id);
      return { ...state, alerts };
    }

    case 'SET_WATCHLISTS':
      return { ...state, watchlists: action.payload };

    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };

    case 'SET_ACHIEVEMENTS':
      return { ...state, achievements: action.payload };

    case 'RESET':
      return {
        ...defaultPortfolioState(),
        watchlists:    state.watchlists,
        notifications: state.notifications,
        achievements:  state.achievements,
      };

    default:
      return state;
  }
}

const initialState = {
  ...defaultPortfolioState(),
  watchlists:    [],
  notifications: [],
  achievements:  [],
};

/* ============================================================
   CONTEXT
   ============================================================ */
const PortfolioContext = createContext(null);

export function PortfolioProvider({ children }) {
  const { user } = useAuth();
  const { prices } = useMarket();
  const [state, dispatch] = useReducer(portfolioReducer, initialState);
  const pendingRef = useRef(false); // debounce save

  // Global order modal state
  const [orderModal, setOrderModal] = useState({ visible: false, instrumentKey: null, side: 'BUY' });
  const openOrderModal  = useCallback((params) => setOrderModal({ visible: true, ...params }), []);
  const closeOrderModal = useCallback(() => setOrderModal(m => ({ ...m, visible: false })), []);

  /* ---- Load from localStorage on mount / user change ---- */
  useEffect(() => {
    if (!user) return;
    const portfolio     = getPortfolio(user.username);
    const watchlists    = getWatchlists(user.username);
    const notifications = getNotifications(user.username);
    const achievements  = getAchievements(user.username);
    dispatch({ type: 'LOAD', payload: { ...portfolio, watchlists, notifications, achievements } });
  }, [user?.username]);

  /* ---- Persist on state change (debounced) ---- */
  useEffect(() => {
    if (!user || pendingRef.current) return;
    pendingRef.current = true;
    const timer = setTimeout(() => {
      savePortfolio(user.username, {
        wallet:    state.wallet,
        holdings:  state.holdings,
        positions: state.positions,
        orders:    state.orders,
        gttOrders: state.gttOrders,
        sips:      state.sips,
        alerts:    state.alerts,
      });
      saveWatchlists(user.username, state.watchlists);
      saveNotifications(user.username, state.notifications);
      saveAchievements(user.username, state.achievements);
      pendingRef.current = false;
    }, 400);
    return () => clearTimeout(timer);
  }, [state, user]);

  /* ---- Check limit & GTT orders on every price tick ---- */
  useEffect(() => {
    if (!prices || prices.size === 0) return;
    checkLimitOrders(state.orders, prices, dispatch, state, user);
    checkGTTOrders(state.gttOrders, prices, dispatch, state, user);
    checkAlerts(state.alerts, prices, dispatch, state, user);
  }, [prices]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- MIS squareoff check every minute ---- */
  useEffect(() => {
    const id = setInterval(() => {
      if (!isMISSquareoffTime()) return;
      const misPositions = state.positions.filter(p => p.product === 'MIS' && p.qty !== 0);
      if (misPositions.length > 0) {
        misPositions.forEach(p => {
          executeExit(p, prices, dispatch, state, user);
        });
        toast('⚠️ MIS positions auto-squared off at 3:20 PM', { icon: '🔔' });
        pushNotification(dispatch, state, user, {
          type: 'SYSTEM',
          title: 'MIS Squareoff',
          message: `${misPositions.length} MIS position(s) auto-squared off at 3:20 PM`,
        });
      }
    }, 60000);
    return () => clearInterval(id);
  }, [state.positions, prices, user]);

  /* ---- SIP check on mount ---- */
  useEffect(() => {
    if (!user || !state.sips?.length) return;
    const now = new Date();
    state.sips.forEach(sip => {
      if (!sip.active) return;
      if (new Date(sip.nextExecutionDate) <= now) {
        const ltp = prices.get(sip.instrumentKey)?.ltp;
        if (!ltp) return;
        internalPlaceOrder({
          instrumentKey: sip.instrumentKey,
          side:          'BUY',
          qty:           sip.qty,
          orderType:     'MARKET',
          product:       'CNC',
          price:         ltp,
          note:          `SIP: ${sip.instrumentKey}`,
        }, dispatch, state, user, prices);
        // Update nextExecutionDate
        const next = new Date(sip.nextExecutionDate);
        if (sip.frequency === 'daily')   next.setDate(next.getDate() + 1);
        if (sip.frequency === 'weekly')  next.setDate(next.getDate() + 7);
        if (sip.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
        dispatch({ type: 'UPDATE_SIP', payload: { id: sip.id, nextExecutionDate: next.toISOString() } });
      }
    });
  }, [user?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Public API ---- */
  const placeOrder = useCallback((params) => {
    return internalPlaceOrder(params, dispatch, state, user, prices);
  }, [state, user, prices]);

  const cancelOrder = useCallback((orderId) => {
    dispatch({ type: 'UPDATE_ORDER', payload: { id: orderId, status: 'CANCELLED', cancelledAt: new Date().toISOString() } });
    toast.success('Order cancelled');
  }, []);

  const modifyOrder = useCallback((orderId, updates) => {
    dispatch({ type: 'UPDATE_ORDER', payload: { id: orderId, ...updates } });
    toast.success('Order modified');
  }, []);

  const exitPosition = useCallback((positionId) => {
    const pos = state.positions.find(p => p.id === positionId);
    if (!pos) return;
    executeExit(pos, prices, dispatch, state, user);
  }, [state.positions, prices, user]);

  const addCoins = useCallback((amount) => {
    const newBalance = Math.min(state.wallet.balance + amount, 1000000);
    const added = newBalance - state.wallet.balance;
    if (added <= 0) {
      toast.error('Maximum balance is C 10,00,000');
      return;
    }
    const tx = {
      id:          generateId('tx'),
      timestamp:   new Date().toISOString(),
      type:        'CREDIT',
      description: 'CONE Coins Added',
      amount:      added,
      balance:     newBalance,
    };
    dispatch({ type: 'SET_WALLET', payload: {
      balance:     newBalance,
      todayPayin:  (state.wallet.todayPayin || 0) + added,
      transactions: [tx, ...(state.wallet.transactions || [])].slice(0, 500),
    }});
    toast.success(`C ${added.toLocaleString('en-IN')} CONE Coins added!`);
    appendPortfolioHistory(user.username, { timestamp: Date.now(), totalValue: newBalance });
  }, [state.wallet, user]);

  const resetPortfolio = useCallback(() => {
    dispatch({ type: 'RESET' });
    appendPortfolioHistory(user.username, { timestamp: Date.now(), totalValue: STARTING_BALANCE });
    toast.success('Portfolio reset. Starting fresh with C 1,00,000.', { icon: '🔄' });
  }, [user]);

  // Watchlist CRUD
  const addToWatchlist = useCallback((listIdx, instrumentKey) => {
    const wl = [...state.watchlists];
    if (!wl[listIdx].stocks.includes(instrumentKey)) {
      wl[listIdx] = { ...wl[listIdx], stocks: [...wl[listIdx].stocks, instrumentKey] };
      dispatch({ type: 'SET_WATCHLISTS', payload: wl });
    }
  }, [state.watchlists]);

  const removeFromWatchlist = useCallback((listIdx, instrumentKey) => {
    const wl = [...state.watchlists];
    wl[listIdx] = { ...wl[listIdx], stocks: wl[listIdx].stocks.filter(k => k !== instrumentKey) };
    dispatch({ type: 'SET_WATCHLISTS', payload: wl });
  }, [state.watchlists]);

  const createWatchlist = useCallback((name) => {
    const wl = [...state.watchlists, { name, stocks: [] }];
    dispatch({ type: 'SET_WATCHLISTS', payload: wl });
  }, [state.watchlists]);

  const deleteWatchlist = useCallback((listIdx) => {
    const wl = state.watchlists.filter((_, i) => i !== listIdx);
    dispatch({ type: 'SET_WATCHLISTS', payload: wl });
  }, [state.watchlists]);

  // Alerts
  const addAlert  = useCallback((alert) => dispatch({ type: 'ADD_ALERT',    payload: { ...alert, id: generateId('alert'), active: true } }), []);
  const removeAlert = useCallback((id)  => dispatch({ type: 'REMOVE_ALERT', id }), []);

  // GTT
  const addGTT    = useCallback((gtt) => dispatch({ type: 'ADD_GTT', payload: { ...gtt, id: generateId('gtt'), status: 'ACTIVE' } }), []);
  const removeGTT = useCallback((id)  => dispatch({ type: 'REMOVE_GTT', id }), []);

  // SIP
  const addSIP    = useCallback((sip) => dispatch({ type: 'ADD_SIP', payload: { ...sip, id: generateId('sip'), active: true } }), []);
  const removeSIP = useCallback((id)  => dispatch({ type: 'REMOVE_SIP', id }), []);
  const pauseSIP  = useCallback((id)  => dispatch({ type: 'UPDATE_SIP', payload: { id, active: false } }), []);
  const resumeSIP = useCallback((id)  => dispatch({ type: 'UPDATE_SIP', payload: { id, active: true  } }), []);

  // Notifications
  const markAllRead = useCallback(() => {
    const notifs = state.notifications.map(n => ({ ...n, read: true }));
    dispatch({ type: 'SET_NOTIFICATIONS', payload: notifs });
  }, [state.notifications]);

  const markRead = useCallback((id) => {
    const notifs = state.notifications.map(n => n.id === id ? { ...n, read: true } : n);
    dispatch({ type: 'SET_NOTIFICATIONS', payload: notifs });
  }, [state.notifications]);

  const clearNotifications = useCallback(() => {
    dispatch({ type: 'SET_NOTIFICATIONS', payload: [] });
  }, []);

  const unreadCount = useMemo(() =>
    state.notifications.filter(n => !n.read).length,
    [state.notifications]
  );

  const totalPortfolioValue = useMemo(() =>
    calcPortfolioTotalValue(state.wallet, state.holdings, state.positions, prices),
    [state.wallet, state.holdings, state.positions, prices]
  );

  const value = useMemo(() => ({
    ...state,
    totalPortfolioValue,
    unreadCount,
    placeOrder,
    cancelOrder,
    modifyOrder,
    exitPosition,
    addCoins,
    resetPortfolio,
    addToWatchlist,
    removeFromWatchlist,
    createWatchlist,
    deleteWatchlist,
    addAlert,
    removeAlert,
    addGTT,
    removeGTT,
    addSIP,
    removeSIP,
    pauseSIP,
    resumeSIP,
    markRead,
    markAllRead,
    clearNotifications,
    orderModal,
    openOrderModal,
    closeOrderModal,
  }), [state, totalPortfolioValue, unreadCount, placeOrder, cancelOrder, modifyOrder, exitPosition, addCoins, resetPortfolio, addToWatchlist, removeFromWatchlist, createWatchlist, deleteWatchlist, addAlert, removeAlert, addGTT, removeGTT, addSIP, removeSIP, pauseSIP, resumeSIP, markRead, markAllRead, clearNotifications, orderModal, openOrderModal, closeOrderModal]);

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used inside PortfolioProvider');
  return ctx;
}

/* ============================================================
   HELPER FUNCTIONS (outside component to avoid re-creation)
   ============================================================ */

function pushNotification(dispatch, state, user, data) {
  const notif = {
    id:        generateId('notif'),
    timestamp: new Date().toISOString(),
    read:      false,
    ...data,
  };
  const notifications = [notif, ...(state.notifications || [])].slice(0, 200);
  dispatch({ type: 'SET_NOTIFICATIONS', payload: notifications });
}

function checkAchievements(dispatch, state, user) {
  const current = state.achievements || [];
  const orders  = state.orders || [];
  const holdings = state.holdings || [];

  const checks = [
    { id: 'first_trade',   cond: orders.filter(o => o.status === 'COMPLETE').length >= 1 },
    { id: 'bull_run',      cond: calcPortfolioTotalValue(state.wallet, holdings, state.positions || [], new Map()) >= 110000 },
    { id: 'diamond_hands', cond: holdings.some(h => Date.now() - new Date(h.firstBoughtAt).getTime() >= 30 * 24 * 3600 * 1000) },
    { id: 'speed_demon',   cond: (() => {
      const today = new Date(); today.setHours(0,0,0,0);
      return orders.filter(o => o.status === 'COMPLETE' && new Date(o.executedAt) >= today).length >= 10;
    })() },
    { id: 'strategist',    cond: holdings.length >= 5 },
  ];

  const newUnlocks = checks.filter(c => c.cond && !current.includes(c.id));
  if (!newUnlocks.length) return;

  const updated = [...current, ...newUnlocks.map(c => c.id)];
  dispatch({ type: 'SET_ACHIEVEMENTS', payload: updated });
  newUnlocks.forEach(c => {
    const ach = ACHIEVEMENTS[c.id];
    toast.success(`🏆 Achievement unlocked: ${ach.name}!`, { duration: 4000 });
    pushNotification(dispatch, state, user, {
      type:    'ACHIEVEMENT',
      title:   'Achievement Unlocked!',
      message: `${ach.icon} ${ach.name} — ${ach.description}`,
    });
  });
}

function internalPlaceOrder(params, dispatch, state, user, prices) {
  const {
    instrumentKey, side, qty, orderType = 'MARKET',
    product = 'CNC', price: limitPrice = 0, note = '',
  } = params;

  const ltp        = prices?.get?.(instrumentKey)?.ltp ?? limitPrice;
  const execPrice  = orderType === 'MARKET' ? ltp : limitPrice;
  const margin     = calcRequiredMargin(execPrice, qty, product);
  const brokerage  = calcBrokerage(product, execPrice, qty);

  // Validate balance for BUY
  if (side === 'BUY' && state.wallet.balance < margin) {
    toast.error('Insufficient CONE Coins');
    return { ok: false, error: 'Insufficient balance' };
  }

  // For SELL CNC — validate holding qty
  if (side === 'SELL' && product === 'CNC') {
    const holding = state.holdings.find(h => h.instrumentKey === instrumentKey);
    if (!holding || holding.qty < qty) {
      toast.error(`You don't hold enough shares to sell`);
      return { ok: false, error: 'Insufficient holdings' };
    }
  }

  const order = {
    id:           generateId('order'),
    instrumentKey,
    tradingsymbol: instrumentKey.split('|')[1] || instrumentKey,
    side,
    qty,
    orderType,
    product,
    price:        execPrice,
    limitPrice,
    status:       orderType === 'LIMIT' ? 'OPEN' : 'COMPLETE',
    createdAt:    new Date().toISOString(),
    executedAt:   orderType !== 'LIMIT' ? new Date().toISOString() : null,
    realizedPnL:  null,
    brokerage,
    note,
  };

  dispatch({ type: 'ADD_ORDER', payload: order });

  if (orderType === 'LIMIT') {
    toast.success(`Limit order placed at C ${execPrice.toLocaleString('en-IN')}`);
    return { ok: true, order };
  }

  // Execute immediately (MARKET order)
  _executeOrder(order, execPrice, dispatch, state, user);
  return { ok: true, order };
}

function _executeOrder(order, execPrice, dispatch, state, user) {
  const { instrumentKey, side, qty, product, brokerage } = order;

  dispatch({ type: 'UPDATE_ORDER', payload: {
    id: order.id, status: 'COMPLETE', executedAt: new Date().toISOString(), price: execPrice,
  }});

  if (side === 'BUY') {
    // Update holdings (CNC) or positions (MIS/NRML)
    if (product === 'CNC') {
      const holdings = [...state.holdings];
      const idx = holdings.findIndex(h => h.instrumentKey === instrumentKey);
      if (idx >= 0) {
        holdings[idx] = {
          ...holdings[idx],
          qty:        holdings[idx].qty + qty,
          avgCost:    calcNewAvgCost(holdings[idx].avgCost, holdings[idx].qty, execPrice, qty),
        };
      } else {
        holdings.push({
          id:            generateId('holding'),
          instrumentKey,
          tradingsymbol: order.tradingsymbol,
          qty,
          avgCost:       execPrice,
          firstBoughtAt: new Date().toISOString(),
          product:       'CNC',
        });
      }
      dispatch({ type: 'SET_HOLDINGS', payload: holdings });
    } else {
      // MIS/NRML — positions
      const positions = [...state.positions];
      const idx = positions.findIndex(p => p.instrumentKey === instrumentKey && p.product === product);
      if (idx >= 0) {
        positions[idx] = {
          ...positions[idx],
          qty:     positions[idx].qty + qty,
          avgCost: calcNewAvgCost(positions[idx].avgCost, positions[idx].qty, execPrice, qty),
        };
      } else {
        positions.push({
          id:            generateId('pos'),
          instrumentKey,
          tradingsymbol: order.tradingsymbol,
          qty,
          avgCost:       execPrice,
          product,
          openedAt:      new Date().toISOString(),
        });
      }
      dispatch({ type: 'SET_POSITIONS', payload: positions });
    }

    // Deduct balance
    const cost = execPrice * qty + brokerage;
    const tx = {
      id: generateId('tx'), timestamp: new Date().toISOString(), type: 'DEBIT',
      description: `Buy Order: ${order.tradingsymbol} x ${qty} @ C ${execPrice.toFixed(2)}`,
      amount: -cost, balance: state.wallet.balance - cost,
    };
    dispatch({ type: 'SET_WALLET', payload: {
      balance:      Math.max(0, state.wallet.balance - cost),
      transactions: [tx, ...(state.wallet.transactions || [])].slice(0, 500),
    }});

  } else {
    // SELL
    let realizedPnL = 0;

    if (product === 'CNC') {
      const holdings = [...state.holdings];
      const idx = holdings.findIndex(h => h.instrumentKey === instrumentKey);
      if (idx >= 0) {
        realizedPnL = calcRealizedPnL(execPrice, holdings[idx].avgCost, qty, brokerage);
        if (holdings[idx].qty - qty <= 0) {
          holdings.splice(idx, 1);
        } else {
          holdings[idx] = { ...holdings[idx], qty: holdings[idx].qty - qty };
        }
        dispatch({ type: 'SET_HOLDINGS', payload: holdings });
      }
    } else {
      const positions = [...state.positions];
      const idx = positions.findIndex(p => p.instrumentKey === instrumentKey && p.product === product);
      if (idx >= 0) {
        realizedPnL = calcRealizedPnL(execPrice, positions[idx].avgCost, qty, brokerage);
        if (Math.abs(positions[idx].qty) - qty <= 0) {
          positions.splice(idx, 1);
        } else {
          positions[idx] = { ...positions[idx], qty: positions[idx].qty - qty };
        }
        dispatch({ type: 'SET_POSITIONS', payload: positions });
      }
    }

    // Update order with realized P&L
    dispatch({ type: 'UPDATE_ORDER', payload: { id: order.id, realizedPnL } });

    // Credit balance
    const proceeds = execPrice * qty - brokerage;
    const tx = {
      id: generateId('tx'), timestamp: new Date().toISOString(), type: 'CREDIT',
      description: `Sell Order: ${order.tradingsymbol} x ${qty} @ C ${execPrice.toFixed(2)}`,
      amount: proceeds, balance: state.wallet.balance + proceeds,
    };
    dispatch({ type: 'SET_WALLET', payload: {
      balance:      state.wallet.balance + proceeds,
      transactions: [tx, ...(state.wallet.transactions || [])].slice(0, 500),
    }});
  }

  const pnlText = side === 'SELL' ? ` • P&L: ${order.realizedPnL >= 0 ? '+' : ''}C ${(order.realizedPnL || 0).toFixed(2)}` : '';
  toast.success(`${side === 'BUY' ? '🟢' : '🔴'} ${order.tradingsymbol} ${side} ${qty} @ C ${execPrice.toFixed(2)}${pnlText}`);

  pushNotification(dispatch, state, user, {
    type:        'ORDER_COMPLETE',
    title:       'Order Executed',
    message:     `${side} ${qty} ${order.tradingsymbol} at C ${execPrice.toFixed(2)} — COMPLETE`,
    actionRoute: '/orders',
  });

  // Append portfolio history
  if (user) {
    setTimeout(() => {
      appendPortfolioHistory(user.username, {
        timestamp:  Date.now(),
        totalValue: calcPortfolioTotalValue(state.wallet, state.holdings, state.positions, prices),
      });
    }, 100);
  }

  checkAchievements(dispatch, state, user);
}

function executeExit(position, prices, dispatch, state, user) {
  const ltp = prices?.get?.(position.instrumentKey)?.ltp ?? position.avgCost;
  const exitSide = position.qty > 0 ? 'SELL' : 'BUY';
  const exitQty  = Math.abs(position.qty);
  const order = {
    id:           generateId('order'),
    instrumentKey: position.instrumentKey,
    tradingsymbol: position.tradingsymbol,
    side:          exitSide,
    qty:           exitQty,
    orderType:     'MARKET',
    product:       position.product,
    price:         ltp,
    status:        'COMPLETE',
    createdAt:     new Date().toISOString(),
    executedAt:    new Date().toISOString(),
    realizedPnL:   null,
    brokerage:     calcBrokerage(position.product, ltp, exitQty),
    note:          'Position exit',
  };
  dispatch({ type: 'ADD_ORDER', payload: order });
  _executeOrder(order, ltp, dispatch, state, user);
}

function checkLimitOrders(orders, prices, dispatch, state, user) {
  const openLimits = orders.filter(o => o.status === 'OPEN' && o.orderType === 'LIMIT');
  openLimits.forEach(order => {
    const priceData = prices?.get?.(order.instrumentKey);
    if (!priceData?.ltp) return;
    const { ltp } = priceData;
    const filled =
      (order.side === 'BUY'  && ltp <= order.limitPrice) ||
      (order.side === 'SELL' && ltp >= order.limitPrice);
    if (filled) {
      _executeOrder(order, ltp, dispatch, state, user);
    }
  });
}

function checkGTTOrders(gttOrders, prices, dispatch, state, user) {
  const active = gttOrders.filter(g => g.status === 'ACTIVE');
  active.forEach(gtt => {
    const priceData = prices?.get?.(gtt.instrumentKey);
    if (!priceData?.ltp) return;
    const { ltp } = priceData;
    let triggered = false;
    if (gtt.side === 'BUY'  && ltp >= gtt.triggerPrice) triggered = true;
    if (gtt.side === 'SELL' && ltp <= gtt.triggerPrice) triggered = true;
    if (triggered) {
      dispatch({ type: 'UPDATE_GTT', payload: { id: gtt.id, status: 'TRIGGERED' } });
      internalPlaceOrder({
        ...gtt,
        orderType: 'LIMIT',
        price:     gtt.limitPrice,
      }, dispatch, state, user, prices);
      toast(`GTT triggered: ${gtt.tradingsymbol || gtt.instrumentKey}`, { icon: '⚡' });
    }
  });
}

function checkAlerts(alerts, prices, dispatch, state, user) {
  const active = alerts.filter(a => a.active);
  active.forEach(alert => {
    const priceData = prices?.get?.(alert.instrumentKey);
    if (!priceData?.ltp) return;
    const { ltp } = priceData;
    let triggered = false;
    if (alert.condition === 'above' && ltp >= alert.target) triggered = true;
    if (alert.condition === 'below' && ltp <= alert.target) triggered = true;
    if (triggered) {
      dispatch({ type: 'UPDATE_ALERT', payload: { id: alert.id, active: false, triggeredAt: new Date().toISOString() } });
      pushNotification(dispatch, state, user, {
        type:    'PRICE_ALERT',
        title:   'Price Alert Triggered',
        message: `${alert.symbol || alert.instrumentKey} ${alert.condition === 'above' ? '≥' : '≤'} C ${alert.target}`,
      });
      // Browser notification if permission granted
      if (Notification?.permission === 'granted') {
        new Notification('CONE Price Alert', {
          body: `${alert.symbol || alert.instrumentKey} hit C ${ltp} — your alert target was C ${alert.target}`,
          icon: '/cone-logo.svg',
        });
      }
    }
  });
}
