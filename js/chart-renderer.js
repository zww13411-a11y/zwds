/**
 * 命盘方格渲染
 */
(function (root) {
  'use strict';

  const state = root.zwdsState;
  const $ = root.ZWDSUtils.$;
  const escapeHtml = root.ZWDSUtils.escapeHtml;
  const SCOPE_LABELS = root.ZWDSConfig.SCOPE_LABELS;
  const GRID_ORDER = root.ZWDSConfig.GRID_ORDER;

  function renderChart() {
    const a = state.astrolabe;
    if (!a) return;
    const box = $('#chartBox');
    box.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'zwds-grid';

    // GRID_ORDER 描述 4×4 网格中 12 个宫位格子的顺序，-1 表示中心区域由 .center 占据
    GRID_ORDER.forEach(idx => {
      if (idx === -1) return;
      grid.appendChild(renderCell(idx));
    });

    // 中心信息格：由 CSS .cell.center 的 grid-column/grid-row 定位
    const center = document.createElement('div');
    center.className = 'cell center';
    center.innerHTML = renderCenter(a);
    grid.appendChild(center);

    box.appendChild(grid);
  }

  function renderCell(idx) {
    const a = state.astrolabe;
    const p = a.palaces[idx];
    const scope = state.scope;
    let name = p.name, stem = p.heavenlyStem, branch = p.earthlyBranch;
    let scopeStars = [];
    let isScopeSoul = false;
    let footer = '';
    if (scope !== 'origin' && state.horoscope) {
      const h = state.horoscope[scope];
      name = h.palaceNames[idx];
      scopeStars = (h.stars && h.stars[idx]) ? h.stars[idx] : [];
      isScopeSoul = h.index === idx;
      if (scope === 'age') {
        footer = `小限年龄:${p.ages ? p.ages.join('/') : ''}`;
      } else {
        footer = `${SCOPE_LABELS[scope]}${name}`;
      }
    } else {
      const ageText = p.ages ? `小限:${p.ages[0]}起…` : '';
      footer = `大限:${p.decadal ? p.decadal.range.join('-') : ''} ${ageText}`;
    }
    const classes = ['cell'];
    if (idx === a.palaces.findIndex(x => x.name === '命宫')) classes.push('soul-palace');
    if (p.isBodyPalace) classes.push('body-palace');
    if (isScopeSoul) classes.push('horoscope-focus');

    const cell = document.createElement('div');
    cell.className = classes.join(' ');

    const major = p.majorStars.map(s => renderStar(s, 'major')).join('');
    const minor = p.minorStars.map(s => renderStar(s, 'minor')).join('');
    const adj = p.adjectiveStars.map(s => renderStar(s, 'adj')).join('');
    const chang = p.changsheng12 ? `<span class="star adj">长生:${p.changsheng12}</span>` : '';
    const scopeHtml = scopeStars.map(s => `<span class="scope-star ${s.type === 'tough' ? 'tough' : ''}">${s.name}</span>`).join('');

    cell.innerHTML = `
      <div class="scope-stars">${scopeHtml}</div>
      <div class="cell-header">
        <span class="cell-branch">${stem}${branch}</span>
        <span class="cell-name">${name}${p.isBodyPalace ? '(身)' : ''}</span>
      </div>
      <div class="cell-body">
        <div class="star-row">${major}</div>
        <div class="star-row">${minor}</div>
        <div class="star-row">${adj}</div>
        <div class="star-row">${chang}</div>
      </div>
      <div class="cell-footer">${footer}</div>
    `;
    return cell;
  }

  function renderStar(s, cls) {
    const bright = s.brightness ? `<span class="bright">[${s.brightness}]</span>` : '';
    const mut = s.mutagen ? `<span class="mutagen mutagen-${s.mutagen === '禄' ? 'lu' : s.mutagen === '权' ? 'quan' : s.mutagen === '科' ? 'ke' : 'ji'}">化${s.mutagen}</span>` : '';
    return `<span class="star ${cls}">${s.name}${bright}${mut}</span>`;
  }

  function renderCenter(a) {
    const e = state.engineResult.summary;
    const scope = state.scope;
    let extra = '';
    if (scope !== 'origin' && state.horoscope) {
      const h = state.horoscope[scope];
      const palace = a.palace(h.palaceNames[h.index]); // 运限命宫
      extra = `<div style="margin-top:8px;color:var(--accent2);">${SCOPE_LABELS[scope]}命宫:${palace.earthlyBranch}宫(${palace.name}) 干支:${palace.heavenlyStem}${palace.earthlyBranch}</div>`;
    }

    return `
      <div style="font-size:16px;color:var(--accent);margin-bottom:6px;">${a.chineseDate}</div>
      <div style="font-size:13px;color:var(--text-dim);">公历 ${a.solarDate} · 农历 ${a.lunarDate}</div>
      <div style="margin-top:8px;">五行局: <strong>${a.fiveElementsClass}</strong> · 命主:${a.soul} · 身主:${a.body}</div>
      <div style="margin-top:4px;">命宫:${a.earthlyBranchOfSoulPalace} · 身宫:${a.earthlyBranchOfBodyPalace}</div>
      <div style="margin-top:4px;color:var(--muted);">紫微:${e.ziweiBranch} · 天府:${e.tianfuBranch}</div>
      ${extra}
    `;
  }

  root.ZWDSChartRenderer = { renderChart, renderCell, renderStar, renderCenter };
})(typeof globalThis !== 'undefined' ? globalThis : this);
