(function () {
  'use strict';

  const Lumen = (window.Lumen = window.Lumen || {});
  Lumen.VERSION = '1.3.2';

  const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const ALGORITHMS = ['SHA1', 'SHA256', 'SHA512'];
  const KEY_CACHE = new Map();

  const util = (Lumen.util = {});
  util.ALGORITHMS = ALGORITHMS;

  util.clamp = function (value, min, max) {
    return Math.min(max, Math.max(min, value));
  };

  util.normalizeSecret = function (input) {
    const raw = String(input == null ? '' : input)
      .trim()
      .toUpperCase()
      .replace(/[\s\-=]/g, '');
    if (!raw) throw new Error('请输入密钥');
    if (/[^A-Z2-7]/.test(raw)) throw new Error('密钥包含无效字符，仅支持 A-Z 与 2-7');
    if (raw.length < 8) throw new Error('密钥太短，请检查是否完整');
    if (raw.length > 2048) throw new Error('密钥过长');
    return raw;
  };

  util.base32ToBytes = function (input) {
    const clean = util.normalizeSecret(input);
    let bits = 0;
    let value = 0;
    const out = [];
    for (let i = 0; i < clean.length; i++) {
      const index = B32_ALPHABET.indexOf(clean[i]);
      value = (value << 5) | index;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        out.push((value >>> bits) & 0xff);
        value &= (1 << bits) - 1;
      }
    }
    if (!out.length) throw new Error('密钥太短，请检查是否完整');
    return new Uint8Array(out);
  };

  util.bytesToBase32 = function (bytes) {
    let bits = 0;
    let value = 0;
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        out += B32_ALPHABET[(value >>> bits) & 31];
        value &= (1 << bits) - 1;
      }
    }
    if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
    return out;
  };

  util.bytesToBase64 = function (bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };

  util.bytesToBase64Url = function (bytes) {
    return util.bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  util.base64ToBytes = function (value) {
    const binary = atob(String(value || '').replace(/\s+/g, ''));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  };

  util.base64UrlToBytes = function (value) {
    let text = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    while (text.length % 4) text += '=';
    return util.base64ToBytes(text);
  };

  util.uuid = function () {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  };

  util.normalizeAlgorithm = function (value) {
    const raw = String(value == null ? 'SHA1' : value)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/-/g, '');
    if (raw === '' || raw === 'SHA1') return 'SHA1';
    if (raw === 'SHA256') return 'SHA256';
    if (raw === 'SHA512') return 'SHA512';
    throw new Error('不支持的哈希算法：' + value);
  };

  util.hashName = function (algorithm) {
    const normalized = util.normalizeAlgorithm(algorithm);
    return normalized === 'SHA1' ? 'SHA-1' : normalized === 'SHA256' ? 'SHA-256' : 'SHA-512';
  };

  util.normalizeDigits = function (value) {
    if (value == null || value === '') return 6;
    const digits = parseInt(value, 10);
    if (!Number.isFinite(digits) || digits < 4 || digits > 10) {
      throw new Error('验证码位数必须在 4 到 10 位之间');
    }
    return digits;
  };

  util.normalizePeriod = function (value) {
    if (value == null || value === '') return 30;
    const period = parseInt(value, 10);
    if (!Number.isFinite(period) || period < 5 || period > 300) {
      throw new Error('刷新周期必须在 5 到 300 秒之间');
    }
    return period;
  };

  util.formatCode = function (code) {
    const text = String(code || '');
    if (text.length === 6) return text.slice(0, 3) + ' ' + text.slice(3);
    if (text.length === 8) return text.slice(0, 4) + ' ' + text.slice(4);
    const mid = Math.ceil(text.length / 2);
    return text.slice(0, mid) + ' ' + text.slice(mid);
  };

  util.groupDigits = function (digits) {
    return Array.from({ length: digits }, () => '•').join('');
  };

  util.passwordStrength = function (password) {
    const text = String(password || '');
    let score = 0;
    if (text.length >= 8) score++;
    if (text.length >= 12) score++;
    if (text.length >= 16) score++;
    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(text)).length;
    if (classes >= 3 && text.length >= 8) score++;
    score = util.clamp(score, 0, 4);
    const labels = ['太短', '较弱', '一般', '良好', '很强'];
    return { score: score, label: labels[score] };
  };

  const totp = (Lumen.totp = {});

  async function getCryptoKey(secret, algorithm) {
    const cacheKey = algorithm + '|' + secret;
    if (KEY_CACHE.has(cacheKey)) return KEY_CACHE.get(cacheKey);
    const raw = util.base32ToBytes(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'HMAC', hash: { name: util.hashName(algorithm) } },
      false,
      ['sign']
    );
    KEY_CACHE.set(cacheKey, key);
    return key;
  }

  totp.generate = async function (item, at) {
    const timestamp = typeof at === 'number' ? at : Date.now();
    const period = util.normalizePeriod(item && item.period);
    const digits = util.normalizeDigits(item && item.digits);
    const algorithm = util.normalizeAlgorithm(item && item.algorithm);
    const secret = util.normalizeSecret(item && item.secret);
    const epochSeconds = Math.floor(timestamp / 1000);
    const counter = Math.floor(epochSeconds / period);
    const key = await getCryptoKey(secret, algorithm);

    const counterBytes = new Uint8Array(8);
    let remaining = counter;
    for (let i = 7; i >= 0; i--) {
      counterBytes[i] = remaining & 0xff;
      remaining = Math.floor(remaining / 256);
    }

    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes));
    const offset = signature[signature.length - 1] & 0x0f;
    const binary =
      ((signature[offset] & 0x7f) << 24) |
      (signature[offset + 1] << 16) |
      (signature[offset + 2] << 8) |
      signature[offset + 3];
    const code = String(binary % Math.pow(10, digits)).padStart(digits, '0');
    const nextBoundary = (counter + 1) * period * 1000;
    return {
      code: code,
      digits: digits,
      period: period,
      counter: counter,
      remainingMs: Math.max(0, nextBoundary - timestamp)
    };
  };

  totp.clearCache = function () {
    KEY_CACHE.clear();
  };

  const parse = (Lumen.parse = {});

  function labelParts(label) {
    const text = String(label || '').trim();
    const index = text.indexOf(':');
    if (index > 0) {
      return { issuer: text.slice(0, index).trim(), account: text.slice(index + 1).trim() };
    }
    return { issuer: '', account: text };
  }

  parse.otpauth = function (uri) {
    let url;
    try {
      url = new URL(String(uri || '').trim());
    } catch (error) {
      throw new Error('otpauth 链接格式无效');
    }
    if (url.protocol !== 'otpauth:') throw new Error('这不是 otpauth 链接');
    const type = String(url.hostname || '').toLowerCase();
    if (type === 'hotp') throw new Error('暂不支持 HOTP 账户，仅支持 TOTP');
    if (type !== 'totp') throw new Error('不支持的 OTP 类型：' + (type || '未知'));

    const params = url.searchParams;
    const secret = util.normalizeSecret(params.get('secret'));
    let label = '';
    try {
      label = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    } catch (error) {
      label = url.pathname.replace(/^\/+/, '');
    }
    const parts = labelParts(label);
    const issuer = String(params.get('issuer') || parts.issuer || '').trim();
    const account = parts.account || parts.issuer || '未命名账户';
    return {
      issuer: issuer.slice(0, 80),
      account: String(account).trim().slice(0, 120) || '未命名账户',
      secret: secret,
      algorithm: util.normalizeAlgorithm(params.get('algorithm')),
      digits: util.normalizeDigits(params.get('digits')),
      period: util.normalizePeriod(params.get('period')),
      type: 'totp'
    };
  };

  function readVarint(bytes, start) {
    let value = 0;
    let factor = 1;
    let index = start;
    let count = 0;
    while (index < bytes.length && count < 10) {
      const byte = bytes[index++];
      value += (byte & 0x7f) * factor;
      if (!(byte & 0x80)) return { value: value, next: index };
      factor *= 128;
      count++;
    }
    throw new Error('迁移二维码数据损坏');
  }

  function readProtoFields(bytes) {
    const fields = [];
    let index = 0;
    while (index < bytes.length) {
      const key = readVarint(bytes, index);
      index = key.next;
      const field = Math.floor(key.value / 8);
      const wire = key.value & 7;
      if (wire === 0) {
        const read = readVarint(bytes, index);
        fields.push({ field: field, wire: wire, value: read.value });
        index = read.next;
      } else if (wire === 1) {
        if (index + 8 > bytes.length) throw new Error('迁移二维码数据损坏');
        index += 8;
      } else if (wire === 2) {
        const length = readVarint(bytes, index);
        index = length.next;
        if (length.value > bytes.length - index) throw new Error('迁移二维码数据损坏');
        fields.push({ field: field, wire: wire, bytes: bytes.subarray(index, index + length.value) });
        index += length.value;
      } else if (wire === 5) {
        if (index + 4 > bytes.length) throw new Error('迁移二维码数据损坏');
        index += 4;
      } else {
        throw new Error('迁移二维码数据损坏');
      }
    }
    return fields;
  }

  function parseOtpParameters(bytes) {
    const params = { secret: null, name: '', issuer: '', algorithm: 0, digits: 0, type: 0 };
    const fields = readProtoFields(bytes);
    for (const entry of fields) {
      if (entry.field === 1 && entry.wire === 2) params.secret = entry.bytes;
      else if (entry.field === 2 && entry.wire === 2) params.name = utf8Decode(entry.bytes);
      else if (entry.field === 3 && entry.wire === 2) params.issuer = utf8Decode(entry.bytes);
      else if (entry.field === 4 && entry.wire !== 2) params.algorithm = entry.value;
      else if (entry.field === 5 && entry.wire !== 2) params.digits = entry.value;
      else if (entry.field === 6 && entry.wire !== 2) params.type = entry.value;
    }
    return params;
  }

  function utf8Decode(bytes) {
    try {
      return new TextDecoder('utf-8').decode(bytes);
    } catch (error) {
      return '';
    }
  }

  function decodeMigrationPayload(bytes) {
    const top = readProtoFields(bytes);
    const accounts = [];
    let batchSize = 0;
    let batchIndex = 0;
    let version = 0;
    for (const entry of top) {
      if (entry.field === 1 && entry.wire === 2) accounts.push(parseOtpParameters(entry.bytes));
      else if (entry.field === 2 && entry.wire !== 2) version = entry.value;
      else if (entry.field === 3 && entry.wire !== 2) batchSize = entry.value;
      else if (entry.field === 4 && entry.wire !== 2) batchIndex = entry.value;
    }
    return { accounts: accounts, batchSize: batchSize, batchIndex: batchIndex, version: version };
  }

  parse.migration = function (uri) {
    let url;
    try {
      url = new URL(String(uri || '').trim());
    } catch (error) {
      throw new Error('迁移二维码链接格式无效');
    }
    if (url.protocol !== 'otpauth-migration:') throw new Error('这不是 Google Authenticator 迁移链接');
    const data = url.searchParams.get('data');
    if (!data) throw new Error('迁移二维码缺少数据');
    let payload;
    try {
      payload = decodeMigrationPayload(util.base64UrlToBytes(data));
    } catch (error) {
      throw new Error('迁移二维码数据无法解析');
    }
    if (payload.accounts.length > 500) throw new Error('迁移账户数量过多');

    const items = [];
    const warnings = [];
    for (const account of payload.accounts) {
      if (!account.secret || !account.secret.length) continue;
      if (account.type === 1) {
        warnings.push('已跳过 HOTP 账户（Lumen 仅支持 TOTP）');
        continue;
      }
      let algorithm = 'SHA1';
      if (account.algorithm === 1 || account.algorithm === 0) algorithm = 'SHA1';
      else if (account.algorithm === 2) algorithm = 'SHA256';
      else if (account.algorithm === 3) algorithm = 'SHA512';
      else if (account.algorithm === 4) {
        warnings.push('已跳过使用 MD5 的账户');
        continue;
      } else {
        warnings.push('已跳过使用未知算法的账户');
        continue;
      }
      const digits = account.digits === 2 ? 8 : 6;
      const parts = labelParts(account.name);
      const issuer = String(account.issuer || parts.issuer || '').trim().slice(0, 80);
      const name = String(parts.account || parts.issuer || '').trim().slice(0, 120) || '未命名账户';
      items.push({
        issuer: issuer,
        account: name,
        secret: util.bytesToBase32(new Uint8Array(account.secret)),
        algorithm: algorithm,
        digits: digits,
        period: 30,
        type: 'totp'
      });
    }

    if (payload.batchSize > 1) {
      const part = Math.min(payload.batchSize, payload.batchIndex + 1);
      warnings.push('这是迁移二维码的第 ' + part + ' / ' + payload.batchSize + ' 批，请继续扫描其余批次。');
    }
    if (!items.length) throw new Error('迁移二维码中没有可用的 TOTP 账户');
    return { items: items, warnings: warnings, batchSize: payload.batchSize, batchIndex: payload.batchIndex };
  };

  function dedupeItems(items) {
    const seen = new Map();
    for (const item of items) {
      const key = (item.issuer || '').toLowerCase() + '|' + (item.account || '').toLowerCase() + '|' + item.secret;
      if (!seen.has(key)) seen.set(key, item);
    }
    return Array.from(seen.values());
  }

  parse.input = function (input) {
    const raw = String(input == null ? '' : input).trim();
    if (!raw) throw new Error('请输入二维码内容或 otpauth 链接');

    const matches = raw.match(/otpauth(?:-migration)?:\/\/[^\s"'<>]+/gi) || [];
    if (!matches.length) throw new Error('没有找到有效的 otpauth 链接');

    const items = [];
    const warnings = [];
    const errors = [];
    for (let i = 0; i < Math.min(matches.length, 200); i++) {
      let uri = matches[i].replace(/[\u3000),.;]+$/g, '');
      try {
        if (/^otpauth-migration:/i.test(uri)) {
          const result = parse.migration(uri);
          items.push.apply(items, result.items);
          warnings.push.apply(warnings, result.warnings || []);
        } else {
          items.push(parse.otpauth(uri));
        }
      } catch (error) {
        errors.push(error.message);
      }
    }

    if (!items.length) {
      const error = new Error(errors[0] || '没有找到有效的 TOTP 账户');
      error.details = errors;
      throw error;
    }
    return {
      items: dedupeItems(items).slice(0, 500),
      warnings: warnings,
      errors: errors
    };
  };

  parse.dedupeItems = dedupeItems;
})();
