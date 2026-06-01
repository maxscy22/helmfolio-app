# 💡 Quick Setup: Connect Helmfolio to Your IBKR Account

To ensure absolute privacy, Helmfolio operates 100% locally on your machine. We never store, transmit, or see your trading data. Follow this 3-minute guide to securely generate your **Flex Token** and **Query ID** from Interactive Brokers to activate your performance desk.

> **Note:** Interactive Brokers occasionally changes its Client Portal layout, so menu names and paths below may differ slightly depending on your IBKR version. The section names and field values, however, are what matter for Helmfolio.

---

## 🗺️ Navigation Path

First, log in to your **IBKR Client Portal** (Web Version) and navigate to:

👉 **Performance & Reports** ➔ **Flex Queries**

*(Depending on your IBKR version, Flex Web Service may also appear under **Settings ➔ Account Settings ➔ Flex Web Service**.)*

---

## 🔑 Step 1: Generate Your Secure Flex Token

On the Flex Queries dashboard, look for the **Flex Web Service** section:

1. Click **Configure** on the Flex Web Service gear.
2. Click **Generate New Token** (if you don't have one active).
3. Select the expiration period you prefer.
4. Copy the generated **Token** (save it in a secure temporary note).
5. Click **Save** and go back to the main **Flex Queries** dashboard.

---

## 📊 Step 2: Create the Helmfolio Activity Flex Query

Under the **Activity Flex Query** section, click the **`+` (Create)** icon and configure as follows:

1. **Query Name:** Enter `Helmfolio_Sync` (or any name you prefer).
2. **Sections to Include:** Click into each of the following sections and select **ALL sub-items** (check all boxes):
   * `1. Trades` — **required**
   * `2. Open Positions` — **required**
   * `3. Cash Transactions` — **required**
   * `4. Change in NAV` — **required**
   * `5. Net Asset Value (NAV) in Base` — **required**
   * `6. Corporate Actions` — **Optional.** Helmfolio does not use this today, but including it future-proofs your data so stock-split adjustments can be supported later. Safe to include or skip.

3. **Delivery Configuration:**
   * **Models:** Optional (leave blank/Default)
   * **Format:** `XML` *(CRITICAL: Helmfolio only reads XML — do not choose CSV/Text.)*
   * **Period:** `Last 365 Calendar Days`

4. **General Configuration:**
   * **Date Format:** `yyyyMMdd`
   * **Time Format:** `HHmmss`
   * **Date/Time Separator:** `;` (semi-colon)
   * **Profit and Loss:** `Default`
   * **Include Offsetting Trade/Cancel Pairs?:** `No`
   * **Include Currency Rates?:** `Yes`
   * **Include Audit Trail Fields?:** `No`
   * **Display Account Alias in Place of Account ID?:** `No`
   * **Breakout by Day?:** `No`

5. Click **Save** at the bottom to complete creation.

---

## 🆔 Step 3: Extract Your Query ID

1. You will be redirected back to the **Flex Queries** dashboard.
2. Locate your newly created query name (e.g., `Helmfolio_Sync`) and click on it.
3. A pop-up or detail window will display your numeric **Query ID**. Copy it.

---

## 🚀 Step 4: Fire Up Helmfolio!

You now have the two keys needed to unlock your data:

1. Open your **Helmfolio Desktop Application** and open **Settings**.
2. Paste your **Token** and **Query ID** into the secure IBKR credentials panel and save.
3. Close Settings and click **Sync IBKR Flex Now** — welcome to your ultimate trading performance desk!
