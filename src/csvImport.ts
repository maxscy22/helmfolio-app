import Papa from 'papaparse';
import type { RawCash, RawNav, RawPosition, RawTrade } from './types';

const requiredTradeHeaders = ['Symbol', 'Trade ID', 'TradeID', 'Trade Date', 'TradeDate'];
const requiredPositionHeaders = ['Symbol', 'Quantity', 'Mark Price', 'MarkPrice', 'Position Value', 'PositionValue', 'Unrealized P/L', 'FifoPnlUnrealized'];
const sectionHeaders = ['Trades', 'Open Positions', 'Positions', 'Data', 'Header'];

const normalizeCell = (value: unknown): string => String(value ?? '').trim();

const canonicalKey = (key: string): string => key.replace(/^\uFEFF/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

const cleanCsvCell = (value: unknown): string => normalizeCell(value).replace(/"/g, '').trim();

const hasRequiredHeaders = (headers: string[]): boolean => {
  const canonicalHeaders = headers.map(canonicalKey);
  const hasSymbol = canonicalHeaders.includes(canonicalKey('Symbol')) || canonicalHeaders.includes(canonicalKey('Underlying Symbol'));
  const hasTradeId = canonicalHeaders.includes(canonicalKey('TradeID')) || canonicalHeaders.includes(canonicalKey('Trade ID'));
  const hasTradeDate = canonicalHeaders.includes(canonicalKey('TradeDate')) || canonicalHeaders.includes(canonicalKey('Trade Date')) || canonicalHeaders.includes(canonicalKey('DateTime')) || canonicalHeaders.includes(canonicalKey('Date/Time'));
  return hasSymbol && (hasTradeId || hasTradeDate);
};

const hasCashFlowHeaders = (headers: string[]): boolean => {
  const canonicalHeaders = headers.map(canonicalKey);
  return canonicalHeaders.includes(canonicalKey('DepositsWithdrawals'))
    && canonicalHeaders.includes(canonicalKey('FromDate'))
    && canonicalHeaders.includes(canonicalKey('ToDate'));
};

const hasCashTransactionHeaders = (headers: string[]): boolean => {
  const canonicalHeaders = headers.map(canonicalKey);
  return canonicalHeaders.includes(canonicalKey('Date/Time'))
    && canonicalHeaders.includes(canonicalKey('Amount'))
    && canonicalHeaders.includes(canonicalKey('Type'))
    && canonicalHeaders.includes(canonicalKey('TransactionID'));
};

const hasPositionHeaders = (headers: string[]): boolean => {
  const canonicalHeaders = headers.map(canonicalKey);
  const hasPositionValue = requiredPositionHeaders.some((header) => canonicalHeaders.includes(canonicalKey(header)));
  const hasTradeId = canonicalHeaders.includes(canonicalKey('TradeID')) || canonicalHeaders.includes(canonicalKey('Trade ID'));
  return hasPositionValue && !hasTradeId;
};

const hasNavHeaders = (headers: string[]): boolean => {
  const canonicalHeaders = headers.map(canonicalKey);
  const hasDate = ['FromDate', 'From Date', 'ToDate', 'To Date', 'Date', 'Report Date'].some((header) => canonicalHeaders.includes(canonicalKey(header)));
  const hasNavValue = ['Total', 'EndingValue', 'Ending Value', 'Net Asset Value(NAV) in base', 'Net Asset Value', 'Total Equity', 'Equity With Loan Value'].some((header) => canonicalHeaders.includes(canonicalKey(header)));
  const hasNavChange = ['Change in NAV', 'ChangeInNAV', 'Change NAV'].some((header) => canonicalHeaders.includes(canonicalKey(header)));
  const hasStartingValue = ['StartingValue', 'Starting Value'].some((header) => canonicalHeaders.includes(canonicalKey(header)));
  const hasCashFlow = ['DepositsWithdrawals'].some((header) => canonicalHeaders.includes(canonicalKey(header)));
  return hasDate && (hasNavValue || hasNavChange || hasStartingValue || hasCashFlow);
};

const getValue = (row: RawTrade, aliases: string[]): unknown => {
  const entries = Object.entries(row);
  const canonicalAliases = aliases.map(canonicalKey);
  const match = entries.find(([key]) => canonicalAliases.includes(canonicalKey(key)));
  return match?.[1];
};

const removeIbkrSectionColumns = (row: Record<string, unknown>): RawTrade => {
  const cleaned: RawTrade = {};
  Object.entries(row).forEach(([key, value]) => {
    const cleanedKey = normalizeCell(key).replace(/^\uFEFF/, '');
    if (!sectionHeaders.some((header) => canonicalKey(header) === canonicalKey(cleanedKey))) {
      cleaned[cleanedKey] = value as string | number | null | undefined;
    }
  });
  return cleaned;
};

const isLikelyTrade = (row: RawTrade): boolean => {
  const symbol = normalizeCell(getValue(row, ['Symbol', 'Underlying Symbol', 'UnderlyingSymbol']));
  const tradeId = normalizeCell(getValue(row, ['Trade ID', 'TradeID', 'tradeID']));
  const date = normalizeCell(getValue(row, ['Trade Date', 'TradeDate', 'Date/Time', 'DateTime', 'Report Date', 'ReportDate']));
  const quantity = normalizeCell(getValue(row, ['Quantity', 'Qty']));
  const transactionType = normalizeCell(getValue(row, ['Transaction Type', 'TransactionType']));
  return Boolean(symbol && symbol.toLowerCase() !== 'symbol' && (tradeId || date || quantity || transactionType));
};

const isLikelyPosition = (row: RawPosition): boolean => {
  const symbol = normalizeCell(getValue(row, ['Symbol', 'Underlying Symbol', 'UnderlyingSymbol']));
  const quantity = normalizeCell(getValue(row, ['Quantity', 'Position']));
  const value = normalizeCell(getValue(row, ['Position Value', 'PositionValue', 'Market Value', 'MarketValue']));
  const unrealized = normalizeCell(getValue(row, ['Unrealized P/L', 'UnrealizedPL', 'FifoPnlUnrealized']));
  return Boolean(symbol && symbol.toLowerCase() !== 'symbol' && (quantity || value || unrealized));
};

const isLikelyNav = (row: RawNav): boolean => {
  const date = normalizeCell(getValue(row, ['ToDate', 'To Date', 'FromDate', 'From Date', 'Date', 'Report Date', 'ReportDate']));
  const navValue = normalizeCell(getValue(row, ['Total', 'EndingValue', 'Ending Value', 'Net Asset Value(NAV) in base', 'Net Asset Value', 'NetAssetValue', 'Total Equity', 'Equity With Loan Value']));
  const navChange = normalizeCell(getValue(row, ['Change in NAV', 'ChangeInNAV', 'Change NAV']));
  const startingValue = normalizeCell(getValue(row, ['StartingValue', 'Starting Value']));
  const cashFlow = normalizeCell(getValue(row, ['DepositsWithdrawals']));
  return Boolean(date && !['todate', 'fromdate'].includes(date.toLowerCase()) && (navValue || navChange || startingValue || cashFlow));
};

const isLikelyCashTransaction = (row: RawCash): boolean => {
  const date = normalizeCell(getValue(row, ['Date/Time', 'DateTime', 'ReportDate', 'Report Date', 'SettleDate']));
  const amount = normalizeCell(getValue(row, ['Amount']));
  const type = normalizeCell(getValue(row, ['Type']));
  return Boolean(date && amount && type && !['datetime', 'date/time', 'reportdate', 'settledate'].includes(date.toLowerCase()));
};

const rowFromLine = (headers: string[], line: string[]): RawTrade => {
  const row: Record<string, unknown> = {};
  headers.forEach((header, index) => {
    row[header] = line[index] ?? '';
  });
  return removeIbkrSectionColumns(row);
};

export const parseIbkrCsv = (file: File): Promise<{ rows: RawTrade[]; positions: RawPosition[]; navRows: RawNav[]; cashRows: RawCash[]; rawRows: number; mode: string }> => new Promise((resolve, reject) => {
  Papa.parse<string[]>(file, {
    skipEmptyLines: true,
    complete: (result) => {
      const table = result.data;
      const rows: RawTrade[] = [];
      const positions: RawPosition[] = [];
      const navRows: RawNav[] = [];
      const cashRows: RawCash[] = [];
      let rawRows = 0;
      let activeHeaders: string[] = [];
      let activeSection: 'trades' | 'positions' | 'nav' | 'cash' | null = null;

      table.forEach((line) => {
        const normalizedLine = line.map(cleanCsvCell);
        const cleanedLine = line.map(cleanCsvCell);
        if (hasCashFlowHeaders(normalizedLine)) {
          console.log('Matched DepositsWithdrawals header row:', cleanedLine);
          activeHeaders = normalizedLine.map((header) => header.replace(/^\uFEFF/, ''));
          activeSection = 'nav';
          return;
        }
        if (hasCashTransactionHeaders(normalizedLine)) {
          activeHeaders = normalizedLine.map((header) => header.replace(/^\uFEFF/, ''));
          activeSection = 'cash';
          return;
        }
        if (hasRequiredHeaders(normalizedLine)) {
          activeHeaders = normalizedLine.map((header) => header.replace(/^\uFEFF/, ''));
          activeSection = 'trades';
          return;
        }
        if (hasPositionHeaders(normalizedLine)) {
          activeHeaders = normalizedLine.map((header) => header.replace(/^\uFEFF/, ''));
          activeSection = 'positions';
          return;
        }
        if (hasNavHeaders(normalizedLine)) {
          activeHeaders = normalizedLine.map((header) => header.replace(/^\uFEFF/, ''));
          activeSection = 'nav';
          return;
        }
        if (!activeHeaders.length || !activeSection || !cleanedLine.some((cell) => normalizeCell(cell))) return;
        const parsedRow = rowFromLine(activeHeaders, cleanedLine);
        if (activeSection === 'trades' && isLikelyTrade(parsedRow)) {
          rows.push(parsedRow);
          rawRows += 1;
        }
        if (activeSection === 'positions' && isLikelyPosition(parsedRow)) {
          positions.push(parsedRow);
          rawRows += 1;
        }
        if (activeSection === 'nav' && isLikelyNav(parsedRow)) {
          if (getValue(parsedRow, ['DepositsWithdrawals']) !== undefined) console.log('Matched DepositsWithdrawals data row:', parsedRow);
          navRows.push(parsedRow);
          rawRows += 1;
        }
        if (activeSection === 'cash' && isLikelyCashTransaction(parsedRow)) {
          cashRows.push(parsedRow);
          rawRows += 1;
        }
      });

      if (!rows.length) {
        reject(new Error('Could not find an IBKR Trades header row in this CSV.'));
        return;
      }

      const modeParts = ['IBKR trades'];
      if (positions.length) modeParts.push('open positions');
      if (navRows.length) modeParts.push('NAV');
      if (cashRows.length) modeParts.push('cash transactions');
      resolve({ rows, positions, navRows, cashRows, rawRows, mode: `${modeParts.join(' + ')} CSV` });
    },
    error: (error) => reject(error),
  });
});
