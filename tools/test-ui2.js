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
    console.log('state exists:', !!win.zwdsState);
    win.document.querySelector('[data-case="A"]').click();
    setTimeout(() => {
      const s = win.zwdsState;
      console.log('astrolabe exists:', !!s.astrolabe);
      console.log('horoscope exists:', !!s.horoscope);
      console.log('horoscopeResult exists:', !!s.horoscopeResult);
      console.log('horoscopeCompare:', JSON.stringify(s.horoscopeCompare));
      const stepTitles = [...win.document.querySelectorAll('.step .title')].map(el => el.textContent);
      console.log('steps count:', stepTitles.length);
      console.log('horoscope steps:', stepTitles.filter(t => t.includes('小限') || t.includes('流年') || t.includes('流月') || t.includes('流日') || t.includes('流时')));

      // 切换小限
      win.document.querySelector('[data-scope="age"]').click();
      setTimeout(() => {
        console.log('age info:', win.document.querySelector('#horoscopeInfo').textContent.replace(/\s+/g, ' ').trim());
        const cells = [...win.document.querySelectorAll('.cell')];
        console.log('cells count:', cells.length);
        cells.slice(0, 3).forEach(c => console.log(c.textContent.replace(/\s+/g, ' ').trim().slice(0, 120)));
        process.exit(0);
      }, 200);
    }, 500);
  }, 300);
});
