/**
 * 全局常量配置
 */
(function (root) {
  'use strict';

  const HOURS = [
    '子 23:00-01:00', '丑 01:00-03:00', '寅 03:00-05:00', '卯 05:00-07:00',
    '辰 07:00-09:00', '巳 09:00-11:00', '午 11:00-13:00', '未 13:00-15:00',
    '申 15:00-17:00', '酉 17:00-19:00', '戌 19:00-21:00', '亥 21:00-23:00',
    '晚子 23:00-00:00'
  ];

  const HOUR_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '晚子'];

  const HOUR_TO_REAL_HOUR = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 23];

  const LUNAR_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];

  const SCOPE_LABELS = {
    origin: '本命盘', decadal: '大限', age: '小限',
    yearly: '流年', monthly: '流月', daily: '流日', hourly: '流时'
  };

  // 4×4 网格中 12 个宫位的排列顺序，-1 表示中心区域
  const GRID_ORDER = [3, 4, 5, 6, 2, -1, -1, 7, 1, -1, -1, 8, 0, 11, 10, 9];

  root.ZWDSConfig = {
    HOURS, HOUR_BRANCHES, HOUR_TO_REAL_HOUR,
    LUNAR_MONTHS, SCOPE_LABELS, GRID_ORDER
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
