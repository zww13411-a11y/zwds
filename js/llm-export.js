/**
 * 紫微斗数 LLM 分析预处理器
 *
 * 补齐两个核心能力：
 *   1. 叠盘关联 — 流X盘与本命盘的宫位叠加分析
 *   2. 事件化索引 — 基于星曜/四化/叠宫的预判事件分类
 *
 * 加载后通过 window.ZWDSLLMExport 访问。
 * 依赖：data-tables.js、engine.js 已加载。
 */
(function (root) {
  'use strict';

  // ---- 公共常量（从 data-tables.js 的 ZWDS_CONST 读取） --------------------
  const C = (typeof root !== 'undefined' && root.ZWDS_CONST) || {};
  const STEMS = C.STEMS;
  const BRANCHES = C.BRANCHES;
  const NATAL_PALACE_NAMES = C.PALACES;
  const TIGER_STEM = C.TIGER_STEM;
  const MUTAGEN_LABEL = C.MUTAGEN_LABEL;
  const TRIPLE_MAP = C.TRIPLE_MAP;
  const TRIPLE_NAMES = C.TRIPLE_NAMES;
  const bi = C.bi;
  const mod12 = C.mod12;
  const mod10 = C.mod10;

  // 命理领域 → 关联宫位（含重要性权重）
  const DOMAIN_PALACES = {
    '事业': { primary: ['官禄', '命宫'], secondary: ['财帛', '迁移'], weight: 1.0 },
    '财运': { primary: ['财帛', '田宅'], secondary: ['福德', '命宫'], weight: 1.0 },
    '感情': { primary: ['夫妻', '福德'], secondary: ['迁移', '命宫'], weight: 0.9 },
    '健康': { primary: ['疾厄'], secondary: ['命宫', '福德'], weight: 0.9 },
    '家庭': { primary: ['田宅', '父母'], secondary: ['兄弟', '命宫'], weight: 0.8 },
    '人际': { primary: ['仆役', '迁移'], secondary: ['兄弟', '夫妻'], weight: 0.7 },
    '迁移': { primary: ['迁移'], secondary: ['命宫', '子女'], weight: 0.7 },
    '官非': { primary: ['仆役', '迁移'], secondary: ['疾厄', '父母'], weight: 0.6 },
    '学业': { primary: ['福德', '父母'], secondary: ['官禄', '迁移'], weight: 0.6 },
    '子女': { primary: ['子女'], secondary: ['田宅', '夫妻'], weight: 0.6 },
  };

  // 事件触发器 — 星曜级别的特殊事件规则
  const STAR_EVENT_RULES = [
    { stars: ['红鸾', '天喜'], inPalaces: ['夫妻', '命宫'], event: '感情姻缘', weight: 30, note: '姻缘星入命/夫妻宫' },
    { stars: ['天马'], inPalaces: ['迁移', '命宫'], event: '出行迁移', weight: 25, note: '天马动星入迁移/命宫' },
    { stars: ['火星', '铃星'], withStar: '贪狼', inPalaces: ['财帛'], event: '财运', weight: 25, note: '火贪格/铃贪格：爆发财运' },
    { stars: ['太阳'], inPalaces: ['官禄', '命宫'], brightness: '庙旺', event: '事业', weight: 20, note: '太阳庙旺守官禄/命宫' },
    { stars: ['太阴'], inPalaces: ['田宅', '财帛'], brightness: '庙旺', event: '财运', weight: 20, note: '太阴庙旺守田宅/财帛' },
    { stars: ['巨门'], inPalaces: ['命宫', '夫妻', '仆役'], event: '官非', weight: 15, note: '巨门暗曜易生口舌是非' },
    { stars: ['廉贞'], inPalaces: ['命宫', '夫妻'], event: '感情', weight: 15, note: '廉贞桃花星入命/夫妻' },
    { stars: ['七杀', '破军'], inPalaces: ['命宫', '官禄'], event: '事业', weight: 20, note: '杀破狼变动格局' },
  ];

  // 流曜分类
  const AUSPICIOUS_FLOW_STARS = new Set(['流禄', '流魁', '流钺', '流昌', '流曲', '流弼', '流辅',
    '红鸾', '天喜', '青龙', '喜神', '长生', '沐浴', '冠带', '临官', '帝旺', '博士', '力士', '青龙', '将军', '奏书']);
  const INAUSPICIOUS_FLOW_STARS = new Set(['流羊', '流陀', '流火', '流铃', '流劫', '流空',
    '白虎', '丧门', '吊客', '死', '墓', '绝', '病', '衰', '小耗', '大耗', '飞廉', '伏兵', '官府']);

  // ---- 工具函数 -----------------------------------------------------------

  function branchDesc(bi) {
    const names = ['寅宫', '卯宫', '辰宫', '巳宫', '午宫', '未宫', '申宫', '酉宫', '戌宫', '亥宫', '子宫', '丑宫'];
    return names[bi];
  }

  // 计算流年五虎遁：年干定寅宫天干
  function computeFiveTigerStems(yearStem) {
    const tigerStem = TIGER_STEM[yearStem];
    const tigerIdx = STEMS.indexOf(tigerStem);
    return BRANCHES.map(function (_, i) { return STEMS[(tigerIdx + i) % 10]; });
  }

  // 从 hexagrams 列表找某颗星的亮度
  function findBrightnessInPalaces(starName, nativePalaces) {
    for (var i = 0; i < nativePalaces.length; i++) {
      var p = nativePalaces[i];
      var allStars = (p.majorStars || []).concat(p.minorStars || []);
      for (var j = 0; j < allStars.length; j++) {
        if (allStars[j].name === starName) return allStars[j].brightness || '';
      }
    }
    return '';
  }

  // ---- 核心：三方四正 ------------------------------------------------------

  /** 地支 → 三合局（本宫被排除在外，返回另外两个三合宫地支索引） */
  const LOCAL_TRIPLE_MAP = TRIPLE_MAP || {
    0: [4, 8],  1: [5, 9],  2: [6, 10], 3: [7, 11],
    4: [8, 0],  5: [9, 1],  6: [10, 2], 7: [11, 3],
    8: [0, 4],  9: [1, 5],  10: [2, 6], 11: [3, 7],
  };

  /** 三合局名称 */
  const LOCAL_TRIPLE_NAMES = TRIPLE_NAMES || ['寅午戌', '卯未亥', '辰申子', '巳酉丑', '寅午戌', '卯未亥', '辰申子', '巳酉丑', '寅午戌', '卯未亥', '辰申子', '巳酉丑'];

  /**
   * 构建本命盘三方四正摘要
   *
   * 对12宫中每一个宫位计算：
   *   - 三合宫（2个）名称 + 星曜列表
   *   - 对宫名称 + 星曜列表
   *   - 四正（本宫+对宫+三合）汇总星曜
   *   - 四正评分（吉星加权 - 凶星加权）
   */
  function buildSanfangSizheng(nativePalaces) {
    if (!nativePalaces || nativePalaces.length < 12) return null;

    // 地支到宫位的索引
    var branchToPalace = {};
    nativePalaces.forEach(function (p, i) {
      branchToPalace[p.earthlyBranch] = i;
    });

    var result = [];

    nativePalaces.forEach(function (p, palaceIdx) {
      var branchIdx = bi(p.earthlyBranch);
      if (branchIdx < 0) return;

      var tripleIndices = LOCAL_TRIPLE_MAP[branchIdx];
      var oppositeIdx = mod12(branchIdx + 6);
      var oppositeBranch = BRANCHES[oppositeIdx];
      var oppositePalaceIdx = branchToPalace[oppositeBranch];

      // 三合宫
      var triplePalaces = tripleIndices.map(function (ti) {
        var tBranch = BRANCHES[ti];
        var tIdx = branchToPalace[tBranch];
        var tp = nativePalaces[tIdx];
        return {
          name: tp.name,
          branch: tp.earthlyBranch,
          majorStars: (tp.majorStars || []).map(function (s) { return { name: s.name, brightness: s.brightness, mutagen: s.mutagen }; }),
          minorStars: (tp.minorStars || []).map(function (s) { return s.name; }).concat((tp.adjectiveStars || []).map(function (s) { return typeof s === 'string' ? s : s.name; })),
        };
      });

      // 对宫
      var opp = nativePalaces[oppositePalaceIdx];
      var oppositeData = {
        name: opp.name,
        branch: opp.earthlyBranch,
        majorStars: (opp.majorStars || []).map(function (s) { return { name: s.name, brightness: s.brightness, mutagen: s.mutagen }; }),
        minorStars: (opp.minorStars || []).map(function (s) { return s.name; }).concat((opp.adjectiveStars || []).map(function (s) { return typeof s === 'string' ? s : s.name; })),
      };

      // 四正星曜汇总（本宫 + 対宫 + 三合2宮）
      var allFourStars = [];
      var addStars = function (pal) {
        (pal.majorStars || []).forEach(function (s) { allFourStars.push(s.name); });
        (pal.minorStars || []).forEach(function (s) { allFourStars.push(s.name); });
        (pal.adjectiveStars || []).forEach(function (s) { allFourStars.push(typeof s === 'string' ? s : s.name); });
      };
      addStars(p);
      addStars(opp);
      triplePalaces.forEach(function (tp) {
        tp.majorStars.forEach(function (s) { allFourStars.push(s.name); });
        tp.minorStars.forEach(function (s) { allFourStars.push(s); });
      });

      // 去重 + 计数
      var freq = {};
      allFourStars.forEach(function (s) { freq[s] = (freq[s] || 0) + 1; });

      // 四正吉凶评分
      var fourScore = 0;
      Object.keys(freq).forEach(function (s) {
        var mul = freq[s]; // 出现次数
        if (ZEJI_STARS.has(s)) fourScore += 2 * mul;
        else if (SHA_STARS.has(s)) fourScore -= 2 * mul;
        else if (ZHU_STARS.has(s)) fourScore += 1 * mul;
      });

      // 四化在四正
      var fourMutatgens = [];
      [p, opp].concat(triplePalaces.map(function (tp) { return nativePalaces[branchToPalace[tp.branch]]; })).forEach(function (fp) {
        (fp.majorStars || []).concat(fp.minorStars || []).forEach(function (s) {
          if (s.mutagen) fourMutatgens.push({ star: s.name, type: s.mutagen, palace: fp.name });
        });
      });

      result.push({
        palaceIndex: palaceIdx,
        palaceName: p.name,
        branch: p.earthlyBranch,
        tripleGroup: LOCAL_TRIPLE_NAMES[branchIdx],
        triplePalaces: triplePalaces,
        opposite: oppositeData,
        fourCorrectPalaces: [p.name, oppositeData.name, triplePalaces[0].name, triplePalaces[1].name],
        starFrequency: freq,
        fourScore: fourScore,
        fourMutatgens: fourMutatgens,
        fourJudgment: fourScore >= 6 ? '四正吉' : fourScore >= 2 ? '四正平' : fourScore <= -4 ? '四正凶' : '四正弱',
      });
    });

    return result;
  }

  // ---- 核心：结构性标记 ----------------------------------------------------

  /** 吉星集合 */
  const ZEJI_STARS = new Set(['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '天马']);
  /** 煞星集合 */
  const SHA_STARS = new Set(['火星', '铃星', '擎羊', '陀罗', '地空', '地劫', '天空']);
  /** 主星集合 */
  const ZHU_STARS = new Set(['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军']);

  /**
   * 构建全局结构性标记
   *
   * 检测：
   *   - 空劫夹 / 火铃夹 / 羊陀夹 / 双禄夹 / 双忌夹 / 魁钺夹 / 昌曲夹
   *   - 日月反背 / 日月并明
   *   - 府相朝垣
   *   - 空宫
   *   - 阴阳差错
   */
  function buildStructuralMarkers(nativePalaces) {
    if (!nativePalaces || nativePalaces.length < 12) return [];

    var markers = [];
    var branchToPalace = {};
    nativePalaces.forEach(function (p, i) { branchToPalace[p.earthlyBranch] = i; });

    // 辅助：获取某宫位所有星曜名称
    function palaceStarNames(p) {
      return (p.majorStars || []).map(function (s) { return s.name; })
        .concat((p.minorStars || []).map(function (s) { return s.name; }))
        .concat((p.adjectiveStars || []).map(function (s) { return typeof s === 'string' ? s : s.name; }));
    }

    // 检查两个相邻宫位（左夹右）
    function checkClamp(palaceIdx, starSet, label, severity) {
      var prevIdx = mod12(palaceIdx - 1);
      var nextIdx = mod12(palaceIdx + 1);
      var prevStars = palaceStarNames(nativePalaces[prevIdx]);
      var nextStars = palaceStarNames(nativePalaces[nextIdx]);
      var prevHit = prevStars.filter(function (s) { return starSet.has(s); });
      var nextHit = nextStars.filter(function (s) { return starSet.has(s); });
      if (prevHit.length > 0 && nextHit.length > 0) {
        return {
          type: label + '夹',
          palace: nativePalaces[palaceIdx].name,
          branch: nativePalaces[palaceIdx].earthlyBranch,
          detail: label + '夹' + nativePalaces[palaceIdx].name + '（左' + prevHit.join('/') + '，右' + nextHit.join('/') + '）',
          severity: severity,
          leftStars: prevHit,
          rightStars: nextHit,
        };
      }
      return null;
    }

    // 遍历12宫检查各种夹宫
    var CLAMP_RULES = [
      { set: new Set(['地空', '地劫', '天空']), label: '空劫', severity: 'warning' },
      { set: new Set(['火星', '铃星']), label: '火铃', severity: 'warning' },
      { set: new Set(['擎羊', '陀罗']), label: '羊陀', severity: 'danger' },
      { set: new Set(['天魁', '天钺']), label: '魁钺', severity: 'good' },
      { set: new Set(['文昌', '文曲']), label: '昌曲', severity: 'good' },
    ];

    for (var pi = 0; pi < 12; pi++) {
      CLAMP_RULES.forEach(function (rule) {
        var m = checkClamp(pi, rule.set, rule.label, rule.severity);
        if (m) markers.push(m);
      });
    }

    // 双禄夹 / 双忌夹（基于四化，非星曜集合）
    for (var pi2 = 0; pi2 < 12; pi2++) {
      var prevP = nativePalaces[mod12(pi2 - 1)];
      var nextP = nativePalaces[mod12(pi2 + 1)];
      var curName = nativePalaces[pi2].name;

      var prevLu = (prevP.majorStars || []).concat(prevP.minorStars || []).filter(function (s) { return s.mutagen === '禄'; });
      var nextLu = (nextP.majorStars || []).concat(nextP.minorStars || []).filter(function (s) { return s.mutagen === '禄'; });
      if (prevLu.length > 0 && nextLu.length > 0) {
        markers.push({
          type: '双禄夹',
          palace: curName,
          branch: nativePalaces[pi2].earthlyBranch,
          detail: '双禄夹' + curName + '（左' + prevLu.map(function (s) { return s.name; }).join('/') + '化禄，右' + nextLu.map(function (s) { return s.name; }).join('/') + '化禄），极其有利',
          severity: 'good',
        });
      }

      var prevJi = (prevP.majorStars || []).concat(prevP.minorStars || []).filter(function (s) { return s.mutagen === '忌'; });
      var nextJi = (nextP.majorStars || []).concat(nextP.minorStars || []).filter(function (s) { return s.mutagen === '忌'; });
      if (prevJi.length > 0 && nextJi.length > 0) {
        markers.push({
          type: '双忌夹',
          palace: curName,
          branch: nativePalaces[pi2].earthlyBranch,
          detail: '双忌夹' + curName + '（左' + prevJi.map(function (s) { return s.name; }).join('/') + '化忌，右' + nextJi.map(function (s) { return s.name; }).join('/') + '化忌），极其不利',
          severity: 'danger',
        });
      }
    }

    // 日月反背 / 日月并明
    var sunPalace = nativePalaces.find(function (p) {
      return (p.majorStars || []).some(function (s) { return s.name === '太阳'; });
    });
    var moonPalace = nativePalaces.find(function (p) {
      return (p.majorStars || []).some(function (s) { return s.name === '太阴'; });
    });

    if (sunPalace && moonPalace) {
      var sunStar = sunPalace.majorStars.find(function (s) { return s.name === '太阳'; });
      var moonStar = moonPalace.majorStars.find(function (s) { return s.name === '太阴'; });
      var sunBright = sunStar && sunStar.brightness;
      var moonBright = moonStar && moonStar.brightness;

      // 日月并明：太阳太阴皆庙旺
      if (sunBright === '庙' && moonBright === '庙') {
        markers.push({
          type: '日月并明',
          palace: sunPalace.name + '/' + moonPalace.name,
          detail: '日月并明格：太阳庙在' + sunPalace.name + '，太阴庙在' + moonPalace.name + '，光明磊落格局宏大',
          severity: 'good',
        });
      }

      // 日月反背：太阳落陷、太阴落陷
      if ((sunBright === '陷' || sunBright === '不') && (moonBright === '陷' || moonBright === '不')) {
        markers.push({
          type: '日月反背',
          palace: sunPalace.name + '/' + moonPalace.name,
          detail: '日月反背：太阳落陷在' + sunPalace.name + '，太阴落陷在' + moonPalace.name + '，劳而无功需低调',
          severity: 'warning',
        });
      }
    }

    // 府相朝垣
    var ziweiP = nativePalaces.find(function (p) {
      return (p.majorStars || []).some(function (s) { return s.name === '紫微'; });
    });
    if (ziweiP && ['寅', '申'].indexOf(ziweiP.earthlyBranch) >= 0) {
      // 检查三方是否有天府/天相
      var ziweiIdx = nativePalaces.indexOf(ziweiP);
      var ziweiBranch = bi(ziweiP.earthlyBranch);
      var tripleBranches = LOCAL_TRIPLE_MAP[ziweiBranch];
      var tripleStars = [];
      tripleBranches.forEach(function (tb) {
        var tp = nativePalaces[branchToPalace[BRANCHES[tb]]];
        (tp.majorStars || []).forEach(function (s) { tripleStars.push(s.name); });
      });
      if (tripleStars.indexOf('天府') >= 0 || tripleStars.indexOf('天相') >= 0) {
        markers.push({
          type: '府相朝垣',
          palace: ziweiP.name,
          detail: '府相朝垣格：紫微在' + ziweiP.earthlyBranch + '宫，天府/天相在三方拱照，贵气格局',
          severity: 'good',
        });
      }
    }

    // 空宫
    nativePalaces.forEach(function (p) {
      var hasMajor = (p.majorStars || []).length > 0;
      if (!hasMajor) {
        markers.push({
          type: '空宫',
          palace: p.name,
          branch: p.earthlyBranch,
          detail: p.name + '为空宫（无主星），借对宫' + BRANCHES[mod12(bi(p.earthlyBranch) + 6)] + '宫星曜来看',
          severity: 'info',
          borrowedFrom: BRANCHES[mod12(bi(p.earthlyBranch) + 6)],
        });
      }
    });

    // 全局宫干分析
    var allStems = nativePalaces.map(function (p) { return p.heavenlyStem || ''; });
    var globalJudge = '';
    // 连续三宫天干相同 → 天干伏吟
    for (var si = 0; si < 12; si++) {
      if (allStems[si] && allStems[si] === allStems[mod12(si + 1)] && allStems[si] === allStems[mod12(si + 2)]) {
        markers.push({
          type: '天干伏吟',
          detail: nativePalaces[si].name + '起连续三宫天干皆为' + allStems[si] + '，该干所主之事反复纠结',
          severity: 'warning',
        });
        break;
      }
    }

    return markers;
  }

  // ---- 核心：叠盘关联 ------------------------------------------------------

  /**
   * 计算流X盘与本命盘的叠宫关系
   *
   * @param {Array}   nativePalaces  — iztro 本命盘 palaces 数组（12个）
   * @param {Object}  horoscopeLayer — iztro 运限层对象（如 horoscope.yearly）
   * @param {string}  scope          — 'yearly'|'monthly'|'daily'|'hourly'
   * @param {string}  fortuneYearStem— 流年天干（用于算宫干）
   * @returns {Object} 叠盘分析结果
   */
  function buildOverlay(nativePalaces, horoscopeLayer, scope, fortuneYearStem) {
    if (!horoscopeLayer || !nativePalaces) return null;

    var scopeCN = { yearly: '流年', monthly: '流月', daily: '流日', hourly: '流时' }[scope] || '流运';

    // 流X天干地支
    var fStem = horoscopeLayer.heavenlyStem || '';
    var fBranch = horoscopeLayer.earthlyBranch || '';

    // 十二宫流年干
    var posStems = computeFiveTigerStems(fortuneYearStem || fStem);

    // 流命宫位置
    var fortuneSoulIdx = horoscopeLayer.index; // iztro 中 horoscope[scope].index 是流命宫所在宫位索引

    // 流命宫叠本命哪个宫位
    var natalSoulPalace = nativePalaces[fortuneSoulIdx];
    var natalSoulName = natalSoulPalace ? (natalSoulPalace.name || '未知') : '未知';

    // 逐个宫位构建叠盘数据
    var overlays = [];
    for (var i = 0; i < 12; i++) {
      var np = nativePalaces[i];
      var fpName = (horoscopeLayer.palaceNames && horoscopeLayer.palaceNames[i]) || '未知';
      var fStars = (horoscopeLayer.stars && horoscopeLayer.stars[i]) || [];
      var fStemAtPos = posStems[i];

      // 四化归属判断：看本命星曜在此宫是否有四化
      var localMutagens = [];
      if (horoscopeLayer.mutagen) {
        (np.majorStars || []).concat(np.minorStars || []).forEach(function (s) {
          var mi = horoscopeLayer.mutagen.indexOf(s.name);
          if (mi >= 0 && s.mutagen) {
            localMutagens.push({ star: s.name, type: s.mutagen, typeCN: MUTAGEN_LABEL[mi] || mi });
          }
        });
      }

      // 流曜分类
      var auspicious = [];
      var inauspicious = [];
      var otherFlow = [];
      fStars.forEach(function (s) {
        var sname = s.name || s;
        if (AUSPICIOUS_FLOW_STARS.has(sname)) {
          auspicious.push(sname);
        } else if (INAUSPICIOUS_FLOW_STARS.has(sname)) {
          inauspicious.push(sname);
        } else {
          otherFlow.push(sname);
        }
      });

      overlays.push({
        index: i,
        branch: np.earthlyBranch || '',
        branchDesc: branchDesc(bi(np.earthlyBranch) || 0),
        natalPalaceName: np.name,
        natalPalaceStem: np.heavenlyStem || '',
        fortunePalaceName: fpName,
        fortuneStem: fStemAtPos,
        fortuneStars: fStars.map(function (s) { return s.name || s; }),
        fortuneAuspiciousStars: auspicious,
        fortuneInauspiciousStars: inauspicious,
        localMutagens: localMutagens,
        overlayLabel: scopeCN + fpName + '叠' + np.name,
        isFortuneSoul: i === fortuneSoulIdx,
        isNatalSoul: np.name === '命宫',
        isNatalBody: np.isBodyPalace || false,
      });
    }

    // 流X四化到本命宫位的映射
    var mutagenMap = {};
    if (horoscopeLayer.mutagen && horoscopeLayer.mutagen.length >= 4) {
      var labels = ['化禄', '化权', '化科', '化忌'];
      for (var m = 0; m < 4; m++) {
        var starName = horoscopeLayer.mutagen[m];
        // 在本命盘中找这颗星在哪个宫位
        for (var pi = 0; pi < nativePalaces.length; pi++) {
          var pal = nativePalaces[pi];
          var found = false;
          (pal.majorStars || []).concat(pal.minorStars || []).forEach(function (s) {
            if (s.name === starName) {
              found = true;
              mutagenMap[labels[m]] = {
                star: starName,
                brightness: s.brightness || '',
                natalPalace: pal.name,
                natalBranch: pal.earthlyBranch,
                natalPalaceIndex: pi,
                overlayFortunePalace: overlays[pi].fortunePalaceName,
                significance: labels[m] + '星' + starName + '在本命' + pal.name +
                  '，叠' + overlays[pi].fortunePalaceName,
              };
            }
          });
          if (found) break;
        }
        if (!mutagenMap[labels[m]]) {
          mutagenMap[labels[m]] = {
            star: starName,
            natalPalace: '未找到',
            overlayFortunePalace: '—',
            significance: labels[m] + '星' + starName + '未在本命盘找到（可能是辅星或流曜）',
          };
        }
      }
    }

    // 重点标记
    var highlights = [];

    // 流命宫叠宫重点
    if (overlays[fortuneSoulIdx]) {
      highlights.push({
        type: '叠宫重点',
        detail: scopeCN + '命宫叠本命' + natalSoulName + '：' + scopeCN + '主题围绕' + natalSoulName + '之事',
        severity: 'info',
        palace: natalSoulName,
      });
    }

    // 四化警示
    var jiInfo = mutagenMap['化忌'];
    if (jiInfo && jiInfo.natalPalace !== '未找到') {
      highlights.push({
        type: '四化警示',
        detail: '化忌在' + jiInfo.natalPalace + '（星' + jiInfo.star + '）：该领域有压力或阻碍，需特别留意',
        severity: 'warning',
        palace: jiInfo.natalPalace,
      });
    }

    // 煞星夹宫
    var soulIdx = nativePalaces.findIndex(function (p) { return p.name === '命宫'; });
    if (soulIdx >= 0) {
      var prevStars = overlays[mod12(soulIdx - 1)].fortuneInauspiciousStars || [];
      var nextStars = overlays[mod12(soulIdx + 1)].fortuneInauspiciousStars || [];
      if (prevStars.length >= 2 && nextStars.length >= 2) {
        highlights.push({
          type: '煞星夹宫',
          detail: '命宫前后被煞星所夹（' + prevStars.slice(0, 2).join('/') + ' + ' + nextStars.slice(0, 2).join('/') + '），需防不测',
          severity: 'warning',
        });
      }
    }

    // 火星/铃星+贪狼格
    for (var oi = 0; oi < overlays.length; oi++) {
      var o = overlays[oi];
      if (o.fortuneStars.indexOf('流火') >= 0 || o.fortuneStars.indexOf('流铃') >= 0 || o.fortuneStars.indexOf('火星') >= 0 || o.fortuneStars.indexOf('铃星') >= 0) {
        var npStars = (nativePalaces[oi].majorStars || []).concat(nativePalaces[oi].minorStars || []).map(function (s) { return s.name; });
        if (npStars.indexOf('贪狼') >= 0) {
          highlights.push({
            type: '火贪/铃贪格',
            detail: o.natalPalaceName + '宫有贪狼+火/铃，爆发型' + (o.natalPalaceName === '财帛' ? '财运' : '变动'),
            severity: 'info',
            palace: o.natalPalaceName,
          });
        }
      }
    }

    return {
      scope: scope,
      scopeCN: scopeCN,
      fortuneStemBranch: fStem + fBranch,
      fortuneSoulBranch: fBranch,
      fortuneSoulIndex: fortuneSoulIdx,
      fortuneSoulOverlay: overlays[fortuneSoulIdx] || null,
      mutagenMap: mutagenMap,
      overlays: overlays,
      highlights: highlights,
    };
  }

  // ---- 核心：事件化索引 ----------------------------------------------------

  /**
   * 基于叠盘数据 + 本命盘，预判各领域事件
   *
   * @param {Array}   nativePalaces
   * @param {Object}  overlayData  — buildOverlay 的输出
   * @param {string}  scope
   * @returns {Object} 事件索引
   */
  function buildEventIndex(nativePalaces, overlayData, scope) {
    if (!nativePalaces || !overlayData) return null;

    var events = {};
    var scopeCN = overlayData.scopeCN || '流运';

    // 初始化各领域
    Object.keys(DOMAIN_PALACES).forEach(function (domain) {
      events[domain] = {
        domain: domain,
        score: 0,
        triggers: [],
        judgment: '平',
        summary: '',
      };
    });

    // --- 触发器 1：四化落入关联宫位 ---
    if (overlayData.mutagenMap) {
      Object.keys(overlayData.mutagenMap).forEach(function (key) {
        var info = overlayData.mutagenMap[key];
        if (!info || info.natalPalace === '未找到') return;
        var weight = key === '化禄' ? 30 : key === '化权' ? 25 : key === '化科' ? 20 : 30;
        var isNeg = key === '化忌';

        Object.keys(DOMAIN_PALACES).forEach(function (domain) {
          var config = DOMAIN_PALACES[domain];
          if (config.primary.indexOf(info.natalPalace) >= 0) {
            events[domain].score += weight * config.weight;
            events[domain].triggers.push({
              type: key,
              detail: key + '星' + info.star + '在本命' + info.natalPalace + '，引动' + info.overlayFortunePalace,
              weight: weight,
              isNegative: isNeg,
            });
          } else if (config.secondary.indexOf(info.natalPalace) >= 0) {
            events[domain].score += weight * config.weight * 0.6;
            events[domain].triggers.push({
              type: key + '(次)',
              detail: key + '星' + info.star + '在本命' + info.natalPalace + '（' + domain + '次关联宫）',
              weight: weight * 0.6,
              isNegative: isNeg,
            });
          }
        });
      });
    }

    // --- 触发器 2：流命宫叠宫 ---
    if (overlayData.fortuneSoulOverlay) {
      var soulPalace = overlayData.fortuneSoulOverlay.natalPalaceName;
      Object.keys(DOMAIN_PALACES).forEach(function (domain) {
        var config = DOMAIN_PALACES[domain];
        if (config.primary.indexOf(soulPalace) >= 0) {
          events[domain].score += 35 * config.weight;
          events[domain].triggers.push({
            type: '流命叠宫',
            detail: scopeCN + '命宫叠本命' + soulPalace + '：' + domain + '是本运限主轴',
            weight: 35,
          });
        } else if (config.secondary.indexOf(soulPalace) >= 0) {
          events[domain].score += 20 * config.weight;
          events[domain].triggers.push({
            type: '流命叠宫(次)',
            detail: scopeCN + '命宫叠本命' + soulPalace + '：与' + domain + '间接相关',
            weight: 20,
          });
        }
      });
    }

    // --- 触发器 3：流曜吉凶 ---
    (overlayData.overlays || []).forEach(function (o) {
      // 吉耀到关联宫
      o.fortuneAuspiciousStars.forEach(function (starName) {
        Object.keys(DOMAIN_PALACES).forEach(function (domain) {
          var config = DOMAIN_PALACES[domain];
          if (config.primary.indexOf(o.natalPalaceName) >= 0) {
            events[domain].score += 15 * config.weight;
            events[domain].triggers.push({
              type: '流曜吉星',
              detail: '吉曜' + starName + '入本命' + o.natalPalaceName + '，利' + domain,
              weight: 15,
            });
          }
        });
      });

      // 煞耀到关联宫
      o.fortuneInauspiciousStars.forEach(function (starName) {
        Object.keys(DOMAIN_PALACES).forEach(function (domain) {
          var config = DOMAIN_PALACES[domain];
          if (config.primary.indexOf(o.natalPalaceName) >= 0) {
            events[domain].score += 12 * config.weight; // 煞星也是事件信号
            events[domain].triggers.push({
              type: '流曜煞星',
              detail: '煞曜' + starName + '入本命' + o.natalPalaceName + '，' + domain + '有阻力',
              weight: 12,
              isNegative: true,
            });
          }
        });
      });

      // 四化在叠宫
      o.localMutagens.forEach(function (m) {
        Object.keys(DOMAIN_PALACES).forEach(function (domain) {
          var config = DOMAIN_PALACES[domain];
          if (config.primary.indexOf(o.natalPalaceName) >= 0) {
            var mw = m.typeCN === '禄' ? 25 : m.typeCN === '权' ? 20 : m.typeCN === '科' ? 15 : 25;
            events[domain].score += mw * config.weight;
            events[domain].triggers.push({
              type: '叠宫四化',
              detail: '流' + o.fortunePalaceName + '叠' + o.natalPalaceName + '，化' + m.type + '星' + m.star,
              weight: mw,
              isNegative: m.typeCN === '忌',
            });
          }
        });
      });
    });

    // --- 触发器 4：特殊星曜组合 ---
    STAR_EVENT_RULES.forEach(function (rule) {
      nativePalaces.forEach(function (np) {
        if (rule.inPalaces.indexOf(np.name) < 0) return;
        var allStars = (np.majorStars || []).concat(np.minorStars || []);
        var starNames = allStars.map(function (s) { return s.name; });

        // 检查是否有指定星曜
        var hasStar = rule.stars.some(function (s) { return starNames.indexOf(s) >= 0; });

        // 检查 withStar 条件
        var withOk = true;
        if (rule.withStar && starNames.indexOf(rule.withStar) < 0) {
          withOk = false;
        }

        if (hasStar && withOk) {
          // 检查亮度条件
          if (rule.brightness) {
            var briOk = allStars.some(function (s) {
              return rule.stars.indexOf(s.name) >= 0 && s.brightness && (s.brightness === '庙' || s.brightness === '旺');
            });
            if (!briOk) hasStar = false;
          }

          if (hasStar) {
            events[rule.event].score += rule.weight;
            events[rule.event].triggers.push({
              type: '格局',
              detail: rule.note + '（在' + np.name + '）',
              weight: rule.weight,
            });
          }
        }
      });
    });

    // --- 生成判定与摘要 ---
    var maxScore = 0;
    Object.keys(events).forEach(function (d) {
      maxScore = Math.max(maxScore, events[d].score);
    });

    // 归一化到 0-40 作为基值(四化流命和流曜可能分别贡献 15-35)
    var normalizeBase = Math.max(maxScore, 40);

    Object.keys(events).forEach(function (domain) {
      var e = events[domain];
      var normalized = Math.min(100, Math.round((e.score / normalizeBase) * 100));

      if (normalized >= 70) e.judgment = '大吉';
      else if (normalized >= 50) e.judgment = '吉';
      else if (normalized >= 30) e.judgment = '平';
      else if (normalized >= 15) e.judgment = '凶';
      else e.judgment = '大凶';

      // 如果有负面触发器 > 正面触发器，降级
      var negCount = e.triggers.filter(function (t) { return t.isNegative; }).length;
      var posCount = e.triggers.length - negCount;
      if (negCount > posCount) {
        var jdMap = { '大吉': '吉', '吉': '平', '平': '凶', '凶': '大凶', '大凶': '大凶' };
        e.judgment = jdMap[e.judgment] || e.judgment;
      }

      // 生成自然语言摘要
      var topTriggers = e.triggers
        .sort(function (a, b) { return b.weight - a.weight; })
        .slice(0, 3);

      var keyword;
      switch (e.judgment) {
        case '大吉': keyword = '极为有利'; break;
        case '吉': keyword = '整体向好'; break;
        case '平': keyword = '平稳中需留意'; break;
        case '凶': keyword = '压力较大需防范'; break;
        default: keyword = '极为不利'; break;
      }

      e.scoreNormalized = normalized;
      e.keyTriggers = topTriggers;
      e.summary = domain + '运势' + keyword +
        (topTriggers.length > 0
          ? '。关键信号：' + topTriggers.map(function (t) { return t.detail; }).join('；')
          : '');
    });

    return events;
  }

  // ---- 综合导出 -----------------------------------------------------------

  /**
   * 完整 LLM 分析数据导出
   *
   * @param {Object} params
   *   nativePalaces  — iztro palaces 数组
   *   horoscope     — iztro horoscope 对象
   *   scope         — 'yearly'|'monthly'|'daily'|'hourly'
   *   nested        — { year, month, day, hour }
   *   targetDate    — Date 对象
   *   birth         — { solarDate, lunarDate, chineseDate, fiveElementsClass, soul, body, ... }
   * @returns {Object}
   */
  function exportLLMData(params) {
    var nativePalaces = params.nativePalaces;
    var horoscope = params.horoscope;
    var scope = params.scope || 'yearly';
    var birth = params.birth || {};

    if (!nativePalaces || !horoscope) {
      return { error: 'Missing nativePalaces or horoscope' };
    }

    var horoscopeLayer = horoscope[scope];
    if (!horoscopeLayer) {
      return { error: 'Horoscope layer not found for scope: ' + scope };
    }

    // 获取流年干
    var fortuneYearStem = (scope === 'yearly')
      ? horoscopeLayer.heavenlyStem
      : (horoscope.yearly ? horoscope.yearly.heavenlyStem : horoscopeLayer.heavenlyStem);

    // 构建各运限层叠盘
    var overlays = {};
    var eventIndices = {};
    var scopes = ['yearly', 'monthly', 'daily', 'hourly'];

    scopes.forEach(function (s) {
      var layer = horoscope[s];
      if (!layer) return;
      overlays[s] = buildOverlay(nativePalaces, layer, s, fortuneYearStem);
      eventIndices[s] = buildEventIndex(nativePalaces, overlays[s], s);
    });

    // 四化汇总（跨运限）
    var mutagenSummary = {};
    scopes.forEach(function (s) {
      if (!overlays[s] || !overlays[s].mutagenMap) return;
      mutagenSummary[s] = overlays[s].mutagenMap;
    });

    return {
      birth: {
        solarDate: birth.solarDate,
        lunarDate: birth.lunarDate,
        chineseDate: birth.chineseDate,
        fiveElementsClass: birth.fiveElementsClass,
        soul: birth.soul,
        body: birth.body,
        soulPalaceBranch: birth.soulPalaceBranch,
        bodyPalaceBranch: birth.bodyPalaceBranch,
      },
      scope: scope,
      targetDate: params.targetDate || null,
      nested: params.nested || null,
      sanfangSizheng: nativePalaces ? buildSanfangSizheng(nativePalaces) : null,
      structuralMarkers: nativePalaces ? buildStructuralMarkers(nativePalaces) : [],
      overlays: overlays,
      eventIndices: eventIndices,
      mutagenSummary: mutagenSummary,
      highlights: (overlays[scope] && overlays[scope].highlights) || [],
    };
  }

  // ---- 文本摘要 -----------------------------------------------------------

  /**
   * 生成面向 LLM 的结构化文本摘要
   */
  function summarizeLLM(params) {
    var data = exportLLMData(params);
    if (data.error) return data.error;

    var d = data;
    var scope = d.scope;
    var scopeCN = { yearly: '流年', monthly: '流月', daily: '流日', hourly: '流时' }[scope] || '流运';
    var overlay = d.overlays[scope];
    if (!overlay) return '无运限叠盘数据';

    var lines = [];

    // 基本资料
    lines.push('## ' + scopeCN + '命理分析数据');
    lines.push('');
    lines.push('出生：' + (d.birth.solarDate || '—') + '（' + (d.birth.lunarDate || '—') + '）');
    lines.push('五行局：' + (d.birth.fiveElementsClass || '—') + '  命主：' + (d.birth.soul || '—') + '  身主：' + (d.birth.body || '—'));
    lines.push('命宫：' + (d.birth.soulPalaceBranch || '—') + '  身宫：' + (d.birth.bodyPalaceBranch || '—'));
    lines.push('');

    // 三方四正快速摘要
    if (d.sanfangSizheng && d.sanfangSizheng.length > 0) {
      lines.push('## 三方四正摘要（本命盘）');
      lines.push('');
      lines.push('| 本宫 | 三合宫 | 对宫 | 四正评分 | 四化 |');
      lines.push('|------|--------|------|----------|------|');
      d.sanfangSizheng.forEach(function (sfsz) {
        var mutStr = sfsz.fourMutatgens.map(function (m) { return m.star + '化' + m.type; }).join(' ') || '—';
        var scoreStr = sfsz.fourScore + '(' + sfsz.fourJudgment + ')';
        lines.push('| ' + sfsz.palaceName + ' | ' +
          sfsz.triplePalaces.map(function (tp) {
            return tp.name + '[' + tp.majorStars.map(function (s) { return s.name; }).join(' ') + ']';
          }).join('<br>') +
          ' | ' + sfsz.opposite.name + '[' + sfsz.opposite.majorStars.map(function (s) { return s.name; }).join(' ') + ']' +
          ' | ' + scoreStr +
          ' | ' + mutStr +
          ' |');
      });
      lines.push('');
    }

    // 结构性标记
    if (d.structuralMarkers && d.structuralMarkers.length > 0) {
      lines.push('## 🔍 结构性标记（本命盘）');
      lines.push('');
      var grouped = { danger: [], warning: [], good: [], info: [] };
      d.structuralMarkers.forEach(function (m) {
        grouped[m.severity] = grouped[m.severity] || [];
        grouped[m.severity].push(m);
      });
      var severityLabel = { danger: '🔴 严重', warning: '🟡 注意', good: '✅ 吉格', info: 'ℹ️ 信息' };
      Object.keys(severityLabel).forEach(function (sev) {
        var items = grouped[sev] || [];
        if (items.length === 0) return;
        lines.push('### ' + severityLabel[sev]);
        items.forEach(function (m) {
          lines.push('- **' + m.type + '**：' + m.detail);
        });
        lines.push('');
      });
    }

    // 性别提示
    if (d.birth.fiveElementsClass) {
      lines.push('> **命理解析提示**：五行局为' + d.birth.fiveElementsClass + '，' +
        '分析时请结合三方四正吉凶与叠盘引动，重点关注本命空宫（借对宫星看）、' +
        '夹宫结构（空劫夹/火铃夹/双禄夹/双忌夹）和日月位置。');
      lines.push('');
    }

    // 流运信息
    lines.push('## ' + scopeCN + '基本盘');
    lines.push('');
    lines.push(scopeCN + '干支：' + overlay.fortuneStemBranch);
    lines.push('');

    // 四化映射
    if (overlay.mutagenMap) {
      lines.push('### ' + scopeCN + '四化');
      Object.keys(overlay.mutagenMap).forEach(function (key) {
        var m = overlay.mutagenMap[key];
        lines.push('- **' + key + '**：' + m.star + (m.brightness ? '[' + m.brightness + ']' : '') +
          ' 在本命' + m.natalPalace + '，叠' + m.overlayFortunePalace);
      });
      lines.push('');
    }

    // 流命宫叠宫
    if (overlay.fortuneSoulOverlay) {
      lines.push('### 流命宫叠宫');
      lines.push('');
      var so = overlay.fortuneSoulOverlay;
      lines.push(scopeCN + '命宫在' + so.branch + '，叠本命**' + so.natalPalaceName + '**：' +
        scopeCN + '运势主基调围绕' + so.natalPalaceName + '领域展开。');
      lines.push('');
    }

    // 十二宫叠盘表
    lines.push('### 十二宫叠盘对照');
    lines.push('');
    lines.push('| 地支 | 本命宫 | ' + scopeCN + '宫 | 流曜吉 | 流曜凶 | 四化 |');
    lines.push('|------|--------|--------|--------|--------|------|');
    overlay.overlays.forEach(function (o) {
      lines.push('| ' + o.branch + ' | ' + o.natalPalaceName + ' | ' + o.fortunePalaceName +
        ' | ' + (o.fortuneAuspiciousStars.join(' ') || '—') +
        ' | ' + (o.fortuneInauspiciousStars.join(' ') || '—') +
        ' | ' + (o.localMutagens.length > 0 ? o.localMutagens.map(function (m) { return m.star + '化' + m.type; }).join(' ') : '—') +
        ' |');
    });
    lines.push('');

    // 重点标记
    if (overlay.highlights && overlay.highlights.length > 0) {
      lines.push('### ⚠️ 重点标记');
      overlay.highlights.forEach(function (h) {
        var icon = h.severity === 'warning' ? '🔴' : '🟡';
        lines.push('- ' + icon + ' **' + h.type + '**：' + h.detail);
      });
      lines.push('');
    }

    // 事件索引
    var eventIdx = d.eventIndices[scope];
    if (eventIdx) {
      lines.push('### 📊 事件预判索引');
      lines.push('');
      var sorted = Object.keys(eventIdx).sort(function (a, b) { return eventIdx[b].score - eventIdx[a].score; });
      sorted.forEach(function (domain) {
        var e = eventIdx[domain];
        var emoji = { '大吉': '✅', '吉': '👍', '平': '➖', '凶': '⚠️', '大凶': '🚫' }[e.judgment] || '❓';
        lines.push('- ' + emoji + ' **' + domain + '**（' + e.judgment + '）：' + e.summary);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  // 简易文本摘要（单行，嵌到 summarize() 里）
  function summarizeShort(params) {
    var data = exportLLMData(params);
    if (data.error) return data.error;

    var overlay = data.overlays[data.scope];
    if (!overlay) return '无叠盘数据';

    var scopeCN = { yearly: '流年', monthly: '流月', daily: '流日', hourly: '流时' }[data.scope] || '';
    var lines = [];

    lines.push(scopeCN + '干支：' + overlay.fortuneStemBranch);

    if (overlay.fortuneSoulOverlay) {
      lines.push(scopeCN + '命宫叠本命' + overlay.fortuneSoulOverlay.natalPalaceName);
    }

    if (overlay.mutagenMap) {
      var mutParts = [];
      Object.keys(overlay.mutagenMap).forEach(function (k) {
        mutParts.push(k + '：' + overlay.mutagenMap[k].star + '@' + overlay.mutagenMap[k].natalPalace);
      });
      lines.push('四化：' + mutParts.join('，'));
    }

    var eventIdx = data.eventIndices[data.scope];
    if (eventIdx) {
      var top = Object.keys(eventIdx)
        .sort(function (a, b) { return eventIdx[b].score - eventIdx[a].score; })
        .slice(0, 3);
      lines.push('重点领域：' + top.map(function (d) { return d + '(' + eventIdx[d].judgment + ')'; }).join('、'));
    }

    return lines.join('  |  ');
  }

  // ---- 导出到全局 -----------------------------------------------------------

  root.ZWDSLLMExport = {
    buildOverlay: buildOverlay,
    buildEventIndex: buildEventIndex,
    buildSanfangSizheng: buildSanfangSizheng,
    buildStructuralMarkers: buildStructuralMarkers,
    exportLLMData: exportLLMData,
    summarizeLLM: summarizeLLM,
    summarizeShort: summarizeShort,
    BRANCHES: BRANCHES,
  };

})(typeof window !== 'undefined' ? window : globalThis);
