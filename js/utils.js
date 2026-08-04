/**
 * 通用工具函数：DOM、日期、农历、时辰、格式化、HTML 转义
 */
(function (root) {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const $$ = sel => document.querySelectorAll(sel);

  function debounce(fn, wait) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function formatDateLocal(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatDateTime(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function serializeDate(d) {
    return d ? d.toISOString() : null;
  }

  function hourIndexFromDate(d) {
    const h = d.getHours();
    if (h === 0) return 0; // 早子
    if (h === 23) return 12; // 晚子
    return Math.floor((h + 1) / 2);
  }

  // UI 的 12（晚子）在调用 iztro 时映射回 0（子），iztro 内部按 0-11 处理
  function hourIndexToIztro(idx) {
    return idx === 12 ? 0 : idx;
  }

  function isValidDateStr(str) {
    return /^\d{4}-\d{1,2}-\d{1,2}$/.test(str.trim());
  }

  function parseDateStr(str, hour) {
    const [y, m, d] = str.split('-').map(Number);
    if (!y || !m || !d || m > 12 || d > 31) return null;
    return new Date(y, m - 1, d, hour || 0, 0, 0);
  }

  function parseChineseNumber(s) {
    const map = { '〇': 0, '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '正': 1, '冬': 11, '腊': 12 };
    if (map[s] !== undefined) return map[s];
    if (s === '十') return 10;
    if (s.startsWith('十')) return 10 + (map[s[1]] || 0);
    if (s.endsWith('十')) {
      const prefix = s.slice(0, -1);
      return (prefix ? (map[prefix] || 1) : 1) * 10;
    }
    if (s.includes('十')) {
      const parts = s.split('十');
      return (map[parts[0]] || 0) * 10 + (map[parts[1]] || 0);
    }
    let n = 0;
    for (const c of s) n = n * 10 + (map[c] || 0);
    return n;
  }

  function parseLunarDate(str) {
    if (!str) return null;
    const raw = String(str).trim();
    const isLeap = raw.includes('闰');
    let clean = raw.replace(/闰/g, '').replace(/\s+/g, '');
    // 支持可选的“日”后缀，如：二〇二六年六月十五 / 二〇二六年六月十五日
    clean = clean.replace(/日$/, '');
    const m = clean.match(/^(.+)年(.+?)月(.+)$/);
    if (!m) return null;
    return {
      year: parseChineseNumber(m[1]),
      month: parseChineseNumber(m[2]),
      day: parseChineseNumber(m[3].replace(/^初/, '')),
      isLeap: isLeap
    };
  }

  function lunarDayText(d) {
    if (d === 1) return '初一';
    if (d === 10) return '初十';
    if (d === 20) return '二十';
    if (d === 30) return '三十';
    const tens = Math.floor(d / 10);
    const ones = d % 10;
    const tenMap = { 0: '初', 1: '十', 2: '廿', 3: '三' };
    const num = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    return tenMap[tens] + num[ones];
  }

  function applySchoolConfig(school) {
    if (school === 'zhongzhou') {
      iztro.astro.config({
        algorithm: 'zhongzhou',
        mutagens: { gengHeavenly: ['taiyangMaj', 'wuquMaj', 'tianfuMaj', 'tiantongMaj'] }
      });
    } else {
      iztro.astro.config({
        algorithm: 'default',
        mutagens: { gengHeavenly: ['taiyangMaj', 'wuquMaj', 'taiyinMaj', 'tiantongMaj'] }
      });
    }
  }

  root.ZWDSUtils = {
    $, $$, debounce, escapeHtml,
    formatDateLocal, formatDateTime, serializeDate,
    hourIndexFromDate, hourIndexToIztro,
    isValidDateStr, parseDateStr,
    parseChineseNumber, parseLunarDate, lunarDayText,
    applySchoolConfig
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
