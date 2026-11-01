(function () {
  'use strict';

  const Lumen = (window.Lumen = window.Lumen || {});
  const state = {
    aiLoaded: false,
    aiLoading: false,
    arenaLive: null,
    aaSnapshot: null,
    arenaSnapshot: null,
    orSnapshot: null,
    langLoaded: false,
    langLoading: false,
    tiobeSnapshot: null,
    fxLoaded: false,
    fxLoading: false,
    wiseSnapshot: null,
    xeSnapshot: null,
    xeError: false,
    wiseLive: new Map(),
    lastHistory: null,
    fxRange: 30,
    fxTimer: null,
    activeTool: 'totp'
  };

  const CURRENCIES = {
    USD: '美元',
    CNY: '人民币',
    EUR: '欧元',
    GBP: '英镑',
    JPY: '日元',
    HKD: '港元',
    KRW: '韩元',
    TWD: '新台币',
    SGD: '新加坡元',
    AUD: '澳元',
    CAD: '加元',
    CHF: '瑞士法郎',
    NZD: '新西兰元',
    THB: '泰铢',
    MYR: '马来西亚林吉特',
    IDR: '印尼盾',
    PHP: '菲律宾比索',
    VND: '越南盾',
    INR: '印度卢比',
    AED: '阿联酋迪拉姆',
    SAR: '沙特里亚尔',
    RUB: '俄罗斯卢布',
    TRY: '土耳其里拉',
    BRL: '巴西雷亚尔',
    MXN: '墨西哥比索',
    ZAR: '南非兰特',
    SEK: '瑞典克朗',
    NOK: '挪威克朗',
    DKK: '丹麦克朗',
    PLN: '波兰兹罗提'
  };

  const PROXIES = [
    function (url) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url); },
    function (url) { return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url); },
    function (url) { return 'https://corsproxy.io/?url=' + encodeURIComponent(url); },
    function (url) { return 'https://api.cors.lol/?url=' + encodeURIComponent(url); }
  ];

  const el = {};
  [
    'aaList', 'arenaList', 'aaMeta', 'arenaMeta', 'aiRefreshBtn',
    'orList', 'orMeta',
    'tiobeList', 'tiobeMeta', 'tiobeMonth',
    'fxAmount', 'fxFrom', 'fxTo', 'fxSwapBtn', 'fxConvertBtn', 'fxStatus',
    'fxWise', 'fxWiseAmount', 'fxWiseCode', 'fxWiseRate',
    'fxXe', 'fxXeAmount', 'fxXeCode', 'fxXeRate',
    'fxTrendPair', 'fxTrendChart',
    'fxHigh', 'fxHighDate', 'fxLow', 'fxLowDate',
    'fxLatest', 'fxLatestDate', 'fxChange', 'fxChangeHint'
  ].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  function toast(message, type) {
    if (window.Lumen.app && window.Lumen.app.toast) window.Lumen.app.toast(message, type);
  }

  function formatShortTime(value) {
    if (!value) return '未知时间';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
    const parts = new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date);
    const get = function (type) { return (parts.find(function (p) { return p.type === type; }) || {}).value || ''; };
    return get('month') + '-' + get('day') + ' ' + get('hour') + ':' + get('minute');
  }

  function formatDay(value) {
    if (!value) return '—';
    const parts = String(value).split('-');
    if (parts.length !== 3) return String(value);
    return parts[1] + '-' + parts[2];
  }

  function formatMoney(value) {
    if (!Number.isFinite(value)) return '—';
    if (Math.abs(value) >= 1e9) {
      return new Intl.NumberFormat('zh-CN', {
        notation: 'compact',
        maximumFractionDigits: 3
      }).format(value);
    }
    const digits = value >= 100 ? 2 : value >= 1 ? 3 : 6;
    return new Intl.NumberFormat('zh-CN', {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0
    }).format(value);
  }

  function formatMoneyFull(value) {
    if (!Number.isFinite(value)) return '';
    return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
  }

  function formatRate(value) {
    if (!Number.isFinite(value)) return '—';
    if (value >= 1000) return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
    if (value >= 1) return value.toFixed(4).replace(/\.?0+$/, '');
    return value.toFixed(6).replace(/\.?0+$/, '');
  }

  function fetchJson(url, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(function () { controller.abort(); }, timeoutMs || 12000);
    return fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      signal: controller.signal
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).finally(function () {
      window.clearTimeout(timer);
    });
  }

  function formatScore(value) {
    const score = Number(value);
    if (!Number.isFinite(score)) return '—';
    if (score >= 100) return score.toFixed(1).replace(/\.0$/, '');
    return score >= 10 ? score.toFixed(1).replace(/\.0$/, '') : score.toFixed(2).replace(/\.?0+$/, '');
  }

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

  function deltaClass(delta) {
    const text = String(delta || '');
    if (text.indexOf('-') === 0) return 'delta-down';
    if (/new|>\+?\d/i.test(text)) return 'delta-up';
    return 'delta-up';
  }

  function renderRankList(container, models, metaEl, metaText, statusClass, options) {
    if (!container) return;
    const opts = options || {};
    container.textContent = '';
    if (!models || !models.length) {
      const empty = document.createElement('div');
      empty.className = 'rank-error';
      empty.textContent = '暂时无法读取这份榜单。可以直接打开源站查看。';
      container.appendChild(empty);
    } else {
      const scores = models.map(function (model) { return Number(model.score) || 0; });
      const max = Math.max.apply(null, scores);
      const min = Math.min.apply(null, scores);
      const positive = scores.filter(function (score) { return score > 0; });
      const logMin = positive.length ? Math.min.apply(null, positive) : 1;
      const barWidth = function (score) {
        const value = Number(score) || 0;
        if (opts.bar === 'log') {
          if (value <= 0) return 8;
          if (max <= logMin) return 100;
          const ratio = (Math.log(value) - Math.log(logMin)) / (Math.log(max) - Math.log(logMin));
          return 8 + Math.max(0, Math.min(1, ratio)) * 92;
        }
        if (opts.bar === 'max') {
          return max > 0 ? Math.max(8, (value / max) * 100) : 100;
        }
        const range = max - min;
        return range > 0 ? Math.max(8, ((value - min) / range) * 100) : 100;
      };
      models.slice(0, opts.limit || 20).forEach(function (model, index) {
        const item = document.createElement('div');
        item.className = 'rank-item' + (index < 3 ? ' top-' + (index + 1) : '');
        item.style.animationDelay = Math.min(index * 24, 360) + 'ms';

        const rank = document.createElement('span');
        rank.className = 'rank-number';
        rank.textContent = String(index + 1).padStart(2, '0');

        const main = document.createElement('div');
        main.className = 'rank-main';
        const name = document.createElement('div');
        name.className = 'rank-name';
        name.textContent = model.name || '未命名条目';
        const creator = document.createElement('div');
        creator.className = 'rank-creator';
        creator.textContent = model.creator || '—';
        main.appendChild(name);
        main.appendChild(creator);

        const score = document.createElement('div');
        score.className = 'rank-score';
        const scoreText = document.createElement('b');
        scoreText.textContent = model.display || formatScore(model.score);
        const bar = document.createElement('span');
        const inner = document.createElement('i');
        inner.style.setProperty('--score', barWidth(model.score).toFixed(1) + '%');
        bar.appendChild(inner);
        score.appendChild(scoreText);
        if (model.delta) {
          const delta = document.createElement('em');
          delta.className = 'rank-delta ' + deltaClass(model.delta);
          delta.textContent = model.delta;
          score.appendChild(delta);
        }
        score.appendChild(bar);

        item.appendChild(rank);
        item.appendChild(main);
        item.appendChild(score);
        container.appendChild(item);
      });
    }
    if (metaEl) {
      metaEl.textContent = '';
      const left = document.createElement('span');
      left.textContent = metaText || '';
      if (statusClass) left.className = statusClass;
      metaEl.appendChild(left);
    }
  }

  function renderAA(metaText, statusClass) {
    const models = state.aaSnapshot && state.aaSnapshot.models;
    renderRankList(el.aaList, models, el.aaMeta, metaText, statusClass);
  }

  function renderArena(metaText, statusClass) {
    const models = (state.arenaLive && state.arenaLive.models) || (state.arenaSnapshot && state.arenaSnapshot.models);
    renderRankList(el.arenaList, models, el.arenaMeta, metaText, statusClass);
  }

  function renderOpenRouter(metaText, statusClass) {
    const models = state.orSnapshot && state.orSnapshot.models;
    renderRankList(el.orList, models, el.orMeta, metaText, statusClass, { limit: 10, bar: 'log' });
  }

  function normalizeArena(raw) {
    const items = (raw && raw.rows ? raw.rows : [])
      .map(function (entry) { return entry.row || entry; })
      .filter(function (model) {
        return model.category === 'overall' && Number.isFinite(Number(model.score));
      })
      .sort(function (a, b) { return Number(b.score) - Number(a.score); });

    const models = items.slice(0, 20).map(function (model, index) {
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

    return {
      models: models,
      updatedAt: new Date().toISOString(),
      publishDate: items.length ? items[0].leaderboard_publish_date : ''
    };
  }

  async function loadAI(force) {
    if (state.aiLoading && !force) return;
    state.aiLoading = true;
    if (el.aiRefreshBtn) el.aiRefreshBtn.disabled = true;

    try {
      if (!state.aaSnapshot || force) {
        try {
          state.aaSnapshot = await fetchJson('./data/aa-snapshot.json' + (force ? '?t=' + Date.now() : ''));
        } catch (error) {
          state.aaSnapshot = state.aaSnapshot || null;
        }
      }
      if (state.aaSnapshot) {
        renderAA('快照 · ' + formatShortTime(state.aaSnapshot.updatedAt) + ' · TOP 20', '');
      } else {
        renderAA('快照不可用', 'status-error');
      }

      if (!state.orSnapshot || force) {
        try {
          state.orSnapshot = await fetchJson('./data/openrouter-snapshot.json' + (force ? '?t=' + Date.now() : ''));
        } catch (error) {
          state.orSnapshot = state.orSnapshot || null;
        }
      }
      if (state.orSnapshot) {
        renderOpenRouter('本周 · 快照 ' + formatShortTime(state.orSnapshot.updatedAt) + ' · TOP 10', '');
      } else {
        renderOpenRouter('快照不可用', 'status-error');
      }

      if (!state.arenaSnapshot) {
        try {
          state.arenaSnapshot = await fetchJson('./data/arena-snapshot.json');
        } catch (error) {
          state.arenaSnapshot = null;
        }
      }

      state.arenaLive = null;
      try {
        const raw = await fetchJson('https://datasets-server.huggingface.co/rows?dataset=lmarena-ai%2Fleaderboard-dataset&config=agent&split=latest&offset=0&length=100', 16000);
        state.arenaLive = normalizeArena(raw);
        renderArena(
          '官方数据集 · 发布 ' + (state.arenaLive.publishDate || formatShortTime(state.arenaLive.updatedAt)) + ' · TOP 20',
          'status-ok'
        );
      } catch (error) {
        if (state.arenaSnapshot) {
          renderArena(
            '快照 · 发布 ' + (state.arenaSnapshot.sourcePublishDate || formatShortTime(state.arenaSnapshot.updatedAt)) + ' · TOP 20',
            ''
          );
        } else {
          renderArena('暂时无法读取 Arena Agent 榜单', 'status-error');
        }
      }

      state.aiLoaded = true;
      if (force) toast('Arena Agent 已实时刷新，其余榜单读取最新快照', 'success');
    } finally {
      state.aiLoading = false;
      if (el.aiRefreshBtn) el.aiRefreshBtn.disabled = false;
    }
  }

  function monthLabel(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return '本月榜单';
    return match[1] + ' 年 ' + Number(match[2]) + ' 月';
  }

  async function loadLang(force) {
    if (state.langLoading) return;
    if (state.tiobeSnapshot && !force) {
      renderTiobe();
      state.langLoaded = true;
      return;
    }
    state.langLoading = true;
    try {
      state.tiobeSnapshot = await fetchJson('./data/tiobe-snapshot.json' + (force ? '?t=' + Date.now() : ''))
        .catch(function () { return state.tiobeSnapshot || null; });
      renderTiobe();
      state.langLoaded = true;
    } finally {
      state.langLoading = false;
    }
  }

  function renderTiobe() {
    const snapshot = state.tiobeSnapshot;
    if (el.tiobeMonth && snapshot) el.tiobeMonth.textContent = monthLabel(snapshot.month) + ' · 全球热度';
    if (!snapshot) {
      renderRankList(el.tiobeList, null, el.tiobeMeta, '快照不可用', 'status-error', { limit: 20 });
      return;
    }
    renderRankList(
      el.tiobeList,
      snapshot.models,
      el.tiobeMeta,
      monthLabel(snapshot.month) + ' · 同比变化 · TOP 20',
      '',
      { limit: 20, bar: 'max' }
    );
  }

  function fillCurrencySelects() {
    if (!el.fxFrom || !el.fxTo) return;
    el.fxFrom.textContent = '';
    el.fxTo.textContent = '';
    Object.keys(CURRENCIES).forEach(function (code) {
      const label = code + ' · ' + CURRENCIES[code];
      const from = document.createElement('option');
      from.value = code;
      from.textContent = label;
      el.fxFrom.appendChild(from);
      const to = document.createElement('option');
      to.value = code;
      to.textContent = label;
      el.fxTo.appendChild(to);
    });
    el.fxFrom.value = 'USD';
    el.fxTo.value = 'CNY';
  }

  function sourceRate(snapshot, from, to) {
    if (!snapshot || !snapshot.rates) return null;
    if (from === to) return 1;
    const rFrom = snapshot.rates[from];
    const rTo = snapshot.rates[to];
    if (!Number.isFinite(Number(rFrom)) || !Number.isFinite(Number(rTo))) return null;
    return Number(rTo) / Number(rFrom);
  }

  function xeRate(from, to) {
    if (!state.xeSnapshot) return null;
    return sourceRate(state.xeSnapshot, from, to);
  }

  function setFxSource(source, amount, code, rate, meta, status) {
    const nodes = {
      wise: { card: el.fxWise, amount: el.fxWiseAmount, code: el.fxWiseCode, rate: el.fxWiseRate },
      xe: { card: el.fxXe, amount: el.fxXeAmount, code: el.fxXeCode, rate: el.fxXeRate }
    }[source];
    if (!nodes || !nodes.card) return;
    nodes.card.dataset.state = status || (rate === null ? 'error' : 'ready');
    nodes.code.textContent = code;
    if (rate === null) {
      nodes.amount.textContent = '—';
      nodes.rate.textContent = meta || '该币种暂无数据';
      nodes.card.dataset.state = status === 'loading' ? 'loading' : 'error';
      return;
    }
    nodes.amount.textContent = formatMoney(amount * rate);
    nodes.amount.title = Math.abs(amount * rate) >= 1e9 ? formatMoneyFull(amount * rate) : '';
    nodes.rate.textContent = '1 ' + (el.fxFrom.value || 'USD') + ' = ' + formatRate(rate) + ' ' + code + ' · ' + meta;
  }

  function renderFX(options) {
    const opts = options || {};
    if (!el.fxAmount) return;
    const amount = Number(el.fxAmount.value);
    const from = el.fxFrom.value;
    const to = el.fxTo.value;
    const valid = Number.isFinite(amount) && amount >= 0;
    const snapshotWise = sourceRate(state.wiseSnapshot, from, to);
    const liveWise = state.wiseLive.get(from + '|' + to);
    const xe = xeRate(from, to);

    if (el.fxTrendPair) el.fxTrendPair.textContent = from + ' → ' + to;

    if (!valid) {
      el.fxStatus.textContent = '请输入有效的金额';
      return;
    }

    if (liveWise && Number.isFinite(liveWise.value)) {
      setFxSource('wise', amount, to, liveWise.value,
        'Wise · 实时 · ' + formatShortTime(liveWise.time), 'ready');
    } else if (snapshotWise !== null) {
      setFxSource('wise', amount, to, snapshotWise,
        'Wise 快照 · ' + formatShortTime(state.wiseSnapshot.updatedAt), 'ready');
    } else {
      setFxSource('wise', amount, to, null,
        state.wiseSnapshot ? 'Wise 快照缺少 ' + from + '/' + to : 'Wise 快照未加载', 'error');
    }

    if (xe !== null) {
      setFxSource('xe', amount, to, xe,
        'XE 快照 · ' + formatShortTime(state.xeSnapshot && state.xeSnapshot.updatedAt), 'ready');
    } else if (state.xeSnapshot) {
      setFxSource('xe', amount, to, null, 'XE 快照缺少该币种数据', 'error');
    } else if (state.xeError) {
      setFxSource('xe', amount, to, null, 'XE 快照加载失败', 'error');
    } else {
      setFxSource('xe', amount, to, null, '正在读取 XE 快照…', 'loading');
    }

    const pair = from + ' → ' + to;
    if (opts.manual) {
      el.fxStatus.textContent = '已换算 ' + pair + ' · Wise 尝试实时刷新';
    } else if (xe === null) {
      el.fxStatus.textContent = '已换算 ' + pair + ' · XE 暂不提供该币种';
    } else {
      el.fxStatus.textContent = '已换算 ' + pair + ' · 走势来自 XE 每日汇率';
    }
  }

  function crossAt(series, from, to, index) {
    const a = from === 'USD' ? 1 : (series[from] ? series[from][index] : NaN);
    const b = to === 'USD' ? 1 : (series[to] ? series[to][index] : NaN);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
    return b / a;
  }

  function trendSeries(from, to, range) {
    const snapshot = state.xeSnapshot;
    if (!snapshot || !snapshot.history) return null;
    const history = snapshot.history;
    const daily = history.daily || (history.dates ? { dates: history.dates, series: history.series } : null);
    const hourly = history.hourly || null;
    const needed = [from, to].filter(function (code) { return code !== 'USD'; });
    for (let i = 0; i < needed.length; i++) {
      const code = needed[i];
      const inDaily = daily && daily.series && daily.series[code];
      const inHourly = hourly && hourly.series && hourly.series[code];
      if (!inDaily && !inHourly) return { missing: code, points: [] };
    }
    const now = Date.now();
    const startMs = now - range * 86400000;
    const recentStart = now - 35 * 86400000;
    const points = [];
    if (daily && daily.dates && daily.series) {
      for (let i = 0; i < daily.dates.length; i++) {
        const ts = Date.parse(daily.dates[i] + 'T00:00:00Z');
        if (!(ts >= startMs)) continue;
        if (hourly && ts >= recentStart) continue;
        const value = crossAt(daily.series, from, to, i);
        if (value !== null) points.push({ t: ts, d: daily.dates[i], v: value });
      }
    }
    if (hourly && hourly.times && hourly.series) {
      for (let i = 0; i < hourly.times.length; i++) {
        const ts = hourly.times[i];
        if (ts < startMs) continue;
        const value = crossAt(hourly.series, from, to, i);
        if (value !== null) {
          points.push({ t: ts, d: new Date(ts).toISOString().slice(0, 10), v: value });
        }
      }
    }
    points.sort(function (a, b) { return a.t - b.t; });
    return { points: points };
  }

  function rangeLabel(range) {
    return range >= 365 ? '1 年' : range + ' 天';
  }

  function loadHistory(from, to, range) {
    if (!el.fxTrendChart) return;
    if (from === to) {
      renderFlatHistory(from, to);
      return;
    }
    if (!state.xeSnapshot) {
      state.lastHistory = null;
      if (state.xeError) {
        el.fxTrendChart.innerHTML = '<div class="rank-error">XE 快照加载失败，请重新进入汇率页或刷新页面重试。</div>';
      } else {
        el.fxTrendChart.innerHTML = '<div class="rank-loading"><span class="loader-dot"></span>正在读取 XE 历史汇率…</div>';
      }
      resetTrendStats();
      return;
    }
    const result = trendSeries(from, to, range);
    if (!result || result.points.length < 2) {
      state.lastHistory = null;
      const message = result && result.missing
        ? 'XE 快照暂不提供 ' + result.missing + ' 的历史数据。'
        : '该区间内的数据点不足，暂时无法绘制走势。';
      el.fxTrendChart.innerHTML = '<div class="rank-error">' + message + '</div>';
      resetTrendStats();
      return;
    }
    renderHistory(result.points, from, to, range);
  }

  function resetTrendStats() {
    ['fxHigh', 'fxLow', 'fxLatest', 'fxChange'].forEach(function (id) {
      if (el[id]) el[id].textContent = '—';
    });
    if (el.fxChange) el.fxChange.classList.remove('is-up', 'is-down');
    ['fxHighDate', 'fxLowDate', 'fxLatestDate', 'fxChangeHint'].forEach(function (id) {
      if (el[id]) el[id].textContent = '—';
    });
  }

  function renderFlatHistory(from, to) {
    state.lastHistory = null;
    el.fxTrendChart.innerHTML = '<div class="rank-error">' + from + ' 与 ' + to + ' 相同，无需查看走势。</div>';
    resetTrendStats();
  }

  function renderHistory(points, from, to, range) {
    if (!el.fxTrendChart || !points.length) return;
    state.lastHistory = { points: points, from: from, to: to, range: range };
    const containerWidth = el.fxTrendChart.clientWidth || 720;
    const width = Math.max(320, Math.min(720, containerWidth - 28));
    const height = width < 480 ? 210 : 240;
    const pad = { l: width < 480 ? 40 : 48, r: width < 480 ? 12 : 18, t: 20, b: 28 };
    const values = points.map(function (p) { return p.v; });
    const max = Math.max.apply(null, values);
    const min = Math.min.apply(null, values);
    const span = max - min || Math.abs(max) * 0.002 || 1;
    const top = max + span * 0.16;
    const bottom = min - span * 0.16;
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    const firstT = points[0].t;
    const lastT = points[points.length - 1].t;
    const x = function (index) {
      if (points.length === 1 || lastT === firstT) return pad.l + innerW / 2;
      return pad.l + ((points[index].t - firstT) / (lastT - firstT)) * innerW;
    };
    const y = function (value) {
      return pad.t + innerH - ((value - bottom) / (top - bottom)) * innerH;
    };

    const line = points.map(function (p, index) {
      return (index === 0 ? 'M' : 'L') + x(index).toFixed(2) + ' ' + y(p.v).toFixed(2);
    }).join(' ');
    const area = line + ' L' + x(points.length - 1).toFixed(2) + ' ' + (pad.t + innerH) + ' L' + x(0).toFixed(2) + ' ' + (pad.t + innerH) + ' Z';

    const maxIndex = values.indexOf(max);
    const minIndex = values.indexOf(min);
    const lastIndex = points.length - 1;
    const maxPoint = points[maxIndex];
    const minPoint = points[minIndex];
    const lastPoint = points[lastIndex];

    const gridLines = [];
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const value = bottom + ((top - bottom) * i) / ticks;
      const gy = y(value);
      gridLines.push('<line x1="' + pad.l + '" y1="' + gy.toFixed(1) + '" x2="' + (width - pad.r) + '" y2="' + gy.toFixed(1) + '" class="trend-grid"/>');
      gridLines.push('<text x="' + (pad.l - 8) + '" y="' + (gy + 3.5).toFixed(1) + '" class="trend-axis" text-anchor="end">' + formatRate(value) + '</text>');
    }

    const label = function (point, index, kind) {
      const px = x(index);
      const py = y(point.v);
      const anchor = px > width - 130 ? 'end' : 'start';
      const dx = anchor === 'end' ? -10 : 10;
      const dy = kind === 'max' ? -12 : 18;
      const text = (kind === 'max' ? '高 ' : '低 ') + formatRate(point.v) + ' · ' + formatDay(point.d);
      return '<circle cx="' + px.toFixed(2) + '" cy="' + py.toFixed(2) + '" r="4" class="trend-dot ' + kind + '"/>' +
        '<text x="' + (px + dx).toFixed(2) + '" y="' + (py + dy).toFixed(2) + '" class="trend-label ' + kind + '" text-anchor="' + anchor + '">' + text + '</text>';
    };

    el.fxTrendChart.innerHTML =
      '<svg viewBox="0 0 ' + width + ' ' + height + '" class="trend-svg" role="img" aria-label="' + from + ' 至 ' + to + ' 汇率走势">' +
      '<defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--violet)" stop-opacity=".34"/>' +
      '<stop offset="100%" stop-color="var(--violet)" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      gridLines.join('') +
      '<path d="' + area + '" fill="url(#trendFill)"/>' +
      '<path d="' + line + '" class="trend-line"/>' +
      label(maxPoint, maxIndex, 'max') +
      label(minPoint, minIndex, 'min') +
      '<circle cx="' + x(lastIndex).toFixed(2) + '" cy="' + y(lastPoint.v).toFixed(2) + '" r="4" class="trend-dot last"/>' +
      '<line class="trend-cursor" x1="0" y1="' + pad.t + '" x2="0" y2="' + (pad.t + innerH) + '" opacity="0"/>' +
      '<circle class="trend-hover-dot" r="3.5" opacity="0"/>' +
      '<rect class="trend-hit" x="' + pad.l + '" y="' + pad.t + '" width="' + innerW + '" height="' + innerH + '" fill="transparent"/>' +
      '</svg>' +
      '<div class="trend-tip" hidden></div>';

    el.fxHigh.textContent = formatRate(max);
    el.fxHighDate.textContent = maxPoint.d;
    el.fxLow.textContent = formatRate(min);
    el.fxLowDate.textContent = minPoint.d;
    el.fxLatest.textContent = formatRate(lastPoint.v);
    el.fxLatestDate.textContent = lastPoint.d;

    const first = points[0].v;
    const change = first ? ((lastPoint.v - first) / first) * 100 : 0;
    el.fxChange.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
    el.fxChange.classList.toggle('is-up', change >= 0);
    el.fxChange.classList.toggle('is-down', change < 0);
    el.fxChangeHint.textContent = '区间内 ' + points.length + ' 个数据点 · ' + rangeLabel(range);

    bindChartHover(points, x, y, width, height, pad);
  }

  function bindChartHover(points, x, y, width, height, pad) {
    const svg = el.fxTrendChart.querySelector('.trend-svg');
    const tip = el.fxTrendChart.querySelector('.trend-tip');
    const cursor = el.fxTrendChart.querySelector('.trend-cursor');
    const dot = el.fxTrendChart.querySelector('.trend-hover-dot');
    if (!svg || !tip || !cursor || !dot) return;

    const move = function (event) {
      const rect = svg.getBoundingClientRect();
      const scale = width / rect.width;
      const px = (event.clientX - rect.left) * scale;
      const ratio = Math.max(0, Math.min(1, (px - pad.l) / (width - pad.l - pad.r)));
      const firstT = points[0].t;
      const lastT = points[points.length - 1].t;
      const target = firstT + ratio * (lastT - firstT);
      let index = 0;
      let best = Infinity;
      for (let i = 0; i < points.length; i++) {
        const diff = Math.abs(points[i].t - target);
        if (diff < best) {
          best = diff;
          index = i;
        }
      }
      const point = points[index];
      const cx = x(index);
      const cy = y(point.v);
      cursor.setAttribute('x1', cx.toFixed(2));
      cursor.setAttribute('x2', cx.toFixed(2));
      cursor.setAttribute('opacity', '0.5');
      dot.setAttribute('cx', cx.toFixed(2));
      dot.setAttribute('cy', cy.toFixed(2));
      dot.setAttribute('opacity', '1');
      tip.hidden = false;
      tip.textContent = formatDay(point.d) + ' · ' + formatRate(point.v);
      const left = (cx / width) * rect.width;
      tip.style.left = Math.max(8, Math.min(rect.width - 8, left)) + 'px';
      tip.style.top = Math.max(4, (cy / height) * rect.height - 34) + 'px';
    };

    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerleave', function () {
      tip.hidden = true;
      cursor.setAttribute('opacity', '0');
      dot.setAttribute('opacity', '0');
    });
  }

  async function loadFX() {
    if (state.fxLoading) return;
    state.fxLoading = true;
    if (el.fxConvertBtn) el.fxConvertBtn.disabled = true;
    try {
      const jobs = [];
      if (!state.wiseSnapshot) {
        jobs.push(fetchJson('./data/wise-snapshot.json').then(function (data) {
          state.wiseSnapshot = data;
        }).catch(function () {
          state.wiseSnapshot = null;
        }));
      }
      if (!state.xeSnapshot) {
        state.xeError = false;
        jobs.push(fetchJson('./data/xe-snapshot.json').then(function (data) {
          const dailyOk = data && data.history && data.history.daily && data.history.daily.dates && data.history.daily.series;
          const legacyOk = data && data.history && data.history.dates && data.history.series;
          if (!data || !data.rates || !data.history || (!dailyOk && !legacyOk)) {
            throw new Error('bad xe snapshot');
          }
          state.xeSnapshot = data;
        }).catch(function () {
          state.xeSnapshot = null;
          state.xeError = true;
        }));
      }
      if (jobs.length) await Promise.all(jobs);
      renderFX({});
      const from = el.fxFrom.value;
      const to = el.fxTo.value;
      loadHistory(from, to, state.fxRange);
      state.fxLoaded = !state.xeError;
    } finally {
      state.fxLoading = false;
      if (el.fxConvertBtn) el.fxConvertBtn.disabled = false;
    }
  }

  async function tryWiseLive(from, to) {
    if (from === to) return;
    const key = from + '|' + to;
    if (state.wiseLive.has(key)) return;
    const target = 'https://wise.com/rates/live?source=' + encodeURIComponent(from) + '&target=' + encodeURIComponent(to);
    let data = null;
    try {
      data = await fetchJson(target, 7000);
    } catch (error) {
      data = null;
    }
    if (!data) {
      for (let i = 0; i < PROXIES.length; i++) {
        if (!data) {
          try {
            data = await fetchJson(PROXIES[i](target), 7000);
          } catch (error) {
            data = null;
          }
        }
      }
    }
    if (data && Number.isFinite(Number(data.value))) {
      state.wiseLive.set(key, { value: Number(data.value), time: data.time || Date.now() });
      if (el.fxFrom.value === from && el.fxTo.value === to) {
        el.fxStatus.textContent = 'Wise 已实时更新 · 走势来自 XE';
        renderFX({});
      }
      toast('Wise 实时汇率已更新', 'success');
    }
  }

  function setRange(range) {
    state.fxRange = range;
    document.querySelectorAll('[data-range]').forEach(function (button) {
      const active = Number(button.getAttribute('data-range')) === range;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    loadHistory(el.fxFrom.value, el.fxTo.value, range);
  }

  function convertFX(manual) {
    renderFX({ manual: manual });
    const from = el.fxFrom.value;
    const to = el.fxTo.value;
    const amount = Number(el.fxAmount.value);
    loadHistory(from, to, state.fxRange);
    if (manual) {
      if (Number.isFinite(amount) && amount >= 0) tryWiseLive(from, to);
    }
  }

  function bindChartResize() {
    let timer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        if (state.lastHistory) {
          renderHistory(state.lastHistory.points, state.lastHistory.from, state.lastHistory.to, state.lastHistory.range);
        }
      }, 220);
    });
  }

  function bindFX() {
    if (!el.fxConvertBtn) return;
    fillCurrencySelects();
    el.fxConvertBtn.addEventListener('click', function () { convertFX(true); });
    el.fxFrom.addEventListener('change', function () { convertFX(false); });
    el.fxTo.addEventListener('change', function () { convertFX(false); });
    el.fxSwapBtn.addEventListener('click', function () {
      const from = el.fxFrom.value;
      el.fxFrom.value = el.fxTo.value;
      el.fxTo.value = from;
      convertFX(false);
    });
    el.fxAmount.addEventListener('input', function () {
      window.clearTimeout(state.fxTimer);
      state.fxTimer = window.setTimeout(function () { convertFX(false); }, 300);
    });
    document.querySelectorAll('[data-range]').forEach(function (button) {
      button.addEventListener('click', function () {
        setRange(Number(button.getAttribute('data-range')) || 30);
      });
    });
  }

  function bindAI() {
    if (!el.aiRefreshBtn) return;
    el.aiRefreshBtn.addEventListener('click', function () {
      loadAI(true);
    });
  }

  function onToolChange(tool) {
    state.activeTool = tool;
    if (tool === 'ai' && !state.aiLoaded) loadAI(false);
    if (tool === 'fx' && !state.fxLoaded) loadFX();
    if (tool === 'lang' && !state.langLoaded) loadLang(false);
  }

  document.addEventListener('lumen:tool', function (event) {
    onToolChange(event.detail && event.detail.tool ? event.detail.tool : 'totp');
  });

  function init() {
    bindAI();
    bindFX();
    bindChartResize();
    const hash = (window.location.hash || '').replace('#', '');
    if (hash === 'fx') loadFX();
    if (hash === 'ai') loadAI(false);
    if (hash === 'lang') loadLang(false);
  }

  Lumen.dataTools = {
    loadAI: function () { return loadAI(true); },
    loadFX: function () { return loadFX(); },
    loadLang: function () { return loadLang(true); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
