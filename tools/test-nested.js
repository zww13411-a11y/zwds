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
  // 载入案例 A
  win.document.querySelector('[data-case="A"]').click();
  setTimeout(() => {
    // 切到流年
    win.document.querySelector('[data-scope="yearly"]').click();
    setTimeout(() => {
      const nav1 = win.document.querySelector('#nestedNav');
      console.log('yearly nav items:', nav1.querySelectorAll('.nested-item').length);
      console.log('yearly title:', nav1.querySelector('.nested-title')?.textContent);

      // 点击六月
      const june = [...nav1.querySelectorAll('.nested-item')].find(b => b.dataset.value === '6');
      if (june) {
        june.click();
        setTimeout(() => {
          const nav2 = win.document.querySelector('#nestedNav');
          console.log('after click month 6, scope:', win.zwdsState.scope);
          console.log('monthly nav items:', nav2.querySelectorAll('.nested-item').length);
          console.log('monthly title:', nav2.querySelector('.nested-title')?.textContent);
          console.log('monthly targetDate:', win.zwdsState.targetDate.toISOString());

          // 点击 15 日
          const d15 = [...nav2.querySelectorAll('.nested-item')].find(b => b.dataset.value === '15');
          if (d15) {
            d15.click();
            setTimeout(() => {
              const nav3 = win.document.querySelector('#nestedNav');
              console.log('after click day 15, scope:', win.zwdsState.scope);
              console.log('daily nav items:', nav3.querySelectorAll('.nested-item').length);
              console.log('daily title:', nav3.querySelector('.nested-title')?.textContent);
              console.log('daily targetDate:', win.zwdsState.targetDate.toISOString());

              // 点击辰时
              const chen = [...nav3.querySelectorAll('.nested-item')].find(b => b.dataset.value === '4');
              if (chen) {
                chen.click();
                setTimeout(() => {
                  const nav4 = win.document.querySelector('#nestedNav');
                  console.log('after click hour 4, scope:', win.zwdsState.scope);
                  console.log('hourly title:', nav4.querySelector('.nested-title')?.textContent);
                  console.log('hourly targetDate:', win.zwdsState.targetDate.toISOString());
                  console.log('hourly horoscope lunar:', win.zwdsState.horoscope.lunarDate);
                  process.exit(0);
                }, 200);
              }
            }, 200);
          }
        }, 200);
      }
    }, 200);
  }, 300);
}, 200));
