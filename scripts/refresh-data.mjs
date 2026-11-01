#!/usr/bin/env node
/**
 * Refresh static data snapshots for Lumen 光栈.
 * Runs inside GitHub Actions and commits with the repository owner's identity.
 * No secrets required: every source is a public endpoint.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'public', 'data');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const CURRENCIES = [
  'USD', 'CNY', 'EUR', 'GBP', 'JPY', 'HKD', 'KRW', 'TWD', 'SGD', 'AUD',
  'CAD', 'CHF', 'NZD', 'THB', 'MYR', 'IDR', 'PHP', 'VND', 'INR', 'AED',
  'SAR', 'RUB', 'TRY', 'BRL', 'MXN', 'ZAR', 'SEK', 'NOK', 'DKK', 'PLN'
];

const ORG_LABELS = {
  anthropic: 'Anthropic',
  google: 'Google',
  openai: 'OpenAI',
  meta: 'Meta',
  moonshot: 'Moonshot AI',
  moonshotai: 'Moonshot AI',
  xiaomi: 'Xiaomi',
  deepseek: 'DeepSeek',
  xai: 'SpaceXAI',
  zai: 'Z.AI',
  alibaba: 'Alibaba',
  qwen: 'Alibaba',
  minimax: 'MiniMax',
  stepfun: 'StepFun',
  nvidia: 'NVIDIA',
  mistral: 'Mistral AI',
  inclusionai: 'InclusionAI',
  tencent: 'Tencent',
  baidu: 'Baidu',
  typesafe: 'Typesafe'
};

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function readJson(name, fallback) {  const file = join(DATA, name);
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(name, value) {
  writeFileSync(join(DATA, name), JSON.stringify(value, null, 2) + '\n');
  console.log('updated', name);
}

function writeJsonCompact(name, value) {
  writeFileSync(join(DATA, name), JSON.stringify(value) + '\n');
  console.log('updated', name, '(' + Math.round(JSON.stringify(value).length / 1024) + ' KB)');
}

async function fetchText(url, timeout = 20000) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(timeout)
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.text();
  } catch (fetchError) {
    // Some Node builds cannot reach certain CDNs directly; curl is available on
    // GitHub runners and provides a reliable fallback.
    try {
      const seconds = String(Math.ceil(timeout / 1000));
      const { stdout } = await execFileAsync('curl', [
        '-fsSL', '--max-time', seconds, '-A', UA, url
      ], { maxBuffer: 20 * 1024 * 1024 });
      return stdout;
    } catch (curlError) {
      throw fetchError;
    }
  }
}

/**
 * The Artificial Analysis models page embeds its React server data as an
 * escaped JSON array. Scan for the matching closing bracket and decode it.
 */
function readEmbeddedModelArray(html) {
  const marker = '\\"initialModels\\":';
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) throw new Error('initialModels not found');
  const start = html.indexOf('[', markerIndex + marker.length);
  if (start < 0) throw new Error('initialModels array not found');

  let depth = 0;
  let inString = false;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (char === '\\' && html[i + 1] === '"') {
      inString = !inString;
      i++;
      continue;
    }
    if (inString) continue;
    if (char === '[') depth++;
    else if (char === ']') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error('initialModels array is incomplete');

  const raw = html
    .slice(start, end)
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
  return JSON.parse(raw);
}

async function refreshArtificialAnalysis() {
  const html = await fetchText('https://artificialanalysis.ai/zh/models', 30000);
  const models = readEmbeddedModelArray(html)
    .filter((model) => model && model.chartDefaultSelected && Number.isFinite(Number(model.intelligenceIndex)))
    .sort((a, b) => Number(b.intelligenceIndex) - Number(a.intelligenceIndex))
    .slice(0, 20)
    .map((model, index) => ({
      rank: index + 1,
      name: model.name,
      creator: model.creator && model.creator.name ? model.creator.name : '—',
      score: Number(Number(model.intelligenceIndex).toFixed(1)),
      display: String(Math.round(Number(model.intelligenceIndex))),
      url: 'https://artificialanalysis.ai/models/' + model.slug
    }));

  if (models.length < 10) {
    console.warn('Artificial Analysis: parsed only', models.length, 'rows, keeping previous snapshot');
    return;
  }
  writeJson('aa-snapshot.json', {
    source: 'Artificial Analysis',
    sourceUrl: 'https://artificialanalysis.ai/zh/models#intelligence',
    metric: 'Intelligence Index',
    updatedAt: new Date().toISOString(),
    models
  });
}

async function refreshArena() {
  const raw = JSON.parse(await fetchText(
    'https://datasets-server.huggingface.co/rows?dataset=lmarena-ai%2Fleaderboard-dataset&config=agent&split=latest&offset=0&length=100',
    25000
  ));
  const items = (raw.rows || [])
    .map((entry) => entry.row || entry)
    .filter((model) => model.category === 'overall' && Number.isFinite(Number(model.score)))
    .sort((a, b) => Number(b.score) - Number(a.score));

  if (items.length < 10) {
    console.warn('Arena Agent: dataset returned only', items.length, 'rows, keeping previous snapshot');
    return;
  }

  const models = items.slice(0, 20).map((model, index) => {
    const percent = Number(model.score) * 100;
    return {
      rank: index + 1,
      name: model.model_name,
      creator: ORG_LABELS[model.organization] || model.organization || '—',
      score: Number(percent.toFixed(2)),
      display: percent.toFixed(2),
      url: 'https://arena.ai/leaderboard/agent'
    };
  });

  writeJson('arena-snapshot.json', {
    source: 'Arena Agent',
    sourceUrl: 'https://arena.ai/leaderboard/agent',
    metric: 'Net Improvement',
    updatedAt: new Date().toISOString(),
    sourcePublishDate: items[0].leaderboard_publish_date || '',
    dataset: 'lmarena-ai/leaderboard-dataset (agent/latest)',
    models
  });
}

async function refreshWise() {
  const previous = readJson('wise-snapshot.json', { rates: { USD: 1 } });
  const rates = { USD: 1 };
  let ok = 0;
  for (const code of CURRENCIES) {
    if (code === 'USD') continue;
    try {
      const data = JSON.parse(await fetchText('https://wise.com/rates/live?source=USD&target=' + code, 10000));
      const value = Number(data.value);
      if (Number.isFinite(value) && value > 0) {
        rates[code] = value;
        ok++;
      }
    } catch (error) {
      console.warn('Wise', code, error.message);
      if (previous.rates && Number.isFinite(Number(previous.rates[code]))) {
        rates[code] = Number(previous.rates[code]);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  if (ok < 8) {
    console.warn('Wise: only', ok, 'live rates, keeping previous snapshot');
    return;
  }
  writeJson('wise-snapshot.json', {
    source: 'Wise',
    sourceUrl: 'https://wise.com/zh-cn/currency-converter/',
    base: 'USD',
    updatedAt: new Date().toISOString(),
    note: 'USD 基准快照；其他币种通过交叉汇率换算',
    rates
  });
}

const XE_SOURCE = 'https://www.xe.com/zh-cn/';
const XE_TABLE = 'https://www.xe.com/currencytables/?from=USD';
// XE 的汇率图表页会在请求里带上这组公开的基础认证头（来自其前端脚本），
// 这里复用同一入口，仅用于生成只读快照，请求间保持间隔。
const XE_BASIC = 'Basic bG9kZXN0YXI6cHVnc25heA==';

async function loadChromium() {
  const candidates = [process.env.XE_PLAYWRIGHT, 'playwright-core', 'playwright'].filter(Boolean);
  for (const name of candidates) {
    try {
      const spec = /[\\/]/.test(name) ? pathToFileURL(name).href : name;
      const mod = await import(spec);
      const chromium = mod.chromium || (mod.default && mod.default.chromium);
      if (chromium) return chromium;
    } catch (error) {
      // 未安装时继续尝试下一个入口
    }
  }
  return null;
}

function findChrome() {
  const candidates = [
    process.env.XE_CHROME,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch (error) {
      // ignore
    }
  }
  return undefined;
}

/**
 * XE 全站由 AWS WAF 的 JS 挑战保护，普通 fetch / curl / 公共代理都会被 202/403
 * 拦截，只有真实浏览器才能拿到数据。因此用无头 Chrome 打开官方汇率表页，
 * 再复用页面上下文读取图表接口，生成 USD 基准的汇率与一年历史快照。
 */
async function refreshXe() {
  const chromium = await loadChromium();
  if (!chromium) {
    console.warn('XE: playwright-core not installed, keeping previous snapshot');
    return;
  }

  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: findChrome(),
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({
      locale: 'en-US',
      timezoneId: 'UTC',
      userAgent: UA,
      viewport: { width: 1366, height: 900 }
    });
    const page = await context.newPage();
    await page.goto(XE_TABLE, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('table tbody tr', { timeout: 90000 });

    const tableRates = await page.evaluate((wanted) => {
      const out = {};
      document.querySelectorAll('table tbody tr').forEach((row) => {
        const link = row.querySelector('th a');
        const code = link ? (link.textContent || '').trim() : '';
        const cells = [...row.querySelectorAll('td')].map((cell) => cell.textContent.trim());
        const value = Number.parseFloat(String(cells[1] || '').replace(/,/g, ''));
        if (/^[A-Z]{3}$/.test(code) && wanted.indexOf(code) >= 0 && Number.isFinite(value) && value > 0) {
          out[code] = value;
        }
      });
      return out;
    }, CURRENCIES);

    tableRates.USD = 1;
    const available = CURRENCIES.filter((code) => code === 'USD' || Number.isFinite(tableRates[code]));
    if (available.length < 24) {
      throw new Error('XE table returned only ' + available.length + ' currencies');
    }

    const histories = await page.evaluate(async (payload) => {
      const out = {};
      for (const code of payload.codes) {
        try {
          const response = await fetch(
            '/api/protected/charting-rates/?fromCurrency=USD&toCurrency=' + code,
            { credentials: 'include', headers: { Authorization: payload.auth } }
          );
          if (response.status !== 200) {
            out[code] = null;
            continue;
          }
          const data = await response.json();
          const batches = (data.batchList || []).slice().sort((a, b) => a.startTime - b.startTime);
          const points = [];
          for (const batch of batches) {
            if (!batch.rates || batch.rates.length < 3) continue;
            // 每个批次的首个数值是时间轴偏移量，真实汇率 = 数值 - 偏移量
            const offset = batch.rates[0];
            for (let i = 1; i < batch.rates.length; i++) {
              const value = batch.rates[i] - offset;
              if (value > 0) points.push([batch.startTime + i * batch.interval, value]);
            }
          }
          points.sort((a, b) => a[0] - b[0]);
          out[code] = points;
        } catch (error) {
          out[code] = null;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      return out;
    }, { codes: available.filter((code) => code !== 'USD'), auth: XE_BASIC });

    const now = Date.now();
    const cutoff = now - 370 * 86400000;
    const recentStart = now - 35 * 86400000;
    const dailyMaps = {};
    const hourlyMaps = {};
    Object.keys(histories).forEach((code) => {
      const points = histories[code];
      if (!points) return;
      const daily = {};
      const hourly = {};
      for (const [ts, value] of points) {
        if (ts < cutoff) continue;
        const day = new Date(ts).toISOString().slice(0, 10);
        daily[day] = value;
        if (ts >= recentStart) {
          const hour = Math.floor(ts / 3600000) * 3600000;
          hourly[hour] = value;
        }
      }
      dailyMaps[code] = daily;
      hourlyMaps[code] = hourly;
    });

    const dateSet = new Set();
    Object.keys(dailyMaps).forEach((code) => {
      Object.keys(dailyMaps[code]).forEach((day) => dateSet.add(day));
    });
    const dates = [...dateSet].sort();
    if (dates.length < 320) {
      throw new Error('XE history returned only ' + dates.length + ' days');
    }

    const dailySeries = {};
    Object.keys(dailyMaps).forEach((code) => {
      const daily = dailyMaps[code];
      dailySeries[code] = dates.map((day) => (
        Number.isFinite(daily[day]) ? Number(daily[day].toPrecision(10)) : null
      ));
    });

    const timeSet = new Set();
    Object.keys(hourlyMaps).forEach((code) => {
      Object.keys(hourlyMaps[code]).forEach((ts) => timeSet.add(Number(ts)));
    });
    const times = [...timeSet].sort((a, b) => a - b);
    if (times.length < 400) {
      throw new Error('XE hourly history returned only ' + times.length + ' points');
    }

    const hourlySeries = {};
    Object.keys(hourlyMaps).forEach((code) => {
      const hourly = hourlyMaps[code];
      hourlySeries[code] = times.map((ts) => (
        Number.isFinite(hourly[ts]) ? Number(hourly[ts].toPrecision(10)) : null
      ));
    });

    if (Object.keys(dailySeries).length < 20 || Object.keys(hourlySeries).length < 20) {
      throw new Error('XE history parsed too few currencies');
    }

    // 卡片当前价取小时序列最后一点，与 XE 官网换算器/图表一致；
    // 缺失时依次回退到每日收盘与汇率表。
    const rates = { USD: 1 };
    Object.keys(hourlySeries).forEach((code) => {
      const values = hourlySeries[code];
      for (let i = values.length - 1; i >= 0; i--) {
        if (Number.isFinite(values[i])) {
          rates[code] = values[i];
          break;
        }
      }
    });
    Object.keys(dailySeries).forEach((code) => {
      if (Number.isFinite(rates[code])) return;
      const values = dailySeries[code];
      for (let i = values.length - 1; i >= 0; i--) {
        if (Number.isFinite(values[i])) {
          rates[code] = values[i];
          break;
        }
      }
    });
    Object.keys(tableRates).forEach((code) => {
      if (!Number.isFinite(rates[code])) rates[code] = Number(tableRates[code].toPrecision(10));
    });

    writeJsonCompact('xe-snapshot.json', {
      source: 'XE',
      sourceUrl: XE_SOURCE,
      base: 'USD',
      updatedAt: new Date().toISOString(),
      note: 'USD 基准快照；近 35 天为小时级行情，更早为每日收盘',
      rates: rates,
      history: {
        daily: { dates, series: dailySeries },
        hourly: { times, series: hourlySeries }
      }
    });
    console.log('XE:', Object.keys(hourlySeries).length, 'currencies,', dates.length, 'days,', times.length, 'hours, CNY', rates.CNY);
  } finally {
    if (browser) await browser.close();
  }
}

async function refreshOpenRouter() {
  const html = await fetchText('https://openrouter.ai/rankings', 30000);
  const anchor = html.indexOf('leaderboard-table');
  const tableStart = html.indexOf('<table', anchor);
  if (tableStart < 0) throw new Error('leaderboard table not found');
  const segment = html.slice(tableStart, tableStart + 120000);
  const rows = [...segment.matchAll(/<tr class="or-table__row">([\s\S]*?)<\/tr>/g)].map((match) => match[1]);

  const models = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/g)]
      .map((cell) => decodeEntities(cell[1].replace(/<[^>]+>/g, '').trim()));
    if (cells.length < 5 || !/^\d+$/.test(cells[0])) continue;
    const amount = cells[3].replace(/\s*tokens?$/i, '').trim();
    const numeric = Number.parseFloat(amount);
    models.push({
      rank: Number(cells[0]),
      name: cells[1].replace(/\s*\*$/, ''),
      creator: ORG_LABELS[cells[2]] || cells[2],
      display: amount,
      score: Number.isFinite(numeric) ? numeric : 0,
      delta: cells[4].replace('>999%', '+999%'),
      url: 'https://openrouter.ai/rankings#leaderboard-table'
    });
    if (models.length === 10) break;
  }

  if (models.length < 5) {
    console.warn('OpenRouter: parsed only', models.length, 'rows, keeping previous snapshot');
    return;
  }

  writeJson('openrouter-snapshot.json', {
    source: 'OpenRouter',
    sourceUrl: 'https://openrouter.ai/rankings#leaderboard-table',
    metric: 'Tokens processed',
    period: 'This Week',
    updatedAt: new Date().toISOString(),
    models
  });
}

async function refreshTiobe() {
  const html = await fetchText('https://www.tiobe.com/tiobe-index/', 30000);
  const tableStart = html.indexOf('<table');
  if (tableStart < 0) throw new Error('TIOBE table not found');
  const segment = html.slice(tableStart, tableStart + 80000);
  const rows = [...segment.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((match) => match[1]);

  const models = [];
  let month = '';
  for (const row of rows) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
      .map((cell) => decodeEntities(cell[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()));
    if (!cells.length) continue;
    if (!month && /^[A-Z][a-z]{2} \d{4}$/.test(cells[0])) {
      const [mon, year] = cells[0].split(' ');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const index = months.indexOf(mon);
      if (index >= 0) month = year + '-' + String(index + 1).padStart(2, '0');
      continue;
    }
    if (cells.length < 7 || !/^\d+$/.test(cells[0])) continue;
    const rating = Number.parseFloat(cells[5]);
    models.push({
      rank: Number(cells[0]),
      name: cells[4],
      creator: /^\d+$/.test(cells[1]) ? '去年 #' + cells[1] : '—',
      display: cells[5].replace('%', ''),
      score: Number.isFinite(rating) ? rating : 0,
      delta: cells[6],
      url: 'https://www.tiobe.com/tiobe-index/'
    });
    if (models.length === 20) break;
  }

  if (models.length < 10) {
    console.warn('TIOBE: parsed only', models.length, 'rows, keeping previous snapshot');
    return;
  }

  writeJson('tiobe-snapshot.json', {
    source: 'TIOBE',
    sourceUrl: 'https://www.tiobe.com/tiobe-index/',
    metric: 'TIOBE Index',
    month: month || new Date().toISOString().slice(0, 7),
    updatedAt: new Date().toISOString(),
    models
  });
}

(async () => {
  const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length).split(',').map((id) => id.trim().toLowerCase()) : null;
  const tasks = [
    ['aa', 'Artificial Analysis', refreshArtificialAnalysis],
    ['arena', 'Arena Agent', refreshArena],
    ['openrouter', 'OpenRouter', refreshOpenRouter],
    ['tiobe', 'TIOBE', refreshTiobe],
    ['wise', 'Wise', refreshWise],
    ['xe', 'XE', refreshXe]
  ];
  for (const [id, name, task] of tasks) {
    if (only && only.indexOf(id) < 0) continue;
    try {
      await task();
    } catch (error) {
      console.warn(name + ' refresh failed:', error.message);
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
