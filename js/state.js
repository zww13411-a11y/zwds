/**
 * 全局运行时状态
 */
(function (root) {
  'use strict';

  const state = {
    astrolabe: null,
    engine: null,
    engineResult: null,
    horoscope: null,
    horoscopeResult: null,
    scope: 'origin',
    targetDate: new Date(),
    followRealtime: true,
    compare: {},
    horoscopeCompare: {},
    nested: { year: null, month: null, day: null, hour: null }
  };

  root.zwdsState = state;
})(typeof globalThis !== 'undefined' ? globalThis : this);
