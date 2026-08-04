// 从 iztro 提取数据表,生成 js/data-tables.js 供网页手写引擎使用
const fs = require('fs');
const base = 'C:/Users/USER/Desktop/Claude-code/zwds-agent/node_modules/iztro/lib';
const d = require(base + '/data/index.js');
const hs = require(base + '/data/heavenlyStems.js');
const zhStar = require(base + '/i18n/locales/zh-CN/star.js');

// 星key->中文名映射
const zh = zhStar.default || zhStar;
const starNameMap = {};
Object.keys(d.STARS_INFO).forEach(k => { if (zh[k]) starNameMap[k] = zh[k]; });

// 亮度表: key -> { name, fiveElements, yinYang, brightness[12] (寅=0..丑=11) }
const B_KEY = { miao: '庙', wang: '旺', de: '得', li: '利', ping: '平', bu: '不', xian: '陷' };
const brightness = {};
Object.entries(d.STARS_INFO).forEach(([k, v]) => {
  if (!zh[k]) return;
  brightness[zh[k]] = {
    fiveElements: v.fiveElements,
    yinYang: v.yinYang,
    table: v.brightness.map(b => B_KEY[b])
  };
});

// 默认(全书派)四化表
const stems = d.heavenlyStems;
const stemZh = { jiaHeavenly: '甲', yiHeavenly: '乙', bingHeavenly: '丙', dingHeavenly: '丁', wuHeavenly: '戊', jiHeavenly: '己', gengHeavenly: '庚', xinHeavenly: '辛', renHeavenly: '壬', guiHeavenly: '癸' };
const mutagenDefault = {};
Object.entries(stems).forEach(([k, v]) => {
  mutagenDefault[stemZh[k]] = v.mutagen.map(s => zh[s] || s);
});

const out = `// 自动生成: 数据表(提取自 iztro v2.5.8, 仅作静态查表数据)
// 亮度表索引: 0=寅 1=卯 2=辰 3=巳 4=午 5=未 6=申 7=酉 8=戌 9=亥 10=子 11=丑
const BRIGHTNESS_TABLE = ${JSON.stringify(brightness, null, 2)};

// 全书派四化表 (iztro 默认): [禄, 权, 科, 忌]
const MUTAGEN_TABLE_QUANSHU = ${JSON.stringify(mutagenDefault, null, 2)};

// 中州派四化表 (教程): 仅庚年不同(天府科替代太阴科)
const MUTAGEN_TABLE_ZHONGZHOU = JSON.parse(JSON.stringify(MUTAGEN_TABLE_QUANSHU));
MUTAGEN_TABLE_ZHONGZHOU['庚'] = ['太阳', '武曲', '天府', '天同'];
`;
fs.writeFileSync('C:/Users/USER/WorkBuddy/2026-07-28-23-15-09/zwds/js/data-tables.js', out);
console.log('written. stars:', Object.keys(brightness).length);
console.log('sample 紫微:', JSON.stringify(brightness['紫微']));
console.log('sample 武曲:', JSON.stringify(brightness['武曲']));
console.log('庚年全书派:', JSON.stringify(mutagenDefault['庚']));
console.log('戊年:', JSON.stringify(mutagenDefault['戊']));
