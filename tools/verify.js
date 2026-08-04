// 验证 iztro API + 建立案例A/B基准数据
const iztro = require('C:/Users/USER/Desktop/Claude-code/zwds-agent/node_modules/iztro/lib/index.js');
const { astro } = iztro;

// 中州派配置
astro.config({ algorithm: 'zhongzhou' });

function dumpPalace(p) {
  const majors = p.majorStars.map(s => `${s.name}[${s.brightness}]${s.mutagen ? '化' + s.mutagen : ''}`).join(' ');
  const minors = p.minorStars.map(s => `${s.name}[${s.brightness}]${s.mutagen ? '化' + s.mutagen : ''}`).join(' ');
  const adjs = p.adjectiveStars.map(s => s.name).join(' ');
  return `${p.heavenlyStem}${p.earthlyBranch} ${p.name}${p.isBodyPalace ? '(身)' : ''} | 主:${majors || '-'} | 辅:${minors || '-'} | 杂:${adjs || '-'} | 长生:${p.changsheng12} 博士:${p.boshi12} 岁前:${p.suiqian12} 将前:${p.jiangqian12} | 大限:${p.decadal ? p.decadal.range[0] + '-' + p.decadal.range[1] : ''} 小限:${p.ages ? p.ages.join('/') : ''}`;
}

function check(name, astrolabe, expect) {
  console.log(`\n===== ${name} =====`);
  console.log('公历:', astrolabe.solarDate, '| 农历:', astrolabe.lunarDate, '| 五行局:', astrolabe.fiveElementsClass, '| 命宫:', astrolabe.earthlyBranchOfSoulPalace, '| 身宫:', astrolabe.earthlyBranchOfBodyPalace, '| 命主:', astrolabe.soul, '| 身主:', astrolabe.body, '| 生肖:', astrolabe.zodiac, '| 星座:', astrolabe.sign);
  console.log('四柱:', JSON.stringify(astrolabe.chineseDate));
  astrolabe.palaces.forEach(p => console.log(dumpPalace(p)));
  console.log('--- 校验 ---');
  const checks = [];
  checks.push(['五行局', astrolabe.fiveElementsClass === expect.fiveElements, astrolabe.fiveElementsClass, expect.fiveElements]);
  checks.push(['命宫地支', astrolabe.earthlyBranchOfSoulPalace === expect.soul, astrolabe.earthlyBranchOfSoulPalace, expect.soul]);
  checks.push(['身宫地支', astrolabe.earthlyBranchOfBodyPalace === expect.body, astrolabe.earthlyBranchOfBodyPalace, expect.body]);
  checks.push(['命主', astrolabe.soul === expect.soulStar, astrolabe.soul, expect.soulStar]);
  checks.push(['身主', astrolabe.body === expect.bodyStar, astrolabe.body, expect.bodyStar]);
  // 校验特定宫位主星
  if (expect.palaceStars) {
    for (const [branch, stars] of Object.entries(expect.palaceStars)) {
      const p = astrolabe.palaces.find(x => x.earthlyBranch === branch);
      const names = p ? [...p.majorStars.map(s => s.name), ...p.minorStars.map(s => s.name)] : [];
      const missing = stars.filter(s => !names.includes(s));
      checks.push([`${branch}宫含${stars.join('+')}`, missing.length === 0, names.join(','), stars.join(',')]);
    }
  }
  let allOk = true;
  checks.forEach(([label, ok, got, want]) => {
    if (!ok) allOk = false;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label} | got=${got} | want=${want}`);
  });
  console.log(allOk ? `>>> ${name} 全部通过` : `>>> ${name} 有失败项!`);
  return astrolabe;
}

// 案例A: 庚午年四月廿一日辰时男 -> 农历1990-4-21, 辰时=4
const caseA = check('案例A 庚午年四月廿一辰时男', astro.byLunar('1990-4-21', 4, '男'), {
  fiveElements: '火六局', soul: '丑', body: '酉', soulStar: '贪狼', bodyStar: '文昌',
  palaceStars: { 丑: ['天机', '天魁'], 寅: ['紫微', '天府'], 酉: ['天同', '擎羊'], 戌: ['武曲'], 亥: ['太阳'], 申: ['七杀', '禄存', '文曲', '天马'] }
});

// 案例B: 戊辰年十月初三丑时男 -> 农历1988-10-3, 丑时=1
const caseB = check('案例B 戊辰年十月初三丑时男', astro.byLunar('1988-10-3', 1, '男'), {
  fiveElements: '水二局', soul: '戌', body: '子', soulStar: '禄存', bodyStar: '天同',
  palaceStars: { 戌: ['武曲', '地空'], 寅: ['紫微', '天府', '天马'], 丑: ['天机', '左辅', '右弼', '天魁'], 辰: ['贪狼', '陀罗'], 巳: ['巨门', '文曲', '禄存'] }
});

// 验证庚年四化(中州派应为: 太阳禄 武曲权 天府科 天同忌)
console.log('\n===== 庚年四化(中州派) =====');
caseA.palaces.forEach(p => {
  [...p.majorStars, ...p.minorStars].forEach(s => {
    if (s.mutagen) console.log(`${s.name} 化${s.mutagen} @ ${p.earthlyBranch}宫(${p.name})`);
  });
});

// 切换默认(全书派)验证庚年差异
astro.config({ algorithm: 'default' });
const caseA2 = astro.byLunar('1990-4-21', 4, '男');
console.log('\n===== 庚年四化(全书派) =====');
caseA2.palaces.forEach(p => {
  [...p.majorStars, ...p.minorStars].forEach(s => {
    if (s.mutagen) console.log(`${s.name} 化${s.mutagen} @ ${p.earthlyBranch}宫(${p.name})`);
  });
});

// 验证 horoscope 六层运限
astro.config({ algorithm: 'zhongzhou' });
const h = caseB.horoscope(new Date('2026-07-28T15:00:00'));
console.log('\n===== 案例B 运限 @2026-07-28 15:00 =====');
console.log('大限:', JSON.stringify(h.decadal));
console.log('小限:', JSON.stringify(h.age));
console.log('流年:', JSON.stringify(h.yearly));
console.log('流月:', JSON.stringify(h.monthly));
console.log('流日:', JSON.stringify(h.daily));
console.log('流时:', JSON.stringify(h.hourly));
