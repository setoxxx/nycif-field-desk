(() => {
  const root = document.body.dataset.root || '.';
  const page = document.body.dataset.page || 'overview';
  const base = `${root}/fixtures`;
  const files = {
    global:'global.json', manifest:'manifest.json',
    v1Summary:'v1/summary.json', v1Events:'v1/events.json', v1Map:'v1/map.json', v1Feeds:'v1/feeds.json', v1Repositories:'v1/repositories.json', v1Timeline:'v1/timeline.json', v1Alerts:'v1/alerts.json',
    v2Summary:'v2/summary.json', v2Enigma:'v2/enigma-core.json', v2Cultural:'v2/cultural.json', v2Events:'v2/events.json', v2Migration:'v2/migration.json', v2Repositories:'v2/repositories.json', v2Timeline:'v2/timeline.json', v2Alerts:'v2/alerts.json'
  };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tone = s => /complete|verified|healthy|pass|active/i.test(s||'') ? 'ok' : /block|fail/i.test(s||'') ? 'blocked' : /plan|lock|unauthor|inactive/i.test(s||'') ? 'violet' : 'warn';
  const badge = s => `<span class="badge ${tone(s)}">${esc(s||'UNKNOWN')}</span>`;
  const stat = (l,v,d='') => `<div class="stat"><div class="label">${esc(l)}</div><div class="value">${esc(v)}</div>${d?`<div class="muted">${esc(d)}</div>`:''}</div>`;
  const bar = v => `<div class="progress"><span style="width:${Math.max(0,Math.min(100,Number(v)||0))}%"></span></div>`;
  const fail = (l,e) => `<div class="subsystem-error"><strong>${esc(l)} unavailable</strong><span>${esc(e?.message||e||'Unknown error')}</span></div>`;
  // Repair 3: explicit freshness validation — fresh / stale / invalid timestamp / missing timestamp / invalid threshold.
  const INVALID_FRESHNESS = 'Freshness cannot be confirmed because the generation timestamp or freshness threshold is invalid.';
  function freshnessMessage(g){
    const raw = g.generated_at_utc;
    if(raw==null || raw==='') return {show:true, state:'missing', text:'Status generation time is unavailable; freshness cannot be confirmed. Fixture data shown for reference only.'};
    const ts = Date.parse(raw);
    const thrRaw = g.freshness_threshold_hours, thr = Number(thrRaw);
    const thrValid = thrRaw!=null && thrRaw!=='' && Number.isFinite(thr) && thr>=0;
    if(!Number.isFinite(ts) || !thrValid) return {show:true, state:'invalid', text:INVALID_FRESHNESS};
    if((Date.now()-ts) > thr*3600e3) return {show:true, state:'stale', text:`Status data may be stale: generated ${new Date(ts).toLocaleString()}, older than the ${thr}h freshness threshold. Shown for reference only, not as current.`};
    return {show:false, state:'fresh'};
  }
  async function load(path){const r=await fetch(`${base}/${path}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);return r.json()}
  async function all(){const entries=Object.entries(files), out={}, errors={};const settled=await Promise.allSettled(entries.map(([,p])=>load(p)));settled.forEach((r,i)=>{const k=entries[i][0];r.status==='fulfilled'?out[k]=r.value:errors[k]=r.reason});return {out,errors}}
  function header(d,e){const g=d.global||{};document.querySelector('[data-global-health]').textContent=g.overall_health||'UNKNOWN';document.querySelector('[data-production-version]').textContent=g.authoritative_production_version||'UNKNOWN';const _upd=g.generated_at_utc?new Date(g.generated_at_utc):null;document.querySelector('[data-updated]').textContent=(_upd&&!isNaN(_upd.getTime()))?_upd.toLocaleString():'Unavailable';const sw=document.querySelector('[data-stale-warning]');if(sw){const fr=freshnessMessage(g);sw.hidden=!fr.show;sw.textContent=fr.show?fr.text:''}const partial=Object.keys(e).filter(k=>!['global','manifest'].includes(k));if(partial.length){const el=document.querySelector('[data-degraded]');el.hidden=false;el.textContent=`Partial preview: ${partial.length} optional status file(s) unavailable.`}}
  function hero(d){const g=d.global||{},m=d.v1Map||{};document.querySelector('[data-command-stack]').innerHTML=[stat('Current objective',g.current_global_objective||'Unavailable'),stat('Active gate',g.current_gate||'Unavailable'),stat('Next gate',g.next_gate||'Unavailable'),stat('Open blockers',g.unresolved_blocker_count??'Unknown'),stat('Verified tests',g.verified_reconstruction_tests??'Unknown'),stat('Write controls',g.write_controls_allowed?'AUTHORIZED':'DISABLED')].join('');const f=document.querySelector('[data-map-frame]');if(new URLSearchParams(location.search).get('qa')==='1'){f.srcdoc='<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:radial-gradient(circle,#18314f,#08111f 65%);color:#dbeafe;font:600 18px system-ui}</style><div>Current Production Map — V1<br><small>QA placeholder</small></div>'}else if(m.embed_url)f.src=m.embed_url;f.title=m.label||'Current Production Map — V1';document.querySelector('[data-map-overlay]').innerHTML=`<div><strong>${esc(m.label||'Current Production Map — V1')}</strong><span>${esc(m.preview_mode||'Read-only preview')}</span></div><div><strong>${esc(m.feed_branch||'main')}</strong><span>Feed branch</span></div><div><strong>${esc(m.qa_status||'Unknown')}</strong><span>Map QA</span></div>`;document.querySelector('[data-map-fallback]').href=m.full_map_url||'https://setoxxx.github.io/nycif-field-desk/'}
  function versions(d){const a=d.v1Summary||{},b=d.v2Summary||{};document.querySelector('[data-version-grid]').innerHTML=`<article class="version-card v1"><h3>V1 Current Production System</h3>${badge(a.production_status)}<div class="big">${esc(a.production_health_percent??'—')}%</div><div class="muted">Production health</div>${bar(a.production_health_percent)}<p>${esc(a.summary||'')}</p><div class="metric-grid">${stat('Original-scope completion',`${a.original_scope_completion_percent??'—'}%`)}${stat('Authority',a.authority||'UNKNOWN')}</div><div class="links"><a href="${root}/v1/">Open V1 view</a><a href="../">Current GodView</a></div></article><article class="version-card v2"><h3>V2 Enigma Platform</h3>${badge(b.architecture_status)}<div class="big">${esc(b.architecture_completion_percent??'—')}%</div><div class="muted">Architecture completion</div>${bar(b.architecture_completion_percent)}<p>${esc(b.summary||'')}</p><div class="metric-grid">${stat('Implementation',`${b.implementation_completion_percent??'—'}%`)}${stat('Production authority',b.production_authority||'NONE')}</div><div class="links"><a href="${root}/v2/">Open V2 view</a></div></article>`}
  function core(d,e){const el=document.querySelector('[data-core-strip]');if(e.v2Enigma){el.innerHTML=fail('Enigma Core',e.v2Enigma);return}el.innerHTML=(d.v2Enigma?.components||[]).map(n=>`<div class="core-node"><strong>${esc(n.name)}</strong>${badge(n.status)}<span>${esc(n.detail||'')}</span></div>`).join('')}
  function lanes(d,e){const lane=(cls,title,x,err)=>err?`<article class="lane ${cls}">${fail(title,err)}</article>`:`<article class="lane ${cls}"><div class="lane-head"><div><h3 class="lane-title">${title}</h3><div class="muted">${esc(x.summary||'')}</div></div>${badge(x.status)}</div><div class="metric-grid">${stat('Current phase',x.current_phase||'Unknown')}${stat('Architecture',`${x.architecture_completion_percent??'—'}%`)}${stat('Implementation',`${x.implementation_completion_percent??'—'}%`)}${stat('Open blockers',x.open_blocker_count??'Unknown')}</div><ul class="task-list">${(x.tasks||[]).map(t=>`<li><strong>${esc(t.title)}</strong>${badge(t.status)}<span>${esc(t.detail||'')}</span></li>`).join('')}</ul></article>`;document.querySelector('[data-lanes]').innerHTML=lane('events','Events V2',d.v2Events||{},e.v2Events)+lane('cultural','Cultural / Community Data',d.v2Cultural||{},e.v2Cultural)}
  // Repair 1: timelines are page-aware — overview shows both, V1 page only V1, V2 page only V2.
  function timelines(d,e){const track=(t,x,err)=>`<div class="timeline-track"><h3>${t}</h3>${err?fail(t,err):`<div class="timeline-rail">${(x?.phases||[]).map(p=>`<div class="phase ${esc(p.status)}"><strong>${esc(p.name)}</strong><span>${esc(p.status)} · ${esc(p.detail||'')}</span></div>`).join('')}</div>`}</div>`;const v1=track('V1 stabilization and preservation',d.v1Timeline,e.v1Timeline),v2=track('V2 Enigma migration',d.v2Timeline,e.v2Timeline);document.querySelector('[data-timelines]').innerHTML = page==='v1' ? v1 : page==='v2' ? v2 : (v1+v2)}
  function repos(d,e){const el=document.querySelector('[data-repositories]'),list=[...(d.v1Repositories?.repositories||[]),...(d.v2Repositories?.repositories||[])],seen=new Set();if(!list.length){el.innerHTML=fail('Repository metadata',e.v1Repositories||e.v2Repositories);return}el.innerHTML=list.filter(r=>!seen.has(r.name)&&seen.add(r.name)).map(r=>`<article class="repo-card"><div class="label">${esc(r.role||'Repository')}</div><h3>${esc(r.name)}</h3>${badge(r.status)}<div class="repo-meta"><div><span class="muted">Branch</span><strong>${esc(r.branch||'Unknown')}</strong></div><div><span class="muted">CI</span><strong>${esc(r.ci||'Unknown')}</strong></div><div><span class="muted">Authority</span><strong>${esc(r.authority||'Unknown')}</strong></div><div><span class="muted">Visibility</span><strong>${esc(r.visibility||'Unknown')}</strong></div></div><div class="links"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open repository ${esc(r.name)}">Open repository</a></div></article>`).join('')}
  // Repair 1: alerts are page-aware — overview shows both, V1 page only V1, V2 page only V2.
  function alerts(d){const v1=d.v1Alerts?.alerts||[],v2=d.v2Alerts?.alerts||[];const list = page==='v1' ? v1 : page==='v2' ? v2 : [...v1,...v2];document.querySelector('[data-alerts]').innerHTML=list.map(a=>`<article class="alert"><div>${badge(a.severity||'INFO')}</div><strong>${esc(a.title)}</strong><span>${esc(a.detail||'')}</span></article>`).join('')||'<div class="muted">No alerts in fixture data.</div>'}
  function details(d){const v1=document.querySelector('[data-v1-detail]');if(v1){const s=d.v1Summary||{},x=d.v1Events||{},f=d.v1Feeds||{},m=d.v1Map||{};v1.innerHTML=`<div class="metric-grid">${stat('Production status',s.production_status||'Unknown')}${stat('Original scope',`${s.original_scope_completion_percent??'—'}%`)}${stat('Approved events',x.approved_event_count??'Unknown')}${stat('Major events',x.major_event_count??'Unknown')}${stat('Feed branch',f.active_branch||'Unknown')}${stat('Map QA',m.qa_status||'Unknown')}</div><h3>Remaining V1 work</h3><ul class="task-list">${(s.remaining_work||[]).map(t=>`<li><strong>${esc(t.title)}</strong>${badge(t.status)}<span>${esc(t.detail)}</span></li>`).join('')}</ul>`}const v2=document.querySelector('[data-v2-detail]');if(v2){const m=d.v2Migration||{};v2.innerHTML=`<div class="metric-grid">${stat('Current gate',d.global?.current_gate||'Unknown')}${stat('Migration readiness',`${m.readiness_percent??'—'}%`)}${stat('Production authority',d.v2Summary?.production_authority||'NONE')}${stat('Cutover status',m.cutover_status||'LOCKED')}</div><h3>Migration safeguards</h3><ul class="task-list">${(m.safeguards||[]).map(t=>`<li><strong>${esc(t.name)}</strong>${badge(t.status)}<span>${esc(t.detail)}</span></li>`).join('')}</ul>`}}
  // Repair 2: explicit target-aware renderer registration.
  // A renderer whose primary target is absent on this page is an intentional no-op.
  // A renderer whose target exists but throws shows a controlled panel failure in that
  // target only, leaving every other panel functional.
  all().then(({out,errors})=>{
    const renderers=[
      {name:'Header',target:'[data-production-version]',fn:()=>header(out,errors)},
      {name:'Command state',target:'[data-command-stack]',fn:()=>hero(out)},
      {name:'Version overview',target:'[data-version-grid]',fn:()=>versions(out)},
      {name:'Enigma Core',target:'[data-core-strip]',fn:()=>core(out,errors)},
      {name:'Domain lanes',target:'[data-lanes]',fn:()=>lanes(out,errors)},
      {name:'Timeline',target:'[data-timelines]',fn:()=>timelines(out,errors)},
      {name:'Repositories',target:'[data-repositories]',fn:()=>repos(out,errors)},
      {name:'Alerts',target:'[data-alerts]',fn:()=>alerts(out)},
      {name:'Detail',target:'[data-v1-detail],[data-v2-detail]',fn:()=>details(out)}
    ];
    renderers.forEach(({name,target,fn})=>{
      const el=document.querySelector(target);
      if(!el) return;                                   // missing target: intentional no-op
      try{ fn(); }
      catch(err){ el.innerHTML=fail(name,err); }        // controlled panel failure; others continue
    });
    document.querySelectorAll('[data-loading]').forEach(x=>x.remove());
  }).catch(e=>document.querySelectorAll('[data-loading]').forEach(x=>{x.innerHTML=fail('GodView preview',e)}));
})();
