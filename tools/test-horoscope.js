const { astro } = require('iztro/lib/index.js');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');

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
  const clean = str.replace('闰', '');
  const m = clean.match(/(.+)年(.+?)月(.+)$/);
  if (!m) return null;
  return { year: parseChineseNumber(m[1]), month: parseChineseNumber(m[2]), day: parseChineseNumber(m[3]) };
}

function runCase(label, lunarDate, hourIndex, gender, targetDate, targetHourIndex) {
  astro.config({ algorithm: 'zhongzhou' });
  const a = astro.byLunar(lunarDate, hourIndex, gender, false, true, 'zh-CN');
  const h = a.horoscope(targetDate, targetHourIndex);
  const lunar = parseLunarDate(h.lunarDate);

  const context = { console, require, module, exports, globalThis: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'data-tables.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'engine.js'), 'utf8'), context);
  const engine = new context.globalThis.ZWDSEngine({
    yearStem: a.rawDates.chineseDate.yearly[0],
    yearBranch: a.rawDates.chineseDate.yearly[1],
    lunarMonth: a.rawDates.lunarDate.lunarMonth,
    lunarDay: a.rawDates.lunarDate.lunarDay,
    hourIndex,
    gender: gender === '男' ? 'male' : 'female',
    school: 'zhongzhou'
  });
  engine.compute();
  const r = engine.calcHoroscope({
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
    targetHourIndex,
    birthIsLeap: !!a.rawDates.lunarDate.isLeap,
    targetIsLeap: h.lunarDate.includes('闰')
  });

  console.log(`\n=== ${label} 目标 ${targetDate} 辰时 ===`);
  console.log('lunarDate:', h.lunarDate, 'parsed:', lunar);
  const cmp = {
    age: h.age.index === r.ageIndex,
    yearly: h.yearly.index === r.yearlyIndex,
    monthly: h.monthly.index === r.monthlyIndex,
    daily: h.daily.index === r.dailyIndex,
    hourly: h.hourly.index === r.hourlyIndex
  };
  console.log('compare:', cmp);
  console.log('iztro:', { age: h.age.index, yearly: h.yearly.index, monthly: h.monthly.index, daily: h.daily.index, hourly: h.hourly.index });
  console.log('engine:', { age: r.ageIndex, yearly: r.yearlyIndex, monthly: r.monthlyIndex, daily: r.dailyIndex, hourly: r.hourlyIndex });
  r.logs.forEach(l => console.log(l.title, '→', l.result));
  return cmp;
}

let all = true;
all = runCase('案例A', '1990-4-21', 4, '男', '2026-07-28', 4) && all;
all = runCase('案例B', '1988-10-3', 1, '男', '2026-07-28', 4) && all;
all = runCase('案例B', '1988-10-3', 1, '男', '2025-01-15', 6) && all;
console.log('\n全部通过:', all);
