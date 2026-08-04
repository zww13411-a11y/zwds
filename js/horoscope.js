/**
 * 运限计算、切换、嵌套导航
 */
(function (root) {
  'use strict';

  const state = root.zwdsState;
  const $ = root.ZWDSUtils.$;
  const $$ = root.ZWDSUtils.$$;
  const escapeHtml = root.ZWDSUtils.escapeHtml;
  const formatDateTime = root.ZWDSUtils.formatDateTime;
  const parseLunarDate = root.ZWDSUtils.parseLunarDate;
  const hourIndexFromDate = root.ZWDSUtils.hourIndexFromDate;
  const hourIndexToIztro = root.ZWDSUtils.hourIndexToIztro;
  const parseDateStr = root.ZWDSUtils.parseDateStr;
  const lunarDayText = root.ZWDSUtils.lunarDayText;
  const HOUR_BRANCHES = root.ZWDSConfig.HOUR_BRANCHES;
  const HOUR_TO_REAL_HOUR = root.ZWDSConfig.HOUR_TO_REAL_HOUR;
  const LUNAR_MONTHS = root.ZWDSConfig.LUNAR_MONTHS;
  const SCOPE_LABELS = root.ZWDSConfig.SCOPE_LABELS;

  function setScope(scope) {
    state.scope = scope;
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.scope === scope));
    renderNestedNav();
    root.ZWDSChartRenderer.renderChart();
    updateHoroscopeInfo();
  }

  function updateHoroscope() {
    if (!state.astrolabe || !state.engine) return;
    const a = state.astrolabe;
    const t = state.targetDate;
    const hIdx = hourIndexFromDate(t);
    const iztroHour = hourIndexToIztro(hIdx);
    let h;
    try {
      h = state.horoscope = a.horoscope(t, iztroHour);
    } catch (err) {
      console.error('运限计算失败：', err);
      return;
    }

    const lunar = parseLunarDate(h.lunarDate);
    if (lunar) {
      state.nested = {
        year: lunar.year,
        month: lunar.month,
        day: lunar.day,
        hour: hIdx
      };
      state.horoscopeResult = state.engine.calcHoroscope({
        nominalAge: h.age.nominalAge,
        yearlyStem: h.yearly.heavenlyStem,
        yearlyBranch: h.yearly.earthlyBranch,
        monthlyStem: h.monthly.heavenlyStem,
        monthlyBranch: h.monthly.earthlyBranch,
        dailyStem: h.daily.heavenlyStem,
        dailyBranch: h.daily.earthlyBranch,
        hourlyStem: h.hourly.heavenlyStem,
        hourlyBranch: h.hourly.earthlyBranch,
        targetLunarMonth: lunar.month,
        targetLunarDay: lunar.day,
        targetHourIndex: hIdx,
        birthIsLeap: !!a.rawDates.lunarDate.isLeap,
        targetIsLeap: lunar.isLeap
      });
      compareHoroscope();
      root.ZWDSApp.renderSteps();
    }
    root.ZWDSChartRenderer.renderChart();
    updateHoroscopeInfo();
    renderNestedNav();
    $('#targetTime').textContent = formatDateTime(t);
  }

  function updateHoroscopeInfo() {
    const info = $('#horoscopeInfo');
    if (!state.horoscope || state.scope === 'origin') {
      info.innerHTML = '当前显示本命盘。切换到大限/流年等标签可查看运限盘，时间轴可前后拖动或跟随实时。';
    } else {
      const h = state.horoscope[state.scope];
      const a = state.astrolabe;
      const palaceBranch = a.palaces[h.index].earthlyBranch;
      const palaceName = h.palaceNames[h.index];
      const stars = (h.stars && h.stars[h.index]) ? h.stars[h.index].map(s => s.name).join(' ') : '';
      const mut = h.mutagen.map((s, i) => `${s}化${['禄', '权', '科', '忌'][i]}`).join(' ');
      const cmp = state.horoscopeCompare || {};
      const ok = cmp[state.scope] !== false;
      info.innerHTML = `
        <strong>${SCOPE_LABELS[state.scope]}</strong>
        命宫:${palaceBranch}(${palaceName}) · 运限干支:${h.heavenlyStem}${h.earthlyBranch}
        · 流耀:${stars || '无'} · 四化:${mut}
        <span class="badge ${ok ? '' : 'warn'}">${ok ? '✓ 与 iztro 一致' : '✗ 存在分歧'}</span>
      `;
    }
    root.ZWDSAnalysis.renderAnalysisPanel();
  }

  function compareHoroscope() {
    const h = state.horoscope;
    const r = state.horoscopeResult;
    if (!h || !r) return;
    state.horoscopeCompare = {
      age: h.age.index === r.ageIndex,
      yearly: h.yearly.index === r.yearlyIndex,
      monthly: h.monthly.index === r.monthlyIndex,
      daily: h.daily.index === r.dailyIndex,
      hourly: h.hourly.index === r.hourlyIndex
    };
  }

  function navigateNested(action, value) {
    if (!state.astrolabe) return;
    const genderName = $('#genderInput').value === 'male' ? '男' : '女';
    const v = parseInt(value, 10);
    state.followRealtime = false;
    $('#followRealtime').classList.remove('active');

    if (action === 'month') {
      const tmp = iztro.astro.byLunar(`${state.nested.year}-${v}-1`, 0, genderName, false, true, 'zh-CN');
      state.targetDate = parseDateStr(tmp.solarDate, 0);
      setScope('monthly');
    } else if (action === 'day') {
      const hourIdx = state.nested.hour || 0;
      const tmp = iztro.astro.byLunar(`${state.nested.year}-${state.nested.month}-${v}`, hourIndexToIztro(hourIdx), genderName, false, true, 'zh-CN');
      state.targetDate = parseDateStr(tmp.solarDate, HOUR_TO_REAL_HOUR[hourIdx]);
      setScope('daily');
    } else if (action === 'hour') {
      const d = new Date(state.targetDate);
      d.setHours(HOUR_TO_REAL_HOUR[v]);
      state.targetDate = d;
      setScope('hourly');
    } else if (action === 'back') {
      const backMap = { monthly: 'yearly', daily: 'monthly', hourly: 'daily' };
      setScope(backMap[value] || 'yearly');
      return;
    }
    updateHoroscope();
  }

  function renderNestedNav() {
    const nav = $('#nestedNav');
    nav.innerHTML = '';
    const scope = state.scope;
    if (['origin', 'decadal', 'age'].includes(scope)) {
      nav.style.display = 'none';
      return;
    }
    nav.style.display = 'flex';

    const h = state.horoscope;
    const n = state.nested;
    if (!h || !n.year) return;

    const wrap = document.createElement('div');
    wrap.className = 'nested-wrap';

    const buildTitle = text => `<div class="nested-title">${escapeHtml(text)}</div>`;
    const buildBack = (to, label) => `<button class="nested-back" data-action="back" data-value="${to}">${escapeHtml(label)}</button>`;

    if (scope === 'yearly') {
      wrap.innerHTML = buildTitle(`${h.yearly.heavenlyStem}${h.yearly.earthlyBranch}年 · 选择流月`) +
        '<div class="nested-grid">' + LUNAR_MONTHS.map((m, i) => {
          const active = n.month === i + 1 ? 'active' : '';
          return `<button class="nested-item ${active}" data-action="month" data-value="${i + 1}">${m}</button>`;
        }).join('') + '</div>';
    } else if (scope === 'monthly') {
      wrap.innerHTML = buildBack('yearly', '← 返回流年') + buildTitle(`${h.yearly.heavenlyStem}${h.yearly.earthlyBranch}年${LUNAR_MONTHS[n.month - 1]} · 选择流日`) +
        '<div class="nested-grid days">' + Array.from({ length: 30 }, (_, i) => {
          const d = i + 1;
          const active = n.day === d ? 'active' : '';
          return `<button class="nested-item ${active}" data-action="day" data-value="${d}">${lunarDayText(d)}</button>`;
        }).join('') + '</div>';
    } else if (scope === 'daily') {
      wrap.innerHTML = buildBack('monthly', '← 返回流月') + buildTitle(`${h.yearly.heavenlyStem}${h.yearly.earthlyBranch}年${LUNAR_MONTHS[n.month - 1]}${lunarDayText(n.day)} · 选择流时`) +
        '<div class="nested-grid hours">' + HOUR_BRANCHES.map((hb, i) => {
          const active = n.hour === i ? 'active' : '';
          return `<button class="nested-item ${active}" data-action="hour" data-value="${i}">${hb}</button>`;
        }).join('') + '</div>';
    } else if (scope === 'hourly') {
      wrap.innerHTML = buildBack('daily', '← 返回流日') + buildTitle(`${h.yearly.heavenlyStem}${h.yearly.earthlyBranch}年${LUNAR_MONTHS[n.month - 1]}${lunarDayText(n.day)} ${HOUR_BRANCHES[n.hour]}时 · 当前流时`) +
        '<div class="nested-grid hours">' + HOUR_BRANCHES.map((hb, i) => {
          const active = n.hour === i ? 'active' : '';
          return `<button class="nested-item ${active}" data-action="hour" data-value="${i}">${hb}</button>`;
        }).join('') + '</div>';
    }

    nav.appendChild(wrap);
  }

  root.ZWDSHoroscope = {
    setScope, updateHoroscope, updateHoroscopeInfo,
    compareHoroscope, navigateNested, renderNestedNav
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
