(function () {
  'use strict';

  const Lumen = (window.Lumen = window.Lumen || {});
  const util = Lumen.util;
  const totp = Lumen.totp;
  const parse = Lumen.parse;
  const VERSION = Lumen.VERSION || '1.3.2';
  const THEME_KEY = 'lumen.tools.theme';

  if (!util || !totp || !parse) throw new Error('Lumen core failed to load');

  const ICONS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 15.4A8.5 8.5 0 0 1 8.6 3.5a8.5 8.5 0 1 0 11.9 11.9Z"/></svg>',
    databaseOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5.5" rx="7" ry="3"/><path d="M5 5.5v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/><path d="M5 11.5v6c0 1.7 3.1 3 7 3 1.2 0 2.3-.1 3.3-.4"/><path d="M4 20 20 4"/></svg>',
    wifiOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5a15.5 15.5 0 0 1 3.4-1.9M9.7 6.1A16 16 0 0 1 21 9.5"/><path d="M6.5 13.2a11 11 0 0 1 3-1.3M14.8 12a11 11 0 0 1 2.7 1.2"/><path d="M9.3 16.7a5.5 5.5 0 0 1 5.4 0"/><circle cx="12" cy="20" r=".8"/><path d="m3 3 18 18"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.4 5.2 3.4 8.5S14.2 18.2 12 20.5c-2.2-2.3-3.4-5.2-3.4-8.5S9.8 5.8 12 3.5Z"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15.5" r="3.5"/><path d="m10.6 13 8.4-8.4M16.2 7.4l2.2 2.2M18.4 5.2l2.2 2.2"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2.8 1.8 5.4 5.4 1.8-5.4 1.8L12 17.2l-1.8-5.4L4.8 10l5.4-1.8L12 2.8Z"/><path d="m19 15 .9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z"/></svg>',
    coins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="8" cy="7" rx="4.5" ry="2.2"/><path d="M3.5 7v4.4c0 1.2 2 2.2 4.5 2.2s4.5-1 4.5-2.2V7"/><path d="M3.5 11.4V15c0 1.2 2 2.2 4.5 2.2s4.5-1 4.5-2.2v-2"/><ellipse cx="16" cy="13" rx="4.5" ry="2.2"/><path d="M11.5 13v4.4c0 1.2 2 2.2 4.5 2.2s4.5-1 4.5-2.2V13"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.3 19 6.8v5.2c0 4.2-2.7 7.1-7 8.7-4.3-1.6-7-4.5-7-8.7V6.8L12 3.3Z"/><path d="m9.4 12.1 1.6 1.6 3.6-3.9"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5.5H7.5A1.5 1.5 0 0 0 6 7v12.5A1.5 1.5 0 0 0 7.5 21h9A1.5 1.5 0 0 0 18 19.5V7A1.5 1.5 0 0 0 16.5 5.5H15"/><rect x="9" y="3.5" width="6" height="4" rx="1.3"/><path d="M9 11h6M9 14.5h6M9 18h4"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2A2 2 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16h2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 6.8"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 21 19H3L12 3.5Z"/><path d="M12 8.5v5M12 16.5v.2"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 13.5V19H5V6h5.5"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h15M15 5l4 4-4 4"/><path d="M20 15H5M9 19l-4-4 4-4"/></svg>'
  };

  const el = {};
  [
    'secretInput', 'inputBadge', 'inputError', 'demoBtn', 'pasteBtn', 'clearBtn',
    'resultCard', 'accountAvatar', 'accountName', 'accountMeta', 'codeDisplay',
    'timerBar', 'timerSeconds', 'timerSecondsCopy', 'timerDial', 'codeHint',
    'copyBtn', 'copyLabel', 'emptyCopy', 'liveBadge', 'toastHost', 'footerVersion',
    'aiRefreshBtn', 'fxAmount', 'fxFrom', 'fxTo', 'fxSwapBtn', 'fxConvertBtn',
    'fxStatus', 'fxWise', 'fxXe', 'fxWiseAmount', 'fxWiseCode', 'fxWiseRate',
    'fxXeAmount', 'fxXeCode', 'fxXeRate', 'aaList', 'arenaList', 'aaMeta', 'arenaMeta'
  ].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  const state = {
    tool: 'totp',
    item: null,
    inputKind: '',
    seq: 0,
    lastCounter: -1,
    lastSeconds: -1,
    rawCode: null,
    parseTimer: null,
    tickerId: null,
    copyTimer: null
  };

  function iconSpan(name, className) {
    const icon = ICONS[name] || ICONS.shield;
    return '<span data-icon="' + name + '"' + (className ? ' class="' + className + '"' : '') + '>' + icon + '</span>';
  }

  function hydrateIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (node) {
      const name = node.getAttribute('data-icon');
      if (ICONS[name] && !node.innerHTML.trim()) node.innerHTML = ICONS[name];
    });
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      /* theme preference only */
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    const meta = document.getElementById('themeColorMeta');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#F2EFE7' : '#07060C');
    document.querySelectorAll('[data-theme-btn]').forEach(function (button) {
      const active = button.getAttribute('data-theme-btn') === theme;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function toggleTheme(theme) {
    applyTheme(theme);
    saveTheme(theme);
  }

  function initTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(current);
    document.querySelectorAll('[data-theme-btn]').forEach(function (button) {
      button.addEventListener('click', function () {
        toggleTheme(button.getAttribute('data-theme-btn'));
      });
    });
  }

  function algoLabel(value) {
    return ({ SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' })[value] || value;
  }

  function applyAvatar(node, name) {
    node.textContent = String(name || '?').trim().slice(0, 2).toUpperCase() || '?';
    for (let i = 0; i < 5; i++) node.classList.remove('g' + i);
    let hash = 0;
    const text = String(name || '');
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    node.classList.add('g' + (hash % 5));
  }

  function setError(message) {
    if (!message) {
      el.inputError.hidden = true;
      el.inputError.textContent = '';
      return;
    }
    el.inputError.textContent = message;
    el.inputError.hidden = false;
  }

  function setDial(left) {
    if (el.timerDial) el.timerDial.style.setProperty('--left', String(Math.max(0, Math.min(100, left))));
  }

  function emptyResult() {
    state.item = null;
    state.inputKind = '';
    state.seq++;
    state.lastCounter = -1;
    state.lastSeconds = -1;
    state.rawCode = null;
    el.inputBadge.hidden = true;
    el.liveBadge.hidden = true;
    el.emptyCopy.hidden = false;
    el.resultCard.dataset.state = 'empty';
    el.accountName.textContent = '等待密钥';
    el.accountMeta.textContent = 'SHA-1 · 6 位 · 30 秒';
    el.codeDisplay.textContent = '· · ·';
    el.codeDisplay.classList.remove('is-updated');
    el.timerSeconds.textContent = '--';
    if (el.timerSecondsCopy) el.timerSecondsCopy.textContent = '--';
    el.codeHint.textContent = '输入后自动生成';
    el.timerBar.style.width = '0%';
    setDial(0);
    el.copyBtn.disabled = true;
    el.copyLabel.textContent = '复制验证码';
    el.copyBtn.classList.remove('copied');
    applyAvatar(el.accountAvatar, '?');
  }

  function updateAccount(item) {
    const name = item.issuer || item.account || '临时验证码';
    const meta = [];
    if (item.issuer && item.account) meta.push(item.account);
    else if (state.inputKind === 'base32') meta.push('手动密钥');
    meta.push(algoLabel(item.algorithm), item.digits + ' 位', item.period + ' 秒');
    el.accountName.textContent = name;
    el.accountMeta.textContent = meta.join(' · ');
    applyAvatar(el.accountAvatar, name);
    el.liveBadge.hidden = false;
    el.emptyCopy.hidden = true;
    el.resultCard.dataset.state = 'ready';
  }

  function resetTimerMeta() {
    el.timerSeconds.textContent = '--';
    if (el.timerSecondsCopy) el.timerSecondsCopy.textContent = '--';
    el.timerBar.style.width = '0%';
    setDial(0);
    el.codeHint.textContent = '输入后自动生成';
  }

  function acceptItem(item, kind) {
    state.inputKind = kind;
    state.item = item;
    el.inputBadge.textContent = kind === 'otpauth' ? 'otpauth' : 'Base32';
    el.inputBadge.hidden = false;
    state.seq++;
    state.lastCounter = -1;
    state.lastSeconds = -1;
    updateAccount(item);
    el.codeDisplay.textContent = '· · ·';
    el.codeHint.textContent = '正在生成…';
    generateCode(true);
    tick();
  }

  function parseInput() {
    const raw = el.secretInput.value.trim();
    setError('');
    if (!raw) {
      emptyResult();
      resetTimerMeta();
      return;
    }

    try {
      if (/^otpauth-migration:/i.test(raw)) {
        throw new Error('迁移二维码包含多个账户，请逐个粘贴密钥');
      }

      const link = raw.match(/otpauth:\/\/[^\s"'<>]+/i);
      if (link) {
        if ((raw.match(/otpauth:\/\//gi) || []).length > 1) {
          throw new Error('一次只能识别一个 otpauth 链接');
        }
        const item = parse.otpauth(link[0].replace(/[\u3000),.;]+$/g, ''));
        acceptItem({
          issuer: item.issuer,
          account: item.account,
          secret: item.secret,
          algorithm: item.algorithm,
          digits: item.digits,
          period: item.period,
          type: 'totp'
        }, 'otpauth');
        return;
      }

      if (/^otpauth/i.test(raw)) throw new Error('没有找到完整的 otpauth 链接');

      const secret = util.normalizeSecret(raw);
      util.base32ToBytes(secret);
      acceptItem({
        issuer: '',
        account: '',
        secret: secret,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        type: 'totp'
      }, 'base32');
    } catch (error) {
      emptyResult();
      resetTimerMeta();
      setError(error.message || '无法识别这个密钥');
    }
  }

  function onInputChanged() {
    window.clearTimeout(state.parseTimer);
    state.parseTimer = window.setTimeout(parseInput, 120);
  }

  async function generateCode(force) {
    const item = state.item;
    if (!item) return;
    const period = Number(item.period) || 30;
    const counter = Math.floor(Date.now() / 1000 / period);
    if (!force && counter === state.lastCounter) return;
    state.lastCounter = counter;
    const seq = ++state.seq;
    try {
      const result = await totp.generate(item);
      if (seq !== state.seq || !state.item) return;
      state.rawCode = result.code;
      el.codeDisplay.textContent = util.formatCode(result.code);
      el.codeDisplay.classList.remove('is-updated');
      void el.codeDisplay.offsetWidth;
      el.codeDisplay.classList.add('is-updated');
      el.copyBtn.disabled = false;
      el.codeHint.textContent = '本地生成 · 不上传';
    } catch (error) {
      if (seq !== state.seq) return;
      state.rawCode = null;
      el.codeDisplay.textContent = '无法生成';
      el.copyBtn.disabled = true;
      el.codeHint.textContent = error.message || '生成失败';
    }
  }

  function tick() {
    if (!state.item || document.hidden) return;
    const item = state.item;
    const period = Number(item.period) || 30;
    const now = Date.now();
    const counter = Math.floor(now / 1000 / period);
    const remaining = Math.max(0, (counter + 1) * period * 1000 - now);
    const seconds = Math.max(1, Math.ceil(remaining / 1000));
    const percent = Math.max(0, Math.min(100, (remaining / (period * 1000)) * 100));
    el.timerBar.style.width = percent + '%';
    setDial(percent);
    if (state.lastSeconds !== seconds) {
      state.lastSeconds = seconds;
      el.timerSeconds.textContent = String(seconds);
      if (el.timerSecondsCopy) el.timerSecondsCopy.textContent = String(seconds);
    }
    if (counter !== state.lastCounter) generateCode(false);
  }

  function startTicker() {
    if (state.tickerId) return;
    state.tickerId = window.setInterval(tick, 250);
  }

  async function writeClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('copy failed');
  }

  async function copyCode() {
    if (!state.rawCode) return;
    try {
      await writeClipboard(state.rawCode);
      el.copyLabel.textContent = '已复制';
      el.copyBtn.classList.add('copied');
      showToast('验证码已复制', 'success');
      window.clearTimeout(state.copyTimer);
      state.copyTimer = window.setTimeout(function () {
        el.copyLabel.textContent = '复制验证码';
        el.copyBtn.classList.remove('copied');
      }, 1600);
    } catch (error) {
      showToast('复制失败，请手动选择验证码', 'error');
    }
  }

  async function pasteFromClipboard() {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error('unsupported');
      const text = await navigator.clipboard.readText();
      if (!text) throw new Error('剪贴板为空');
      el.secretInput.value = text;
      parseInput();
      el.secretInput.focus();
    } catch (error) {
      showToast('无法读取剪贴板，请手动粘贴', 'error');
    }
  }

  function clearInput() {
    el.secretInput.value = '';
    setError('');
    emptyResult();
    resetTimerMeta();
    el.secretInput.focus();
  }

  function fillDemo() {
    el.secretInput.value = 'JBSWY3DPEHPK3PXP';
    setError('');
    parseInput();
    showToast('已填入公开示例密钥，不会保存', 'success');
  }

  function showToast(message, type) {
    if (!el.toastHost) return;
    const node = document.createElement('div');
    node.className = 'toast ' + (type === 'error' ? 'is-error' : 'is-success');
    node.innerHTML = iconSpan(type === 'error' ? 'alert' : 'check') + '<span></span>';
    node.querySelector('span:last-child').textContent = message;
    el.toastHost.appendChild(node);
    window.setTimeout(function () {
      node.classList.add('is-leaving');
      window.setTimeout(function () {
        node.remove();
      }, 250);
    }, 3200);
  }

  function activateTool(tool, options) {
    if (!['totp', 'ai', 'fx'].includes(tool)) tool = 'totp';
    state.tool = tool;
    document.querySelectorAll('[data-tool-tab]').forEach(function (button) {
      const active = button.getAttribute('data-tool-tab') === tool;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.setAttribute('tabindex', active ? '0' : '-1');
    });
    ['totp', 'ai', 'fx'].forEach(function (name) {
      const panel = document.getElementById('tool-' + name);
      if (!panel) return;
      const active = name === tool;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    if (!options || !options.silent) {
      try {
        const hash = '#' + tool;
        if (window.location.hash !== hash) history.replaceState(null, '', hash);
      } catch (error) {
        /* ignore */
      }
      document.dispatchEvent(new CustomEvent('lumen:tool', { detail: { tool: tool } }));
    }
  }

  function initTabs() {
    const hash = window.location.hash.replace('#', '');
    activateTool(hash || 'totp', { silent: true });
    document.querySelectorAll('[data-tool-tab]').forEach(function (button, index, buttons) {
      button.addEventListener('click', function () {
        activateTool(button.getAttribute('data-tool-tab'));
      });
      button.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const step = event.key === 'ArrowRight' ? 1 : -1;
        const next = buttons[(index + step + buttons.length) % buttons.length];
        activateTool(next.getAttribute('data-tool-tab'));
        next.focus();
      });
    });
    document.dispatchEvent(new CustomEvent('lumen:tool', { detail: { tool: state.tool } }));
  }

  function initTotp() {
    el.secretInput.addEventListener('input', onInputChanged);
    el.secretInput.addEventListener('paste', function () {
      window.setTimeout(parseInput, 0);
    });
    el.demoBtn.addEventListener('click', fillDemo);
    el.pasteBtn.addEventListener('click', pasteFromClipboard);
    el.clearBtn.addEventListener('click', clearInput);
    el.copyBtn.addEventListener('click', copyCode);
    el.footerVersion.textContent = 'v' + VERSION;
    emptyResult();
    startTicker();
  }

  function init() {
    hydrateIcons(document);
    initTheme();
    initTabs();
    initTotp();
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) tick();
    });
    if ('serviceWorker' in navigator && window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }
  }

  window.Lumen.app = {
    toast: showToast,
    activateTool: activateTool,
    getTool: function () { return state.tool; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
