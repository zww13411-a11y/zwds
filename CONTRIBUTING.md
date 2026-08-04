# 贡献指南

感谢你对紫微斗数排盘工具项目的关注！

## 如何贡献

### 报告问题
- 使用 GitHub Issues 提交 bug 或功能建议
- 描述问题时请提供：浏览器版本、复现步骤、预期 vs 实际结果

### 提交代码
1. Fork 本仓库
2. 创建你的功能分支：`git checkout -b feature/xxx`
3. 提交更改：`git commit -m 'feat: add xxx'`
4. 推送到分支：`git push origin feature/xxx`
5. 提交 Pull Request

### 代码规范
- 使用纯原生 JavaScript（ES6+），不引入框架
- 保持代码与现有风格一致
- 关键算法变更需补充对拍测试

## 开发环境

```bash
# 克隆仓库
git clone https://github.com/zww13411-a11y/zwds.git
cd zwds

# 启动本地服务器
node tools/serve.js
```

## 提交信息规范

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构 |
| `test` | 测试相关 |
| `chore` | 构建/工具相关 |

## 联系我们

如有问题，欢迎通过 GitHub Issues 交流。
