/* src/hooks/useLivePrice.js */
import { useMarket } from '../context/MarketContext.jsx';

export function useLivePrice(instrumentKey) {
  const { prices } = useMarket();
  return instrumentKey ? prices.get(instrumentKey) ?? null : null;
}
