# Dashboard Changelog

## v1.3.81 - 2026-05-30

- Added the ranked "Rank" column (with #1/#2/#3 medal icons and gold/silver/bronze colors) to the Top Winning Symbols and Top Losing Symbols tables, matching the Symbol Leaderboard. Enabled via the existing `showRank` prop on `SymbolTable`.

## v1.3.80 - 2026-05-30

- Added a detail box to the "Total Commissions" card. Clicking its info icon now shows a breakdown of total gross traded value (sum of buy + sell value across all symbols) vs total commissions, plus commission drag % and commissions-vs-realized-P/L %.

## v1.3.79 - 2026-05-30

- Fixed garbled text in the Sharpe Ratio detail box formula. The annualization factor displayed as `? ??52` (mojibake) and now correctly reads `(average daily cash-flow-adjusted return / daily return standard deviation) × √252`. Verified the underlying calculation in `src/lib/risk.ts` is a correct annualized Sharpe (sample standard deviation, risk-free rate = 0, ×√252) on cash-flow-adjusted daily NAV returns.

## v1.3.78 - 2026-05-30

- Fixed IBKR Flex NAV daily rows being silently dropped, which caused the Equity Curve & P/L Trend to not update from Flex syncs (only CSV worked). The "Net Asset Value (NAV) in Base" section nests daily rows as `EquitySummaryByReportDateInBase` inside an `EquitySummaryInBase` container, but `extractNavRows` previously treated `EquitySummaryByReportDateInBase` as a container expecting `EquitySummary` children. Added the correct element paths (`EquitySummaryInBase > EquitySummaryByReportDateInBase`, `EquitySummary > EquitySummaryByReportDate`) and added these row element names to `collectNestedRows`, so daily NAV rows are now parsed from Flex sync.

## v1.3.77 - 2026-05-28

- Refined cycle detail popover positioning to cap the y position at maxY (window.innerHeight - 448 - 16) instead of moving fully above the clicked cell. When the below position would touch the bottom edge, the popover now moves just high enough to clear the bottom, staying closer to the click spot.

## v1.3.76 - 2026-05-28

- Changed cycle detail popover positioning to default below the clicked cell (rect.bottom + 10). Only position above (rect.top - 448 - 10) if the below position would touch the bottom of the screen (yBelow + 448 > window.innerHeight) and there's space above (yAbove >= 16). This keeps the popover below the click spot unless it would go off-screen.

## v1.3.75 - 2026-05-28

- Centered cycle detail popover horizontally on screen at (window.innerWidth - 1152) / 2. Positioned above the clicked cell when there's space (rect.top - 448 - 10), otherwise below (rect.bottom + 10) to avoid covering the click spot. Increased width to 72rem to display all 14 columns including Return % and Annualized Return %.

## v1.3.74 - 2026-05-28

- Fixed cycle detail popover not appearing by reverting to original positioning logic and width (48rem). Removed scroll-following logic that was causing rendering issues. Popover now appears at the clicked cell position (rect.left, rect.bottom + 10) with the original working width, displaying all 14 columns including Return % and Annualized Return %.

## v1.3.73 - 2026-05-28

- Fixed cycle detail popover positioning to work correctly with fixed CSS positioning. Removed scroll-following logic that was causing the popover to appear off-screen. Popover now appears centered horizontally and slightly below the clicked Cycle Win Rate cell using viewport-relative coordinates (rect.bottom + 10, no scrollY offset).

## v1.3.72 - 2026-05-28

- Fixed cycle detail popover not appearing when clicked. Changed initialScrollY from useState to useRef to avoid dependency issues in the scroll-following useEffect. The popover now correctly appears and follows page scroll.

## v1.3.71 - 2026-05-28

- Fixed cycle detail popover to follow page scroll instead of sticking to viewport edge. Previously the fixed-position popover would not move when scrolling the page. Now it tracks scroll delta and adjusts its y position accordingly, staying positioned relative to the clicked element even as the user scrolls.

## v1.3.70 - 2026-05-28

- Centered cycle detail popover horizontally on screen while keeping vertical position slightly below the clicked Cycle Win Rate cell. Previously the popover appeared near the click position, which could be off-center. Now it always appears centered at (window.innerWidth - 1152) / 2 with y = rect.bottom + 10.

## v1.3.69 - 2026-05-28

- Increased cycle detail popover width from 48rem to 72rem to display all 14 columns (including the new Return % and Annualized Return %) without horizontal scrolling. Updated positioning offset to prevent the wider box from going off-screen.

## v1.3.68 - 2026-05-28

- Added Return % and Annualized Return % columns to the cycle detail popover (accessed by clicking Cycle Win Rate in Top Losing Symbols, Top Winning Symbols, and Symbol Leaderboard). Return % = (realized P/L / total IN) × 100. Annualized Return % = ((1 + return) ^ (365 / holding days) - 1) × 100. Both values are color-coded green for positive, red for negative.

## v1.3.67 - 2026-05-27

- Changed Equity Curve & P/L Trend layout from 2-column grid to stacked layout (1 graph per row) for better width and label visibility. Increased chart heights from h-80 to h-96 for more detail. Reduced XAxis minTickGap to allow more month labels to display in the wider layout.

## v1.3.65 - 2026-05-27

- Fixed Equity Curve to start counting from the investment start date (effectiveBenchmarkStartDate or DEFAULT_BENCHMARK_START_DATE = 2025-07-01). Previously the chart and NAV return calculation included all historical data from the earliest available date, which could predate the actual investment start. Now equityCurveData filters out points before the configured start date.
- Recalculated NAV return percentage to use the first NAV row on or after the investment start date instead of the earliest NAV row. This ensures the displayed "total NAV return X%" in the Equity Curve section matches the filtered chart data.

## v1.3.64 - 2026-05-27

- Expanded the `Withholding Tax Refunded` detail popover to include a past-12-month refund table with date, symbol, native amount, currency, base-currency value, and a totals row. Empty state shows 'No withholding tax refunds detected in the past 12 months.'
- Added `withholdingTaxRefundDetailRows(cashRows, monthsWindow)` helper to `src/lib/cashFlow.ts` returning positive-amount `Withholding Tax` rows within the trailing window, sorted newest first.

## v1.3.63 - 2026-05-27

- Added `Withholding Tax Refunded` KPI card to the Cash Income & Cost Leakage section. Shows the total amount of positive `Withholding Tax` Cash Transactions rows (refunds, reversals, or treaty-rate adjustments), the refunded-to-gross-withheld percentage, and a detail popover with the gross/refunded/net breakdown plus guidance on treaty relief.
- Extended `cashTransactionInsights` in `src/lib/cashFlow.ts` to split `Withholding Tax` rows into `withholdingTaxGross` (negative-amount deductions) and `withholdingTaxRefunds` (positive-amount refunds). The existing `withholdingTax` field stays as the net sum and remains backward-compatible.
- Bumped Cash Income KPI grid to `xl:grid-cols-5` so the new card sits inline with the existing four.

## v1.3.62 - 2026-05-27

- Fixed Unicode mojibake characters introduced by PowerShell encoding during the round 2 refactor: 18 occurrences of `繚` restored to proper middle-dot `·`, and 11 occurrences of `??` restored to proper en-dash `–`, minus sign `−`, or right-arrow `→` depending on semantic context (date ranges, NAV before/after, formula text). Affected labels include Review period, VIX/Fear & Greed/CNN subtitles, NAV cash field source, Max Drawdown Audit date range and equity transitions, sync diff banner NAV change, largest winning/losing cycle date ranges, Total Unrealized P/L formula (Σ, ×), trade cycle table date columns.

## v1.3.61 - 2026-05-27

- Round 2 refactor: extracted 8 more modules from App.tsx, dropping it from 3,032 to 1,990 lines (40% smaller vs original 3,344).
  - src/lib/themes.ts: 9 theme presets and ThemePreset type.
  - src/lib/risk.ts: calculateRiskMetrics, benchmarkReturnsFromStart, BenchmarkPoint, RiskMetrics types.
  - src/lib/persistence.ts: STORAGE_KEY/SETTINGS_KEY/AAII_MANUAL_KEY constants, DEFAULT_INITIAL_FUNDING/DEFAULT_BENCHMARK_START_DATE, PersistedDashboardData/PersistedDashboardSettings/BrowserStorageUsage/AaiiSentimentRow types, tradeDedupKey/navDedupKey/cashDedupKey/positionDedupKey, mergeUniqueRows/dedupeRows, AAII manual sentiment helpers, loadPersistedDashboardData/loadPersistedDashboardSettings.
  - src/lib/rawRow.ts: canonicalRawKey, rawValueByAliases, rawStringByAliases, normalizedRawStringByAliases, normalizedTradeId, rawDateByAliases, rawDateTimeByAliases, rawNumberByAliases, stableRowSignature, isSamplePreviewRow, withoutSamplePreviewRows.
  - src/lib/storage.ts: bytesForStorageValue, formatStorageMb, measureLocalStorageBytes, measureBrowserStorageUsage.
  - src/lib/syncDiff.ts: SyncDiff type and buildSyncDiff helper.
  - src/lib/trades.ts: tradeDateKey, tradeSideLabel.
  - src/components/SymbolTable.tsx: symbol stats table with click-through cycle popover.
  - src/components/MonthlyPnlCalendar.tsx: monthly calendar grid with weekly totals and fill-details popover.
  - src/components/SettingsModal.tsx: settings modal with theme picker, portrait upload, changelog, storage usage, and danger zone.
- All 8 analytics unit tests still pass.

## v1.3.60 - 2026-05-27

- Improved text readability for Miami Neon and Sunrise Gold themes by softening bright radial gradients, adding solid panel/section backgrounds, and applying a subtle text shadow for separation against accents.
- Added 'What changed since last sync' banner under the IBKR sync status showing new trades, NAV change, dividends, withholding tax, interest, deposits, and withdrawals captured by the latest sync.
- Added sticky section navigation bar (Markets, Snapshot, Open Book, Equity, Benchmark, Risk, Symbols, Calendar, Asset Class, Cycles, Cash, Import) with anchor links and scroll-offset padding.
- Added Vitest test harness with 8 unit tests covering trade cycle building, partial-exit handling, bond/cash-yield exclusion, winners/losers sorting, monthly aggregation, multi-buy single-sell cycles, and profit factor / payoff ratio. Added 'npm test' and 'npm run test:watch' scripts.
- Refactored App.tsx into modules: extracted src/lib/formatters.ts (money, percent, dateMonthLabel, etc.), src/components/StatCard.tsx (stat card component with detail popover), and src/lib/cashFlow.ts (NAV curve helpers, cash transaction analytics, cumulative withdrawals, navEstimateFromPositions).

## v1.3.59 - 2026-05-27

- Replaced the NAV Residual Estimate KPI in Open Positions Insight with Total Unrealized P/L showing dollar P/L across open positions plus return % on cost basis and a detail popover explaining the formula.

## v1.3.58 - 2026-05-27

- Period Benchmark Comparison 'To date' input now defaults to the latest available data date instead of appearing empty, matching the chart end date.

## v1.3.57 - 2026-05-27

- Fixed ambiguous month-year axis labels (e.g., Period Benchmark Comparison showing 'Jul 25') by switching dateMonthLabel to 4-digit year (Jul 2025). Equity curve, monthly P/L chart, dividends/interest chart, and commission breakdown tables all benefit.

## v1.3.56 - 2026-05-27

- Improved Largest Winning/Losing Trade Cycle detail date formatting: split combined IBKR YYYYMMDD;HHMMSS into Opened, Closed, and Holding rows with readable YYYY-MM-DD HH:MM format; subtitle also uses normalized dates.

## v1.3.55 - 2026-05-27

- Made Largest Winning/Losing Trade Cycle fair by switching to the analytics-filtered cycle ranking that already excludes bond/cash-yield symbols (SGOV, IB01) and zero-PnL cycles.
- Added Trade Cycle Detail popover to Largest Winning Trade Cycle and Largest Losing Trade Cycle stat cards showing symbol, period and holding days, trades/orders/fills, buy/sell quantities, average prices, totals, commissions, realized P/L, and result.

## v1.3.54 - 2026-05-27

- Added a past-12-months monthly commission breakdown table inside the Commission / Realized P/L stat card detail popover showing each month's trades, commission in USD, share of the 12-month total, and a totals row.

## v1.3.53 - 2026-05-27

- Added a withdrawal breakdown table inside the Net Deposits / Withdrawals stat card detail popover showing each contributing row's date, currency, original amount, base USD value, and description for easier reconciliation.

## v1.3.52 - 2026-05-27

- Restored automatic AAII Investor Sentiment Survey live updates by switching the backend primary fetcher to the official AAII historical Excel file (sentiment.xls) parsed with SheetJS, bypassing the Incapsula bot wall on the HTML page. The HTML scrape now acts as a fallback and the manual override and fallback snapshot remain as final safety nets.

## v1.3.51 - 2026-05-27

- Removed Cash Balance KPI card from Open Positions Insight and added a dedicated Cash row in the Open Positions Insight portfolio table so cash sits alongside other holdings at a glance.

## v1.3.50 - 2026-05-27

- Added Cash Balance display to Open Portfolio (header badge and table footer row) and Open Positions Insight (new Cash Balance stat card) using the latest IBKR NAV cash field, falling back to NAV − open positions estimate when not available.

## v1.3.49 - 2026-05-27

- Fixed top-of-dashboard Review Period end date being limited to the latest trade date by extending it to the latest of trades, NAV, and cash transaction dates so it auto-updates with new IBKR/CSV imports.

## v1.3.48 - 2026-05-26

- Fixed Period Benchmark Comparison end date stopping at the last IBKR NAV snapshot (e.g., 2026-05-15) instead of the latest trade/portfolio date by using the maximum of NAV last date and portfolio curve last date.

## v1.3.47 - 2026-05-21

- Changed the AAII manual sentiment date entry to a calendar date picker and normalized edited AAII dates into the picker format.

## v1.3.46 - 2026-05-21

- Limited manual AAII sentiment history to the latest 4 rows by date, automatically dropping the oldest stored row when a newer manual row is added.

## v1.3.45 - 2026-05-21

- Added a compact manual AAII sentiment editor in the existing AAII panel for adding or editing weekly date, bullish %, neutral %, and bearish % rows.
- Saved manual AAII rows in browser localStorage and merged them over fetched/fallback AAII history by date, with row-level edit/remove controls and a manual override label.

## v1.3.44 - 2026-05-21

- Updated the AAII fallback sentiment snapshot to the confirmed 5/20/2026 values: Bullish 31.7%, Neutral 24.7%, Bearish 43.6%.
- Added explicit AAII bot-protection detection so the dashboard explains when live AAII retrieval is blocked and fallback/cached data is being shown.

## v1.3.43 - 2026-05-21

- Changed Market Reference Data loading to force a fresh backend fetch whenever the dashboard opens, so AAII Investor Sentiment Survey is not held back by the 6-hour in-memory cache.
- Added cache-busting request headers and query parameters to the AAII sentiment fetch while preserving cached/fallback data only when live AAII retrieval fails.

## v1.3.42 - 2026-05-21

- Added a Browser storage panel in Settings showing saved dashboard data size, settings size, total localStorage usage, browser origin storage usage/quota, and an IndexedDB migration rule of thumb.
- Reverted trade cycle analytics back to the original closed-cycle method where cycles close only when running symbol quantity returns to zero, restoring prior payoff ratio and profit factor behavior.
- Added CSV import loading feedback and basic missing-section validation messages, and wrapped expensive dashboard calculations in memoized selectors.

## v1.3.41 - 2026-05-17

- Added Cash Transactions extraction to IBKR Flex sync and updated the sync status message to show new/duplicate cash transaction counts and saved cash history totals.

## v1.3.40 - 2026-05-17

- Reworked AAII Investor Sentiment Survey into a fetched Market Reference Data source with backend caching, stale/fallback handling, and a full-width stacked bullish/neutral/bearish sentiment bar below VIX and CNN Fear & Greed.

## v1.3.39 - 2026-05-17

- Added an AAII Investor Sentiment Survey panel below VIX and CNN Fear & Greed, including weekly bullish/neutral/bearish votes, historical averages, and one-year sentiment highs.

## v1.3.38 - 2026-05-17

- Reordered dashboard sections into the fixed priority flow: hero/import snapshot, main KPIs, risk metrics, Max Drawdown Audit, Cash Income & Cost Leakage, Open Positions Insight, Equity/P&L Trend, Benchmark Comparison, then symbol/monthly/asset analytics and trade detail tables.

## v1.3.37 - 2026-05-17

- Moved the Cash Income & Cost Leakage section lower in the dashboard, below the Period Benchmark Comparison.
- Fixed Period Benchmark portfolio performance to remove deposits/withdrawals inside the selected period, so cash withdrawals are no longer treated as investment underperformance.

## v1.3.36 - 2026-05-17

- Added residual NAV cash to the Open Positions Insight cards and table so the insight section includes cash alongside open positions.

## v1.3.35 - 2026-05-17

- Added NAV and Cash Transactions counts to the current saved database panel.
- Added cash as a residual NAV row in the Open Portfolio snapshot so portfolio weights include cash alongside open positions.

## v1.3.34 - 2026-05-17

- Added Cash Income & Cost Leakage section using IBKR Cash Transactions with Gross Dividends, Withholding Tax Rate, Fee Drag, Interest & Other Fees cards, plus a monthly stacked cash income/drag chart.

## v1.3.33 - 2026-05-17

- Added a Max Drawdown Audit panel showing raw NAV drawdown, withdrawals inside the peak-to-trough path, and the final cash-flow-adjusted equity bridge used for the displayed drawdown.

## v1.3.32 - 2026-05-17

- Corrected Max Drawdown cash-flow adjustment to compare cumulative cash-flow-adjusted NAV, so withdrawals between the peak and trough reduce the cash-flow impact across all later drawdown points.

## v1.3.31 - 2026-05-17

- Fixed cash-flow-adjusted Max Drawdown to assign each withdrawal to the next available NAV date, ensuring November and future withdrawals are removed from drawdown calculations even when cash transaction dates do not exactly match NAV dates.

## v1.3.30 - 2026-05-17

- Added Max Drawdown peak/trough dates, cash-flow-adjusted peak/trough equity values, and estimated holdings on the trough date in the Max Drawdown detail popup.

## v1.3.29 - 2026-05-17

- Updated Cash Transactions cash-flow adjustment to exclude initial funding deposits and use only negative Deposits/Withdrawals withdrawal rows converted to base currency.

## v1.3.28 - 2026-05-17

- Added full IBKR Cash Transactions parsing and persistence.
- Switched Net Deposits / Withdrawals plus cash-flow-adjusted Sharpe Ratio and Max Drawdown to use dated Cash Transactions rows where Type is Deposits/Withdrawals, converted to base currency with FXRateToBase.

## v1.3.27 - 2026-05-17

- Reworked cash-flow section detection to match any cleaned CSV header containing DepositsWithdrawals with FromDate and ToDate, regardless of row prefix.
- Added parser and accumulator console traces for DepositsWithdrawals rows reaching Net Deposits / Withdrawals.

## v1.3.26 - 2026-05-17

- Verified the real IBKR Change in NAV header uses DepositsWithdrawals and updated cash-flow parsing/display aliases to use that exact key.

## v1.3.25 - 2026-05-17

- Hardened Change in NAV CSV matching by stripping double quotes before prefix checks and logging matched Change in NAV rows for traceability.

## v1.3.24 - 2026-05-17

- Fixed stacked IBKR CSV parsing to explicitly read Change in NAV Header/Data rows and extract dated Deposits/Withdrawals cash flows.

## v1.3.23 - 2026-05-17

- Corrected the IBKR cash-flow column name to prioritize the exact Deposits/Withdrawals field when parsing Change in NAV rows.

## v1.3.22 - 2026-05-17

- Parsed all dated IBKR Change in NAV Deposits/Withdrawals rows and display their cumulative sum in Net Deposits / Withdrawals.
- Cash-flow adjusted Sharpe Ratio and Max Drawdown by removing dated deposits and withdrawals from NAV return/drawdown calculations.
- Fixed withdrawal-driven NAV drops being treated as investment drawdowns, including the inflated withdrawal-related drawdown issue.

## v1.3.21 - 2026-05-16

- Moved IBKR sync status directly below the Sync button and added estimated progress percentage with phase-specific messages.

## v1.3.20 - 2026-05-16

- Updated IBKR Flex import to use the current official Flex Web Service endpoint and a safer SendRequest once, wait, then GetStatement polling flow.
- Added backend protection against overlapping IBKR Flex imports so repeated clicks do not start multiple statement generations.
- Added configurable initial wait support before polling IBKR GetStatement to reduce pacing pressure.

## v1.3.19 - 2026-05-15

- Changed Cycle Win Rate average buy and sell prices to display cents, such as $123.45.

## v1.3.18 - 2026-05-15

- Fixed StatCard detail popups so market reference details can be dragged, closed, and dismissed without immediately re-opening.

## v1.3.17 - 2026-05-15

- Changed Cycle Win Rate Date In / Date Out formatting to day-month-year style, such as 11 Aug, 2025.

## v1.3.16 - 2026-05-15

- Updated Cycle Win Rate Date In / Date Out display to show human-readable date and time when IBKR trade timestamps include time.

## v1.3.15 - 2026-05-15

- Improved Cycle Win Rate detail dates in the symbol leaderboards with compact Date In / Date Out formatting and holding-days context.

## v1.3.14 - 2026-05-15

- Added quantity, average buy price, and average sell price columns to Top Winning Symbols, Top Losing Symbols, and Symbol Leaderboard.
- Changed Cycle Win Rate details to open on click and expanded cycle details with trade count, buy/sell quantities, average buy/sell prices, result, and realized P/L.

## v1.3.13 - 2026-05-15

- Moved Open Positions Insight above Equity Curve & P/L Trend to prioritize current holdings and exposure review.

## v1.3.12 - 2026-05-15

- Removed the Account NAV KPI card and NAV count badge from the dashboard for the Trades + Open Positions workflow.
- Removed NAV-specific summary KPIs from the PDF export summary.

## v1.3.11 - 2026-05-15

- Added cash-flow impact warnings to Sharpe Ratio and Max Drawdown when NAV data includes aggregate DepositsWithdrawals but no dated daily cash-flow rows.
- Risk metric cards now explicitly label NAV-based Sharpe and Max Drawdown as cash-flow unadjusted when exact dated withdrawals/deposits are unavailable.

## v1.3.10 - 2026-05-15

- Improved Monthly Change in NAV and Recent Weekly Change in NAV hover behavior with active bar highlighting and tooltips that show the exact hovered period amount.

## v1.3.9 - 2026-05-15

- Corrected Sharpe Ratio and Max Drawdown to use the funded review-period equity curve instead of the full raw NAV history, avoiding distortion from pre-funding NAV ramp-up rows.
- Sharpe Ratio and Max Drawdown cards now display the exact risk period and NAV row count used for the calculation.

## v1.3.8 - 2026-05-15

- Added an Account NAV KPI and clarified NAV-based versus trade-based performance labels now that full daily NAV history is imported.
- Cash-flow card now prefers IBKR DepositsWithdrawals when available and falls back to the previous estimated transfer formula only when needed.
- Updated Max Drawdown, equity curve, and PDF wording to reflect whether calculations are using downloaded NAV or fallback realized-P/L equity.

## v1.3.7 - 2026-05-15

- Fixed NAV imports for IBKR CSV files where daily account-value history is provided as the opening account summary section using ReportDate and Total columns.
- Change in NAV trend bars now calculate day-to-day NAV movement when the daily NAV section has account values but no explicit Change in NAV column.

## v1.3.6 - 2026-05-15

- Added the Clear Data button back under Settings > Danger Zone to remove imported dashboard data while keeping display settings.

## v1.3.5 - 2026-05-15

- CSV imports now capture IBKR NAV rows including StartingValue, EndingValue, Net Asset Value(NAV) in base, and Change in NAV aliases.
- Equity curve, benchmark comparison, Sharpe Ratio, Max Drawdown, and weekly/monthly trend bars now prefer downloaded NAV data when available.

## v1.3.4 - 2026-05-15

- Bond Yield Profit detail popup now shows separate SGOV and IB01 realized P/L, trades, and commissions.

## v1.3.3 - 2026-05-15

- Upgraded Emerald Vault, Royal Indigo, Graphite Pro, Sunrise Gold, Rose Risk, and Ocean Glass with richer premium styling while keeping Command Center unchanged.

## v1.3.2 - 2026-05-15

- Added three limited-edition dashboard themes: Noir Luxe, Miami Neon, and Arctic Aurora.

## v1.3.1 - 2026-05-15

- Project backup now also saves a separate dashboard JSON backup in the selected target folder root, outside the copied project folder.

## v1.3.0 - 2026-05-15

- Added Equity Curve and weekly/monthly realized P/L trend charts.
- Added IBKR Flex request timeout, retry, and polling safeguards for unstable or delayed Flex responses.
- Treated IB01 like SGOV as a bond/cash-yield product for KPI exclusions and Asset Class Realized P/L contribution.

## v1.2.1 - 2026-05-15

- Updated Period Benchmark Comparison chart to keep daily line data while showing monthly X-axis ticks and labels.

## v1.2.0 - 2026-05-15

- Added Period Benchmark Comparison to the exported PDF report.
- Fixed benchmark chart tooltip labels to show Portfolio, NASDAQ, and S&P 500 instead of repeated Return labels.

## v1.1.9 - 2026-05-15

- Added explicit Top Winners and Top Losses sections to the exported PDF report.
- PDF Top Symbols are now sorted by absolute realized P/L impact.

## v1.1.8 - 2026-05-15

- Added a constrained scroll area to the Open Portfolio table so long holdings lists do not stretch the dashboard header too far.

## v1.1.7 - 2026-05-15

- Replaced the Open Position Snapshot summary cards with an Open Portfolio stocks-on-hand table.
- Open Portfolio now shows symbol, quantity, market value, unrealized P/L, return, and portfolio weight.

## v1.1.6 - 2026-05-15

- Added an Open Position Snapshot below Portfolio Snapshot in the dashboard header.
- Open Position Snapshot shows open position count, unrealized P/L, largest exposure, and best/worst open P/L.

## v1.1.5 - 2026-05-15

- Updated CNN Fear & Greed from a 3-color scale to a 5-level emotion color scale.

## v1.1.4 - 2026-05-15

- Added color emotion guides to the VIX Index and CNN Fear & Greed detail popups.

## v1.1.3 - 2026-05-15

- Project backup folder names now include the dashboard version number.

## v1.1.2 - 2026-05-15

- Fixed repeated browser-restore messages accumulating in the dashboard status text after each reload.
- Saved import status now removes old restore suffixes before writing to browser storage.

## v1.1.1 - 2026-05-15

- Improved project backup error handling when the local backend has not been restarted after an update.
- Backup Project Now now explains that `Open Dashboard.bat` should be reopened instead of showing a raw JSON parse error.

## v1.1.0 - 2026-05-15

- Added dashboard version display in Settings.
- Added changelog display in Settings.
- Added project-folder backup workflow from Settings.
- Removed built-in sample/demo trades so empty dashboards stay clean.
- Moved Market Reference Data into the header area above Portfolio Snapshot.
- Added market emotion colors for VIX and CNN Fear & Greed.

## v1.0.0 - Before 2026-05-15

- Initial personalized IBKR trading dashboard with CSV import, IBKR Flex sync, JSON export/import, themed PDF export, performance analytics, market references, and backup/restore data support.
