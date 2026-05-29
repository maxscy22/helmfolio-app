import type { Trade } from '../types';

export const tradeDateKey = (trade: Trade) => {
  const rawDate = trade.tradeDate || trade.date;
  const datePart = String(rawDate || '').split(';')[0];
  if (/^\d{8}$/.test(datePart)) return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
  return datePart.slice(0, 10);
};

export const tradeSideLabel = (trade: Trade) => {
  const side = trade.buySell.toUpperCase();
  if (side === 'BUY' || side === 'SELL') return side;
  if (trade.quantity > 0) return 'BUY';
  if (trade.quantity < 0) return 'SELL';
  return 'UNKNOWN';
};
