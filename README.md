# IBKR Trade Performance Dashboard

A local React dashboard for reviewing the last 365 calendar days of IBKR Flex Query trade data.

## One-click open on Windows

Double-click `Open Dashboard.bat`.

It will start the local backend API, start the dashboard frontend, and open `http://localhost:5173` in your browser. Keep the two server windows open while using the dashboard.

## What it analyzes

- Total realized P/L, MTM P/L, commissions, taxes, and net cash
- Win rate, average winner, average loser, 盈虧比, profit factor, and expectancy
- Performance comparison against NASDAQ and S&P 500 using editable return inputs
- Monthly realized P/L trend
- Top winners and top losers for trade review
- Symbol leaderboard with win rate, P/L, and commission drag
- Asset class contribution
- Cost and execution review
- Systematic review checklist for concentration, process consistency, risk/reward, and cost control

## Secure IBKR Flex importer

The app includes a small Express backend that imports trades from IBKR Flex Web Service without exposing your token in browser JavaScript.

For accurate unrealized P/L, your IBKR Flex Query must include an open-position section such as `Open Positions` or `Positions`. The dashboard does not use the `MTM P/L` field in the `Trades` section as unrealized P/L.

1. Copy `.env.example` to `.env`.
2. Fill in:
   - `IBKR_FLEX_TOKEN`
   - `IBKR_FLEX_QUERY_ID`
3. Run `npm install`.
4. In one terminal, run `npm run api`.
5. In another terminal, run `npm run dev`.
6. Open the Vite local URL.
7. Click `Import from IBKR Flex`.

The frontend calls `/api/ibkr/flex/trades`; Vite proxies that request to the local backend at `http://localhost:8787` during development.

## CSV upload fallback

1. Export your IBKR Flex Query `Trades` section as CSV.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the local URL shown in the terminal.
5. Click `Upload IBKR CSV` and select your trades CSV.
6. Enter your portfolio return, NASDAQ return, and S&P 500 return percentages for benchmark comparison.

## Verification and export

- Run `npm run verify` to check the core trade-cycle, P/L, position, win-rate, payoff-ratio, profit-factor, and expectancy calculations.
- Use `Export Cleaned Dashboard Data` in the dashboard to download normalized trades, positions, and summary metrics as JSON for backup or debugging.

## Long-term cumulative history

- IBKR Flex can only return a rolling window such as the last 365 calendar days, so the dashboard keeps a cumulative browser-saved trade history.
- Every IBKR sync or CSV upload is merged into the existing saved history.
- Duplicate trades are skipped using IBKR trade IDs when available, with a composite fallback key for rows without trade IDs.
- NAV rows are also merged without duplicates.
- Open positions are treated as the latest current snapshot, not historical records, because old open-position rows become stale after positions close or change.
- Use `Clear Saved Browser Data` only when you intentionally want to reset the long-term saved history.

## Expected IBKR fields

The app is designed around your listed IBKR fields and currently uses these fields directly:

- `Account ID`
- `Currency`
- `Asset Class`
- `Sub Category`
- `Symbol`
- `Underlying Symbol`
- `Trade ID`
- `Date/Time`
- `Trade Date`
- `Report Date`
- `Transaction Type`
- `Exchange`
- `Quantity`
- `TradePrice`
- `Trade Money`
- `Proceeds`
- `Taxes`
- `IB Commission`
- `Net Cash`
- `Cost Basis`
- `Realized P/L`
- `MTM P/L`
- `Buy/Sell`
- `Order Type`
- `Is API Order`

## Security notes

- The dashboard runs locally in your browser.
- Do not commit `.env`.
- Do not commit IBKR CSV exports. The project ignores `*.csv`, `*.tsv`, and `*.xlsx` by default because exports can contain account IDs, positions, trade history, and P/L.
- Do not paste the IBKR token into frontend code.
- The backend reads credentials from server-side environment variables only.
- The backend binds to `127.0.0.1` by default so it is only reachable from this computer.
- CORS is restricted to the local dashboard origins `http://localhost:5173` and `http://127.0.0.1:5173` unless `CLIENT_ORIGIN` is explicitly configured.
- Use `Clear Saved Browser Data` in the dashboard if you want to remove persisted trades and positions from browser storage.
- For deployment, configure the same environment variables in the hosting provider's private secret settings.
