import type { RawCash, RawNav, RawPosition, RawTrade } from '../types';

export const canonicalRawKey = (key: string): string => key.replace(/^\uFEFF/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

export const rawValueByAliases = (row: RawTrade | RawPosition | RawNav | RawCash, aliases: string[]) => {
  const canonicalAliases = aliases.map(canonicalRawKey);
  return Object.entries(row).find(([key]) => canonicalAliases.includes(canonicalRawKey(key)))?.[1];
};

export const rawStringByAliases = (row: RawTrade | RawPosition | RawNav | RawCash, aliases: string[]) =>
  String(rawValueByAliases(row, aliases) ?? '').trim();

export const normalizedRawStringByAliases = (row: RawTrade | RawPosition | RawNav | RawCash, aliases: string[]) =>
  rawStringByAliases(row, aliases).replace(/\s+/g, ' ').trim().toUpperCase();

export const normalizedTradeId = (row: RawTrade) =>
  rawStringByAliases(row, ['Trade ID', 'TradeID', 'tradeID', 'Trade Id', 'tradeId']).replace(/\.0$/, '').trim();

export const rawDateByAliases = (row: RawTrade | RawPosition | RawNav | RawCash, aliases: string[]) => {
  const datePart = rawStringByAliases(row, aliases).split(';')[0];
  if (/^\d{8}$/.test(datePart)) return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
  return datePart.slice(0, 10);
};

export const rawDateTimeByAliases = (row: RawTrade | RawPosition | RawNav | RawCash, aliases: string[]) => {
  const raw = rawStringByAliases(row, aliases);
  const [datePart, timePart = ''] = raw.split(';');
  const date = /^\d{8}$/.test(datePart) ? `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}` : datePart.slice(0, 10);
  const timeDigits = timePart.replace(/\D/g, '');
  const time = timeDigits.length >= 6 ? `${timeDigits.slice(0, 2)}:${timeDigits.slice(2, 4)}:${timeDigits.slice(4, 6)}` : timePart.slice(0, 8);
  return [date, time].filter(Boolean).join(';');
};

export const rawNumberByAliases = (row: RawTrade | RawPosition | RawNav | RawCash, aliases: string[]) => {
  const value = Number(String(rawValueByAliases(row, aliases) ?? '').replace(/[$,%\s]/g, '').replace(/,/g, ''));
  return Number.isFinite(value) ? value : 0;
};

export const stableRowSignature = (row: RawTrade | RawPosition | RawNav | RawCash) =>
  Object.entries(row)
    .map(([key, value]) => [canonicalRawKey(key), String(value ?? '').trim()] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');

export const isSamplePreviewRow = (row: RawTrade) => {
  const accountId = rawStringByAliases(row, ['Account ID', 'AccountID', 'ClientAccountID', 'accountId']);
  const tradeId = rawStringByAliases(row, ['Trade ID', 'TradeID', 'tradeID']);
  const symbol = rawStringByAliases(row, ['Symbol', 'symbol']);
  return accountId === 'U123'
    && [
      ['1', 'NVDA'],
      ['2', 'TSLA'],
      ['3', 'AAPL'],
      ['4', 'MSFT'],
      ['5', 'META'],
    ].some(([sampleTradeId, sampleSymbol]) => tradeId === sampleTradeId && symbol === sampleSymbol);
};

export const withoutSamplePreviewRows = (tradeRows: RawTrade[]) => tradeRows.filter((row) => !isSamplePreviewRow(row));
