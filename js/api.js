/**
 * 对外 API 与数据导出
 */
(function (root) {
  'use strict';

  const state = root.zwdsState;
  const $ = root.ZWDSUtils.$;
  const serializeDate = root.ZWDSUtils.serializeDate;
  const SCOPE_LABELS = root.ZWDSConfig.SCOPE_LABELS;

  function exportData() {
    if (!state.astrolabe) return null;
    const a = state.astrolabe;
    return {
      input: {
        calendarType: document.querySelector('input[name="calendarType"]:checked').value,
        dateStr: $('#dateInput').value,
        hourIndex: parseInt($('#hourInput').value, 10),
        gender: $('#genderInput').value,
        school: $('#schoolInput').value
      },
      birth: {
        solarDate: a.solarDate,
        lunarDate: a.lunarDate,
        chineseDate: a.chineseDate,
        rawDates: a.rawDates,
        fiveElementsClass: a.fiveElementsClass,
        soul: a.soul,
        body: a.body,
        soulPalaceBranch: a.earthlyBranchOfSoulPalace,
        bodyPalaceBranch: a.earthlyBranchOfBodyPalace
      },
      nativePalaces: a.palaces.map(p => ({
        index: p.index,
        name: p.name,
        heavenlyStem: p.heavenlyStem,
        earthlyBranch: p.earthlyBranch,
        isBodyPalace: p.isBodyPalace,
        majorStars: p.majorStars.map(s => ({ name: s.name, brightness: s.brightness, mutagen: s.mutagen })),
        minorStars: p.minorStars.map(s => ({ name: s.name, mutagen: s.mutagen })),
        adjectiveStars: p.adjectiveStars,
        changsheng12: p.changsheng12,
        decadal: p.decadal,
        ages: p.ages
      })),
      engineNative: state.engineResult ? {
        summary: state.engineResult.summary,
        logs: state.engineResult.logs
      } : null,
      scope: state.scope,
      nested: state.nested,
      targetDate: serializeDate(state.targetDate),
      horoscope: state.horoscope ? {
        age: state.horoscope.age,
        yearly: state.horoscope.yearly,
        monthly: state.horoscope.monthly,
        daily: state.horoscope.daily,
        hourly: state.horoscope.hourly,
        lunarDate: state.horoscope.lunarDate
      } : null,
      engineHoroscope: state.horoscopeResult ? {
        logs: state.horoscopeResult.logs,
        ageIndex: state.horoscopeResult.ageIndex,
        yearlyIndex: state.horoscopeResult.yearlyIndex,
        monthlyIndex: state.horoscopeResult.monthlyIndex,
        dailyIndex: state.horoscopeResult.dailyIndex,
        hourlyIndex: state.horoscopeResult.hourlyIndex
      } : null,
      compare: state.compare,
      horoscopeCompare: state.horoscopeCompare
    };
  }

  function getInput() {
    return {
      calendarType: document.querySelector('input[name="calendarType"]:checked').value,
      dateStr: $('#dateInput').value,
      hourIndex: parseInt($('#hourInput').value, 10),
      gender: $('#genderInput').value,
      school: $('#schoolInput').value
    };
  }

  function summarize() {
    const d = exportData();
    if (!d) return '尚未排盘';
    const lines = [
      `出生：公历${d.birth.solarDate}，农历${d.birth.lunarDate}，八字${d.birth.chineseDate}`,
      `五行局：${d.birth.fiveElementsClass}，命主${d.birth.soul}，身主${d.birth.body}，命宫${d.birth.soulPalaceBranch}，身宫${d.birth.bodyPalaceBranch}`,
      `当前视图：${SCOPE_LABELS[d.scope]}，目标时间：${d.targetDate}`
    ];
    if (d.horoscope && d.scope !== 'origin') {
      const h = d.horoscope[d.scope];
      lines.push(`${SCOPE_LABELS[d.scope]}命宫：${d.nativePalaces[h.index].earthlyBranch}宫(${h.palaceNames[h.index]})，干支${h.heavenlyStem}${h.earthlyBranch}，四化${h.mutagen.join('、')}`);
    }
    return lines.join('\n');
  }

  function exportLLMData() {
    const d = exportData();
    if (!d) return null;
    return root.ZWDSLLMExport.exportLLMData({
      nativePalaces: d.nativePalaces,
      horoscope: {
        yearly: d.horoscope ? d.horoscope.yearly : null,
        monthly: d.horoscope ? d.horoscope.monthly : null,
        daily: d.horoscope ? d.horoscope.daily : null,
        hourly: d.horoscope ? d.horoscope.hourly : null,
      },
      scope: d.scope === 'origin' ? 'yearly' : d.scope,
      nested: d.nested,
      targetDate: d.targetDate,
      birth: d.birth,
    });
  }

  function summarizeLLM() {
    const d = exportData();
    if (!d) return '尚未排盘';
    if (d.scope === 'origin') {
      return summarize();
    }
    return root.ZWDSLLMExport.summarizeLLM({
      nativePalaces: d.nativePalaces,
      horoscope: {
        yearly: d.horoscope ? d.horoscope.yearly : null,
        monthly: d.horoscope ? d.horoscope.monthly : null,
        daily: d.horoscope ? d.horoscope.daily : null,
        hourly: d.horoscope ? d.horoscope.hourly : null,
      },
      scope: d.scope,
      nested: d.nested,
      targetDate: d.targetDate,
      birth: d.birth,
    });
  }

  function summarizeShort() {
    const d = exportData();
    if (!d) return '尚未排盘';
    if (d.scope === 'origin') return summarize();
    return root.ZWDSLLMExport.summarizeShort({
      nativePalaces: d.nativePalaces,
      horoscope: {
        yearly: d.horoscope ? d.horoscope.yearly : null,
        monthly: d.horoscope ? d.horoscope.monthly : null,
        daily: d.horoscope ? d.horoscope.daily : null,
        hourly: d.horoscope ? d.horoscope.hourly : null,
      },
      scope: d.scope,
      nested: d.nested,
      targetDate: d.targetDate,
      birth: d.birth,
    });
  }

  root.zwdsAPI = {
    calculate: () => { /* app.js 初始化时覆盖 */ },
    setScope: () => {},
    navigateNested: () => {},
    updateHoroscope: () => {},
    exportData,
    getState: () => state,
    getInput,
    summarize,
    exportLLMData,
    summarizeLLM,
    summarizeShort
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
