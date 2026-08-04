const fs = require('fs');
const path = require('path');

const analysis = fs.readFileSync(path.join(__dirname, '..', 'js', 'analysis.js'), 'utf8');
const checks = [
  ['callLLM 流式函数', /async function callLLM\(/],
  ['doTestConnection 测试连接', /async function doTestConnection\(/],
  ['buildNativeAIPrompt 本命 prompt', /function buildNativeAIPrompt\(/],
  ['summarizeLLM 运限 prompt', /ZWDSLLMExport\.summarizeLLM\(/],
  ['getBaseURL 自定义地址', /function getBaseURL\(/],
  ['停止按钮', /aigptStop/],
  ['R1 思考过程', /reasoning_content/],
  ['API 地址输入框', /aigptBase/],
  ['复制数据兼容 file', /copyText\(/],
];
let ok = 0;
checks.forEach(([name, re]) => {
  const pass = re.test(analysis);
  console.log((pass ? 'PASS' : 'FAIL') + ' ' + name);
  if (pass) ok++;
});
console.log('--- ' + ok + '/' + checks.length + ' passed ---');
