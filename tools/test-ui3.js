const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'file:///' + root.replace(/\\/g, '/') + '/index.html' });
const win = dom.window;

['lib/iztro.min.js', 'js/data-tables.js', 'js/engine.js', 'js/app.js'].forEach(f => {
  win.eval(fs.readFileSync(path.join(root, f), 'utf8'));
});

win.document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    win.document.querySelector('[data-case="A"]').click();
    setTimeout(() => {
      ['yearly', 'monthly', 'daily', 'hourly'].forEach((scope, i) => {
        setTimeout(() => {
          win.document.querySelector(`[data-scope="${scope}"]`).click();
          setTimeout(() => {
            const info = win.document.querySelector('#horoscopeInfo').textContent.replace(/\s+/g, ' ').trim();
            console.log(scope, ':', info.slice(0, 200));
            const soulCell = win.document.querySelector('.horoscope-focus');
            console.log('  focus:', soulCell ? soulCell.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) : 'none');
            if (scope === 'hourly') process.exit(0);
          }, 150);
        }, i * 300);
      });
    }, 500);
  }, 300);
});
