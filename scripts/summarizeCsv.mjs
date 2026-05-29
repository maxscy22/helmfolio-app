import fs from 'node:fs';
import Papa from 'papaparse';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/summarizeCsv.mjs <csv-file>');
  process.exit(1);
}

const csv = fs.readFileSync(filePath, 'utf8');
const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
const rows = parsed.data.filter((row) => row.Symbol && row.Symbol !== 'Symbol');
const numberValue = (value) => {
  const parsedNumber = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsedNumber) ? parsedNumber : 0;
};
const realized = rows.map((row) => numberValue(row.FifoPnlRealized));
const mtm = rows.map((row) => numberValue(row.MtmPnl));
const commissions = rows.map((row) => numberValue(row.IBCommission));
const winners = realized.filter((value) => value > 0);
const losers = realized.filter((value) => value < 0);
const nonZero = realized.filter((value) => value !== 0);
const sum = (values) => values.reduce((total, value) => total + value, 0);
const avg = (values) => (values.length ? sum(values) / values.length : 0);
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

console.table({
  validTradeRows: rows.length,
  totalRealizedPnl: round(sum(realized)),
  tradeMtmPnl: round(sum(mtm)),
  totalCommissions: round(sum(commissions)),
  winners: winners.length,
  losers: losers.length,
  realizedWinLossRows: nonZero.length,
  winRatePct: round((winners.length / Math.max(1, nonZero.length)) * 100),
  averageWinner: round(avg(winners)),
  averageLoser: round(Math.abs(avg(losers))),
  payoffRatio: round(avg(winners) / Math.abs(avg(losers))),
  profitFactor: round(sum(winners) / Math.abs(sum(losers))),
});
