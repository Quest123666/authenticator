(function () {
  'use strict';

  const Lumen = (window.Lumen = window.Lumen || {});
  const state = {
    aiLoaded: false,
    aiLoading: false,
    arenaLive: null,
    aaSnapshot: null,
    arenaSnapshot: null,
    fxLoaded: false,
    fxLoading: false,
    wiseSnapshot: null,
    xeSnapshot: null,
    refRates: null,
    refUpdated: '',
    wiseLive: new Map(),
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
    'fxAmount', 'fxFrom', 'fxTo', 'fxSwapBtn', 'fxConvertBtn', 'fxStatus',
    'fxWise', 'fxWiseAmount', 'fxWiseCode', 'fxWiseRate',
    'fxXe', 'fxXeAmount', 'fxXeCode', 'fxXeRate',
    'fxRef', 'fxRefAmount', 'fxRefCode', 'fxRefRate'
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

  function formatMoney(value) {
    if (!Number.isFinite(value)) return '—';
    const digits = value >= 100 ? 2 : value >= 1 ? 3 : 6;
    return new Intl.NumberFormat('zh-CN', {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0
    }).format(value);
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

  function renderRankList(container, models, metaEl, metaText, statusClass) {
    if (!container) return;
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
      models.slice(0, 20).forEach(function (model, index) {
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
        name.textContent = model.name || '未命名模型';
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
        const range = max - min;
        const percent = range > 0 ? ((Number(model.score) - min) / range) * 100 : 100;
        inner.style.setProperty('--score', Math.max(8, percent).toFixed(1) + '%');
        bar.appendChild(inner);
        score.appendChild(scoreText);
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
      if (!state.aaSnapshot) {
        try {
          state.aaSnapshot = await fetchJson('./data/aa-snapshot.json');
        } catch (error) {
          state.aaSnapshot = null;
        }
      }
      if (state.aaSnapshot) {
        renderAA('快照 · ' + formatShortTime(state.aaSnapshot.updatedAt) + ' · TOP 20', '');
      } else {
        renderAA('快照不可用', 'status-error');
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
      if (force) toast('Arena Agent 榜单已刷新；Artificial Analysis 使用内置快照', 'success');
    } finally {
      state.aiLoading = false;
      if (el.aiRefreshBtn) el.aiRefreshBtn.disabled = false;
    }
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

  function refRate(from, to) {
    if (!state.refRates || !state.refRates.rates) return null;
    if (from === to) return 1;
    const rFrom = state.refRates.rates[from];
    const rTo = state.refRates.rates[to];
    if (!Number.isFinite(Number(rFrom)) || !Number.isFinite(Number(rTo))) return null;
    return Number(rTo) / Number(rFrom);
  }

  function setFxSource(source, amount, code, rate, meta, status) {
    const nodes = {
      wise: { card: el.fxWise, amount: el.fxWiseAmount, code: el.fxWiseCode, rate: el.fxWiseRate },
      xe: { card: el.fxXe, amount: el.fxXeAmount, code: el.fxXeCode, rate: el.fxXeRate },
      ref: { card: el.fxRef, amount: el.fxRefAmount, code: el.fxRefCode, rate: el.fxRefRate }
    }[source];
    if (!nodes || !nodes.card) return;
    nodes.card.dataset.state = status || (rate === null ? 'error' : 'ready');
    nodes.code.textContent = code;
    if (rate === null) {
      nodes.amount.textContent = '—';
      nodes.rate.textContent = meta || '该币种暂无快照';
      nodes.card.dataset.state = status === 'loading' ? 'loading' : 'error';
      return;
    }
    nodes.amount.textContent = formatMoney(amount * rate);
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
    const snapshotXe = sourceRate(state.xeSnapshot, from, to);
    const liveWise = state.wiseLive.get(from + '|' + to);
    const ref = refRate(from, to);

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

    if (snapshotXe !== null) {
      setFxSource('xe', amount, to, snapshotXe,
        'XE 快照 · ' + formatShortTime(state.xeSnapshot.updatedAt), 'ready');
    } else {
      setFxSource('xe', amount, to, null,
        state.xeSnapshot ? 'XE 快照缺少 ' + from + '/' + to : 'XE 快照未加载', 'error');
    }

    if (ref !== null) {
      setFxSource('ref', amount, to, ref,
        '实时参考 · ' + (state.refUpdated || '已更新'), 'ready');
    } else if (state.refRates) {
      setFxSource('ref', amount, to, null, '实时参考暂无该币种', 'error');
    } else {
      setFxSource('ref', amount, to, null, '正在加载实时参考…', 'loading');
    }

    const pair = from + ' → ' + to;
    if (opts.manual) {
      el.fxStatus.textContent = '已换算 ' + pair + (state.refRates ? ' · 实时参考已更新' : '');
    } else if (state.refRates) {
      el.fxStatus.textContent = '已换算 ' + pair + ' · Wise / XE 为最近快照';
    } else {
      el.fxStatus.textContent = '已换算 ' + pair + ' · 正在加载实时参考…';
    }
  }

  async function loadRefRates() {
    try {
      const raw = await fetchJson('https://open.er-api.com/v6/latest/USD', 12000);
      if (!raw || !raw.rates) throw new Error('bad response');
      state.refRates = raw;
      state.refUpdated = formatShortTime(raw.time_last_update_utc || raw.time_last_update_unix * 1000);
      renderFX({});
    } catch (error) {
      state.refRates = null;
      setFxSource('ref', Number(el.fxAmount.value) || 0, el.fxTo.value, null, '实时参考暂时不可用', 'error');
      el.fxStatus.textContent = 'Wise / XE 快照已加载 · 实时参考暂不可用';
    }
  }

  async function loadFX() {
    if (state.fxLoading) return;
    state.fxLoading = true;
    if (el.fxConvertBtn) el.fxConvertBtn.disabled = true;
    try {
      if (!state.wiseSnapshot) {
        try { state.wiseSnapshot = await fetchJson('./data/wise-snapshot.json'); } catch (error) { state.wiseSnapshot = null; }
      }
      if (!state.xeSnapshot) {
        try { state.xeSnapshot = await fetchJson('./data/xe-snapshot.json'); } catch (error) { state.xeSnapshot = null; }
      }
      renderFX({});
      if (!state.refRates) loadRefRates();
      state.fxLoaded = true;
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
        el.fxStatus.textContent = 'Wise 已实时更新 · XE 为最近快照';
        renderFX({});
      }
      toast('Wise 实时汇率已更新', 'success');
    }
  }

  function convertFX(manual) {
    renderFX({ manual: manual });
    if (manual) {
      const from = el.fxFrom.value;
      const to = el.fxTo.value;
      const amount = Number(el.fxAmount.value);
      if (!state.refRates) loadRefRates();
      if (Number.isFinite(amount) && amount >= 0) tryWiseLive(from, to);
    }
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
  }

  document.addEventListener('lumen:tool', function (event) {
    onToolChange(event.detail && event.detail.tool ? event.detail.tool : 'totp');
  });

  function init() {
    bindAI();
    bindFX();
    if ((window.location.hash || '').replace('#', '') === 'fx') loadFX();
    if ((window.location.hash || '').replace('#', '') === 'ai') loadAI(false);
  }

  Lumen.dataTools = {
    loadAI: function () { return loadAI(true); },
    loadFX: function () { return loadFX(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
