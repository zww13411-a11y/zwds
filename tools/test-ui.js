const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + path.resolve(__dirname, '../index.html')
});
const win = dom.window;

// 加载外部脚本
const dataTables = fs.readFileSync(path.resolve(__dirname, '../js/data-tables.js'), 'utf8');
const engine = fs.readFileSync(path.resolve(__dirname, '../js/engine.js'), 'utf8');
const app = fs.readFileSync(path.resolve(__dirname, '../js/app.js'), 'utf8');
const iztro = fs.readFileSync(path.resolve(__dirname, '../lib/iztro.min.js'), 'utf8');

win.eval(iztro);
win.eval(dataTables);
win.eval(engine);
win.eval(app);

win.document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try {
      // 模拟点击案例A
      const btn = win.document.querySelector('[data-case="A"]');
      btn.click();
      setTimeout(() => {
        console.log('chartBox children:', win.document.getElementById('chartBox').children.length);
        console.log('steps:', win.document.querySelectorAll('.step').length);
        const badges = [...win.document.querySelectorAll('.badge')].map(b => b.textContent);
        console.log('badges:', badges.join(' | '));
        const cells = win.document.querySelectorAll('.cell');
        console.log('cells:', cells.length);
        console.log('center text:', win.document.querySelector('.cell.center')?.textContent.slice(0, 120));
        // 切流年
        win.document.querySelector('[data-scope="yearly"]').click();
        setTimeout(() => {
          console.log('yearly info:', win.document.getElementById('horoscopeInfo').textContent.slice(0, 200));
          process.exit(0);
        }, 200);
      }, 300);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  }, 200);
});
