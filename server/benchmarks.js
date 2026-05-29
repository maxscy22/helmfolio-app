import XLSX from 'xlsx';

const yahooChartUrl = (symbol, period1, period2) => {
  const params = new URLSearchParams({
    period1: String(period1),
    period2: String(period2),
    interval: '1d',
    events: 'history',
    includeAdjustedClose: 'true',
  });
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params.toString()}`;
};

const startOfYearUnix = () => Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);
const todayUnix = () => Math.floor(Date.now() / 1000);
const dateToUnix = (dateValue) => Math.floor(new Date(`${dateValue}T00:00:00Z`).getTime() / 1000);
const marketReferenceCacheTtlMs = 6 * 60 * 60 * 1000;
let marketReferenceCache = null;

const toIsoDate = (unixSeconds) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);
const stripHtml = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();
const parsePercent = (value) => {
  const parsed = Number(String(value ?? '').replace('%', '').trim());
  return Number.isFinite(parsed) ? Number(parsed.toFixed(1)) : null;
};

const aaiiSeedData = {
  sourceUrl: 'https://www.aaii.com/sentimentsurvey',
  fetchedAt: null,
  weekEnding: '5/20/2026',
  bullish: 31.7,
  neutral: 24.7,
  bearish: 43.6,
  history: [
    { weekEnding: '5/20/2026', bullish: 31.7, neutral: 24.7, bearish: 43.6 },
    { weekEnding: '5/13/2026', bullish: 39.3, neutral: 24.1, bearish: 36.6 },
    { weekEnding: '5/6/2026', bullish: 38.3, neutral: 28.7, bearish: 33.0 },
    { weekEnding: '4/29/2026', bullish: 38.1, neutral: 22.2, bearish: 39.7 },
    { weekEnding: '4/22/2026', bullish: 46.0, neutral: 19.5, bearish: 34.4 },
  ],
  historicalAverages: { bullish: 37.5, neutral: 31.5, bearish: 31.0 },
  oneYearHighs: [
    { label: 'Bullish', value: 49.5, weekEnding: '1/14/2026' },
    { label: 'Neutral', value: 31.4, weekEnding: '3/4/2026' },
    { label: 'Bearish', value: 52.0, weekEnding: '3/18/2026' },
  ],
};

const fetchYahooSeries = async (symbol, name, period1, period2) => {
  const response = await fetch(yahooChartUrl(symbol, period1, period2), {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed for ${name} with HTTP ${response.status}`);
  }
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const firstClose = closes.find((value) => typeof value === 'number' && Number.isFinite(value));
  if (!firstClose) {
    throw new Error(`Yahoo Finance returned no close prices for ${name}`);
  }
  return timestamps.map((timestamp, index) => {
    const close = closes[index];
    if (typeof close !== 'number' || !Number.isFinite(close)) return null;
    return {
      date: toIsoDate(timestamp),
      close,
      returnPct: Number((((close / firstClose) - 1) * 100).toFixed(2)),
    };
  }).filter(Boolean);
};

const fetchVix = async () => {
  const series = await fetchYahooSeries('^VIX', 'CBOE VIX', startOfYearUnix(), todayUnix());
  const latest = series[series.length - 1];
  if (!latest) throw new Error('Yahoo Finance returned no VIX prices.');
  return {
    symbol: 'INDEXCBOE: VIX',
    yahooSymbol: '^VIX',
    value: Number(latest.close.toFixed(2)),
    date: latest.date,
    ytdReturnPct: latest.returnPct,
  };
};

const fetchCnnFearGreed = async () => {
  const response = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      Referer: 'https://www.cnn.com/markets/fear-and-greed',
      Origin: 'https://www.cnn.com',
    },
  });
  if (!response.ok) {
    throw new Error(`CNN Fear & Greed request failed with HTTP ${response.status}`);
  }
  const payload = await response.json();
  const current = payload?.fear_and_greed;
  const value = Number(current?.score);
  if (!Number.isFinite(value)) {
    throw new Error('CNN Fear & Greed returned no current score.');
  }
  return {
    value: Number(value.toFixed(1)),
    rating: current?.rating || 'Unknown',
    previousClose: typeof current?.previous_close === 'number' ? Number(current.previous_close.toFixed(1)) : null,
    previous1Week: typeof current?.previous_1_week === 'number' ? Number(current.previous_1_week.toFixed(1)) : null,
    previous1Month: typeof current?.previous_1_month === 'number' ? Number(current.previous_1_month.toFixed(1)) : null,
    previous1Year: typeof current?.previous_1_year === 'number' ? Number(current.previous_1_year.toFixed(1)) : null,
    updatedAt: current?.timestamp ? new Date(current.timestamp).toISOString() : null,
  };
};

const parseAaiiRowsFromHtml = (html) => {
  const rows = [...String(html).matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => {
    const cells = [...match[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripHtml(cell[1]));
    const dateCell = cells.find((cell) => /\d{1,2}\/\d{1,2}\/\d{4}/.test(cell));
    const percentages = cells.map(parsePercent).filter((value) => value !== null);
    if (!dateCell || percentages.length < 3) return null;
    return {
      weekEnding: dateCell.match(/\d{1,2}\/\d{1,2}\/\d{4}/)?.[0] ?? dateCell,
      bullish: percentages[0],
      neutral: percentages[1],
      bearish: percentages[2],
    };
  }).filter(Boolean);
  const uniqueRows = [];
  const seenDates = new Set();
  rows.forEach((row) => {
    if (seenDates.has(row.weekEnding)) return;
    seenDates.add(row.weekEnding);
    uniqueRows.push(row);
  });
  return uniqueRows;
};

const oneYearHighsFromAaiiRows = (rows) => {
  const recentRows = rows.slice(0, 52);
  const buildHigh = (key, label) => recentRows.reduce((best, row) => row[key] > best.value ? { label, value: row[key], weekEnding: row.weekEnding } : best, { label, value: -Infinity, weekEnding: '' });
  const highs = [buildHigh('bullish', 'Bullish'), buildHigh('neutral', 'Neutral'), buildHigh('bearish', 'Bearish')];
  return highs.every((row) => Number.isFinite(row.value)) ? highs : aaiiSeedData.oneYearHighs;
};

const excelSerialToDate = (serial) => {
  if (!Number.isFinite(serial)) return null;
  const epochMs = Date.UTC(1899, 11, 30) + Number(serial) * 86400000;
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
};

const decimalToPercent = (value) => {
  if (!Number.isFinite(value)) return null;
  return Number((Number(value) * 100).toFixed(1));
};

const parseAaiiRowsFromXls = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames.find((name) => /sentiment/i.test(name)) ?? workbook.SheetNames[0];
  if (!sheetName) return { rows: [], bullishHistoricalAverage: null };
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  const parsed = [];
  let bullishHistoricalAverage = null;
  matrix.forEach((row) => {
    const serial = row?.[0];
    const bullishDecimal = row?.[1];
    const neutralDecimal = row?.[2];
    const bearishDecimal = row?.[3];
    if (!Number.isFinite(serial) || !Number.isFinite(bullishDecimal) || !Number.isFinite(neutralDecimal) || !Number.isFinite(bearishDecimal)) return;
    const weekEnding = excelSerialToDate(serial);
    const bullish = decimalToPercent(bullishDecimal);
    const neutral = decimalToPercent(neutralDecimal);
    const bearish = decimalToPercent(bearishDecimal);
    if (!weekEnding || bullish === null || neutral === null || bearish === null) return;
    if (bullishHistoricalAverage === null && Number.isFinite(row?.[7])) {
      bullishHistoricalAverage = decimalToPercent(row[7]);
    }
    parsed.push({ weekEnding, bullish, neutral, bearish, sortKey: Number(serial) });
  });
  const sorted = parsed.sort((a, b) => b.sortKey - a.sortKey).map(({ sortKey, ...rest }) => rest);
  return { rows: sorted, bullishHistoricalAverage };
};

const fetchAaiiSentimentXls = async () => {
  const sourceUrl = 'https://www.aaii.com/sentimentsurvey/sent_results';
  const downloadUrl = `https://www.aaii.com/files/surveys/sentiment.xls?_=${Date.now()}`;
  const response = await fetch(downloadUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'application/vnd.ms-excel,application/octet-stream,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      Referer: 'https://www.aaii.com/sentimentsurvey/sent_results',
    },
  });
  if (!response.ok) {
    throw new Error(`AAII Sentiment xls request failed with HTTP ${response.status}`);
  }
  const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();
  const arrayBuffer = await response.arrayBuffer();
  if (contentType.includes('text/html') || arrayBuffer.byteLength < 4096) {
    throw new Error('AAII xls download returned non-Excel content; bot-protection may have intercepted the request.');
  }
  const { rows, bullishHistoricalAverage } = parseAaiiRowsFromXls(Buffer.from(arrayBuffer));
  const latest = rows[0];
  if (!latest) {
    throw new Error('AAII Sentiment xls contained no parseable weekly sentiment rows.');
  }
  const historicalAverages = {
    bullish: bullishHistoricalAverage ?? aaiiSeedData.historicalAverages.bullish,
    neutral: aaiiSeedData.historicalAverages.neutral,
    bearish: aaiiSeedData.historicalAverages.bearish,
  };
  return {
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    weekEnding: latest.weekEnding,
    bullish: latest.bullish,
    neutral: latest.neutral,
    bearish: latest.bearish,
    history: rows.slice(0, 8),
    historicalAverages,
    oneYearHighs: oneYearHighsFromAaiiRows(rows),
  };
};

const fetchAaiiSentimentHtml = async () => {
  const sourceUrl = 'https://www.aaii.com/sentimentsurvey/sent_results';
  const requestUrl = `${sourceUrl}?_=${Date.now()}`;
  const response = await fetch(requestUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      Referer: 'https://www.aaii.com/sentimentsurvey',
    },
  });
  if (!response.ok) {
    throw new Error(`AAII Sentiment Survey request failed with HTTP ${response.status}`);
  }
  const html = await response.text();
  if (/Pardon Our Interruption|Incapsula|CWUDNSAI|Just a moment/i.test(html)) {
    throw new Error('AAII blocked the automated backend request with bot-protection HTML.');
  }
  const rows = parseAaiiRowsFromHtml(html);
  const latest = rows[0];
  if (!latest) {
    throw new Error('AAII Sentiment Survey returned no parseable weekly sentiment rows.');
  }
  return {
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    weekEnding: latest.weekEnding,
    bullish: latest.bullish,
    neutral: latest.neutral,
    bearish: latest.bearish,
    history: rows.slice(0, 8),
    historicalAverages: aaiiSeedData.historicalAverages,
    oneYearHighs: oneYearHighsFromAaiiRows(rows),
  };
};

const fetchAaiiSentiment = async () => {
  try {
    return await fetchAaiiSentimentXls();
  } catch (xlsError) {
    try {
      return await fetchAaiiSentimentHtml();
    } catch (htmlError) {
      const xlsMessage = xlsError instanceof Error ? xlsError.message : 'AAII xls request failed.';
      const htmlMessage = htmlError instanceof Error ? htmlError.message : 'AAII HTML request failed.';
      throw new Error(`AAII fetch failed. xls: ${xlsMessage} · html: ${htmlMessage}`);
    }
  }
};

const settleReference = async (fetcher, cachedReference, fallbackData = null) => {
  try {
    return { data: await fetcher(), error: null };
  } catch (error) {
    if (cachedReference?.data) {
      return {
        data: cachedReference.data,
        error: `${error instanceof Error ? error.message : 'Reference data request failed.'} Showing cached data from ${cachedReference.cachedAt ?? 'the previous successful request'}.`,
        cached: true,
        cachedAt: cachedReference.cachedAt ?? null,
      };
    }
    if (fallbackData) {
      return {
        data: fallbackData,
        error: `${error instanceof Error ? error.message : 'Reference data request failed.'} Showing fallback snapshot until AAII is reachable.`,
        cached: true,
        cachedAt: null,
      };
    }
    return { data: null, error: error instanceof Error ? error.message : 'Reference data request failed.' };
  }
};

export const fetchMarketReferenceData = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && marketReferenceCache && Date.now() - marketReferenceCache.cachedAtMs < marketReferenceCacheTtlMs) {
    return {
      ...marketReferenceCache.payload,
      servedFromCache: true,
    };
  }
  const cached = marketReferenceCache?.payload;
  const [vix, fearGreed, aaii] = await Promise.all([
    settleReference(fetchVix, cached?.vix ? { data: cached.vix.data, cachedAt: cached.importedAt } : null),
    settleReference(fetchCnnFearGreed, cached?.fearGreed ? { data: cached.fearGreed.data, cachedAt: cached.importedAt } : null),
    settleReference(fetchAaiiSentiment, cached?.aaii ? { data: cached.aaii.data, cachedAt: cached.importedAt } : null, aaiiSeedData),
  ]);
  const payload = {
    importedAt: new Date().toISOString(),
    vix,
    fearGreed,
    aaii,
    servedFromCache: false,
  };
  marketReferenceCache = {
    cachedAtMs: Date.now(),
    payload,
  };
  return payload;
};

export const fetchYtdBenchmarks = async ({ startDate, endDate } = {}) => {
  const period1 = startDate ? dateToUnix(startDate) : startOfYearUnix();
  const period2 = endDate ? dateToUnix(endDate) + 86400 : todayUnix();
  const [nasdaq, sp500] = await Promise.all([
    fetchYahooSeries('^IXIC', 'NASDAQ Composite', period1, period2),
    fetchYahooSeries('^GSPC', 'S&P 500', period1, period2),
  ]);
  return {
    importedAt: new Date().toISOString(),
    startDate: startDate || null,
    endDate: endDate || null,
    benchmarks: {
      nasdaq,
      sp500,
    },
  };
};
