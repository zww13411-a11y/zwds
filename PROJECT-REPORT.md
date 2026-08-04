# 紫微斗数网页排盘工具 — 完整项目报告（面向 AI Agent）

> **版本**: 2026-07-29T22:40  
> **位置**: `C:\Users\USER\Desktop\zwds`  
> **目标读者**: 其他 AI Agent / LLM  
> 读完本文档后，一个全新的 AI Agent 应该能够：理解项目架构、知道每个文件的职责、复现完整开发历程、在此基础上继续扩展。

---

## 一、项目概述

一个**纯静态网页版紫微斗数排盘分析工具**，双击 `index.html` 即可在浏览器运行，无需服务器。

### 核心能力
1. **双引擎排盘**：手写安星引擎（17步推演过程可视化）+ iztro v2.5.8（权威对拍 + 杂曜数据）
2. **运限计算**：本命盘 → 大限 → 小限 → 流年 → 流月 → 流日 → 流时，支持嵌套导航
3. **叠盘对照**：流X盘十二宫逐一映射回本命宫，自动标注四化引动链
4. **事件预判**：对事业/财运/感情/健康/家庭/人际/迁移/官非/学业/子女 10大领域自动评分
5. **三方四正**：每宫三合宫 + 对宫 + 四正吉凶评分
6. **结构标记**：夹宫、日月状态、格局识别、空宫、伏吟
7. **AI 解读**：内置 DeepSeek 调用通道（V3/R1），API Key 本地 localStorage 持久化，一键调用 LLM 生成命理解读

---

## 二、文件结构（按创建/修改时序）

```
C:\Users\USER\Desktop\zwds\
├── 📄 index.html           (3.6 KB)  入口页面
├── 📄 report.md            (11 KB)   技术文档（→ 本文）
├── 📄 report.html          (~30 KB)  技术文档网页版
├── 📂 css/
│   └── 📄 style.css        (14.6 KB) 暗色主题样式，含分析面板+AI面板全部样式
├── 📂 js/                  ← 所有 JS 运行时文件
│   ├── 📄 data-tables.js   (5.8 KB)  常量表：天干地支、星名、亮度表、四化表
│   ├── 📄 engine.js        (22.9 KB) ZWDSEngine：手写安星引擎
│   ├── 📄 llm-export.js    (43.7 KB) LLM 分析预处理器（叠盘+事件索引+三方四正+结构标记）
│   └── 📄 app.js           (51.5 KB) UI 渲染、iztro 调用、对拍、运限导航、AI 面板、对外 API
├── 📂 lib/
│   └── 📄 iztro.min.js     (~500KB)  iztro v2.5.8 UMD 浏览器构建
└── 📂 tools/               ← 非运行时 Node 测试脚本
    ├── test-engine.js / test-horoscope.js   引擎/运限对拍测试
    ├── test-nested.js / test-ui*.js         嵌套导航 & UI 测试
    ├── test-agent-api.js                    Agent API 调用测试
    ├── test-quanshu.js                     全书流派测试
    ├── verify.js / verify2.js              对拍验证脚本
    ├── gen-data.js                         数据生成
    └── config-dump.json                    iztro 配置快照
```

---

## 三、完整开发历程（按时间线）

### Phase 0 — 项目创建（2026-07-28 之前）

**文件创建**：
- `data-tables.js` — 天干地支、星曜名、亮度/四化表、五行局/大限表
- `engine.js` — ZWDSEngine 类，实现完整 17 步安星法：
  1. 定命宫 → 2. 定十二宫 → 3. 定十二宫干 → 4. 定五行局 → 5. 安紫微 → 6. 安天府 → 7. 安十四主星 → 8. 安辅星（左右昌曲魁钺）→ 9. 安六煞 → 10. 安禄存羊陀 → 11. 定命主身主 → 12. 安生年四化 → 13. 定大限 → 14. 定小限 → 15. 安长生十二神 → 16. 安流年 → 17. 对拍验证
- `app.js` — iztro 集成、命盘 4×4 方格渲染、计算步骤面板、运限 Tab + 时间轴
- `index.html` — 暗色主题（CSS 变量体系：`--bg`、`--panel`、`--accent` 等）
- `style.css` — 十二宫方格、步骤列表、Tab、时间轴、状态标签样式

**关键决策**：
- 纯静态，无构建工具，双击运行
- iztro 作为"权威对拍源"，手写引擎负责推演过程可视化
- 数据模型：iztro 的 `Palace`（含 majorStars/minorStars/adjectiveStars/changsheng12/decadal/ages）

### Phase 1 — 对外 API 暴露（2026-07-28 ~ 29 凌晨）

**目的**：让外部 Agent（浏览器自动化/脚本注入）可以无侵入读取和操控。

**新增内容**：
- `window.zwdsAPI` 公开接口对象：
  - `calculate()` — 重新排盘
  - `setScope(scope)` — 切换运限
  - `navigateNested(action, value)` — 嵌套导航
  - `exportData()` — 导出完整 JSON
  - `summarize()` — 文本摘要
  - `getState()` / `getInput()` — 状态与输入参数
- `window.zwdsState` — 完整运行时状态（astrolabe/engine/horoscope/scope/targetDate...）

### Phase 2 — LLM 导出模块（2026-07-29 上午）

**文件创建**：`js/llm-export.js`（初始 25KB → 最终 44KB）

**新增模块** `window.ZWDSLLMExport`：

| 函数 | 功能 |
|------|------|
| `exportLLMData()` | 核心导出：本命+叠盘+事件索引，LLM 可直接消费 |
| `summarizeLLM()` | Markdown 完整分析摘要 |
| `summarizeShort()` | 一行简洁摘要 |
| `buildOverlay()` | 叠盘对照计算引擎 |
| `buildEventIndex()` | 10大领域事件预判评分 |
| `buildSanfangSizheng()` | 三方四正摘要 |
| `buildStructuralMarkers()` | 命盘结构标记（夹宫/日月/格局/空宫/伏吟） |

**数据模型新增**：
- `OverlayData`：运限干支、流命叠宫映射、四化引动链(mutagenMap)、12宫逐宫叠盘表、重点标记
- `EventIndex`：10领域 {score, scoreNormalized, judgment, keyTriggers, summary}
- `SanfangSizhengEntry`：三合宫(2个)+对宫+四正评分+四化
- `StructuralMarker`：{type, severity(danger/warning/good/info), detail}

**评分算法**：
- 流命宫叠本命关联宫 +35 → 领域主轴
- 四化入关联宫 +20~30 → 核心引动
- 吉曜 +15 / 煞曜 +12 / 格局 +15~30
- 化忌惩罚：最终判定下调一级
- 输出 0-100 归一化分数 + 大吉/吉/平/凶/大凶 五级

### Phase 3 — 分析面板 UI（2026-07-29 中午 ~ 下午）

**修改文件**：
- `index.html` — 在命盘区下方新增 `#analysisPanel` 区块
- `style.css` — 追加分析面板/叠盘表/事件卡片/标记列表样式
- `app.js` — 新增渲染函数：

**UI 结构**（5个标签页）：
```
📊 命盘分析
[叠盘对照] [事件预判] [三方四正] [结构标记] [AI 解读]
─────────────────────────────────────────
  对应内容区（#analysisContent 动态渲染）
```

**新增函数**：
- `renderAnalysisPanel()` — 主渲染路由（switch 按 activeTab 分发）
- `renderOverlayPanel()` — 叠盘对照表（12宫逐行：地支/本命宫/流X宫/流曜吉/流曜凶）
- `renderEventsPanel()` — 事件卡片（10领域排序，含分数条+判定+触发信号）
- `renderSanfangPanel()` — 三方四正表（fourScore/fourJudgment）
- `renderMarkersPanel()` — 结构标记列表（按 severity 分组着色）
- `setupAnalysisTabs()` — 标签点击事件委托

### Phase 4 — AI 解读集成（2026-07-29 下午 ~ 傍晚）

**新增能力**：
- DeepSeek API 调用（`callDeepSeek`）：POST `https://api.deepseek.com/chat/completions`
- System Prompt（`ZWDS_SYSTEM_PROMPT`）：定义星曜/四化/十二宫/叠宫/格局分析能力 + 输出要求
- User Prompt 构建（`buildAIUserPrompt`）：自动拼接命主信息+盘面+叠宫+事件索引+结构标记
- Markdown→HTML 渲染（`renderMarkdownToHtml`）：h2/h3/bold/italic/list/blockquote

**初始布局问题**：
- AI 配置区（#aigptConfig）被放在分析面板外部
- 用户点「AI 解读」标签时内容区空白，输入框却在另一个独立区域
- **修复**：将 AI 面板完全嵌入 `renderAnalysisPanel()` 的 switch 分支，通过 `renderAIGPTPanel()` 返回完整 HTML 注入 `#analysisContent`

**新增函数**：
- `renderAIGPTPanel()` — AI 面板 HTML（配置栏 + Prompt 预览 + 输出区）
- `buildAIContext()` — 构建 {systemPrompt, userPrompt} 上下文
- `callDeepSeek()` — fetch API 调用
- `renderMarkdownToHtml()` — 简易 Markdown 渲染
- `doAIAnalyze()` — 分析按钮事件处理
- `doCopyAIData()` — 复制 Prompt 到剪贴板

### Phase 5 — 用户体验改进 + Bug 修复（2026-07-29 晚上）

**改进：API Key 本地存储**
- `_getSavedKey()` / `_saveKey(k)` → `localStorage.zwds_deepseek_key`
- 填过一次自动记住，刷新/关浏览器后还在
- 已保存时显示 `🔑 API Key 已保存（sk-xxxx...）[更换]`
- 点「更换」清空 localStorage + 缓存 → 重新显示输入框
- 未保存时显示注册引导 + 免费额度说明 + 数据安全声明

**改进：新手引导**
- 链接到 platform.deepseek.com/api_keys
- "注册即送 500 万 token 免费额度"
- "填入后自动保存在浏览器本地，不会上传到任何服务器"
- 「复制数据」按钮始终可见（不管有没有 Key），可粘贴到 ChatGPT/Claude 等

**Bug 修复 1：key 当 DOM 元素用**
```js
// 🔴 旧代码（致命）
var key = $('#aigptKey');           // 可能返回字符串
callDeepSeek(..., key.value.trim()) // 💥 字符串无 .value 属性

// 🟢 修复后
var keyEl = $('#aigptKey');
var key = keyEl ? keyEl.value.trim() : '';
if (!key) { key = _getSavedKey(); } // fallback localStorage
callDeepSeek(..., key, model);      // 字符串直接传
```

**Bug 修复 2：复制按钮被隐藏**
- 未保存 Key 时 `savedKey ? actionRow : ''` 整个吞掉了复制按钮行
- 修复：`actionRow` 始终渲染，仅模型选择+分析按钮有条件

---

## 四、关键技术架构

### 4.1 数据流

```
用户输入(公历/农历日期+时辰+性别+流派)
        │
        ▼
  app.js calculate()
        │
        ├─→ iztro 排本命盘 (astrolabe)
        ├─→ ZWDSEngine 排本命盘 (engineResult)
        ├─→ 对拍 (compare)
        └─→ 渲染命盘方格 + 计算步骤
                │
        用户点击运限 Tab / 嵌套导航
                │
                ▼
        app.js setScope() / navigateNested()
                │
                ├─→ iztro.horoscope() 排运限
                ├─→ 对拍 (horoscopeCompare)
                ├─→ renderChart() 更新宫格
                ├─→ renderAnalysisPanel() 更新分析面板
                │     └─→ ZWDSLLMExport.exportLLMData()
                │           ├─→ buildOverlay() → 叠盘数据
                │           ├─→ buildEventIndex() → 事件评分
                │           ├─→ buildSanfangSizheng() → 三方四正
                │           └─→ buildStructuralMarkers() → 结构标记
                └─→ 用户点「AI 解读」→ buildAIContext() → callDeepSeek()
```

### 4.2 全局暴露（浏览器 Console 可直接调用）

```js
// 状态
window.zwdsState → { astrolabe, engine, engineResult, horoscope, horoscopeResult, scope, targetDate, nested, ... }

// API
window.zwdsAPI.calculate()                   // 重新排盘
window.zwdsAPI.setScope('yearly')             // 切换运限
window.zwdsAPI.navigateNested('month', '8')   // 嵌套导航到八月
window.zwdsAPI.exportData()                   // 导出原始 JSON（无 LLM 预处理）
window.zwdsAPI.exportLLMData()                // 🆕 导出含叠盘+事件索引的完整数据
window.zwdsAPI.summarizeLLM()                 // 🆕 Markdown 分析摘要
window.zwdsAPI.summarizeShort()               // 🆕 一行简洁摘要
window.zwdsAPI.getState()                     // 返回完整 zwdsState
window.zwdsAPI.getInput()                     // 返回当前输入参数

// LLM 导出模块
window.ZWDSLLMExport.exportLLMData({...})     // 带参数调用
window.ZWDSLLMExport.buildSanfangSizheng(...)
window.ZWDSLLMExport.buildStructuralMarkers(...)
```

### 4.3 CSS 变量体系（换肤只需改这些）

```css
:root {
  --bg: #0f1117;
  --panel: #1a1d27;
  --panel-light: #242836;
  --border: #2e3345;
  --text: #e0e4f0;
  --text-dim: #6b7394;
  --accent: #c9a227;     /* 金色 */
  --accent2: #58a6ff;    /* 蓝色 */
  --green: #3fb950;
  --red: #f85149;
  /* ... */
}
```

---

## 五、数据模型速查

### 5.1 exportLLMData() 返回结构

```typescript
{
  birth: { solarDate, lunarDate, chineseDate, fiveElementsClass, soul, body, zodiac, bazi, ... },
  scope: 'yearly' | 'monthly' | 'daily' | 'hourly',
  targetDate: string,
  nested: { year, month, day, hour },
  nativePalaces: Palace[],           // 12 宫含主星/辅星/杂曜
  nativeMutagen: string[],           // ["天同化禄@田宅", ...]
  sanfangSizheng: SanfangEntry[],    // 12 宫三方四正
  structuralMarkers: Marker[],       // 夹宫/日月/格局/空宫/伏吟
  overlays: {
    yearly: OverlayData,
    monthly: OverlayData,
    daily: OverlayData,
    hourly: OverlayData
  },
  eventIndices: {
    yearly: { 事业, 财运, 感情, 健康, 家庭, 人际, 迁移, 官非, 学业, 子女 },
    monthly: EventIndex,
    daily: EventIndex,
    hourly: EventIndex
  }
}
```

### 5.2 OverlayData（叠盘对照）

```typescript
{
  scope: string,                    // 'yearly'
  scopeCN: string,                  // '流年'
  fortuneStemBranch: string,        // '丙午'
  fortuneSoulIndex: number,         // 流命宫索引
  fortuneSoulOverlay: {
    natalPalaceName: string,        // ★ '官禄' → 今年事业是主轴
    overlayLabel: string,           // '流年命宫叠本命官禄宫'
    fortuneAuspiciousStars: string[],
    fortuneInauspiciousStars: string[]
  },
  mutagenMap: {
    '化禄': { star, brightness, natalPalace, significance },
    '化权': { ... },
    '化科': { ... },
    '化忌': { ... }
  },
  overlays: CellOverlay[]           // 12 宫逐行：分支/本命宫/流宫/流曜吉/流曜凶/本宫四化
}
```

### 5.3 EventIndex（事件预判）

```typescript
{
  [领域名]: {
    domain: string,           // '事业'
    score: number,            // 加权原始分
    scoreNormalized: number,  // 0-100
    judgment: '大吉' | '吉' | '平' | '凶' | '大凶',
    keyTriggers: [{ type, detail, weight }],  // Top3 触发信号
    summary: string           // 自然语言摘要
  }
}
```

### 5.4 SanfangSizhengEntry

```typescript
{
  palaceIndex: number,
  palaceName: string,         // '命宫'
  earthlyBranch: string,      // '丑'
  sanhePalaces: string[],     // ['财帛', '官禄'] ← 三合宫
  oppositePalace: string,     // '迁移' ← 对宫
  fourScore: number,          // 四正吉凶分（吉星+2/主星+1/煞星-2）
  fourJudgment: '四正吉' | '四正平' | '四正弱' | '四正凶',
  majorStarsSummary: string   // 主星摘要
}
```

### 5.5 StructuralMarker

```typescript
{
  severity: 'danger' | 'warning' | 'good' | 'info',
  type: string,               // '空劫夹' | '火铃夹' | '羊陀夹' | '日月并明' | '日月反背' | '府相朝垣' | '空宫' | '伏吟(XX)'
  detail: string,             // '子丑二宫夹寅宫'
  involvedPalaces: string[]   // 涉及宫位
}
```

---

## 六、LLM 分析 Prompt 结构

### System Prompt（ZWDS_SYSTEM_PROMPT）

```
你是紫微斗数命理分析专家。你精通：
- 星曜性质（紫微/天府/天相等十四主星的庙旺利陷）
- 四化飞星（禄权科忌的引动含义）
- 十二宫职事（命/兄弟/夫妻/子女/财帛/疾厄/迁移/交友/官禄/田宅/福德/父母）
- 三方四正（本宫+对宫+三合宫的联动）
- 叠宫论法（运限命宫叠本命某宫，即该运限重心在此宫之事）
- 格局吉凶（如府相朝垣/日月并明/火贪格/铃昌陀武等）
- 流年流月流日流时逐层递进

【关键输出要求】
1. 用简洁中文输出，不要学术腔，通俗易懂
2. 每个结论必须有盘面事实支撑
3. 不要编造盘面没有的星曜或四化
4. 重点分三段：①总体运势基调 ②十二宫要点 ③关键时间窗口与建议
5. 凶处不要过度恐吓，吉处不要过度吹捧，实事求是
```

### User Prompt 自动构建

```
=== 命主信息 ===
性别：女  生肖：马  八字：庚午 辛巳 庚辰 庚辰

=== 流年盘面（简化） ===
丑[命宫]：主星=巨门(旺) 天府(庙)  辅星=禄存 擎羊
寅[父母]：主星=廉贞(平) 天相(庙)  辅星=擎羊 ...
...

=== 本命四化 ===
天同化禄@田宅 天机化权@迁移 文昌化科@父母 廉贞化忌@父母

=== 流年叠宫对照 ===
运限干支：丙午
运限命宫叠本命官禄宫
四化引动：天同化禄引动本命田宅；廉贞化忌引动本命父母
重点标记：流年命宫叠本命官禄——事业为本年主轴

=== 事件预判索引 ===
事业：吉(71) — 流命叠官禄，事业运势整体向好...
财运：平(52) — ...
感情：吉(68) — ...

=== 命盘结构标记 ===
[danger] 空劫夹：子丑二宫夹寅宫
[good] 府相朝垣：命宫天府与迁移宫天相呼应
```

---

## 七、关键约定与已知限制

| 项 | 说明 |
|----|------|
| 农历闰月 | 当前按平年 12 个月，每月 30 天处理（需真实历法数据实现精确闰月） |
| 时辰索引 | 0-11 对应子丑寅卯辰巳午未申酉戌亥，12=晚子(23:00-00:00) |
| iztro 缓存 | Node 环境 require 会缓存配置，切换流派前必须 `astro.config()` 重置；浏览器每次 calculate() 重新配置 |
| 定紫微算法 | 采用 iztro 修正算法（非少数"提前一日"旧法） |
| 流年法 | 采用太岁宫法 |
| 杂曜 | 红鸾天喜、岁前/将前/博士十二神直接取自 iztro |
| 未实现 | 博士十二神/将前十二神/岁前十二神的独立计算（依赖 iztro 提供） |
| 运行环境 | 浏览器 ES6+，不依赖任何构建工具或服务端 |

---

## 八、扩展指南

### 增加新流派
1. `data-tables.js` 新增四化表
2. `engine.js` 的 `MUTAGEN_TABLE` 选择逻辑增加分支
3. `app.js` 的 `applySchoolConfig` 配置 iztro
4. `index.html` 的 `#schoolInput` 增加选项

### 增加新运限层级
1. `engine.js` 的 `calcHoroscope` 补充算法
2. `app.js` 的 `SCOPE_LABELS` + Tab 按钮 + `renderCell` + `updateHoroscopeInfo` + `exportData`
3. `llm-export.js` 的 scopes 数组增加新层级

### 接入新的 LLM 模型
修改 `callDeepSeek` 函数的 URL 和 body 格式即可。API Key 存储逻辑(`_getSavedKey/_saveKey`)是通用的。

### 无人介入 Agent 调用流程
```js
// 1. 浏览器自动化注入脚本
await page.goto('file:///C:/Users/USER/Desktop/zwds/index.html');
await page.waitForFunction(() => window.zwdsAPI?.getState()?.astrolabe);

// 2. 设置出生信息
await page.evaluate(() => {
  document.querySelector('#dateInput').value = '1990-05-15';
  document.querySelector('#hourInput').value = '4';
  window.zwdsAPI.calculate();
});

// 3. 导航到目标时间
await page.evaluate(() => window.zwdsAPI.navigateNested('month', '8'));

// 4. 获取 LLM 预处理数据
const data = await page.evaluate(() => window.zwdsAPI.exportLLMData());

// 5. 基于 eventIndices 选 Top3 领域，基于 mutagenMap 追踪四化链
// 6. 构建 prompt → 调 LLM → 生成解读
```

---

## 九、已知 Bug 修复记录

| Bug | 严重度 | 修复 |
|-----|--------|------|
| AI Key 从 localStorage 取出后当 DOM 对象用 `.value` 报错 | 🔴 致命 | `key` 作为纯字符串直接传给 `callDeepSeek` |
| 未保存 Key 时复制数据按钮被条件隐藏 | 🟡 中等 | `actionRow` 始终渲染，仅模型选择+分析按钮有条件 |
| AI 面板在分析面板外部，标签切换割裂 | 🟡 UI | 迁移到 `renderAnalysisPanel()` 的 `case 'aigpt'` 分支 |

---

> **维护者注**：本文档生成于 2026-07-29，涵盖从项目创建到 AI 解读集成的完整历程。后续任何 Agent 接手此项目时，建议先读本文 + `report.md`，再对 `app.js` 的 `exportData()` 和 `llm-export.js` 的 `exportLLMData()` 做端到端调用验证数据流正确。
