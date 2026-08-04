// 验证 mutagens 覆盖 + 提取亮度表 + 确认数据结构
const iztro = require('C:/Users/USER/Desktop/Claude-code/zwds-agent/node_modules/iztro/lib/index.js');
const { astro } = iztro;
const fs = require('fs');

// 1. 覆盖庚年四化为中州派: 太阳禄 武曲权 天府科 天同忌
astro.config({ mutagens: { gengHeavenly: ['taiyangMaj', 'wuquMaj', 'tianfuMaj', 'tiantongMaj'] } });
const a = astro.byLunar('1990-4-21', 4, '男');
console.log('===== 覆盖后庚年四化 =====');
a.palaces.forEach(p => [...p.majorStars, ...p.minorStars].forEach(s => { if (s.mutagen) console.log(`${s.name} 化${s.mutagen} @${p.earthlyBranch}(${p.name})`); }));

// 2. 提取星曜亮度表
const starData = require('C:/Users/USER/Desktop/Claude-code/zwds-agent/node_modules/iztro/lib/star/index.js');
console.log('\n===== star 模块导出 =====', Object.keys(starData));

// 3. 看 data 模块
const data = require('C:/Users/USER/Desktop/Claude-code/zwds-agent/node_modules/iztro/lib/data/index.js');
console.log('===== data 模块导出 =====', Object.keys(data));

// 4. 找亮度定义
try {
  const { getStarBrightness } = require('C:/Users/USER/Desktop/Claude-code/zwds-agent/node_modules/iztro/lib/star/brightness.js');
  console.log('\nbrightness fn exists:', typeof getStarBrightness);
} catch (e) { console.log('no brightness.js:', e.message); }

// 5. palaces 数组顺序确认(案例A)
console.log('\n===== palaces 顺序 =====');
console.log(a.palaces.map((p, i) => `${i}:${p.earthlyBranch}`).join(' '));

// 6. 一颗星的完整字段
console.log('\n===== 星曜字段 =====');
console.log(JSON.stringify(a.palaces[0].majorStars[0]));
console.log(JSON.stringify(a.palaces[1].adjectiveStars[0]));

// 7. horoscope stars 数组与 palaces 的对齐: 大限 stars[11] 应落在丑宫
const b = astro.byLunar('1988-10-3', 1, '男');
const h = b.horoscope(new Date('2026-07-28T15:00:00'));
console.log('\n===== 大限 stars 对齐检查 =====');
h.decadal.stars.forEach((s, i) => { if (s.length) console.log(`palaces[${i}]=${b.palaces[i].earthlyBranch}: ${s.map(x => x.name).join(',')}`); });

// 8. 小限 palace
console.log('\n===== agePalace =====');
console.log('小限宫:', h.agePalace().earthlyBranch, h.agePalace().name);

// 9. 导出全部数据供前端参考(亮度表)
const allStars = ['ziweiMaj','tianjiMaj','taiyangMaj','wuquMaj','tiantongMaj','lianzhenMaj','tianfuMaj','taiyinMaj','tanlangMaj','jumenMaj','tianxiangMaj','tianliangMaj','qishaMaj','pojunMaj','zuofuMin','youbiMin','wenchangMin','wenquMin','tiankuiMin','tianyueMin','lucunMin','tianmaMin','qingyangMin','tuoluoMin','huoxingMin','lingxingMin','dikongMin','dijieMin'];
const cfg = astro.getConfig();
console.log('\n===== 当前 brightness 配置(keys) =====', Object.keys(cfg.brightness).length);
fs.writeFileSync('C:/Users/USER/WorkBuddy/2026-07-28-23-15-09/zwds/tools/config-dump.json', JSON.stringify(cfg, null, 2));
console.log('config dumped');

// 10. astrolabe 顶层字段
console.log('\n===== astrolabe 顶层字段 =====', Object.keys(a).filter(k => typeof a[k] !== 'function'));
