(function(){
  "use strict";

  const RAW = SPO_DATA;
  const YEARS = RAW.years;               // ["2019-2020", ... "2025-2026"]
  const YEARS_SHORT = YEARS.map(y => "'" + y.slice(2,4) + '/' + y.slice(7,9));
  const ROWS = RAW.rows;
  const N = YEARS.length;

  const INSTITUTIONS = [...new Set(ROWS.map(r=>r.institution))];
  const FORMS = [...new Set(ROWS.map(r=>r.form))];
  const PROGRAMS = [...new Set(ROWS.map(r=>r.program))];

  const PROGRAM_LABELS = {
    'ППССЗ: на базе основного общего образования': 'ППССЗ, база 9 кл.',
    'ППССЗ: на базе среднего общего образования': 'ППССЗ, база 11 кл.',
    'ППКРС: на базе основного общего образования': 'ППКРС, база 9 кл.',
    'ППКРС: на базе среднего общего образования': 'ППКРС, база 11 кл.'
  };
  const INST_LABELS = {
    'Государственные учреждения': 'Государственные',
    'Негосударственные учреждения': 'Негосударственные'
  };

  const fmt = n => Math.round(n).toLocaleString('ru-RU');
  const fmt1 = n => n.toLocaleString('ru-RU', {minimumFractionDigits:1, maximumFractionDigits:1});
  const pct = n => (n>=0?'+':'') + fmt1(n) + '%';
  const zeros = () => new Array(N).fill(0);

  // ---------- Filter state ----------
  const state = {
    institution: new Set(INSTITUTIONS),
    form: new Set(FORMS),
    program: new Set(PROGRAMS)
  };

  // ---------- Aggregation ----------
  function aggregateAll(rows){
    const agg = {
      total: zeros(), base: zeros(), advanced: zeros(),
      budget: zeros(), budget_federal: zeros(), budget_subject: zeros(), budget_local: zeros(),
      contract: zeros(), target: zeros()
    };
    rows.forEach(r=>{
      for(let i=0;i<N;i++){
        agg.total[i]   += r.total[i];
        agg.base[i]    += r.base_level[i];
        agg.advanced[i]+= r.advanced_level[i];
        agg.budget[i]  += r.budget_total[i];
        agg.budget_federal[i] += r.budget_federal[i];
        agg.budget_subject[i] += r.budget_subject[i];
        agg.budget_local[i]   += r.budget_local[i];
        agg.contract[i]+= r.contract_total[i];
        agg.target[i]  += r.target[i];
      }
    });
    return agg;
  }

  function filteredRows(){
    return ROWS.filter(r =>
      state.institution.has(r.institution) &&
      state.form.has(r.form) &&
      state.program.has(r.program)
    );
  }

  const AGG_ALL = aggregateAll(ROWS); // fixed, for header cards

  // ---------- Header meta ----------
  // (блок с типами учреждений/годами/программами убран из шапки по запросу)

  // ---------- Stat cards (fixed, unfiltered) ----------
  function deltaHtml(first, last){
    const d = first === 0 ? 0 : (last-first)/first*100;
    const cls = d >= 0 ? 'up' : 'down';
    const arrow = d >= 0 ? '&#9650;' : '&#9660;';
    return `<span class="delta ${cls}">${arrow} ${pct(d)} с ${YEARS[0]}</span>`;
  }
  function statCard(tag, color, value, sub, first, last){
    return `<div class="stat-card">
      <span class="tag"><span class="dot" style="background:${color}"></span>${tag}</span>
      <div class="value num">${fmt(value)}</div>
      <div class="sub">${sub}</div>
      ${deltaHtml(first,last)}
      <div class="period">${YEARS[0]} → ${YEARS[N-1]}</div>
    </div>`;
  }
  document.getElementById('stat-cards').innerHTML =
    statCard('Итого студентов', 'var(--total)', AGG_ALL.total[N-1], 'на всех курсах, все учреждения', AGG_ALL.total[0], AGG_ALL.total[N-1]) +
    statCard('Заключили договор о целевом обучении', 'var(--target)', AGG_ALL.target[N-1], 'студентов', AGG_ALL.target[0], AGG_ALL.target[N-1]) +
    statCard('За счет бюджетных ассигнований', 'var(--budget)', AGG_ALL.budget[N-1], fmt1(AGG_ALL.budget[N-1]/AGG_ALL.total[N-1]*100)+'% от контингента', AGG_ALL.budget[0], AGG_ALL.budget[N-1]) +
    statCard('По договорам об оказании платных образова-тельных услуг', 'var(--contract)', AGG_ALL.contract[N-1], fmt1(AGG_ALL.contract[N-1]/AGG_ALL.total[N-1]*100)+'% от контингента', AGG_ALL.contract[0], AGG_ALL.contract[N-1]);

  // ---------- Guard: Chart.js must be loaded before building charts ----------
  if (typeof Chart === 'undefined') {
    document.getElementById('main-content').innerHTML =
      '<div class="card" style="border-color:#B2402A;"><h2 style="color:#B2402A;">Графики не загрузились</h2>' +
      '<p style="margin-top:10px;color:var(--ink-soft);">Не удалось загрузить библиотеку Chart.js с CDN (нужен доступ в интернет). ' +
      'Проверьте подключение и обновите страницу — карточки выше уже отображают актуальные данные.</p></div>';
    return;
  }

  // ---------- Filters UI ----------
  function buildFilterGroup(groupKey, values, labelMap){
    const container = document.querySelector(`.filter-group[data-group="${groupKey}"] .opts`);
    container.innerHTML = values.map(v => `
      <label class="filter-opt">
        <input type="checkbox" data-group="${groupKey}" value="${v.replace(/"/g,'&quot;')}" checked>
        <span>${(labelMap && labelMap[v]) || v}</span>
      </label>
    `).join('');
  }
  buildFilterGroup('institution', INSTITUTIONS, INST_LABELS);
  buildFilterGroup('form', FORMS, null);
  buildFilterGroup('program', PROGRAMS, PROGRAM_LABELS);

  document.getElementById('filters').addEventListener('change', e=>{
    const cb = e.target;
    if(cb.tagName !== 'INPUT') return;
    const group = cb.dataset.group;
    const checkedInGroup = [...document.querySelectorAll(`input[data-group="${group}"]:checked`)];
    if(checkedInGroup.length === 0){
      // не даём снять последний чекбокс группы
      cb.checked = true;
      return;
    }
    state[group] = new Set(checkedInGroup.map(i=>i.value));
    renderAll();
  });

  document.getElementById('filter-reset').addEventListener('click', ()=>{
    document.querySelectorAll('.filters input[type=checkbox]').forEach(cb=>cb.checked=true);
    state.institution = new Set(INSTITUTIONS);
    state.form = new Set(FORMS);
    state.program = new Set(PROGRAMS);
    renderAll();
  });

  function filterNoteText(){
    const parts = [];
    if(state.institution.size < INSTITUTIONS.length) parts.push(INSTITUTIONS.filter(v=>state.institution.has(v)).map(v=>INST_LABELS[v]||v).join(', '));
    if(state.form.size < FORMS.length) parts.push([...state.form].join(', '));
    if(state.program.size < PROGRAMS.length) parts.push([...state.program].map(v=>PROGRAM_LABELS[v]||v).join(', '));
    if(parts.length === 0) return 'Показаны все учреждения, формы обучения и программы подготовки.';
    return 'Активные фильтры: <b>' + parts.join(' · ') + '</b>';
  }

  // ---------- Charts ----------
  const CHART_FONT = { family: "'Times New Roman', Times, serif", size: 12 };
  Chart.defaults.font.family = CHART_FONT.family;
  Chart.defaults.color = '#565F82';
  Chart.defaults.borderColor = '#DCE1EC';

  let dynamicsChart, budgetChart, formChart, growthChart;
  const seriesVisible = { total:true, budget:true, contract:true, target:true };
  const SERIES_META = {
    total:    {label:'Итого студентов', color:'#2A3F7C'},
    budget:   {label:'Бюджет', color:'#B8790C'},
    contract: {label:'Договор', color:'#106B66'},
    target:   {label:'Целевое обучение', color:'#8A3260'}
  };

  function buildLegendToggles(){
    const el = document.getElementById('legend-toggles');
    el.innerHTML = Object.entries(SERIES_META).map(([key,m])=>`
      <button class="legend-btn" data-key="${key}">
        <span class="sw" style="background:${m.color}"></span>${m.label}
      </button>
    `).join('');
    el.querySelectorAll('.legend-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const key = btn.dataset.key;
        seriesVisible[key] = !seriesVisible[key];
        btn.classList.toggle('off', !seriesVisible[key]);
        updateDynamicsChart();
      });
    });
  }

  function updateDynamicsChart(){
    const rows = filteredRows();
    const agg = aggregateAll(rows);
    const datasets = Object.entries(SERIES_META)
      .filter(([key])=>seriesVisible[key])
      .map(([key,m])=>({
        label:m.label,
        data:agg[key],
        borderColor:m.color,
        backgroundColor:m.color,
        pointRadius:3,
        pointHoverRadius:5,
        tension:.3,
        borderWidth:2.5
      }));
    if(!dynamicsChart){
      dynamicsChart = new Chart(document.getElementById('dynamicsChart'), {
        type:'line',
        data:{ labels:YEARS, datasets },
        options:{
          responsive:true, maintainAspectRatio:false,
          interaction:{ mode:'index', intersect:false },
          plugins:{
            legend:{ display:false },
            tooltip:{ callbacks:{ label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } }
          },
          scales:{
            y:{ beginAtZero:true, grid:{ color:'#E7EAF3' }, ticks:{ callback:v=>fmt(v) } },
            x:{ grid:{ display:false } }
          }
        }
      });
    } else {
      dynamicsChart.data.datasets = datasets;
      dynamicsChart.update();
    }
    document.getElementById('filter-note-1').innerHTML = filterNoteText();
  }

  function updateBudgetChart(){
    const rows = filteredRows();
    const agg = aggregateAll(rows);
    const budgetPct = agg.total.map((t,i)=> t? agg.budget[i]/t*100 : 0);
    const contractPct = agg.total.map((t,i)=> t? agg.contract[i]/t*100 : 0);
    const datasets = [
      { label:'Бюджет', data:budgetPct, backgroundColor:'#B8790C', stack:'s' },
      { label:'Договор', data:contractPct, backgroundColor:'#106B66', stack:'s' }
    ];
    const rawByKey = { budget: agg.budget, contract: agg.contract };
    const labelMap = { budget:'Бюджет', contract:'Договор' };
    if(!budgetChart){
      budgetChart = new Chart(document.getElementById('budgetChart'), {
        type:'bar',
        data:{ labels:YEARS_SHORT, datasets },
        options: normalizedBarOptions(rawByKey, labelMap)
      });
    } else {
      budgetChart.data.datasets = datasets;
      budgetChart.options = normalizedBarOptions(rawByKey, labelMap);
      budgetChart.update();
    }
  }

  const FORM_LABELS = {
    'Очная форма обучения': 'Очная',
    'Очно-заочная форма обучения': 'Очно-заочная',
    'Заочная форма обучения': 'Заочная'
  };
  const FORM_COLORS = {
    'Очная форма обучения': '#2A3F7C',
    'Очно-заочная форма обучения': '#8A3260',
    'Заочная форма обучения': '#6B7394'
  };

  function aggregateByForm(rows){
    const result = {};
    FORMS.forEach(f => result[f] = zeros());
    rows.forEach(r=>{
      for(let i=0;i<N;i++){ result[r.form][i] += r.total[i]; }
    });
    return result;
  }

  function updateFormChart(){
    const rows = filteredRows();
    const byForm = aggregateByForm(rows);
    const totals = zeros();
    FORMS.forEach(f=>{ for(let i=0;i<N;i++) totals[i] += byForm[f][i]; });

    const rawByKey = {};
    const datasets = FORMS.map(f=>{
      const pct = byForm[f].map((v,i)=> totals[i] ? v/totals[i]*100 : 0);
      rawByKey[f] = byForm[f];
      return { label: FORM_LABELS[f]||f, data:pct, backgroundColor: FORM_COLORS[f]||'#999', stack:'s' };
    });

    if(!formChart){
      formChart = new Chart(document.getElementById('formChart'), {
        type:'bar',
        data:{ labels:YEARS_SHORT, datasets },
        options: normalizedBarOptions(rawByKey, FORM_LABELS)
      });
    } else {
      formChart.data.datasets = datasets;
      formChart.options = normalizedBarOptions(rawByKey, FORM_LABELS);
      formChart.update();
    }
  }

  function normalizedBarOptions(rawByKey, labelMap){
    const keys = Object.keys(rawByKey);
    return {
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ display:false },
        tooltip:{
          callbacks:{
            label: ctx => ` ${ctx.dataset.label}: ${fmt1(ctx.parsed.y)}%`,
            afterBody: ctx => {
              const i = ctx[0].dataIndex;
              return keys.map(k => `${labelMap[k]||k}, чел.: ${fmt(rawByKey[k][i])}`);
            }
          }
        }
      },
      scales:{
        y:{ min:0, max:100, ticks:{ callback:v=>v+'%' }, grid:{ color:'#E7EAF3' } },
        x:{ grid:{ display:false } }
      }
    };
  }

  // ---------- Growth ----------
  const METRIC_LABELS = { total:'Итого студентов', budget:'Бюджет', contract:'Договор', target:'Целевое обучение' };
  let currentMetric = 'total';

  function computeGrowth(agg, key){
    const vals = agg[key];
    const abs = [null];
    const rate = [null];
    for(let i=1;i<N;i++){
      abs.push(vals[i]-vals[i-1]);
      rate.push(vals[i-1] ? (vals[i]-vals[i-1])/vals[i-1]*100 : null);
    }
    return { vals, abs, rate };
  }

  function updateGrowth(){
    const rows = filteredRows();
    const agg = aggregateAll(rows);
    const g = computeGrowth(agg, currentMetric);

    const barColors = g.rate.map(r => r===null ? '#C7CCDE' : (r>=0 ? '#1E7A46' : '#B2402A'));
    const chartData = { labels:YEARS_SHORT, datasets:[{ label:'Темп роста, %', data:g.rate, backgroundColor:barColors, borderRadius:4 }] };
    if(!growthChart){
      growthChart = new Chart(document.getElementById('growthChart'), {
        type:'bar',
        data: chartData,
        options:{
          responsive:true, maintainAspectRatio:false,
          plugins:{
            legend:{ display:false },
            tooltip:{ callbacks:{ label: ctx => ctx.parsed.y===null?'нет данных':` ${pct(ctx.parsed.y)} к пред. году` } }
          },
          scales:{
            y:{ grid:{ color:'#E7EAF3' }, ticks:{ callback:v=>v+'%' } },
            x:{ grid:{ display:false } }
          }
        }
      });
    } else {
      growthChart.data = chartData;
      growthChart.update();
    }

    const tbody = document.querySelector('#growth-table tbody');
    tbody.innerHTML = YEARS.map((y,i)=>{
      const absCell = g.abs[i]===null ? '—' : (g.abs[i]>=0?'+':'') + fmt(g.abs[i]);
      const rateCell = g.rate[i]===null ? '—' : pct(g.rate[i]);
      const cls = g.rate[i]===null ? '' : (g.rate[i]>=0?'pos':'neg');
      return `<tr>
        <td>${y}</td>
        <td class="num">${fmt(g.vals[i])}</td>
        <td class="num ${cls}">${absCell}</td>
        <td class="num ${cls}">${rateCell}</td>
      </tr>`;
    }).join('');

    updateExtraMetrics(agg, currentMetric);
  }

  document.getElementById('metric-select').addEventListener('change', e=>{
    currentMetric = e.target.value;
    updateGrowth();
  });

  // ---------- Extra metrics ----------
  function updateExtraMetrics(agg, key){
    const vals = agg[key];
    const first = vals[0], last = vals[N-1];
    const absGrowth = last - first;
    const relGrowth = first ? (last-first)/first*100 : 0;
    const years = N-1;
    const cagr = (first>0 && years>0) ? (Math.pow(last/first, 1/years)-1)*100 : 0;

    let maxV=-Infinity, maxI=0, minV=Infinity, minI=0;
    vals.forEach((v,i)=>{ if(v>maxV){maxV=v;maxI=i;} if(v<minV){minV=v;minI=i;} });

    const rates = [];
    for(let i=1;i<N;i++){
      rates.push(vals[i-1] ? (vals[i]-vals[i-1])/vals[i-1]*100 : null);
    }
    let maxRate=-Infinity, maxRateI=-1, minRate=Infinity, minRateI=-1;
    rates.forEach((r,i)=>{
      if(r===null) return;
      if(r>maxRate){maxRate=r; maxRateI=i;}
      if(r<minRate){minRate=r; minRateI=i;}
    });

    const cards = [
      { l:'Абсолютный прирост, чел.', v:(absGrowth>=0?'+':'')+fmt(absGrowth), s:'за весь период', cls: absGrowth>=0?'pos':'neg' },
      { l:'Относительный прирост, %', v:pct(relGrowth), s:'за весь период', cls: relGrowth>=0?'pos':'neg' },
      { l:'Среднегодовой темп роста, %', v:pct(cagr), s:'за весь период', cls: cagr>=0?'pos':'neg' },
      { l:'Максимальное значение, чел.', v:fmt(maxV), s:YEARS[maxI], cls:'' },
      { l:'Минимальное значение, чел.', v:fmt(minV), s:YEARS[minI], cls:'' },
      { l:'Максимальный рост за год, %', v: maxRateI>=0 ? pct(maxRate) : '—', s: maxRateI>=0 ? YEARS[maxRateI+1] : 'нет данных', cls:'pos' }
    ];
    document.getElementById('extra-grid').innerHTML = cards.map(c=>`
      <div class="extra-card">
        <div class="l">${c.l}</div>
        <div class="v num ${c.cls}">${c.v}</div>
        <div class="s">${c.s}</div>
      </div>
    `).join('');

    document.getElementById('extra-metric-badge').innerHTML =
      `<span class="sw" style="background:${SERIES_META[key].color}"></span>Показатель: ${METRIC_LABELS[key]}`;
  }

  // ---------- Render all ----------
  function renderAll(){
    updateDynamicsChart();
    updateBudgetChart();
    updateFormChart();
    updateGrowth();
  }

  buildLegendToggles();
  renderAll();

})();
