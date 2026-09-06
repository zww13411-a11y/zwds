const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'file:///tmp.html' });
const win = dom.window;

['lib/iztro.min.js', 'js/data-tables.js', 'js/engine.js', 'js/app.js'].forEach(f => {
  win.eval(fs.readFileSync(path.join(root, f), 'utf8'));
});

win.document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  console.log('API exists:', !!win.zwdsAPI);
  console.log('State exists:', !!win.zwdsState);

  // 载入案例 A
  win.zwdsAPI.calculate();
  setTimeout(() => {
    const summary = win.zwdsAPI.summarize();
    console.log('summarize:\n' + summary);

    const data = win.zwdsAPI.exportData();
    console.log('exportData keys:', Object.keys(data));
    console.log('nativePalaces count:', data.nativePalaces.length);
    console.log('engineNative logs count:', data.engineNative.logs.length);

    // 切换到流年并导航到六月十五辰时
    win.zwdsAPI.setScope('yearly');
    setTimeout(() => {
      win.zwdsAPI.navigateNested('month', '6');
      setTimeout(() => {
        win.zwdsAPI.navigateNested('day', '15');
        setTimeout(() => {
          win.zwdsAPI.navigateNested('hour', '4');
          setTimeout(() => {
            const d2 = win.zwdsAPI.exportData();
            console.log('after nested nav scope:', d2.scope);
            console.log('after nested nav targetDate:', d2.targetDate);
            console.log('after nested nav nested:', JSON.stringify(d2.nested));
            console.log('hourly palace:', d2.nativePalaces[d2.horoscope.hourly.index].name,
              d2.nativePalaces[d2.horoscope.hourly.index].earthlyBranch);
            process.exit(0);
          }, 200);
        }, 200);
      }, 200);
    }, 200);
  }, 300);
}, 200));
