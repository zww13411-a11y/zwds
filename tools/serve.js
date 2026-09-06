/**
 * zwds 本地代理 + 静态服务器
 *
 * 作用：
 *   1. 托管 zwds 静态文件（双击打开会有 CORS/跨域问题，用本服务以 http://localhost 打开即可规避）
 *   2. 提供同源接口 POST /api/llm，把请求（含 Authorization 里的 API Key）转发到 DeepSeek，
 *      并以 SSE 流式透传回来，解决浏览器直连 DeepSeek 被 CORS 拦截的问题。
 *
 * 用法：
 *   node tools/serve.js
 *   然后浏览器打开 http://localhost:8787
 *
 * 说明：API Key 只保存在你的浏览器 localStorage，本代理仅做透明转发，不存储 Key。
 */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || '127.0.0.1';
const DEFAULT_LLM_URL = 'https://api.deepseek.com/chat/completions';
const MAX_BODY_BYTES = 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 30_000;
const ROOT = path.join(__dirname, '..'); // zwds 根目录

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { Allow: 'GET, POST, OPTIONS' });
    return res.end();
  }

  // LLM 代理
  if (req.method === 'POST' && url.pathname === '/api/llm') {
    let body = '';
    let bodyBytes = 0;
    let bodyTooLarge = false;
    req.on('data', (chunk) => {
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_BODY_BYTES) {
        bodyTooLarge = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'request body too large' }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (bodyTooLarge) return;

      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'invalid JSON body' }));
      }

      // 本地代理只允许固定的 DeepSeek 端点，避免被当作开放代理或 SSRF 通道。
      delete parsed.base_url;
      body = JSON.stringify(parsed);

      const target = new URL(DEFAULT_LLM_URL);
      const auth = req.headers['authorization'] || '';
      const upstream = https.request(
        target,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: auth,
            Accept: 'text/event-stream',
          },
        },
        (up) => {
          res.writeHead(up.statusCode, {
            'Content-Type': up.headers['content-type'] || 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });
          up.pipe(res);
        }
      );
      upstream.on('error', (e) => {
        if (res.headersSent) return res.end();
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'proxy error: ' + e.message }));
      });
      upstream.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
        upstream.destroy(new Error('upstream timeout'));
      });
      upstream.write(body);
      upstream.end();
    });
    return;
  }

  // 静态文件
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const filePath = path.resolve(ROOT, '.' + p);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 not found: ' + p);
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log('✅ zwds 已启动： http://' + HOST + ':' + PORT);
  console.log('   AI 解读走同源代理 /api/llm → DeepSeek（零跨域）');
  console.log('   停止：Ctrl+C');
});
