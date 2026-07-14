(() => {
  const VERSION = 'all-source-data-explorer-v01';
  const PRIMARY = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/nycif_staged_live_events.json';
  const SUPPLEMENTAL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/supplemental_events_staging_feed.json';
  const PAGE = 100;
  const NYC = { minLat: 40.4774, maxLat: 40.9176, minLng: -74.2591, maxLng: -73.7004 };
  const CATEGORIES = {
    sports:['🏟️','Sports'], fitness:['💪','Fitness / wellness'], parks:['🌳','Parks / recreation'], arts:['🎭','Arts / culture'], market:['🛍️','Markets / fairs'], civic:['📣','Civic / neighborhood'], government:['🏛️','Government / hearings'], education:['📚','Education / training'], family:['👨‍👩‍👧','Kids / family'], services:['🤝','Benefits / services'], environment:['🌎','Environment'], volunteer:['🙋','Volunteer'], jobs:['💼','Jobs / careers'], housing:['🏠','Housing / tenant help'], general:['📍','General']
  };
  const BOROUGH = {mn:'Manhattan',manhattan:'Manhattan',bk:'Brooklyn',brooklyn:'Brooklyn',qn:'Queens',q:'Queens',queens:'Queens',bx:'Bronx',bronx:'Bronx',si:'Staten Island','staten island':'Staten Island'};
  const state = { rows:[], filtered:[], shown:PAGE, query:'', category:'all', borough:'all', source:'all', date:'next7', marker:null };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v ?? '').toLowerCase().replace(/\s+/g,' ').trim();
  const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const today = () => dateKey(new Date());
  const plusDays = n => { const d=new Date(); d.setDate(d.getDate()+n); return dateKey(d); };
  const rowDate = r => { const direct=String(r.date||'').slice(0,10); if(/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct; const t=Date.parse(r.start_date_time||r.start||''); return Number.isFinite(t)?dateKey(new Date(t)):''; };
  const borough = v => BOROUGH[norm(Array.isArray(v)?v[0]:v)] || String(Array.isArray(v)?v[0]:v||'').trim();
  const coords = r => { const lat=Number.parseFloat(r.lat??r.latitude??r.proposed_lat), lng=Number.parseFloat(r.lng??r.longitude??r.proposed_lng); return {lat,lng,valid:Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=NYC.minLat&&lat<=NYC.maxLat&&lng>=NYC.minLng&&lng<=NYC.maxLng}; };
  function category(r, source){
    const direct=norm(r.category); if(source==='primary' && CATEGORIES[direct]) return direct;
    const text=norm([r.category,Array.isArray(r.categories)?r.categories.join(' '):r.categories,r.title,r.name,r.event_type,r.type,r.event_agency,r.location,r.display_location].filter(Boolean).join(' '));
    if(/job fair|career fair|employment|workforce|hiring/.test(text))return'jobs';
    if(/tenant|housing|property owner|landlord|homeowner|rent assistance|housing ambassador/.test(text))return'housing';
    if(/hearing|public meeting|community board|city government|government office|council meeting/.test(text))return'government';
    if(/benefit|resource fair|outreach|clinic|health screening|social service|food assistance|legal help/.test(text))return'services';
    if(/education|training|class|workshop|lecture|literacy|school program/.test(text))return'education';
    if(/kids and family|kids|children|family|youth program|storytime/.test(text))return'family';
    if(/volunteer|it'?s my park|stewardship|service project/.test(text))return'volunteer';
    if(/environment|ecology|climate|cleanup|compost|recycling|conservation|gardening|nature walk/.test(text))return'environment';
    if(/yoga|zumba|pilates|fitness|workout|aerobics|exercise|calisthenics|boot camp|barre|spinning|tai chi|qigong|wellness|stretching|shape up nyc|lap swim/.test(text))return'fitness';
    if(/athletic|softball|baseball|basketball|soccer|football|hockey|tennis|lacrosse|cricket|volleyball|kickball|rugby|marathon|5k|race|sport/.test(text))return'sports';
    if(/cultural|music|concert|arts?|dance|theater|theatre|film|performance|exhibit|museum|summerstage/.test(text))return'arts';
    if(/market|greenmarket|vendor|fair|feast|food festival|pop[- ]?up/.test(text))return'market';
    if(/parade|march|rally|vigil|ceremony|memorial|street and neighborhood|block party|open street|civic|community event/.test(text))return'civic';
    if(/parks? & recreation|park|playground|pool|recreation|garden|beach/.test(text))return'parks';
    return CATEGORIES[direct]?direct:'general';
  }
  function normalizeRow(r,i,source){
    const c=coords(r), key=category(r,source), title=r.title||r.name||'Untitled event';
    return {...r,_id:`${source}:${r.id||r.source_event_id||r.overlap_key||i}`,_source:source,_category:key,_date:rowDate(r),_borough:borough(r.borough||r.event_borough),_title:title,_location:r.display_location||r.location||r.address||'',_lat:c.lat,_lng:c.lng,_mapReady:c.valid,_search:norm([title,r.display_location,r.location,r.borough,r.event_borough,r.event_type,r.event_agency,r.category,Array.isArray(r.categories)?r.categories.join(' '):r.categories].filter(Boolean).join(' '))};
  }
  async function rows(url,label){ const res=await fetch(`${url}?cache=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/json'}}); if(!res.ok)throw new Error(`${label} HTTP ${res.status}`); const json=await res.json(); return Array.isArray(json)?json:(json.events||[]); }
  function install(){
    if(document.getElementById('nycifExplorerBtn'))return;
    const btn=document.createElement('button'); btn.id='nycifExplorerBtn'; btn.className='desk-btn nycif-explorer-btn'; btn.type='button'; btn.textContent='All Data'; btn.setAttribute('aria-controls','nycifExplorer'); btn.setAttribute('aria-expanded','false');
    const shell=document.querySelector('.map-shell'); shell?.appendChild(btn);
    const drawer=document.createElement('aside'); drawer.id='nycifExplorer'; drawer.className='desk-drawer nycif-explorer'; drawer.hidden=true; drawer.innerHTML=`<header class="desk-header"><div><p>NYC In Focus</p><h1>All-Source Data Explorer</h1></div><button id="nycifExplorerClose" class="close-btn" type="button">×</button></header><p id="nycifExplorerSummary" class="list-meta">Loading all data…</p><label class="search"><span class="sr-only">Search all loaded records</span><input id="nycifExplorerSearch" type="search" placeholder="Search titles, places, agencies and categories"></label><div class="nycif-explorer-filters"><select id="nycifExplorerSource"><option value="all">All sources</option><option value="primary">Approved / staged</option><option value="supplemental">Expanded review</option></select><select id="nycifExplorerCategory"><option value="all">All categories</option>${Object.entries(CATEGORIES).map(([k,v])=>`<option value="${k}">${v[0]} ${v[1]}</option>`).join('')}</select><select id="nycifExplorerBorough"><option value="all">All boroughs</option>${['Manhattan','Brooklyn','Queens','Bronx','Staten Island'].map(v=>`<option>${v}</option>`).join('')}</select><select id="nycifExplorerDate"><option value="next7">Next 7 days</option><option value="today">Today</option><option value="all">All upcoming</option></select></div><p class="nycif-explorer-note">Expanded review records are clearly labeled and are not promoted into the approved production feed. Records without approved coordinates remain searchable as list-only.</p><div id="nycifExplorerList" class="event-list"></div><button id="nycifExplorerMore" class="load-all" type="button" hidden>Load more</button>`;
    shell?.appendChild(drawer);
    const style=document.createElement('style'); style.id='nycifExplorerStyle'; style.textContent=`.nycif-explorer-btn{right:118px}.nycif-explorer{z-index:1600}.nycif-explorer-filters{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:8px 0}.nycif-explorer-filters select{min-width:0;padding:9px;border-radius:9px}.nycif-explorer-note{font-size:11px;line-height:1.35;color:rgba(255,255,255,.72)}.nycif-explorer .event-item{display:block;width:100%;text-align:left}.nycif-source-review{color:#f59e0b;font-weight:800}.nycif-list-only{color:#ef4444;font-weight:800}.nycif-explorer .load-all{margin-top:10px}@media(max-width:600px){.nycif-explorer-btn{right:104px;bottom:20px}.nycif-explorer-filters{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
    btn.addEventListener('click',()=>toggle(true)); document.getElementById('nycifExplorerClose').addEventListener('click',()=>toggle(false));
    document.getElementById('nycifExplorerSearch').addEventListener('input',e=>{state.query=norm(e.target.value);state.shown=PAGE;render();});
    [['nycifExplorerSource','source'],['nycifExplorerCategory','category'],['nycifExplorerBorough','borough'],['nycifExplorerDate','date']].forEach(([id,key])=>document.getElementById(id).addEventListener('change',e=>{state[key]=e.target.value;state.shown=PAGE;render();}));
    document.getElementById('nycifExplorerMore').addEventListener('click',()=>{state.shown+=PAGE;render();});
  }
  function toggle(open){ const d=document.getElementById('nycifExplorer'),b=document.getElementById('nycifExplorerBtn'); d.hidden=!open;b.setAttribute('aria-expanded',String(open));setTimeout(()=>window.NYCIF_MAIN_MAP?.invalidateSize(),80); }
  function matches(r){
    if(state.source!=='all'&&r._source!==state.source)return false; if(state.category!=='all'&&r._category!==state.category)return false; if(state.borough!=='all'&&r._borough!==state.borough)return false; if(state.query&&!r._search.includes(state.query))return false;
    const t=today(), end=plusDays(7); if(state.date==='today'&&r._date!==t)return false; if(state.date==='next7'&&(!r._date||r._date<t||r._date>end))return false; if(state.date==='all'&&r._date&&r._date<t)return false; return true;
  }
  function card(r){ const cat=CATEGORIES[r._category]||CATEGORIES.general, review=r._source==='supplemental'; return `<article class="event-item" data-explorer-id="${esc(r._id)}" tabindex="0"><span class="item-top"><span class="item-source">${cat[0]} ${esc(cat[1])}</span><span class="item-tags"><span class="item-tag ${review?'nycif-source-review':''}">${review?'REVIEW':'LIVE'}</span>${r._mapReady?'':'<span class="item-tag nycif-list-only">LIST ONLY</span>'}</span></span><strong>${esc(r._title)}</strong><span>${esc(r._date||'Date unavailable')}</span><small>${esc([r._borough,r._location,r.event_agency].filter(Boolean).join(' • '))}</small>${review?'<small>Expanded source intake; manual review pending.</small>':''}</article>`; }
  function render(){
    state.filtered=state.rows.filter(matches).sort((a,b)=>(a._date||'9999').localeCompare(b._date||'9999')||a._title.localeCompare(b._title)); const shown=Math.min(state.shown,state.filtered.length), primary=state.rows.filter(r=>r._source==='primary').length,supp=state.rows.length-primary,mapReady=state.rows.filter(r=>r._mapReady).length;
    document.getElementById('nycifExplorerSummary').textContent=`${state.rows.length.toLocaleString()} loaded · ${primary.toLocaleString()} approved/staged · ${supp.toLocaleString()} expanded review · ${mapReady.toLocaleString()} map-ready · showing ${shown.toLocaleString()} of ${state.filtered.length.toLocaleString()} matches`;
    const list=document.getElementById('nycifExplorerList'); list.innerHTML=state.filtered.slice(0,shown).map(card).join('')||'<div class="empty">No records match this view.</div>';
    list.querySelectorAll('[data-explorer-id]').forEach(el=>{const open=()=>focus(state.rows.find(r=>r._id===el.dataset.explorerId));el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});});
    const more=document.getElementById('nycifExplorerMore'); more.hidden=shown>=state.filtered.length; more.textContent=`Load 100 more (${Math.max(0,state.filtered.length-shown).toLocaleString()} remaining)`;
  }
  function focus(r){ if(!r)return; if(!r._mapReady){document.getElementById('status').textContent=`${r._title}: coordinate pending; list-only record.`;return;} const map=window.NYCIF_MAIN_MAP;if(!map)return; if(state.marker)map.removeLayer(state.marker); state.marker=L.marker([r._lat,r._lng]).addTo(map).bindPopup(`<strong>${esc(r._title)}</strong><br>${esc(r._location)}<br>${r._source==='supplemental'?'Expanded review record':'Approved/staged record'}`).openPopup();map.flyTo([r._lat,r._lng],15,{duration:.5}); }
  async function boot(){
    install(); try{const [primary,supp]=await Promise.all([rows(PRIMARY,'staged feed'),rows(SUPPLEMENTAL,'supplemental feed')]); state.rows=[...primary.map((r,i)=>normalizeRow(r,i,'primary')),...supp.map((r,i)=>normalizeRow(r,i,'supplemental'))];render();window.NYCIF_ALL_SOURCE_EXPLORER={version:VERSION,getSummary:()=>({total:state.rows.length,primary:state.rows.filter(r=>r._source==='primary').length,supplemental:state.rows.filter(r=>r._source==='supplemental').length,mapReady:state.rows.filter(r=>r._mapReady).length,categories:Object.fromEntries(Object.keys(CATEGORIES).map(k=>[k,state.rows.filter(r=>r._category===k).length]))})};}catch(e){document.getElementById('nycifExplorerSummary').textContent=`All-source explorer failed: ${e.message}`;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
