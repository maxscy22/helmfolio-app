import { XMLParser } from 'fast-xml-parser';

const IBKR_BASE_URL = 'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService';
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_REQUEST_ATTEMPTS = 3;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false });

const asArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableRequestError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('timeout') || message.includes('network') || message.includes('fetch failed') || message.includes('http 429') || /^ibkr request failed with http 5\d\d/.test(message);
};

const requestXmlOnce = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`IBKR request failed with HTTP ${response.status}`);
    }
    return parser.parse(text);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`IBKR request timeout after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const requestXml = async (url, { attempts = DEFAULT_REQUEST_ATTEMPTS, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, retryDelayMs = 1500 } = {}) => {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await requestXmlOnce(url, timeoutMs);
    } catch (error) {
      lastError = error;
      if (!isRetryableRequestError(error) || attempt === attempts) break;
      await wait(retryDelayMs * attempt);
    }
  }
  throw lastError;
};

const assertIbkrSuccess = (payload, stage) => {
  const response = payload?.FlexStatementResponse;
  const status = response?.Status;
  if (status && String(status).toLowerCase() !== 'success') {
    const code = response?.ErrorCode;
    const message = response?.ErrorMessage || code || 'Unknown IBKR Flex error';
    throw new Error(`${stage} failed${code ? ` (IBKR code ${code})` : ''}: ${message}`);
  }
};

const isIbkrStatementNotReady = (payload) => {
  const response = payload?.FlexStatementResponse;
  const code = String(response?.ErrorCode ?? '').trim();
  const message = String(response?.ErrorMessage ?? response?.Status ?? '').toLowerCase();
  return code === '1019' || message.includes('not ready') || message.includes('being generated') || message.includes('try again');
};

const summarizeFlexSections = (statementPayload) => {
  const statements = asArray(statementPayload?.FlexQueryResponse?.FlexStatements?.FlexStatement);
  const sections = new Set();
  statements.forEach((statement) => {
    Object.entries(statement || {}).forEach(([key, value]) => {
      if (value && typeof value === 'object') sections.add(key);
    });
  });
  if (sections.size) return Array.from(sections).sort().join(', ');
  return Object.keys(statementPayload?.FlexQueryResponse || statementPayload || {}).sort().join(', ');
};

const canonicalXmlKey = (key) => String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

const collectNestedRows = (root, containerNames, rowNames) => {
  const containers = new Set(containerNames.map(canonicalXmlKey));
  const rows = new Set(rowNames.map(canonicalXmlKey));
  const found = [];
  const visit = (node, parentKey = '') => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, parentKey));
      return;
    }
    Object.entries(node).forEach(([key, value]) => {
      const canonicalKey = canonicalXmlKey(key);
      if (containers.has(canonicalKey) && value && typeof value === 'object') {
        Object.entries(value).forEach(([childKey, childValue]) => {
          if (rows.has(canonicalXmlKey(childKey))) found.push(...asArray(childValue));
        });
      }
      if (rows.has(canonicalKey) && containers.has(canonicalXmlKey(parentKey))) {
        found.push(...asArray(value));
      }
      visit(value, key);
    });
  };
  visit(root);
  return found.filter((row) => row && typeof row === 'object');
};

const uniqueRows = (rows) => Array.from(new Set(rows));

const extractTradeRows = (statementPayload) => {
  const statements = asArray(statementPayload?.FlexQueryResponse?.FlexStatements?.FlexStatement);
  return uniqueRows(statements.flatMap((statement) => [
    ...asArray(statement?.Trades?.Trade),
    ...collectNestedRows(statement, ['Trades'], ['Trade']),
  ]));
};

const extractPositionRows = (statementPayload) => {
  const statements = asArray(statementPayload?.FlexQueryResponse?.FlexStatements?.FlexStatement);
  return uniqueRows(statements.flatMap((statement) => [
    ...asArray(statement?.OpenPositions?.OpenPosition),
    ...asArray(statement?.Positions?.Position),
    ...collectNestedRows(statement, ['OpenPositions', 'Positions'], ['OpenPosition', 'Position']),
  ]));
};

const extractNavRows = (statementPayload) => {
  const statements = asArray(statementPayload?.FlexQueryResponse?.FlexStatements?.FlexStatement);
  return uniqueRows(statements.flatMap((statement) => [
    ...asArray(statement?.EquitySummaryInBase?.EquitySummaryByReportDateInBase),
    ...asArray(statement?.EquitySummaryInBase?.EquitySummary),
    ...asArray(statement?.EquitySummary?.EquitySummaryByReportDate),
    ...asArray(statement?.EquitySummaryByReportDateInBase?.EquitySummary),
    ...asArray(statement?.EquitySummaryByReportDate?.EquitySummary),
    ...asArray(statement?.NetAssetValue?.NetAssetValueDetail),
    ...asArray(statement?.NetAssetValue?.NAV),
    ...asArray(statement?.ChangeInNAV?.ChangeInNAVDetail),
    ...collectNestedRows(
      statement,
      ['EquitySummaryByReportDateInBase', 'EquitySummaryByReportDate', 'EquitySummaryInBase', 'EquitySummary', 'NetAssetValue', 'ChangeInNAV'],
      ['EquitySummaryByReportDateInBase', 'EquitySummaryByReportDate', 'EquitySummary', 'NetAssetValueDetail', 'NAV', 'ChangeInNAVDetail'],
    ),
  ]));
};

const extractCashRows = (statementPayload) => {
  const statements = asArray(statementPayload?.FlexQueryResponse?.FlexStatements?.FlexStatement);
  return uniqueRows(statements.flatMap((statement) => [
    ...asArray(statement?.CashTransactions?.CashTransaction),
    ...asArray(statement?.CashTransaction),
    ...collectNestedRows(statement, ['CashTransactions'], ['CashTransaction']),
  ]));
};

export const fetchIbkrFlexStatement = async ({ token, queryId, maxAttempts = 30, pollMs = 10000, initialWaitMs = 20000, requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, requestAttempts = DEFAULT_REQUEST_ATTEMPTS }) => {
  if (!token || !queryId) {
    throw new Error('IBKR_FLEX_TOKEN and IBKR_FLEX_QUERY_ID are required on the server.');
  }

  const sendUrl = `${IBKR_BASE_URL}/SendRequest?t=${encodeURIComponent(token)}&q=${encodeURIComponent(queryId)}&v=3`;
  const sendPayload = await requestXml(sendUrl, { attempts: 1, timeoutMs: requestTimeoutMs });
  assertIbkrSuccess(sendPayload, 'IBKR Flex SendRequest');

  const response = sendPayload?.FlexStatementResponse;
  const referenceCode = response?.ReferenceCode;

  if (!referenceCode) {
    throw new Error('IBKR did not return a Flex reference code.');
  }

  if (initialWaitMs > 0) {
    await wait(initialWaitMs);
  }

  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const getUrl = `${IBKR_BASE_URL}/GetStatement?t=${encodeURIComponent(token)}&q=${encodeURIComponent(referenceCode)}&v=3`;
      const statementPayload = await requestXml(getUrl, { attempts: requestAttempts, timeoutMs: requestTimeoutMs });
      if (isIbkrStatementNotReady(statementPayload)) {
        throw new Error(`IBKR Flex GetStatement is not ready yet after attempt ${attempt}/${maxAttempts}.`);
      }
      assertIbkrSuccess(statementPayload, 'IBKR Flex GetStatement');
      const trades = extractTradeRows(statementPayload);
      const positions = extractPositionRows(statementPayload);
      const navRows = extractNavRows(statementPayload);
      const cashRows = extractCashRows(statementPayload);
      if (trades.length || positions.length || navRows.length || cashRows.length) {
        return { trades, positions, navRows, cashRows };
      }
      throw new Error(`IBKR accepted the Flex request and generated a statement, but the XML contained no Trades, Positions, NAV, or Cash Transactions rows. Received XML sections: ${summarizeFlexSections(statementPayload) || 'none'}. Check that the Flex Query includes Trades, Open Positions or Positions, Equity Summary or Net Asset Value, and Cash Transactions, and that the selected period contains data.`);
    } catch (error) {
      lastError = error;
      if (!String(error.message).toLowerCase().includes('not ready') && !isRetryableRequestError(error)) break;
    }
    if (attempt < maxAttempts) await wait(pollMs);
  }

  throw lastError || new Error('IBKR Flex statement was not ready before timeout.');
};
