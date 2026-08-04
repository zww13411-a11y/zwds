/**
 * 命盘分析面板 + AI 解读
 */
(function (root) {
  'use strict';

  const state = root.zwdsState;
  const $ = root.ZWDSUtils.$;
  const $$ = root.ZWDSUtils.$$;
  const escapeHtml = root.ZWDSUtils.escapeHtml;
  const SCOPE_LABELS = root.ZWDSConfig.SCOPE_LABELS;

  const ZWDS_SYSTEM_PROMPT = `你是紫微斗数命理分析专家。你精通：
- 星曜性质（紫微/天府/天相等十四主星的庙旺利陷）
- 四化飞星（禄权科忌的引动含义）
- 十二宫职事（命/兄弟/夫妻/子女/财帛/疾厄/迁移/交友/官禄/田宅/福德/父母）
- 三方四正（本宫+对宫+三合宫的联动）
- 叠宫论法（运限命宫叠本命某宫，即该运限重心在此宫之事）
- 格局吉凶（如府相朝垣/日月并明/火贪格/铃昌陀武等）
- 流年流月流日流时逐层递进

【关键输出要求】
1. 用简洁中文输出，不要学术腔，通俗易懂
2. 每个结论必须有盘面事实支撑（如"流年命宫叠本命夫妻宫，贪狼化禄入运财帛"）
3. 不要编造盘面没有的星曜或四化
4. 重点分三段：①总体运势基调 ②十二宫要点 ③关键时间窗口与建议
5. 凶处不要过度恐吓，吉处不要过度吹捧，实事求是`;

  function scopeTag(s) {
    return { yearly: '流年', monthly: '流月', daily: '流日', hourly: '流时' }[s] || s;
  }

  function renderAnalysisPanel() {
    const panel = $('#analysisPanel');
    if (!panel) return;
    if (!state.astrolabe) {
      $('#analysisContent').innerHTML = '<div style="padding:12px;color:var(--text-dim);">尚未排盘，请先点击"开始排盘"。</div>';
      return;
    }
    const d = root.zwdsAPI.exportData();
    if (!d) return;
    const scope = d.scope === 'origin' ? 'yearly' : d.scope;
    const isOrigin = d.scope === 'origin';
    const llmData = isOrigin ? null : root.ZWDSLLMExport.exportLLMData({
      nativePalaces: d.nativePalaces,
      horoscope: d.horoscope
        ? { yearly: d.horoscope.yearly, monthly: d.horoscope.monthly, daily: d.horoscope.daily, hourly: d.horoscope.hourly }
        : { yearly: null, monthly: null, daily: null, hourly: null },
      scope: scope, nested: d.nested, targetDate: d.targetDate, birth: d.birth,
    });
    const sanfang = root.ZWDSLLMExport.buildSanfangSizheng(d.nativePalaces);
    const markers = root.ZWDSLLMExport.buildStructuralMarkers(d.nativePalaces);
    const activeTab = document.querySelector('.analysis-tab.active');
    const activeId = activeTab ? activeTab.dataset.atab : 'overlay';
    const content = $('#analysisContent');
    switch (activeId) {
      case 'overlay':
        content.innerHTML = isOrigin
          ? '<div style="padding:12px;color:var(--text-dim);">本命盘视图无叠盘数据。切换到流年/流月/流日/流时视图可看叠盘对照。</div>'
          : renderOverlayPanel(llmData, d);
        break;
      case 'events':
        content.innerHTML = isOrigin
          ? '<div style="padding:12px;color:var(--text-dim);">本命盘视图无事件预判。切换到流年/流月/流日/流时视图可看事件预判。</div>'
          : renderEventsPanel(llmData, d);
        break;
      case 'sanfang': content.innerHTML = renderSanfangPanel(sanfang); break;
      case 'markers': content.innerHTML = renderMarkersPanel(markers); break;
      case 'aigpt': content.innerHTML = renderAIGPTPanel(); break;
    }
  }

  function renderOverlayPanel(llmData, d) {
    const scope = d.scope === 'origin' ? 'yearly' : d.scope;
    const ov = llmData.overlays && llmData.overlays[scope];
    if (!ov || !ov.overlays) return '<div style="padding:12px;color:var(--text-dim);">当前无叠盘数据。请切换到流年/流月/流日/流时视图。</div>';
    let html = '<div><strong style="color:var(--accent);">' + scopeTag(scope) + '干支：' + ov.fortuneStemBranch +
      '　命宫叠本命<strong style="color:var(--accent2);">' + (ov.fortuneSoulOverlay ? ov.fortuneSoulOverlay.natalPalaceName : '—') +
      '</strong></strong></div>';
    if (ov.mutagenMap && Object.keys(ov.mutagenMap).length > 0) {
      html += '<div style="margin-top:6px;font-size:12px;">四化引动：';
      Object.keys(ov.mutagenMap).forEach(function (k) {
        const m = ov.mutagenMap[k];
        html += ' <strong>' + k + '</strong>：' + m.star + ' → 本命' + m.natalPalace + '（叠' + m.overlayFortunePalace + '）';
      });
      html += '</div>';
    }
    if (ov.highlights && ov.highlights.length > 0) {
      html += '<div style="margin-top:6px;font-size:12px;">';
      ov.highlights.forEach(function (h) { html += '<div style="margin-bottom:2px;">' + (h.severity === 'warning' ? '⚠️' : 'ℹ️') + ' <strong>' + h.type + '</strong>：' + h.detail + '</div>'; });
      html += '</div>';
    }
    html += '<table class="overlay-table" style="margin-top:6px;"><thead><tr><th>地支</th><th>本命宫</th><th>' + scopeTag(scope) + '宫</th><th>流曜吉</th><th>流曜凶</th></tr></thead><tbody>';
    ov.overlays.forEach(function (o) {
      html += '<tr class="' + (o.isFortuneSoul ? 'fortune-soul' : '') + '"><td>' + o.branch + '</td><td>' + o.natalPalaceName + '</td><td>' + o.fortunePalaceName + '</td><td class="auspicious">' + (o.fortuneAuspiciousStars.join(' ') || '—') + '</td><td class="inauspicious">' + (o.fortuneInauspiciousStars.join(' ') || '—') + '</td></tr>';
    });
    html += '</tbody></table><div style="margin-top:6px;font-size:12px;color:var(--text-dim);">每宫四化：';
    ov.overlays.forEach(function (o) {
      (o.localMutagens || []).forEach(function (m) { html += ' ' + o.branch + o.natalPalaceName + ':' + m.star + '化' + m.type; });
    });
    html += '</div>';
    return html;
  }

  function renderEventsPanel(llmData, d) {
    const scope = d.scope === 'origin' ? 'yearly' : d.scope;
    const ei = llmData.eventIndices && llmData.eventIndices[scope];
    if (!ei) return '<div style="padding:12px;color:var(--text-dim);">当前无事件预判数据。请切换到运限视图。</div>';
    const sorted = Object.keys(ei).sort(function (a, b) { return ei[b].scoreNormalized - ei[a].scoreNormalized; });
    let html = '<div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">按综合评分排序（四化引动 + 叠宫主调 + 流曜吉凶 + 格局规则）</div><div class="event-grid">';
    sorted.forEach(function (domain) {
      const e = ei[domain];
      const jCls = { '大吉': 'event-card-great', '吉': 'event-card-good', '平': 'event-card-flat', '凶': 'event-card-bad', '大凶': 'event-card-terrible' }[e.judgment] || 'event-card-flat';
      const jStyle = { '大吉': 'background:var(--green);color:#000;', '吉': 'background:rgba(63,185,80,.25);color:var(--green);', '平': 'background:rgba(139,148,158,.2);color:var(--text-dim);', '凶': 'background:rgba(248,81,73,.25);color:var(--red);', '大凶': 'background:var(--red);color:#fff;' }[e.judgment] || '';
      const sc = e.scoreNormalized >= 70 ? 'var(--green)' : e.scoreNormalized >= 50 ? 'var(--green)' : e.scoreNormalized >= 30 ? 'var(--text-dim)' : 'var(--red)';
      html += '<div class="event-card ' + jCls + '"><div class="event-card-header"><span class="event-card-name">' + domain + '</span><span class="event-card-score" style="color:' + sc + '">' + e.scoreNormalized + '</span></div><span class="event-card-judge" style="' + jStyle + '">' + e.judgment + '</span><div class="event-card-triggers">' + (e.summary || '') + '</div></div>';
    });
    html += '</div>';
    return html;
  }

  function renderSanfangPanel(sanfang) {
    if (!sanfang || !sanfang.length) return '<div style="padding:12px;color:var(--text-dim);">无三方四正数据。</div>';
    let html = '<div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">每宫三合+对宫星曜一览。吉星+2/主星+1/煞星-2。</div><table class="sanfang-table"><thead><tr><th>本宫</th><th>地支</th><th>三合(左)</th><th>三合(右)</th><th>对宫</th><th>评分</th><th>四化</th></tr></thead><tbody>';
    sanfang.forEach(function (s) {
      const scoreCls = s.fourScore >= 6 ? 'score-good' : s.fourScore >= 2 ? 'score-flat' : s.fourScore <= -4 ? 'score-bad' : 'score-weak';
      const tpStars = s.triplePalaces.map(function (tp) { const n = tp.majorStars.map(function (x) { return x.name; }).join(' ') || '—'; const e = tp.minorStars.slice(0, 2).join(' '); return tp.name + '[' + n + (e ? ' +' + e : '') + ']'; });
      const opp = s.opposite.majorStars.map(function (x) { return x.name; }).join(' ') || '—';
      const mutstr = s.fourMutatgens.map(function (m) { return m.star + '化' + m.type + '@' + m.palace; }).join(' ') || '—';
      html += '<tr><td><strong>' + s.palaceName + '</strong></td><td>' + s.branch + '</td><td>' + (tpStars[0] || '—') + '</td><td>' + (tpStars[1] || '—') + '</td><td>' + s.opposite.name + '[' + opp + ']</td><td class="' + scoreCls + '">' + s.fourScore + '分 ' + s.fourJudgment + '</td><td>' + mutstr + '</td></tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  function renderMarkersPanel(markers) {
    if (!markers || !markers.length) return '<div style="padding:12px;color:var(--green);">✅ 未检测到特殊结构标记。命盘中规中矩。</div>';
    const icons = { danger: '🔴', warning: '🟡', good: '✅', info: 'ℹ️' };
    const cls = { danger: 'marker-danger', warning: 'marker-warning', good: 'marker-good', info: 'marker-info' };
    const grouped = { danger: [], warning: [], good: [], info: [] };
    markers.forEach(function (m) { (grouped[m.severity] = grouped[m.severity] || []).push(m); });
    let html = '<div class="marker-list">';
    ['danger', 'warning', 'good', 'info'].forEach(function (sev) {
      (grouped[sev] || []).forEach(function (m) {
        html += '<div class="marker-item ' + cls[sev] + '"><span class="marker-icon">' + (icons[sev] || '') + '</span><span class="marker-type">' + m.type + '</span><span class="marker-detail">' + m.detail + '</span></div>';
      });
    });
    html += '</div>';
    return html;
  }

  function setupAnalysisTabs() {
    document.addEventListener('click', function (e) {
      const tab = e.target.closest('.analysis-tab');
      if (!tab) return;
      e.preventDefault();
      document.querySelectorAll('.analysis-tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      renderAnalysisPanel();
    });
  }

  function buildAIUserPrompt(data, scopeStr, nativePalaces) {
    const p = [];
    p.push('请基于以下紫微斗数盘面数据，做一份运限解读。');
    p.push('=== 命主信息 ===');
    p.push('性别：' + data.sex + '  生肖：' + data.zodiac + '  八字：' + data.bazi);
    p.push('');
    p.push('=== ' + scopeStr + '盘面（简化） ===');
    nativePalaces.forEach(function (pc, i) {
      const stars = pc.majorStars.map(function (s) { return s.name + '(' + s.brightness + ')'; }).join(' ');
      const minors = (pc.minorStars || []).slice(0, 8).join(' ');
      p.push(pc.earthlyBranch + '[' + pc.name + ']：主星=' + (stars || '无') + '  辅星=' + (minors || '无'));
    });
    p.push('');
    p.push('=== 本命四化 ===');
    p.push(data.nativeMutagen.join(' '));
    if (data.overlay) {
      p.push('');
      p.push('=== ' + scopeStr + '叠宫对照 ===');
      p.push('运限干支：' + data.overlay.fortuneStemBranch);
      p.push('运限命宫叠本命' + data.overlay.fortuneSoulPalace + '宫');
      if (data.overlay.mutagenSummary) {
        p.push('四化引动：' + data.overlay.mutagenSummary.join('；'));
      }
      if (data.overlay.highlights) {
        p.push('重点标记：' + data.overlay.highlights.map(function (h) { return h.type + '：' + h.detail; }).join('；'));
      }
    }
    if (data.eventSummary) {
      p.push('');
      p.push('=== 事件预判索引 ===');
      data.eventSummary.forEach(function (es) {
        p.push(es.domain + '：' + es.judgment + '(' + es.score + ') — ' + es.trigger);
      });
    }
    if (data.markers && data.markers.length > 0) {
      p.push('');
      p.push('=== 命盘结构标记 ===');
      data.markers.forEach(function (m) { p.push('[' + m.severity + '] ' + m.type + '：' + m.detail); });
    }
    p.push('');
    p.push('请输出运限解读（用 Markdown 格式，但不要用代码块包裹）。');
    return p.join('\n');
  }

  function buildNativeAIPrompt(d) {
    const L = [];
    const b = d.birth || {};
    L.push('## 本命盘命理分析数据');
    L.push('');
    L.push('出生：' + (b.solarDate || '—') + '（农历 ' + (b.lunarDate || '—') + '）');
    L.push('八字：' + (b.chineseDate || '—'));
    L.push('五行局：' + (b.fiveElementsClass || '—') + '　命主：' + (b.soul || '—') + '　身主：' + (b.body || '—'));
    L.push('命宫地支：' + (b.soulPalaceBranch || '—') + '　身宫地支：' + (b.bodyPalaceBranch || '—'));
    L.push('');
    L.push('## 十二宫主星');
    (d.nativePalaces || []).forEach(function (p) {
      const maj = (p.majorStars || []).map(function (s) { return s.name + (s.brightness ? ('[' + s.brightness + ']') : '') + (s.mutagen ? ('化' + s.mutagen) : ''); }).join(' ');
      const min = (p.minorStars || []).map(function (s) { return s.name + (s.mutagen ? ('化' + s.mutagen) : ''); }).join(' ');
      const adj = (p.adjectiveStars || []).map(function (s) { return typeof s === 'string' ? s : s.name; }).join(' ');
      L.push('- ' + p.earthlyBranch + '[' + p.name + ']：主星 ' + (maj || '无') + '｜辅星 ' + (min || '无') + '｜杂曜 ' + (adj || '无'));
    });
    L.push('');
    const sf = root.ZWDSLLMExport.buildSanfangSizheng(d.nativePalaces);
    if (sf && sf.length) {
      L.push('## 三方四正');
      sf.forEach(function (s) {
        const mut = s.fourMutatgens.map(function (m) { return m.star + '化' + m.type; }).join(' ') || '—';
        L.push('- ' + s.palaceName + '：三合[' + s.triplePalaces.map(function (t) { return t.name; }).join('/') + '] 对宫' + s.opposite.name + ' 评分' + s.fourScore + '(' + s.fourJudgment + ') 四化 ' + mut);
      });
      L.push('');
    }
    const mk = root.ZWDSLLMExport.buildStructuralMarkers(d.nativePalaces);
    if (mk && mk.length) {
      L.push('## 结构标记');
      mk.forEach(function (m) { L.push('- [' + m.severity + '] ' + m.type + '：' + m.detail); });
      L.push('');
    }
    L.push('请基于以上本命盘数据，输出一份本命格局解读（用 Markdown，不要代码块包裹）：①总体格局与命主特质 ②十二宫要点（重点：命宫/财帛/官禄/夫妻/疾厄）③格局与注意点。每个结论需有盘面事实支撑，不要编造星曜或四化。');
    return L.join('\n');
  }

  function buildAIContext() {
    const d = root.zwdsAPI.exportData();
    if (!d) return null;
    let userPrompt;
    if (d.scope === 'origin') {
      userPrompt = buildNativeAIPrompt(d);
    } else {
      userPrompt = root.ZWDSLLMExport.summarizeLLM({
        nativePalaces: d.nativePalaces,
        horoscope: {
          yearly: d.horoscope ? d.horoscope.yearly : null,
          monthly: d.horoscope ? d.horoscope.monthly : null,
          daily: d.horoscope ? d.horoscope.daily : null,
          hourly: d.horoscope ? d.horoscope.hourly : null,
        },
        scope: d.scope, nested: d.nested, targetDate: d.targetDate, birth: d.birth,
      });
    }
    return { systemPrompt: ZWDS_SYSTEM_PROMPT, userPrompt: userPrompt };
  }

  async function callLLM(opts) {
    const baseURL = opts.baseURL;
    const key = opts.key;
    const model = opts.model || 'deepseek-chat';
    const messages = opts.messages;
    const signal = opts.signal;
    const onChunk = opts.onChunk;
    const onReasoning = opts.onReasoning;

    const isSameOriginProxy = baseURL === '/api/llm';
    const bodyPayload = { model: model, messages: messages, stream: true, temperature: 0.7, max_tokens: 4096 };
    if (isSameOriginProxy) {
      const realEl = document.getElementById('aigptBase');
      bodyPayload.base_url = realEl && realEl.dataset && realEl.dataset.real ? realEl.dataset.real : 'https://api.deepseek.com/chat/completions';
    }
    const resp = await fetch(baseURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(bodyPayload),
      signal: signal,
    });
    if (!resp.ok) {
      let txt = '';
      try { txt = await resp.text(); } catch (e) {}
      if (resp.status === 401) throw new Error('API Key 无效或余额不足（401）。请检查 Key，或到 platform.deepseek.com 确认额度。');
      if (resp.status === 0 || resp.type === 'opaque') throw new Error('请求被浏览器拦截（CORS 跨域）。请通过本地代理运行：node tools/serve.js，然后用 http://localhost:8787 打开本页；或在「API 地址」填写你自己的跨域代理。');
      throw new Error('API 调用失败(' + resp.status + ')：' + (txt.length > 200 ? txt.slice(0, 200) + '...' : txt));
    }
    if (!resp.body || !resp.body.getReader) {
      const json = await resp.json();
      if (onChunk) onChunk((json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '');
      return;
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        let line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line || !line.startsWith('data:')) continue;
        let data = line.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          const delta = json.choices && json.choices[0] && json.choices[0].delta;
          if (!delta) continue;
          if (delta.reasoning_content && onReasoning) onReasoning(delta.reasoning_content);
          if (delta.content && onChunk) onChunk(delta.content);
        } catch (e) { /* 忽略不完整分片 */ }
      }
    }
  }

  function getKey() {
    const el = $('#aigptKey');
    const v = el ? el.value.trim() : '';
    return v ? v : _getSavedKey();
  }
  function getModel() { const el = $('#aigptModel'); return el ? el.value : 'deepseek-chat'; }
  function getBaseURL() {
    const el = $('#aigptBase');
    const v = el ? el.value.trim() : '';
    // 用户手动输入非默认直连地址时优先使用
    if (v && v !== '/api/llm') return v;
    const saved = _getSavedBase();
    if (saved) return saved;
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' || location.port === '8787') return '/api/llm';
    return 'https://api.deepseek.com/chat/completions';
  }
  async function copyText(txt) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); return true; } } catch (e) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  async function doTestConnection() {
    const key = getKey();
    if (!key) { alert('请先填入 API Key'); return; }
    const btn = $('#aigptTest');
    if (btn) { btn.disabled = true; btn.textContent = '测试中…'; }
    _saveBase(getBaseURL());
    try {
      await callLLM({
        baseURL: getBaseURL(), key: key, model: getModel(),
        messages: [{ role: 'system', content: '你是测试助手。' }, { role: 'user', content: '只回复 ok' }],
        signal: new AbortController().signal,
        onChunk: function () {},
      });
      if (btn) btn.textContent = '✓ 已连通';
    } catch (e) {
      alert('连接失败：' + e.message);
      if (btn) btn.textContent = '测试连接';
    } finally {
      if (btn) setTimeout(function () { btn.textContent = '测试连接'; btn.disabled = false; }, 1500);
    }
  }

  function renderMarkdownToHtml(md) {
    const esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    const lines = (md || '').replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let inUl = false, inOl = false;
    const closeLists = function () {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
    };
    let m;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { closeLists(); const lv = m[1].length; html += '<h' + lv + '>' + esc(m[2]) + '</h' + lv + '>'; continue; }
      if ((m = line.match(/^>\s?(.*)$/))) { closeLists(); html += '<blockquote>' + esc(m[1]) + '</blockquote>'; continue; }
      if ((m = line.match(/^\d+\.\s+(.*)$/))) {
        if (!inOl) { closeLists(); html += '<ol>'; inOl = true; }
        if (inUl) { html += '</ul>'; inUl = false; }
        html += '<li>' + esc(m[1]) + '</li>'; continue;
      }
      if ((m = line.match(/^[-*]\s+(.*)$/))) {
        if (!inUl) { closeLists(); html += '<ul>'; inUl = true; }
        if (inOl) { html += '</ol>'; inOl = false; }
        html += '<li>' + esc(m[1]) + '</li>'; continue;
      }
      if (line.trim() === '') { closeLists(); continue; }
      closeLists();
      let t = esc(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
      html += '<p>' + t + '</p>';
    }
    closeLists();
    return html;
  }

  // 组件状态：用 DOM 元素上的 dataset 存分析结果
  let _aiOutputCache = '';
  let _currentController = null;

  function _getSavedKey() {
    try { return localStorage.getItem('zwds_deepseek_key') || ''; } catch (e) { return ''; }
  }
  function _saveKey(k) {
    try { localStorage.setItem('zwds_deepseek_key', k); } catch (e) {}
  }
  function _getSavedBase() {
    try {
      const v = localStorage.getItem('zwds_base_url') || '';
      // 兼容旧版本保存的错误地址
      if (v === 'https://api.deepseek.com' || v === 'https://api.deepseek.com/') {
        localStorage.removeItem('zwds_base_url');
        return '';
      }
      return v;
    } catch (e) { return ''; }
  }
  function _saveBase(v) {
    try { localStorage.setItem('zwds_base_url', v); } catch (e) {}
  }

  function renderAIGPTPanel() {
    const ctx = buildAIContext();
    let promptPreview = ctx ? ctx.userPrompt : '（请先排盘）';
    if (promptPreview.length > 600) promptPreview = promptPreview.slice(0, 600) + '...';

    const isFile = location.protocol === 'file:';
    const savedKey = _getSavedKey();
    const savedBase = _getSavedBase();
    const defBase = savedBase || '/api/llm';

    let keyHtml = '';
    if (savedKey) {
      keyHtml = '<div class="aigpt-key-saved">🔑 API Key 已保存（' + savedKey.slice(0, 6) + '...）<button id="aigptChangeKey" class="btn-text">更换</button><button id="aigptDeleteKey" class="btn-text" style="margin-left:8px;color:var(--red);">删除</button></div>';
    } else {
      keyHtml = '<div class="aigpt-key-setup"><div class="aigpt-key-help">🔑 需要 <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener" style="color:var(--accent);">DeepSeek API Key</a>（注册送免费额度），填入后仅保存在本机浏览器，不会上传任何服务器。</div>' +
        '<div class="aigpt-config-row" style="margin-top:6px;"><label>API Key：</label><input type="password" id="aigptKey" placeholder="sk-..." style="flex:1;" /><select id="aigptModel"><option value="deepseek-chat">deepseek-chat</option><option value="deepseek-reasoner">deepseek-reasoner</option></select></div></div>';
    }

    const actionRow = '<div class="aigpt-config-row" style="margin-top:6px;">' +
      (savedKey ? '<select id="aigptModel"><option value="deepseek-chat">deepseek-chat</option><option value="deepseek-reasoner">deepseek-reasoner</option></select>' : '') +
      '<button id="aigptTest" class="btn-secondary">测试连接</button>' +
      '<button id="aigptAnalyze" class="btn-primary">开始分析</button>' +
      '<button id="aigptStop" class="btn-secondary" style="display:none;">停止</button>' +
      '<button id="aigptCopy" class="btn-secondary">复制数据</button>' +
      '</div>';

    const baseRow = '<div class="aigpt-config-row" style="margin-top:6px;"><label>API 地址：</label><input id="aigptBase" value="/api/llm" data-real="' + defBase + '" style="flex:1;" placeholder="/api/llm 或 https://api.deepseek.com/chat/completions" /></div>';

    const fileWarn = isFile ? '<div style="margin-top:6px;color:var(--red);font-size:12px;">⚠ 当前以 file:// 打开，浏览器会拦截对 DeepSeek 的直接请求。请运行 <code>node tools/serve.js</code> 后用 <code>http://localhost:8787</code> 打开本页，即可正常调用 AI。</div>' : '';

    return '<div class="aigpt-config">' + keyHtml + baseRow + actionRow + fileWarn +
      '<div class="aigpt-prompt-preview"><div style="color:var(--accent);margin-bottom:4px;">📤 将发给 AI 的盘面数据（左侧分析汇总）：</div>' + promptPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' +
      '</div>' +
      '<details class="aigpt-thinking" id="aigptThinkingBox" style="display:none;"><summary>🧠 模型思考过程（R1）</summary><div id="aigptThinking" class="aigpt-output" style="font-size:12px;color:var(--text-dim);"></div></details>' +
      '<div id="aigptOutput" class="aigpt-output">' + (_aiOutputCache || '<div class="typing">填入 API Key（或用本地代理）后点击「开始分析」，或点「复制数据」把盘面数据粘贴到 ChatGPT / Claude 等任意 AI。</div>') + '</div>';
  }

  // 事件委托：按钮 ID 是稳定的，不受渲染方式影响
  document.addEventListener('click', function (e) {
    const btn = e.target;
    if (btn.id === 'aigptAnalyze') {
      e.preventDefault();
      doAIAnalyze();
    } else if (btn.id === 'aigptTest') {
      e.preventDefault();
      doTestConnection();
    } else if (btn.id === 'aigptStop') {
      e.preventDefault();
      if (_currentController) _currentController.abort();
    } else if (btn.id === 'aigptCopy') {
      e.preventDefault();
      doCopyAIData();
    } else if (btn.id === 'aigptChangeKey') {
      e.preventDefault();
      try { localStorage.removeItem('zwds_deepseek_key'); } catch (ex) {}
      _aiOutputCache = '';
      renderAnalysisPanel();
    } else if (btn.id === 'aigptDeleteKey') {
      e.preventDefault();
      if (confirm('确定删除已保存的 API Key 吗？')) {
        try { localStorage.removeItem('zwds_deepseek_key'); localStorage.removeItem('zwds_base_url'); } catch (ex) {}
        _aiOutputCache = '';
        renderAnalysisPanel();
      }
    }
  });

  async function doAIAnalyze() {
    const keyEl = $('#aigptKey');
    let key = keyEl ? keyEl.value.trim() : '';
    if (!key) key = _getSavedKey();
    if (!key) { alert('请先填入 DeepSeek API Key。到 platform.deepseek.com/api_keys 免费获取。'); return; }
    if (keyEl && keyEl.value.trim()) _saveKey(keyEl.value.trim());
    _saveBase(getBaseURL());

    const btn = $('#aigptAnalyze'); const stop = $('#aigptStop'); const test = $('#aigptTest');
    if (btn) { btn.disabled = true; btn.textContent = '分析中…'; }
    if (stop) stop.style.display = '';
    if (test) test.disabled = true;

    const out = $('#aigptOutput');
    out.style.display = 'block';
    out.innerHTML = '<div class="typing">正在调用大模型进行命理分析…</div>';

    const thinkBox = $('#aigptThinkingBox'); const think = $('#aigptThinking');
    if (thinkBox) thinkBox.style.display = 'none';
    if (think) think.innerHTML = '';

    const ctx = buildAIContext();
    if (!ctx) { out.innerHTML = '<div class="error">无法构建分析上下文，请先排盘。</div>'; return; }

    const controller = new AbortController();
    _currentController = controller;
    let acc = ''; let reasoning = '';
    try {
      await callLLM({
        baseURL: getBaseURL(), key: key, model: getModel(),
        messages: [{ role: 'system', content: ctx.systemPrompt }, { role: 'user', content: ctx.userPrompt }],
        signal: controller.signal,
        onReasoning: function (t) {
          reasoning += t;
          if (thinkBox) thinkBox.style.display = '';
          if (think) think.textContent = reasoning;
        },
        onChunk: function (t) {
          acc += t;
          out.innerHTML = renderMarkdownToHtml(acc);
          out.scrollTop = out.scrollHeight;
        },
      });
      _aiOutputCache = renderMarkdownToHtml(acc);
      out.innerHTML = _aiOutputCache;
    } catch (err) {
      out.innerHTML = '<div class="error">' + escapeHtml(err.message || String(err)) + '</div>';
    } finally {
      _currentController = null;
      if (btn) { btn.disabled = false; btn.textContent = '开始分析'; }
      if (stop) stop.style.display = 'none';
      if (test) test.disabled = false;
    }
  }

  async function doCopyAIData() {
    try {
      const ctx = buildAIContext();
      if (!ctx) { alert('请先排盘'); return; }
      const full = '【系统设定】\n' + ctx.systemPrompt + '\n\n【盘面数据（左侧分析汇总）】\n' + ctx.userPrompt;
      const ok = await copyText(full);
      const copyBtn = $('#aigptCopy');
      if (ok) { copyBtn.textContent = '已复制'; } else { copyBtn.textContent = '复制失败'; }
      setTimeout(function () { copyBtn.textContent = '复制数据'; }, 2000);
    } catch (e) { alert('复制失败：' + e.message); }
  }

  // 初始化分析标签事件
  setupAnalysisTabs();

  root.ZWDSAnalysis = {
    renderAnalysisPanel,
    renderOverlayPanel, renderEventsPanel, renderSanfangPanel, renderMarkersPanel,
    buildAIContext, callLLM, renderMarkdownToHtml, doTestConnection
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
