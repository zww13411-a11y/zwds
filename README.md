# 紫微斗数排盘工具 (ZWDS Chart Tool)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 一个纯静态网页版紫微斗数排盘分析工具，以「手写安星引擎 + iztro 权威对拍」双引擎为核心，支持本命盘、大限、小限、流年/流月/流日/流时多级运限，并内置 LLM AI 解读通道。

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🔮 **双引擎排盘** | 手写安星引擎 + iztro 权威对拍，17 步推演过程可视化 |
| 📅 **多级运限** | 本命盘 → 大限 → 小限 → 流年 → 流月 → 流日 → 流时 |
| 🤖 **AI 解读** | 接入 DeepSeek 等大模型，支持流式输出命理分析 |
| 📊 **命盘分析** | 叠盘对照、事件预判、三方四正、结构标记 |
| 🌐 **纯静态部署** | 零后端依赖，双击即用，可部署到任何静态托管服务 |
| 🔌 **Agent API** | 暴露 `window.zwdsAPI` 接口，支持浏览器自动化调用 |

## 🚀 快速开始

### 方式一：本地运行
```bash
git clone https://github.com/zww13411-a11y/zwds.git
cd zwds
# 直接打开 index.html，或使用本地服务器
node tools/serve.js
# 访问 http://localhost:8787
```

### 方式二：在线使用
访问 GitHub Pages 部署地址（如已启用）：
`https://zww13411-a11y.github.io/zwds`

## 📖 使用说明

1. **输入出生信息**：选择公历/农历，输入日期、时辰、性别、流派
2. **开始排盘**：点击「开始排盘」按钮
3. **查看命盘**：十二宫格展示本命盘，可切换大限/流年等运限
4. **时间轴**：拖动滑块查看不同时间点的运限，或点击「跟随实时」
5. **AI 解读**：在分析面板中输入 API Key，获取智能命理解读

## 🏗️ 项目架构

```
zwds/
├── index.html           # 页面入口
├── css/
│   └── style.css        # 样式
├── js/
│   ├── app.js           # 应用入口
│   ├── engine.js        # 手写安星引擎
│   ├── chart-renderer.js # 命盘渲染
│   ├── analysis.js      # 分析面板
│   ├── api.js           # 对外 API
│   ├── horoscope.js     # 运限计算
│   ├── llm-export.js    # LLM 数据预处理
│   ├── data-tables.js   # 常量数据表
│   ├── config.js        # 配置
│   ├── state.js         # 状态管理
│   └── utils.js         # 工具函数
├── lib/
│   └── iztro.min.js     # iztro 排盘库
├── tools/
│   └── serve.js         # 本地开发服务器
└── README.md
```

### 数据流

```
用户输入 → app.js calculate()
    ├──→ iztro 排本命盘
    ├──→ ZWDSEngine 手写排盘
    ├──→ compareAll() 对拍校验
    ├──→ chart-renderer.js 渲染
    └──→ horoscope.js 运限计算
              ↓
    analysis.js → LLM 解读
```

## 🔧 开发

### 本地开发服务器
```bash
node tools/serve.js
```
提供 `http://localhost:8787`，并代理 `/api/llm` 解决 CORS 问题。

### 配置 AI 解读
1. 获取 DeepSeek API Key
2. 在页面「AI 解读」标签页输入 Key
3. Key 仅保存在浏览器 localStorage，不会上传服务器

## 📋 技术栈

- **前端**：纯 HTML/CSS/JavaScript（无框架依赖）
- **排盘引擎**：iztro + 手写 ZWDSEngine
- **AI 接口**：DeepSeek API（SSE 流式）
- **部署**：任意静态托管（GitHub Pages / Vercel / Cloudflare Pages）

## 🗺️ 路线图

- [ ] 引入真实农历库（处理闰月、大小月、节气）
- [ ] 多模型接入（OpenAI / Claude / 通义千问等）
- [ ] 新增三合派、飞星派等流派
- [ ] 命盘导出图片（PNG/PDF）
- [ ] 移动端响应式适配
- [ ] 单元测试覆盖

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 📄 许可证

[MIT License](./LICENSE) © 2026

## 🙏 致谢

- [iztro](https://github.com/SylarLong/iztro) - 紫微斗数排盘核心库
- [DeepSeek](https://deepseek.com) - AI 解读服务
