/**
 * 紫微斗数安星手写引擎
 * 严格按《紫微斗数安星法_完整教程》实现本命盘排盘,每步输出过程日志。
 * 其中定紫微采用与 iztro 一致的修正算法(教程 2.5 文字有自洽性错误,最终命盘以修正法为准)。
 */
(function (root) {
  'use strict';

  // 从 data-tables.js 统一读取公共常量与工具函数
  const C = (typeof root !== 'undefined' && root.ZWDS_CONST) || {};
  const STEMS = C.STEMS;
  const BRANCHES = C.BRANCHES;
  const PALACES = C.PALACES;
  const TIGER_STEM = C.TIGER_STEM;
  const bi = C.bi;
  const si = C.si;
  const mod12 = C.mod12;
  const mod10 = C.mod10;
  const nextStem = C.nextStem;
  const branchAt = C.branchAt;
  const move = C.move;
  const stepBetween = C.stepBetween;

  const GENDER = { male: '男', female: '女' };

  const LU_CUN = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
  const TIAN_MA = {
    申: '寅', 子: '寅', 辰: '寅',
    亥: '巳', 卯: '巳', 未: '巳',
    巳: '亥', 酉: '亥', 丑: '亥',
    寅: '申', 午: '申', 戌: '申'
  };
  const KUI_YUE = {
    甲: ['丑', '未'], 乙: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'],
    戊: ['丑', '未'], 己: ['子', '申'], 庚: ['丑', '未'], 辛: ['午', '寅'],
    壬: ['卯', '巳'], 癸: ['卯', '巳']
  };
  const HUO_LING_START = {
    寅: { 火星: '丑', 铃星: '卯' }, 午: { 火星: '丑', 铃星: '卯' }, 戌: { 火星: '丑', 铃星: '卯' },
    申: { 火星: '寅', 铃星: '戌' }, 子: { 火星: '寅', 铃星: '戌' }, 辰: { 火星: '寅', 铃星: '戌' },
    巳: { 火星: '卯', 铃星: '戌' }, 酉: { 火星: '卯', 铃星: '戌' }, 丑: { 火星: '卯', 铃星: '戌' },
    亥: { 火星: '酉', 铃星: '戌' }, 卯: { 火星: '酉', 铃星: '戌' }, 未: { 火星: '酉', 铃星: '戌' }
  };
  const FIVE_ELEMENT_CLASS = {
    1: '木三局', 2: '金四局', 3: '水二局', 4: '火六局', 5: '土五局',
    6: '木三局', 7: '金四局', 8: '水二局', 9: '火六局', 10: '土五局'
  };
  const FIVE_ELEMENT_VALUE = { '木三局': 3, '金四局': 4, '水二局': 2, '火六局': 6, '土五局': 5 };
  const START_AGE = { '水二局': 2, '木三局': 3, '金四局': 4, '土五局': 5, '火六局': 6 };
  const SOUL_STAR = { 子: '贪狼', 丑: '巨门', 寅: '禄存', 卯: '文曲', 辰: '廉贞', 巳: '武曲', 午: '破军', 未: '武曲', 申: '廉贞', 酉: '文曲', 戌: '禄存', 亥: '巨门' };
  const BODY_STAR = { 子: '铃星', 丑: '天相', 寅: '天梁', 卯: '天同', 辰: '文昌', 巳: '天机', 午: '火星', 未: '天相', 申: '天梁', 酉: '天同', 戌: '文昌', 亥: '天机' };
  const YANG_STEMS = ['甲', '丙', '戊', '庚', '壬'];
  const HOUR_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子'];
  const AGE_START = {
    '寅': '辰', '午': '辰', '戌': '辰',
    '申': '戌', '子': '戌', '辰': '戌',
    '巳': '未', '酉': '未', '丑': '未',
    '亥': '丑', '卯': '丑', '未': '丑'
  };

  // 来自 data-tables.js (browser/Node 均通过 globalThis 访问)
  const MUTAGEN_TABLE_QUANSHU = typeof globalThis !== 'undefined' && globalThis.MUTAGEN_TABLE_QUANSHU ? globalThis.MUTAGEN_TABLE_QUANSHU : {};
  const MUTAGEN_TABLE_ZHONGZHOU = typeof globalThis !== 'undefined' && globalThis.MUTAGEN_TABLE_ZHONGZHOU ? globalThis.MUTAGEN_TABLE_ZHONGZHOU : {};
  const BRIGHTNESS_TABLE = typeof globalThis !== 'undefined' && globalThis.BRIGHTNESS_TABLE ? globalThis.BRIGHTNESS_TABLE : {};

  function getMutagen(starName, yearStem, school) {
    const table = school === 'zhongzhou' ? MUTAGEN_TABLE_ZHONGZHOU : MUTAGEN_TABLE_QUANSHU;
    const list = table[yearStem] || [];
    const idx = list.indexOf(starName);
    return idx >= 0 ? ['禄', '权', '科', '忌'][idx] : '';
  }
  function getBrightness(starName, branch) {
    const t = BRIGHTNESS_TABLE[starName];
    if (!t) return '';
    return t.table[bi(branch)] || '';
  }

  function groupValueOfStem(s) {
    const g = { 甲: 1, 乙: 1, 丙: 2, 丁: 2, 戊: 3, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5 };
    return g[s];
  }
  function groupValueOfBranch(b) {
    const g = { 子: 1, 丑: 1, 午: 1, 未: 1, 寅: 2, 卯: 2, 申: 2, 酉: 2, 辰: 3, 巳: 3, 戌: 3, 亥: 3 };
    return g[b];
  }

  class ZWDSEngine {
    constructor(input) {
      this.input = input;
      this.yearStem = input.yearStem;
      this.yearBranch = input.yearBranch;
      this.lunarMonth = input.lunarMonth;
      this.lunarDay = input.lunarDay;
      this.hourIndex = input.hourIndex; // 0-12, 0=子, 12=晚子
      this.gender = input.gender;
      this.school = input.school || 'zhongzhou';
      this.logs = [];
    }

    _log(title, formula, calc, result, note, analysis) {
      this.logs.push({ title, formula, calc: calc || '', result, note: note || '', analysis: analysis || '' });
    }

    compute() {
      this.logs = [];
      // 1. 定命宫
      const monthStart = branchAt(this.lunarMonth - 1); // 寅起正月
      this._log('① 定命宫', '寅上起正月,顺数到生月,逆数到生时',
        `正月在寅; 生月${this.lunarMonth}月,顺数至${monthStart}; 生时第${this.hourIndex + 1}个时辰(子=1)`,
        `命宫 = ${monthStart} 逆数 ${this.hourIndex + 1} 步 = ${branchAt(bi(monthStart) - this.hourIndex)}`,
        '时辰从子起算第1步');
      this.soulBranch = branchAt(bi(monthStart) - this.hourIndex);
      this.soulIndex = bi(this.soulBranch);

      // 2. 定身宫
      this.bodyBranch = branchAt(bi(monthStart) + this.hourIndex);
      this._log('② 定身宫', '寅上起正月,顺数到生月,再顺数到生时',
        `生月起点${monthStart}; 生时第${this.hourIndex + 1}个时辰`,
        `身宫 = ${monthStart} 顺数 ${this.hourIndex + 1} 步 = ${this.bodyBranch}`);

      // 3. 安十二宫名
      // 从命宫开始,逆时针(地支索引增加方向)依次是:命宫→父母→福德→田宅→官禄→仆役→迁移→疾厄→财帛→子女→夫妻→兄弟
      this.palaceNames = BRANCHES.map((_, i) => PALACES[mod12(this.soulIndex - i)]);
      this._log('③ 安十二宫名', '从命宫开始逆时针依次排十二宫',
        `命宫在${this.soulBranch}`,
        this.palaceNames.map((n, i) => `${BRANCHES[i]}:${n}`).join(' · '));

      // 4. 五虎遁
      this.tigerStem = TIGER_STEM[this.yearStem];
      this.palaceStems = BRANCHES.map((b, i) => nextStem(this.tigerStem, i));
      this._log('④ 五虎遁定宫干', `${this.yearStem}年,${this.yearStem === '甲' || this.yearStem === '己' ? '甲己之年丙作首' : ''}`,
        `寅宫天干=${this.tigerStem}; 从寅顺排十天干`,
        this.palaceStems.map((s, i) => `${s}${BRANCHES[i]}`).join(' · '));
      this.soulStem = this.palaceStems[this.soulIndex];

      // 5. 纳音五行局
      const sg = groupValueOfStem(this.soulStem);
      const bg = groupValueOfBranch(this.soulBranch);
      const naYin = sg + bg;
      this.fiveElementsClass = FIVE_ELEMENT_CLASS[naYin];
      this._log('⑤ 定五行局（纳音法）', '天干组值 + 地支组值 = 纳音数,查表得五行局',
        `${this.soulStem}属第${sg}组,${this.soulBranch}属第${bg}组; 纳音数=${sg}+${bg}=${naYin}`,
        `五行局 = ${this.fiveElementsClass}, 起运岁数 = ${START_AGE[this.fiveElementsClass]}岁`);

      // 6. 定紫微星
      const ju = FIVE_ELEMENT_VALUE[this.fiveElementsClass];
      let offset = 0;
      while ((this.lunarDay + offset) % ju !== 0) offset++;
      let quotient = (this.lunarDay + offset) / ju;
      quotient %= 12;
      let ziweiIndex = quotient - 1; // 0=寅
      if (offset % 2 === 0) ziweiIndex += offset; else ziweiIndex -= offset;
      ziweiIndex = mod12(ziweiIndex);
      this.ziweiBranch = BRANCHES[ziweiIndex];
      this._log('⑥ 定紫微星', '局数除生日,加补数使其整除得商;商从寅起数,偶补顺行、奇补逆行',
        `${this.lunarDay} ÷ ${ju} 不能整除,补数=${offset},商=${quotient}; ` +
        `${offset % 2 === 0 ? '偶补' : '奇补'}:${offset % 2 === 0 ? '+' + offset : '-' + offset}`,
        `紫微在${this.ziweiBranch}宫`,
        '修正法与 iztro 一致');

      // 7. 定天府星
      this.tianfuIndex = mod12(12 - ziweiIndex);
      this.tianfuBranch = BRANCHES[this.tianfuIndex];
      this._log('⑦ 定天府星', '天府与紫微相对;若紫微在寅/申则同宫',
        `紫微在${this.ziweiBranch}(index=${ziweiIndex}); 12 - ${ziweiIndex} = ${this.tianfuIndex}`,
        `天府在${this.tianfuBranch}宫`);

      // 8. 安十四主星
      this.palaces = BRANCHES.map((b, i) => ({
        index: i, branch: b, stem: this.palaceStems[i],
        name: this.palaceNames[i],
        stars: [], majorStars: [], minorStars: []
      }));
      const ziweiGroup = [
        { star: '紫微', step: 0 }, { star: '天机', step: 1 }, null,
        { star: '太阳', step: 3 }, { star: '武曲', step: 4 }, { star: '天同', step: 5 },
        null, null, { star: '廉贞', step: 8 }
      ];
      const tianfuGroup = [
        { star: '天府', step: 0 }, { star: '太阴', step: 1 }, { star: '贪狼', step: 2 },
        { star: '巨门', step: 3 }, { star: '天相', step: 4 }, { star: '天梁', step: 5 },
        { star: '七杀', step: 6 }, null, null, null, { star: '破军', step: 10 }
      ];
      const majorLog = [];
      ziweiGroup.forEach(item => {
        if (!item) return;
        const idx = mod12(ziweiIndex - item.step);
        this._placeStar(idx, item.star, 'major', true);
        majorLog.push(`${item.star}→${BRANCHES[idx]}`);
      });
      tianfuGroup.forEach(item => {
        if (!item) return;
        const idx = mod12(this.tianfuIndex + item.step);
        this._placeStar(idx, item.star, 'major', true);
        majorLog.push(`${item.star}→${BRANCHES[idx]}`);
      });
      this._log('⑧ 安十四主星', '紫微系从紫微起逆时针,天府系从天府起顺时针',
        '紫微系:' + ziweiGroup.filter(Boolean).map(i => i.star).join('→') + '; 天府系:' + tianfuGroup.filter(Boolean).map(i => i.star).join('→'),
        majorLog.join(' · '));

      // 9. 安辅星
      this._placeAuxiliaries();

      // 10. 四化
      const yearMutagen = (this.school === 'zhongzhou' ? MUTAGEN_TABLE_ZHONGZHOU : MUTAGEN_TABLE_QUANSHU)[this.yearStem] || [];
      this.palaces.forEach(p => {
        p.stars.forEach(star => {
          star.mutagen = getMutagen(star.name, this.yearStem, this.school);
        });
      });
      this._log('⑩ 安四化', `${this.school === 'zhongzhou' ? '中州派' : '全书派'} ${this.yearStem}年四化`,
        '',
        yearMutagen.map((s, i) => `${s}化${['禄', '权', '科', '忌'][i]}`).join(' · '));

      // 11. 命主身主
      // 全书派: 命主由命宫地支定; 中州派: 命主由生年地支定(iztro 实现)
      const soulSource = this.school === 'zhongzhou' ? this.yearBranch : this.soulBranch;
      this.soulStar = SOUL_STAR[soulSource];
      this.bodyStar = BODY_STAR[this.yearBranch];
      this._log('⑪ 命主身主',
        this.school === 'zhongzhou' ? '中州派:命主由生年地支定;身主由生年地支定' : '全书派:命主由命宫地支定;身主由生年地支定',
        `命主来源${soulSource} → ${this.soulStar}; 生年${this.yearBranch} → ${this.bodyStar}`,
        `命主${this.soulStar},身主${this.bodyStar}`,
        '',
        '命主星象徵先天格局、禀性與人生主軸，由命宮地支(全書派)或生年地支(中州派)推出；身主星象徵後天行為、身體與後天際遇，由生年地支推出。二者與命身宮同參，可判斷一個人的先天潛質與後天修為走向。');

      // 12. 大限
      this._calcDecadal();

      return {
        logs: this.logs,
        summary: {
          yearStem: this.yearStem, yearBranch: this.yearBranch,
          lunarMonth: this.lunarMonth, lunarDay: this.lunarDay,
          hourIndex: this.hourIndex, gender: this.gender,
          soulBranch: this.soulBranch, bodyBranch: this.bodyBranch,
          soulStem: this.soulStem, fiveElementsClass: this.fiveElementsClass,
          soulStar: this.soulStar, bodyStar: this.bodyStar,
          ziweiBranch: this.ziweiBranch, tianfuBranch: this.tianfuBranch,
          school: this.school
        },
        palaces: this.palaces.map(p => ({
          index: p.index, branch: p.branch, stem: p.stem, name: p.name,
          stars: p.stars.map(s => ({ name: s.name, type: s.type, brightness: s.brightness, mutagen: s.mutagen })),
          majorStars: p.stars.filter(s => s.type === 'major').map(s => s.name),
          minorStars: p.stars.filter(s => s.type === 'minor').map(s => s.name),
          decadal: p.decadal
        }))
      };
    }

    _placeStar(idx, starName, type, withBrightness) {
      const p = this.palaces[idx];
      const star = {
        name: starName, type: type, scope: 'origin',
        brightness: withBrightness ? getBrightness(starName, p.branch) : '',
        mutagen: getMutagen(starName, this.yearStem, this.school)
      };
      p.stars.push(star);
    }

    _placeAuxiliaries() {
      const notes = [];
      // 左辅右弼
      const zuoIdx = mod12(bi('辰') + (this.lunarMonth - 1));
      const youIdx = mod12(bi('戌') - (this.lunarMonth - 1));
      this._placeStar(zuoIdx, '左辅', 'minor', false);
      this._placeStar(youIdx, '右弼', 'minor', false);
      notes.push(`左辅${BRANCHES[zuoIdx]} 右弼${BRANCHES[youIdx]}`);

      // 文昌文曲
      const changIdx = mod12(bi('戌') - this.hourIndex);
      const quIdx = mod12(bi('辰') + this.hourIndex);
      this._placeStar(changIdx, '文昌', 'minor', true);
      this._placeStar(quIdx, '文曲', 'minor', true);
      notes.push(`文昌${BRANCHES[changIdx]} 文曲${BRANCHES[quIdx]}`);

      // 天魁天钺
      const [kuiB, yueB] = KUI_YUE[this.yearStem];
      const kuiIdx = bi(kuiB), yueIdx = bi(yueB);
      this._placeStar(kuiIdx, '天魁', 'minor', false);
      this._placeStar(yueIdx, '天钺', 'minor', false);
      notes.push(`天魁${kuiB} 天钺${yueB}`);

      // 禄存 擎羊 陀罗
      const luB = LU_CUN[this.yearStem];
      const luIdx = bi(luB);
      this._placeStar(luIdx, '禄存', 'minor', true);
      this._placeStar(mod12(luIdx + 1), '擎羊', 'minor', true);
      this._placeStar(mod12(luIdx - 1), '陀罗', 'minor', true);
      notes.push(`禄存${luB} 擎羊${BRANCHES[mod12(luIdx + 1)]} 陀罗${BRANCHES[mod12(luIdx - 1)]}`);

      // 天马
      const maB = TIAN_MA[this.yearBranch];
      this._placeStar(bi(maB), '天马', 'minor', false);
      notes.push(`天马${maB}`);

      // 火星铃星
      const hls = HUO_LING_START[this.yearBranch];
      const huoIdx = mod12(bi(hls['火星']) + this.hourIndex);
      const lingIdx = mod12(bi(hls['铃星']) + this.hourIndex);
      this._placeStar(huoIdx, '火星', 'minor', true);
      this._placeStar(lingIdx, '铃星', 'minor', true);
      notes.push(`火星${BRANCHES[huoIdx]} 铃星${BRANCHES[lingIdx]}`);

      // 地空地劫
      const kongIdx = mod12(bi('亥') - this.hourIndex);
      const jieIdx = mod12(bi('亥') + this.hourIndex);
      this._placeStar(kongIdx, '地空', 'minor', false);
      this._placeStar(jieIdx, '地劫', 'minor', false);
      notes.push(`地空${BRANCHES[kongIdx]} 地劫${BRANCHES[jieIdx]}`);

      this._log('⑨ 安辅星', '左辅右弼/文昌文曲/天魁天钺/禄存羊陀/天马/火铃/空地,按年月日时规则安布',
        notes.join('; '), '六吉六煞+禄马布齐');
    }

    _calcDecadal() {
      const startAge = START_AGE[this.fiveElementsClass];
      const yangYear = YANG_STEMS.includes(this.yearStem);
      const male = this.gender === 'male';
      const forward = (yangYear && male) || (!yangYear && !male);
      this._log('⑫ 排大限', `${yangYear ? '阳' : '阴'}年${male ? '男' : '女'} → ${forward ? '顺行' : '逆行'}; 从${this.soulBranch}命宫起,每宫十年`,
        `五行局${this.fiveElementsClass},起运${startAge}岁`, '',
        '',
        '大限又稱十年大運，是人生階段性運勢的總綱。陽男陰女順行、陰男陽女逆行，自命宮起每宮管十年。大限走到何宮，即以該宮為主運宮位，配合該宮主星、四化及與本命盤的交感，可斷十年吉凶趨勢與人生重大轉折。');
      for (let i = 0; i < 12; i++) {
        const offset = forward ? i : -i;
        const idx = mod12(this.soulIndex + offset);
        const p = this.palaces[idx];
        const s = startAge + i * 10;
        p.decadal = { start: s, end: s + 9, range: `${s}-${s + 9}` };
      }
    }

    /**
     * 计算小限、流年、流月、流日、流时命宫位置并记录过程
     * @param {Object} input
     *   nominalAge 虚岁
     *   yearlyStem/yearlyBranch 流年干支
     *   monthlyStem/monthlyBranch 流月干支
     *   dailyStem/dailyBranch 流日干支
     *   hourlyStem/hourlyBranch 流时干支
     *   targetLunarMonth 目标农历月
     *   targetLunarDay 目标农历日
     *   targetHourIndex 目标时辰索引(0-12)
     *   birthIsLeap 出生是否闰月
     *   targetIsLeap 目标是否闰月
     */
    calcHoroscope(input) {
      const logs = [];
      const male = this.gender === 'male';

      // 1. 小限
      const ageStartBranch = AGE_START[this.yearBranch];
      const ageStartIndex = bi(ageStartBranch);
      const ageOffset = (input.nominalAge - 1) % 12;
      const ageIndex = mod12(ageStartIndex + (male ? ageOffset : -ageOffset));
      const ageBranch = BRANCHES[ageIndex];
      logs.push({
        title: '⑬ 起小限',
        formula: '小限一年一度逢,男顺女逆不相同;寅午戌人辰上起,申子辰人自戌宫,巳酉丑人未宫始,亥卯未人起丑宫',
        calc: `${this.yearBranch}年生 → 起宫${ageStartBranch}(index=${ageStartIndex}); 虚岁${input.nominalAge}, 偏移=${ageOffset}; ${male ? '男顺' : '女逆'}`,
        result: `小限命宫在${ageBranch}宫(index=${ageIndex})`,
        note: '',
        analysis: '小限為當年歲運，反映一年之內的吉凶起伏與流年事象的細部脈動。男順女逆、以生年地支定起點，虛歲逐年移宮。小限所在宮位及其主星、四化，可與流年命宮相互參照，細斷當年健康、情緒與人際變化。'
      });

      // 2. 流年
      const yearlyIndex = bi(input.yearlyBranch);
      logs.push({
        title: '⑭ 起流年',
        formula: '流年命宫 = 当年太岁宫(即流年地支所在宫位)',
        calc: `流年地支${input.yearlyBranch} → 宫位index=${yearlyIndex}`,
        result: `流年命宫在${BRANCHES[yearlyIndex]}宫, 流年干支${input.yearlyStem}${input.yearlyBranch}`,
        note: 'iztro 采用太岁宫法,与教程简化法结果一致',
        analysis: '流年為一整年之大運，以當年地支(太歲)入命宮，再配合流年天干四化，可觀該年整體氣運與重大事件。流年命宮成為該年度的「當事宮」，與本命、大限、小限疊盤而觀，可斷事業、財運、感情、健康等年度主題。'
      });

      // 3. 流月
      // iztro 公式: monthlyIndex = yearlyIndex - (birthLunarMonth+leap) + birthHourBranch + (targetLunarMonth+targetLeap)
      const birthLeap = (input.birthIsLeap && this.lunarDay > 15) ? 1 : 0;
      const targetLeap = (input.targetIsLeap && input.targetLunarDay > 15) ? 1 : 0;
      const birthHourBranchIdx = this.hourIndex % 12;
      const birthHourName = HOUR_BRANCHES[this.hourIndex];
      const monthlyIndex = mod12(yearlyIndex - (this.lunarMonth + birthLeap) + birthHourBranchIdx + (input.targetLunarMonth + targetLeap));
      logs.push({
        title: '⑮ 起流月',
        formula: '流月命宫 = 流年命宫 - (生月+闰补) + 生时地支 + (当月+闰补)',
        calc: `${yearlyIndex} - (${this.lunarMonth}${birthLeap ? '+'+birthLeap : ''}) + ${birthHourBranchIdx}(${birthHourName}时) + (${input.targetLunarMonth}${targetLeap ? '+'+targetLeap : ''}) = ${monthlyIndex}`,
        result: `流月命宫在${BRANCHES[monthlyIndex]}宫, 流月干支${input.monthlyStem}${input.monthlyBranch}`,
        note: '综合了太岁宫、生月生时修正与寅宫建月规则',
        analysis: '流月為一個月之運勢，由流年命宮出發，結合出生月、出生時辰與目標月進行推演。流月命宮是當月事件與情緒起伏的主軸，與流年、本命相疊後，可細斷當月財運、工作推進、感情互動等短期趨勢。'
      });

      // 4. 流日
      const dailyIndex = mod12(monthlyIndex + input.targetLunarDay - 1);
      logs.push({
        title: '⑯ 起流日',
        formula: '流日命宫 = 流月命宫 + 农历日 - 1',
        calc: `${monthlyIndex} + ${input.targetLunarDay} - 1 = ${dailyIndex}`,
        result: `流日命宫在${BRANCHES[dailyIndex]}宫, 流日干支${input.dailyStem}${input.dailyBranch}`,
        note: '',
        analysis: '流日為一日之運勢，由流月命宮順推當日農曆日期。流日命宮及其主星、流耀，可反映當天的氣場、機緣與應注意的事項。對於擇日、行程規劃、短線決策（如面試、簽約、出行）具有參考價值。'
      });

      // 5. 流时
      const targetHourBranchIdx = input.targetHourIndex % 12;
      const targetHourName = HOUR_BRANCHES[input.targetHourIndex];
      const hourlyIndex = mod12(dailyIndex + targetHourBranchIdx);
      logs.push({
        title: '⑰ 起流时',
        formula: '流时命宫 = 流日命宫 + 目标时辰地支索引',
        calc: `${dailyIndex} + ${targetHourBranchIdx}(${targetHourName}时) = ${hourlyIndex}`,
        result: `流时命宫在${BRANCHES[hourlyIndex]}宫, 流时干支${input.hourlyStem}${input.hourlyBranch}`,
        note: '',
        analysis: '流時為一個時辰(兩小時)之運勢，由流日命宮順推當前時辰地支。流時命宮可捕捉更細微的氣運波動，適用於短時段決策、擇時與事件發生時刻的精微判斷。'
      });

      return {
        ageIndex, yearlyIndex, monthlyIndex, dailyIndex, hourlyIndex,
        logs
      };
    }
  }

  root.ZWDSEngine = ZWDSEngine;
})(typeof window !== 'undefined' ? window : globalThis);
