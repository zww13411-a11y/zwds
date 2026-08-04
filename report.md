# 紫微斗数网页排盘工具 — Agent 技术文档

> 本文档面向其他 AI Agent / 大模型。阅读后应能完整理解本项目结构、数据模型、对外接口，并具备在此基础上扩展或调用计算结果进行分析的能力。

## 1. 项目定位

一个**纯静态网页版紫微斗数排盘器**，基于《紫微斗数安星法_完整教程》与 iztro v2.5.8 实现。

- **无需构建**：直接双击 `index.html` 在浏览器打开即可运行。
- **双引擎**：手写安星引擎负责过程推演，iztro 作为权威结果用于对拍与杂曜数据。
- **Agent 友好**：页面加载后会在 `window` 上暴露 `zwdsState`（完整状态）与 `zwdsAPI`（可调用接口），其他 Agent 可通过浏览器自动化或脚本注入直接读取/调用。
- **🆕 LLM 分析预处理**：内置叠盘关联 + 事件化索引引擎，自动生成 LLM 可直接消费的结构化分析数据。

## 2. 文件结构与职责

```
zwds/
├── index.html              # 页面结构：输入区、计算过程面板、命盘方格、嵌套导航、时间轴
├── css/style.css           # 暗色传统 4×4 十二宫方格样式
├── js/
│   ├── data-tables.js      # 常量与查表数据：地支/天干/宫位、星名、亮度表、四化表
│   ├── engine.js           # ZWDSEngine：手写安星与运限计算引擎
│   ├── llm-export.js       # 🆕 LLM 分析预处理器：叠盘关联 + 事件化索引
│   └── app.js              # UI 渲染、事件绑定、iztro 调用、对拍逻辑、嵌套导航、Agent API
├── lib/iztro.min.js        # iztro v2.5.8 UMD 浏览器构建，暴露全局 iztro 对象
├── report.md               # 本文档
├── report.html             # 本文档网页版
└── tools/                  # Node 环境测试/数据生成脚本（非运行时必需）
```

## 3. 核心数据模型

### 3.1 本命盘宫位（Palace）

iztro 返回的 palace 对象关键字段：

```ts
{
  index: number,              // 0-11，固定顺序：命宫、父母、福德、田宅、官禄、仆役、迁移、疾厄、财帛、子女、夫妻、兄弟
  name: string,               // 宫名
  heavenlyStem: string,       // 宫干
  earthlyBranch: string,      // 宫支
  isBodyPalace: boolean,      // 是否为身宫
  majorStars: Star[],         // 14 主星
  minorStars: Star[],         // 六吉六煞等辅星
  adjectiveStars: string[],   // 杂曜
  changsheng12: string,       // 长生十二神
  decadal: { range: [number, number] },  // 大限起止年龄
  ages: number[]              // 小限年龄列表
}
```

`Star` 结构：

```ts
{
  name: string,        // 星曜中文名
  brightness?: string, // 庙旺利平陷
  mutagen?: string     // 禄/权/科/忌
}
```

### 3.2 手写引擎结果（ZWDSEngine.compute）

```ts
{
  summary: {
    soulBranch: string,        // 命宫地支
    bodyBranch: string,        // 身宫地支
    fiveElementsClass: string, // 五行局
    soulStar: string,          // 命主星
    bodyStar: string,          // 身主星
    ziweiBranch: string,       // 紫微所在地支
    tianfuBranch: string       // 天府所在地支
  },
  palaces: EnginePalace[],     // 12 宫
  logs: LogEntry[]             // 17 步计算过程
}
```

`LogEntry`：

```ts
{
  title: string,    // 如 "① 定命宫"
  formula: string,  // 口诀/公式
  calc: string,     // 代入数值的计算式
  result: string,   // 最终结果
  note?: string,    // 补充说明
  analysis?: string // 命理解析(第11-17步已填充)
}
```

### 3.3 运限数据（iztro.horoscope）

```ts
{
  age: { index, nominalAge },
  yearly: { index, heavenlyStem, earthlyBranch, palaceNames, mutagen, stars },
  monthly: { index, heavenlyStem, earthlyBranch, palaceNames, mutagen, stars },
  daily:  { index, heavenlyStem, earthlyBranch, palaceNames, mutagen, stars },
  hourly: { index, heavenlyStem, earthlyBranch, palaceNames, mutagen, stars },
  lunarDate: string  // 如 "二〇二六年六月十五"
}
```

每个 `stars[idx]` 数组表示该层流耀叠加到第 `idx` 宫位的星曜。

### 3.4 状态对象（window.zwdsState）

```ts
{
  astrolabe: Astrolabe,          // iztro 本命盘对象
  engine: ZWDSEngine,            // 引擎实例
  engineResult: EngineResult,    // 手写本命盘结果
  horoscope: Horoscope,          // 当前目标时间的 iztro 运限对象
  horoscopeResult: HoroscopeResult,
  scope: 'origin'|'decadal'|'age'|'yearly'|'monthly'|'daily'|'hourly',
  targetDate: Date,
  followRealtime: boolean,
  compare: Object,
  horoscopeCompare: Object,
  nested: { year, month, day, hour }
}
```

## 4. 对外 Agent API（window.zwdsAPI）

页面加载并初始化完成后调用。

### 4.1 calculate()

读取当前输入区内容，重新排盘。

### 4.2 setScope(scope)

切换视图：`origin`、`decadal`、`age`、`yearly`、`monthly`、`daily`、`hourly`。

### 4.3 navigateNested(action, value)

嵌套导航切换：
```js
window.zwdsAPI.navigateNested('month', '6')   // 流年下进入六月
window.zwdsAPI.navigateNested('day', '15')    // 流月下进入十五
window.zwdsAPI.navigateNested('hour', '4')    // 辰时，进入流时
window.zwdsAPI.navigateNested('back', 'daily') // 返回
```

### 4.4 exportData()

返回完整命盘与运限数据（JSON 可序列化）。不含 LLM 预处理数据。

### 4.5 summarize()

返回大模型可快速理解的文本摘要（出生、五行局、命主身主、当前视图）。

### 4.6 getState() / getInput()

返回完整状态对象或当前输入参数。

### 4.7 exportLLMData() 🆕

**核心 LLM 分析接口**。返回含**叠盘关联**与**事件预判索引**的完整结构化数据，供大模型精准解析流年/流月/流日/流时。详见第 5 章。

### 4.8 summarizeLLM() 🆕

返回面向 LLM 的完整 Markdown 文本分析摘要，含叠盘对照表 + 四化映射 + 事件预判。

### 4.9 summarizeShort() 🆕

返回一行简洁摘要：
```
流年干支：丙午  |  流年命宫叠本命官禄  |  四化：化禄：天同@田宅，化权：天机@迁移  |  重点领域：事业(吉)、财运(平)、感情(吉)
```

## 5. 🆕 叠盘关联与事件索引（LLM 分析预处理）

`llm-export.js` 提供 `buildOverlay` 和 `buildEventIndex` 两个预处理器，由 `window.ZWDSLLMExport` 暴露。它们补齐了从"原始排盘数据"到"LLM 可精准分析"的关键中间层。

### 5.1 叠盘关联原理

紫微斗数断事的核心在于"叠宫"——流X盘和本命盘的相对位置决定运势主题：
- 流年命宫叠本命**官禄**宫 → 该年事业是主轴
- 流年命宫叠本命**财帛**宫 → 该年财运是主轴
- 流年夫妻宫叠本命**疾厄**宫 → 感情涉及健康议题

`buildOverlay` 对每个流X层（流年/流月/流日/流时）计算：12 宫逐一叠盘对照、流曜分布、四化到本命宫映射、重点标记。

### 5.2 事件预判索引原理

基于叠盘 + 四化 + 流曜，对 **10 大领域**（事业/财运/感情/健康/家庭/人际/迁移/官非/学业/子女）量化评分：
- **四化引动**：化禄/权/科/忌入关联宫位权重打分
- **流命叠宫**：流命宫叠本命哪个宫位决定主旋律
- **流曜吉凶**：吉耀加分、煞耀减分也是事件信号
- **格局识别**：火贪格、日月并明等特殊组合

输出 `0-100 归一化分数` + `大吉/吉/平/凶/大凶` 判定 + 自然语言摘要。

### 5.3 exportLLMData() 数据模型

```ts
{
  birth: { solarDate, lunarDate, chineseDate, fiveElementsClass, soul, body, ... },
  scope: string,          // 'yearly'|'monthly'|'daily'|'hourly'
  targetDate: string,
  nested: { year, month, day, hour },

  // 🆕 本命盘三方四正摘要
  sanfangSizheng: SanfangSizhengEntry[],

  // 🆕 本命盘结构性标记
  structuralMarkers: StructuralMarker[],

  overlays: {
    yearly: OverlayData,   // 流年叠本命盘
    monthly: OverlayData,  // 流月叠本命盘
    daily: OverlayData,    // 流日叠本命盘
    hourly: OverlayData    // 流时叠本命盘
  },
  eventIndices: {
    yearly: EventIndex,    // 流年10大领域评分
    monthly: EventIndex,   // 流月10大领域评分
    daily: EventIndex,
    hourly: EventIndex
  },
  mutagenSummary: Object,  // 四化跨运限汇总
  highlights: Highlight[]  // 叠盘重点标记
}
```

**SanfangSizhengEntry**：每宫三合(2个)+对宫+四正评分+四化。`fourScore` 基于吉星+2/主星+1/煞星-2 计分，`fourJudgment` 分四正吉/平/弱/凶四级。

**StructuralMarker**：夹宫（空劫夹/火铃夹/羊陀夹/双禄夹/双忌夹/魁钺夹/昌曲夹）、日月（日月并明/日月反背）、格局（府相朝垣）、空宫、天干伏吟。`severity` 分 danger/warning/good/info。

**OverlayData：**

```ts
{
  scope: string,              // 运限类型
  scopeCN: string,            // 中文名称
  fortuneStemBranch: string,  // 流X天干地支
  fortuneSoulIndex: number,   // 流命宫位置索引
  fortuneSoulOverlay: {       // ★ 断事关键
    natalPalaceName: string,  // 流命宫对应本命宫名
    overlayLabel: string,     // "流年父母叠本命夫妻"
    fortuneAuspiciousStars: string[],
    fortuneInauspiciousStars: string[],
  },
  mutagenMap: {               // 四化→本命宫引动链
    "化禄": { star, brightness, natalPalace, significance },
    "化权": { ... },
    "化科": { ... },
    "化忌": { ... }
  },
  overlays: CellOverlay[],    // 12宫逐宫叠盘
  highlights: Highlight[]     // 叠盘重点标记
}
```

**EventIndex（10 大领域）：**

```ts
{
  "事业": {
    domain: "事业",
    score: 85,              // 加权原始分
    scoreNormalized: 71,    // 0-100 归一化
    judgment: "吉",         // 大吉/吉/平/凶/大凶
    keyTriggers: [{ type, detail, weight }],  // Top3 触发信号
    summary: "事业运势整体向好。关键信号：..."
  },
  "财运": { ... }, "感情": { ... }, "健康": { ... },
  "家庭": { ... }, "人际": { ... }, "迁移": { ... },
  "官非": { ... }, "学业": { ... }, "子女": { ... }
}
```

### 5.4 事件评分规则

| 触发类型 | 影响 | 权重 |
|----------|------|------|
| 流命宫叠本命主要关联宫 | 该领域是运限主轴 | +35 |
| 四化（禄/权/科/忌）入关联宫 | 核心引动信号 | +20~30 |
| 四化入次要关联宫 | 次级引动 | +12~18 |
| 吉曜入关联宫 | 利好信号 | +15 |
| 煞曜入关联宫 | 阻力但也是事件信号 | +12 |
| 特殊格局触发 | 爆发型事件 | +15~30 |
| 化忌（负面降级） | 负面惩罚 | 最终判定下调一级 |

## 6. 如何扩展

### 6.1 增加新的运限层级

1. 在 `engine.js` 的 `calcHoroscope` 中补充对应算法与 log。
2. 在 `app.js` 的 `SCOPE_LABELS` 和 Tab 按钮中增加新层级。
3. 在 `renderCell` 与 `updateHoroscopeInfo` 中处理新层级的显示。
4. 在 `exportData` 中导出新的 horoscope 字段。
5. （LLM 分析）在 `llm-export.js` 的 scopes 数组中增加新层级。

### 6.2 增加新流派

1. 在 `data-tables.js` 中新增四化表。
2. 在 `engine.js` 的 `MUTAGEN_TABLE` 选择逻辑中增加流派分支。
3. 在 `applySchoolConfig` 中配置 iztro。
4. 在 `index.html` 的 `#schoolInput` 中增加选项。

### 6.3 接入其他分析模型

**方式一（最简）**：调用 `window.zwdsAPI.summarizeLLM()` 获取 Markdown 文本，注入 LLM prompt。

**方式二（推荐）**：调用 `window.zwdsAPI.exportLLMData()` 获取结构化数据，用 `eventIndices` 做领域排名，用 `mutagenMap` 追踪四化引动链。

**方式三（无人介入）**：浏览器自动化注入脚本，直接调用 `exportLLMData()` 后传入 LLM。

## 7. 计算结果输出格式示例

### 7.1 单宫数据

```json
{
  "index": 0,
  "name": "命宫",
  "heavenlyStem": "辛",
  "earthlyBranch": "丑",
  "isBodyPalace": false,
  "majorStars": [
    { "name": "巨门", "brightness": "旺" },
    { "name": "天府", "brightness": "庙" }
  ],
  "minorStars": [
    { "name": "禄存" },
    { "name": "擎羊" }
  ],
  "adjectiveStars": ["天姚", "天刑"],
  "changsheng12": "长生",
  "decadal": { "range": [26, 35] },
  "ages": [37, 49]
}
```

### 7.2 对拍结果

```json
{
  "compare": {
    "soulBranch": true, "bodyBranch": true, "fiveElements": true,
    "majorStars": true, "minorStars": true, "mutagen": true, "decadal": true
  },
  "horoscopeCompare": {
    "age": true, "yearly": true, "monthly": true, "daily": true, "hourly": true
  }
}
```

## 8. 关键约定与陷阱

1. **农历闰月**：嵌套导航目前按平年 12 个月、每月 30 天处理。需额外历法数据做精确闰月。
2. **时辰索引**：`hourIndex` 0-11 对应子丑寅卯辰巳午未申酉戌亥，12 对应晚子（23:00-00:00）。
3. **iztro 配置缓存**：Node 环境 `require('iztro')` 会缓存配置，切换流派前须 `astro.config()` 重置。浏览器每次 `calculate()` 重新配置。
4. **教程与 iztro 差异**：定紫微采用 iztro 修正算法；流年采用太岁宫法。
5. **杂曜来源**：红鸾天喜、岁前/将前/博士十二神直接取自 iztro 数据。
6. **目标时间**：`targetDate` 是公历 Date。

## 9. 给其他 Agent 的使用建议

### 快速上手

1. 等待页面完成初始化。
2. 调用 `window.zwdsAPI.exportData()` 获取原始数据（或 `exportLLMData()` 获取预处理数据）。
3. 根据 `data.scope` 判断当前视图。
4. 结合 `nativePalaces` 与 horoscope 层分析宫位/星曜/四化。
5. 需要切换时间时调用 `navigateNested()`。

### LLM 精准分析流水线

```
浏览器 → navigateNested() 选目标时间
      → exportLLMData() 获取叠盘+事件索引
      → 注入 LLM prompt（含 eventIndices Top3 领域 + mutagenMap 四化链 + highlights 风险标记）
      → LLM 基于叠盘数据 + 本命盘做深度分析
```

### 浏览器自动化示例

```js
await page.goto('file:///path/to/zwds/index.html');
await page.waitForFunction(() => window.zwdsAPI?.getState()?.astrolabe);

// 设置出生并导航
await page.evaluate(() => {
  document.querySelector('#dateInput').value = '1990-05-15';
  document.querySelector('#hourInput').value = '4';
  window.zwdsAPI.calculate();
});
await page.evaluate(() => window.zwdsAPI.navigateNested('month', '8'));

// 获取 LLM 预处理数据
const data = await page.evaluate(() => window.zwdsAPI.exportLLMData());
// → data.eventIndices.yearly → 10大领域评分
// → data.overlays.yearly.mutagenMap → 四化引动链
// → data.overlays.yearly.fortuneSoulOverlay.natalPalaceName → 运限主题
```
