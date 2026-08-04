// 测试手写引擎与 iztro 对拍
const fs = require('fs');
const vm = require('vm');
const iztro = require('C:/Users/USER/Desktop/Claude-code/zwds-agent/node_modules/iztro/lib/index.js');
const { astro } = iztro;

// 构造浏览器上下文
const context = { console, require, module, exports, globalThis: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('C:/Users/USER/WorkBuddy/2026-07-28-23-15-09/zwds/js/data-tables.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('C:/Users/USER/WorkBuddy/2026-07-28-23-15-09/zwds/js/engine.js', 'utf8'), context);

function runEngine(lunarStr, timeIndex, gender, school) {
  // 用 iztro 拿到年月干支（先重置配置避免 require 缓存污染）
  astro.config({
    algorithm: school === 'zhongzhou' ? 'zhongzhou' : 'default',
    mutagens: school === 'zhongzhou'
      ? { gengHeavenly: ['taiyangMaj', 'wuquMaj', 'tianfuMaj', 'tiantongMaj'] }
      : { gengHeavenly: ['taiyangMaj', 'wuquMaj', 'taiyinMaj', 'tiantongMaj'] }
  });
  const a = astro.byLunar(lunarStr, timeIndex, gender);
  const [yearStem, yearBranch] = a.rawDates.chineseDate.yearly;
  const lunarMonth = a.rawDates.lunarDate.lunarMonth;
  const lunarDay = a.rawDates.lunarDate.lunarDay;
  const engine = new context.globalThis.ZWDSEngine({ yearStem, yearBranch, lunarMonth, lunarDay, hourIndex: timeIndex, gender, school });
  return { iztro: a, engine: engine.compute(), yearStem, yearBranch, lunarMonth, lunarDay };
}

function parseLunarMonth(str) {
  const map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12 };
  const m = str.match(/年(闰?)([十廿]?[一二三四五六七八九十]+)月/);
  return map[m[2]] || 0;
}
function parseLunarDay(str) {
  const map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12,'十三':13,'十四':14,'十五':15,'十六':16,'十七':17,'十八':18,'十九':19,'二十':20,'廿一':21,'廿二':22,'廿三':23,'廿四':24,'廿五':25,'廿六':26,'廿七':27,'廿八':28,'廿九':29,'三十':30 };
  const m = str.match(/月([廿卅]?[一二三四五六七八九十]+)日/);
  return map[m[1]] || 0;
}

function compare(label, r) {
  console.log(`\n===== ${label} =====`);
  const a = r.iztro;
  const e = r.engine;
  const checks = [];
  checks.push(['命宫地支', a.earthlyBranchOfSoulPalace === e.summary.soulBranch, a.earthlyBranchOfSoulPalace, e.summary.soulBranch]);
  checks.push(['身宫地支', a.earthlyBranchOfBodyPalace === e.summary.bodyBranch, a.earthlyBranchOfBodyPalace, e.summary.bodyBranch]);
  checks.push(['五行局', a.fiveElementsClass === e.summary.fiveElementsClass, a.fiveElementsClass, e.summary.fiveElementsClass]);
  checks.push(['命主', a.soul === e.summary.soulStar, a.soul, e.summary.soulStar]);
  checks.push(['身主', a.body === e.summary.bodyStar, a.body, e.summary.bodyStar]);

  // 逐宫比对主星集合
  a.palaces.forEach((p, i) => {
    const ep = e.palaces[i];
    const izSet = new Set([...p.majorStars.map(s => s.name), ...p.minorStars.map(s => s.name)]);
    const enSet = new Set([...ep.majorStars, ...ep.minorStars]);
    const onlyIz = [...izSet].filter(x => !enSet.has(x));
    const onlyEn = [...enSet].filter(x => !izSet.has(x));
    const ok = onlyIz.length === 0 && onlyEn.length === 0;
    if (!ok) checks.push([`${p.earthlyBranch}宫星曜`, ok, [...izSet].join(','), [...enSet].join(',')]);
  });

  // 四化比对
  const izMutagen = [];
  a.palaces.forEach(p => [...p.majorStars, ...p.minorStars].forEach(s => { if (s.mutagen) izMutagen.push(`${s.name}化${s.mutagen}@${p.earthlyBranch}`); }));
  const enMutagen = [];
  e.palaces.forEach(p => p.stars.forEach(s => { if (s.mutagen) enMutagen.push(`${s.name}化${s.mutagen}@${p.branch}`); }));
  const mutOk = JSON.stringify(izMutagen.sort()) === JSON.stringify(enMutagen.sort());
  checks.push(['四化', mutOk, izMutagen.join(' '), enMutagen.join(' ')]);

  let allOk = true;
  checks.forEach(([label, ok, got, want]) => {
    if (!ok) allOk = false;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label} | got=${got} | want=${want}`);
  });
  console.log(allOk ? '>>> 全部通过' : '>>> 有失败项');
  return allOk;
}

console.log('案例A 中州派');
const a = runEngine('1990-4-21', 4, '男', 'zhongzhou');
compare('案例A', a);

console.log('\n案例B 中州派');
const b = runEngine('1988-10-3', 1, '男', 'zhongzhou');
compare('案例B', b);

console.log('\n案例A 全书派');
const a2 = runEngine('1990-4-21', 4, '男', 'quanshu');
compare('案例A 全书派', a2);
