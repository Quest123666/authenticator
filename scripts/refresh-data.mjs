#!/usr/bin/env node
/**
 * Refresh static data snapshots for Lumen 光栈.
 * Runs inside GitHub Actions and commits with the repository owner's identity.
 * No secrets required: every source is a public endpoint.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  xiaomi: 'Xiaomi',
  deepseek: 'DeepSeek',
  xai: 'SpaceXAI',
  zai: 'Z.AI',
  alibaba: 'Alibaba',
  minimax: 'MiniMax',
  stepfun: 'StepFun',
  nvidia: 'NVIDIA',
  mistral: 'Mistral AI',
  inclusionai: 'InclusionAI'
};

function readJson(name, fallback) {
  const file = join(DATA, name);
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

async function refreshXe() {
  // XE blocks datacenter IPs with a WAF challenge. Keep the last snapshot rather than
  // relabeling another provider's rates as XE.
  try {
    const html = await fetchText('https://www.xe.com/currencytables/?from=USD', 15000);
    if (!/<table/i.test(html)) throw new Error('no rate table in response');
    console.log('XE: page reachable, but parser is intentionally conservative; keeping snapshot');
  } catch (error) {
    console.warn('XE unavailable:', error.message, '- keeping previous snapshot');
  }
}

(async () => {
  const tasks = [
    ['Artificial Analysis', refreshArtificialAnalysis],
    ['Arena Agent', refreshArena],
    ['Wise', refreshWise],
    ['XE', refreshXe]
  ];
  for (const [name, task] of tasks) {
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
