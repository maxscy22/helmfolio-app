# Helmfolio — Frequently Asked Questions

## 🔒 Privacy & Security (Why Helmfolio is different)

### Where is my data stored? Does anything get uploaded to the cloud?

Everything stays on your own computer. Helmfolio is a **local desktop application** — your trades, open positions, NAV history, cash transactions, and settings are saved **only on your machine**, never on our servers and never in the cloud.

There is no account to create, no data to sync to a backend, and nothing for us to leak — because we never receive your data in the first place.

### Is my IBKR Flex Token safe with Helmfolio?

Yes. Your **Flex Token** and **Query ID** are stored **on your own computer, encrypted by your operating system** (via Electron's `safeStorage`). They are never written in plaintext, never bundled into the app, and never uploaded anywhere.

When you sync, your computer talks **directly to Interactive Brokers' official Flex Web Service over HTTPS**. There is no middleman server and no cloud relay — your credentials and trading data go straight from your machine to IBKR and back.

### So you (the developer) can't see my trades or positions?

Correct. We have **no access** to your portfolio, your P/L, your account balance, or your IBKR credentials. That data physically never leaves your computer, so there is nothing for us — or anyone else — to look at, sell, or expose.

### If everything is local, why does the app ever go online?

Only two reasons, and neither involves your sensitive data:

1. **Public market data** — to fetch benchmark prices (NASDAQ, S&P 500) and free market-sentiment indicators (VIX, CNN Fear & Greed, AAII). This is the same public data anyone can look up online.
2. **License verification (Pro only)** — to confirm your Pro license key is valid. When this happens, the only things sent to our license server are your **license key** and an **anonymous, hashed device ID**. **No trading data, no personal financial information, ever.**

### Can I use Helmfolio offline?

Yes. Your data and all analytics work completely offline. A Pro license re-verifies online **periodically (about once a day)**; in between, the app keeps working without an internet connection.

### Can I back up my data or move it to another computer?

Yes. Because all your data lives on your own machine, you stay in full control of it. In **Settings** you can **export your full dataset to a single JSON file** — every trade, position, NAV snapshot and cash transaction — and **import** it on any other computer to pick up exactly where you left off. You can also open the local data folder from Settings to copy or archive it yourself. Nothing is locked to the cloud.

---

## 📈 Getting Started & Brokers

### Do you support other brokers like Charles Schwab or Robinhood?

No. To deliver the deepest and most accurate performance tracking possible, Helmfolio is engineered **exclusively for Interactive Brokers (IBKR)**, using their robust **Flex Query** system. We would rather do one broker exceptionally well than many brokers superficially.

### What do I need to connect my IBKR account?

Two things from your IBKR Client Portal: a **Flex Web Service Token** and an **Activity Flex Query ID**. The in-app setup guide (and our website guide) walks you through generating both in about 3 minutes. You paste them once into Settings — encrypted on your machine — and then sync with one click.

### How much history can I analyze?

Helmfolio is built around IBKR's **365-day** Flex window, and it **merges every sync into a growing local history** — duplicate trades are automatically skipped — so your performance record keeps building over time on your own machine.

---

## 💳 Pricing & License

### Do I need to pay for a subscription?

You can download Helmfolio and use the **free tier** at no cost — including CSV/manual import, core profit & loss, and free market-sentiment indicators.

To unlock the full performance desk — **one-click IBKR auto-sync, risk metrics (Sharpe, max drawdown), benchmark comparison, advanced KPIs (win rate, payoff ratio, profit factor), and themed PDF reports** — you can upgrade to **Pro — $129/year**, or **$99/year for the first 100 customers** with our founding-member discount code at checkout.

### What's included free vs. Pro?

| | Free | Pro |
| --- | :---: | :---: |
| CSV & manual import + core P/L | ✅ | ✅ |
| Market sentiment — VIX, Fear & Greed, AAII | ✅ | ✅ |
| IBKR one-click auto-sync | — | ✅ |
| Risk metrics — Sharpe, max drawdown | — | ✅ |
| Benchmark vs. NASDAQ & S&P 500 | — | ✅ |
| Advanced KPIs — win rate, payoff, profit factor | 🔒 | ✅ |
| Themed PDF report export | — | ✅ |

### Can I use my license on more than one computer?

Yes. A single Pro license can be activated on **2 of your personal devices** (for example, a desktop and a laptop). Switching to a new machine? Just **deactivate** the old device inside the app first to free up a seat, then activate on the new one.

### What happens if my license lapses or expires?

Nothing dramatic, and **you never lose your data**. The app simply drops back to the free tier — your trades, history, and core P/L remain on your machine. Renew any time to re-unlock Pro analytics.

---

## 👤 About

### Who is behind Helmfolio?

Helmfolio is built by **Max Shing**, an independent fintech developer based in **Hong Kong**. It was born out of frustration with IBKR's native reporting interface — so it's designed by a trader, for traders.

### Is Helmfolio affiliated with Interactive Brokers?

No. Helmfolio is an independent tool and is **not affiliated with, endorsed by, or sponsored by Interactive Brokers**. "Interactive Brokers" and "IBKR" are trademarks of their respective owner.

### Is this financial advice?

No. Helmfolio is for **informational and analytical purposes only** and is **not financial, investment, or tax advice**. All figures are estimates derived from the data you import and may differ from your broker's official records.
