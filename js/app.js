/**
 * 应用入口：事件绑定、排盘、对拍、步骤渲染、API 覆盖
 */
(function () {
  'use strict';

  const state = window.zwdsState;
  const $ = window.ZWDSUtils.$;
  const $$ = window.ZWDSUtils.$$;
  const debounce = window.ZWDSUtils.debounce;
  const formatDateLocal = window.ZWDSUtils.formatDateLocal;
  const hourIndexFromDate = window.ZWDSUtils.hourIndexFromDate;
  const hourIndexToIztro = window.ZWDSUtils.hourIndexToIztro;
  const isValidDateStr = window.ZWDSUtils.isValidDateStr;
  const applySchoolConfig = window.ZWDSUtils.applySchoolConfig;
  const escapeHtml = window.ZWDSUtils.escapeHtml;
  const HOURS = window.ZWDSConfig.HOURS;

  function init() {
    const hourSel = $('#hourInput');
    HOURS.forEach((h, i) => { const o = document.createElement('option'); o.value = i; o.textContent = h; hourSel.appendChild(o); });
    hourSel.value = 4;

    $('#calcBtn').addEventListener('click', calculate);
    $('#nowBtn').addEventListener('click', () => {
      const now = new Date();
      $('#dateInput').value = formatDateLocal(now);
      $('#hourInput').value = hourIndexFromDate(now);
    });
    $$('.tab').forEach(tab => tab.addEventListener('click', () => { window.ZWDSHoroscope.setScope(tab.dataset.scope); }));

    const debouncedUpdateHoroscope = debounce(window.ZWDSHoroscope.updateHoroscope, 150);
    $('#followRealtime').addEventListener('click', () => {
      state.followRealtime = !state.followRealtime;
      $('#followRealtime').classList.toggle('active', state.followRealtime);
      if (state.followRealtime) state.targetDate = new Date();
      window.ZWDSHoroscope.updateHoroscope();
    });
    $('#timeSlider').addEventListener('input', () => {
      state.followRealtime = false;
      $('#followRealtime').classList.remove('active');
      const maxHours = 30 * 24;
      const offset = (($('#timeSlider').value - 50) / 50) * maxHours;
      state.targetDate = new Date(Date.now() + offset * 3600000);
      debouncedUpdateHoroscope();
    });

    $('#nestedNav').addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      window.ZWDSHoroscope.navigateNested(btn.dataset.action, btn.dataset.value);
    });

    setInterval(() => {
      if (state.followRealtime) {
        state.targetDate = new Date();
        window.ZWDSHoroscope.updateHoroscope();
      }
    }, 60000);

    // 覆盖 API 中由 app 提供的入口
    window.zwdsAPI.calculate = calculate;
    window.zwdsAPI.setScope = window.ZWDSHoroscope.setScope;
    window.zwdsAPI.navigateNested = window.ZWDSHoroscope.navigateNested;
    window.zwdsAPI.updateHoroscope = window.ZWDSHoroscope.updateHoroscope;

    window.ZWDSApp = { calculate, compareAll, renderSteps };

    calculate();
  }

  function calculate() {
    const calendarType = document.querySelector('input[name="calendarType"]:checked').value;
    const dateStr = $('#dateInput').value.trim();
    const timeIndex = parseInt($('#hourInput').value, 10);
    const gender = $('#genderInput').value;
    const school = $('#schoolInput').value;

    if (!dateStr) { alert('请输入出生日期'); return; }
    if (calendarType === 'solar' && !isValidDateStr(dateStr)) {
      alert('公历日期格式应为：1990-05-15'); return;
    }

    applySchoolConfig(school);

    const genderName = gender === 'male' ? '男' : '女';
    const iztroHour = hourIndexToIztro(timeIndex);
    let astrolabe;
    try {
      if (calendarType === 'solar') {
        astrolabe = iztro.astro.bySolar(dateStr, iztroHour, genderName, true, 'zh-CN');
      } else {
        astrolabe = iztro.astro.byLunar(dateStr, iztroHour, genderName, false, true, 'zh-CN');
      }
    } catch (err) {
      alert('排盘失败：' + (err.message || err));
      return;
    }
    state.astrolabe = astrolabe;

    const rd = astrolabe.rawDates;
    const engineInput = {
      yearStem: rd.chineseDate.yearly[0],
      yearBranch: rd.chineseDate.yearly[1],
      lunarMonth: rd.lunarDate.lunarMonth,
      lunarDay: rd.lunarDate.lunarDay,
      hourIndex: timeIndex,
      gender: gender,
      school: school
    };
    const engine = new ZWDSEngine(engineInput);
    state.engine = engine;
    state.engineResult = engine.compute();

    compareAll();
    renderSteps();
    window.ZWDSChartRenderer.renderChart();
    window.ZWDSHoroscope.updateHoroscope();
  }

  function compareAll() {
    const a = state.astrolabe;
    const e = state.engineResult;
    const cmp = {};

    cmp.soulBranch = a.earthlyBranchOfSoulPalace === e.summary.soulBranch;
    cmp.bodyBranch = a.earthlyBranchOfBodyPalace === e.summary.bodyBranch;
    cmp.fiveElements = a.fiveElementsClass === e.summary.fiveElementsClass;
    cmp.soulStar = a.soul === e.summary.soulStar;
    cmp.bodyStar = a.body === e.summary.bodyStar;
    cmp.ziweiBranch = e.summary.ziweiBranch === a.palaces.find(p => p.majorStars.some(s => s.name === '紫微')).earthlyBranch;
    cmp.tianfuBranch = e.summary.tianfuBranch === a.palaces.find(p => p.majorStars.some(s => s.name === '天府')).earthlyBranch;

    cmp.palaceNames = a.palaces.every((p, i) => p.name === e.palaces[i].name);
    cmp.palaceStems = a.palaces.every((p, i) => p.heavenlyStem === e.palaces[i].stem);

    cmp.majorStars = true;
    a.palaces.forEach((p, i) => {
      const enMajor = new Set(e.palaces[i].majorStars);
      const izMajor = new Set(p.majorStars.map(s => s.name));
      if ([...enMajor].some(x => !izMajor.has(x)) || [...izMajor].some(x => !enMajor.has(x))) cmp.majorStars = false;
    });

    cmp.minorStars = true;
    a.palaces.forEach((p, i) => {
      const enMinor = new Set(e.palaces[i].minorStars);
      const izMinor = new Set(p.minorStars.map(s => s.name));
      if ([...enMinor].some(x => !izMinor.has(x)) || [...izMinor].some(x => !enMinor.has(x))) cmp.minorStars = false;
    });

    const enMut = [];
    e.palaces.forEach(p => p.stars.forEach(s => { if (s.mutagen) enMut.push(`${s.name}@${p.branch}@${s.mutagen}`); }));
    const izMut = [];
    a.palaces.forEach(p => [...p.majorStars, ...p.minorStars].forEach(s => { if (s.mutagen) izMut.push(`${s.name}@${p.earthlyBranch}@${s.mutagen}`); }));
    cmp.mutagen = JSON.stringify(enMut.sort()) === JSON.stringify(izMut.sort());

    cmp.decadal = true;
    a.palaces.forEach((p, i) => {
      if (!p.decadal || !e.palaces[i].decadal) return;
      if (p.decadal.range[0] !== e.palaces[i].decadal.start || p.decadal.range[1] !== e.palaces[i].decadal.end) cmp.decadal = false;
    });

    state.compare = cmp;
  }

  function renderSteps() {
    const container = $('#stepsList');
    container.innerHTML = '';
    const cmp = state.compare;
    const stepChecks = {
      '① 定命宫': cmp.soulBranch,
      '② 定身宫': cmp.bodyBranch,
      '③ 安十二宫名': cmp.palaceNames,
      '④ 五虎遁定宫干': cmp.palaceStems,
      '⑤ 定五行局': cmp.fiveElements,
      '⑥ 定紫微星': cmp.ziweiBranch,
      '⑦ 定天府星': cmp.tianfuBranch,
      '⑧ 安十四主星': cmp.majorStars,
      '⑨ 安辅星': cmp.minorStars,
      '⑩ 安四化': cmp.mutagen,
      '⑪ 命主身主': cmp.soulStar && cmp.bodyStar,
      '⑫ 排大限': cmp.decadal
    };

    state.engineResult.logs.forEach(log => {
      const ok = stepChecks[log.title] !== false;
      const div = document.createElement('div');
      div.className = 'step';
      div.innerHTML = `
        <div class="step-header">
          <span class="title">${log.title}</span>
          <span class="badge ${ok ? '' : 'warn'}">${ok ? '✓ 与 iztro 一致' : '✗ 存在分歧'}</span>
        </div>
        <div class="step-body">
          <div class="formula">口诀/公式: ${escapeHtml(log.formula)}</div>
          <div class="calc">${escapeHtml(log.calc)}</div>
          <div class="result">结果: ${escapeHtml(log.result)}</div>
          ${log.note ? `<div class="note">说明: ${escapeHtml(log.note)}</div>` : ''}
          ${log.analysis ? `<div class="analysis"><strong>解析:</strong> ${escapeHtml(log.analysis)}</div>` : ''}
        </div>
      `;
      div.querySelector('.step-header').addEventListener('click', () => div.classList.toggle('open'));
      container.appendChild(div);
    });

    if (state.horoscopeResult && state.horoscopeResult.logs) {
      const hcmp = state.horoscopeCompare || {};
      const hstepChecks = {
        '⑬ 起小限': hcmp.age,
        '⑭ 起流年': hcmp.yearly,
        '⑮ 起流月': hcmp.monthly,
        '⑯ 起流日': hcmp.daily,
        '⑰ 起流时': hcmp.hourly
      };
      state.horoscopeResult.logs.forEach(log => {
        const ok = hstepChecks[log.title] !== false;
        const div = document.createElement('div');
        div.className = 'step horoscope-step';
        div.innerHTML = `
          <div class="step-header">
            <span class="title">${log.title}</span>
            <span class="badge ${ok ? '' : 'warn'}">${ok ? '✓ 与 iztro 一致' : '✗ 存在分歧'}</span>
          </div>
          <div class="step-body">
            <div class="formula">口诀/公式: ${escapeHtml(log.formula)}</div>
            <div class="calc">${escapeHtml(log.calc)}</div>
            <div class="result">结果: ${escapeHtml(log.result)}</div>
            ${log.note ? `<div class="note">说明: ${escapeHtml(log.note)}</div>` : ''}
            ${log.analysis ? `<div class="analysis"><strong>解析:</strong> ${escapeHtml(log.analysis)}</div>` : ''}
          </div>
        `;
        div.querySelector('.step-header').addEventListener('click', () => div.classList.toggle('open'));
        container.appendChild(div);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
