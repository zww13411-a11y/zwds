// 验证网页端全书派四化
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const iztro = require('iztro/lib/index.js');
const root = path.resolve(__dirname, '..');

// 重置为全书派
iztro.astro.config({ algorithm: 'default', mutagens: { gengHeavenly: ['taiyangMaj', 'wuquMaj', 'taiyinMaj', 'tiantongMaj'] } });
const a = iztro.astro.byLunar('1990-4-21', 4, '男', false, true, 'zh-CN');
const mut = [];
a.palaces.forEach(p => [...p.majorStars, ...p.minorStars].forEach(s => { if (s.mutagen) mut.push(`${s.name}化${s.mutagen}@${p.earthlyBranch}`); }));
console.log('iztro 全书派 四化:', mut.join(' '));

const context = { console, require, module, exports, globalThis: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'data-tables.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'engine.js'), 'utf8'), context);
const e = new context.globalThis.ZWDSEngine({ yearStem: '庚', yearBranch: '午', lunarMonth: 4, lunarDay: 21, hourIndex: 4, gender: 'male', school: 'quanshu' }).compute();
const enMut = [];
e.palaces.forEach(p => p.stars.forEach(s => { if (s.mutagen) enMut.push(`${s.name}化${s.mutagen}@${p.branch}`); }));
console.log('engine 全书派 四化:', enMut.join(' '));
console.log('match:', JSON.stringify(mut.sort()) === JSON.stringify(enMut.sort()));
