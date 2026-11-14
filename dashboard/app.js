(() => {
  const pack = window.RADAR;
  if (!pack) return;
  const root = document.querySelector('#app');
  const board = pack.rows || [];
  const live = pack.live || [];
  const money = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0});
  const pct = value => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  const usd = value => money.format(value || 0);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const key = value => String(value || '').toLowerCase();
  const state = {query:'', category:'', chain:'', watch:false, floor:0, sort:'value', growth:pack.model.growth_weight, maturity:pack.model.maturity_floor, global:1, focus:-1};
  const chains = [...new Set(board.flatMap(row => row.chains || []))].sort();
  const categories = [...new Set(board.map(row => row.category).filter(Boolean))].sort();
  const route = () => {
    const hash = location.hash || '#/';
    if (hash.startsWith('#/live')) return {view:'live'};
    if (hash.startsWith('#/detail/')) return {view:'detail',slug:decodeURIComponent(hash.slice(9))};
    const params = new URLSearchParams(hash.split('?')[1] || '');
    return {view:'board',category:params.get('category') || ''};
  };
  const modelValue = row => {
    const factor = 1 + Math.max(-60,Math.min(120,row.change_7d ?? 0)) * state.growth / 100;
    const mature = state.maturity + Math.min(row.age_days ?? 365,1095) / 1095 * .4;
    return Math.round(row.tvl_usd * row.model.category_multiple * factor * mature * row.model.chain_multiplier * state.global);
  };
  function shell(content, active='board') {
    return `<header class="topbar"><a class="brand" href="#/"><span class="brand-mark">◈</span><span><b>TOKEN RADAR</b><small>Pre-token protocols ranked by implied launch value</small></span></a><nav><a class="${active==='board'?'selected':''}" href="#/">Board</a><a class="${active==='live'?'selected':''}" href="#/live">Already launched</a><a href="#/method">Methodology</a></nav></header>${content}`;
  }
  function card(label,value,note) { return `<article class="stat"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`; }
  function options(items,current,all) { return `<option value="">${all}</option>${items.map(item=>`<option value="${esc(item)}" ${item===current?'selected':''}>${esc(item)}</option>`).join('')}`; }
  function filteredRows() {
    let rows=board.filter(row => (!state.query || key(row.name).includes(key(state.query)) || key(row.slug).includes(key(state.query))) && (!state.category || row.category===state.category) && (!state.chain || (row.chains||[]).includes(state.chain)) && (!state.watch || row.on_watchlist) && row.tvl_usd>=state.floor);
    const val = row => state.sort==='value'?modelValue(row):state.sort==='tvl'?row.tvl_usd:state.sort==='change'?(row.change_7d ?? -Infinity):state.sort==='age'?(row.age_days ?? -1):row.name.toLowerCase();
    return rows.slice().sort((a,b)=>{const x=val(a),y=val(b);if(typeof x==='string')return x.localeCompare(y);return y-x;});
  }
  function exportRows(rows) {
    const heads=['rank','slug','name','category','chains','TVL','seven-day change','age days','implied value'];
    const quote = value => `"${String(value ?? '').replaceAll('"','""')}"`;
    const lines=[heads,...rows.map(row=>[row.rank,row.slug,row.name,row.category,(row.chains||[]).join(';'),row.tvl_usd,row.change_7d,row.age_days,modelValue(row)])].map(line=>line.map(quote).join(','));
    const file=new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const link=document.createElement('a');link.href=URL.createObjectURL(file);link.download='token-radar-board.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),500);
  }
  function tableRows(rows) {
    const ceiling=Math.max(1,...rows.map(modelValue));
    return rows.map((row,index)=>`<tr tabindex="0" data-row="${index}" class="${index===state.focus?'keyboard-focus':''}" data-slug="${esc(row.slug)}"><td class="rank">${row.rank}</td><td><b>${esc(row.name)}</b><small>${esc(row.slug)} · ${esc(row.category||'Uncategorised')} · ${(row.chains||[]).map(esc).join(', ')}</small></td><td>${usd(row.tvl_usd)}</td><td class="${(row.change_7d||0)>=0?'positive':'negative'}">${pct(row.change_7d)}</td><td>${row.age_days==null?'Unknown':`${row.age_days}d`}</td><td class="value-cell"><b>${usd(modelValue(row))}</b><span class="value-track"><i style="width:${Math.max(2,modelValue(row)/ceiling*100)}%"></i></span></td><td><span class="step-count">${row.farm_steps.length} steps</span></td></tr>`).join('');
  }
  function boardView() {
    const rows=filteredRows();state.focus=Math.min(state.focus,rows.length-1);
    const tvl=rows.reduce((sum,row)=>sum+row.tvl_usd,0);
    const ordered=rows.map(modelValue).sort((a,b)=>a-b);const median=ordered.length?ordered[Math.floor(ordered.length/2)]:0;
    const groups={};rows.forEach(row=>groups[row.category||'Uncategorised']=(groups[row.category||'Uncategorised']||0)+row.tvl_usd);
    const leader=Object.entries(groups).sort((a,b)=>b[1]-a[1])[0]||['—',0];const top=board[0];
    const controls=`<section class="controls"><label class="search-control">Search name or slug<input id="search" value="${esc(state.query)}" placeholder="Search protocols"></label><label>Category<select id="category">${options(categories,state.category,'All categories')}</select></label><label>Chain<select id="chain">${options(chains,state.chain,'All chains')}</select></label><label>Minimum TVL<select id="floor">${[[0,'Any TVL'],[10000000,'$10m+'],[50000000,'$50m+'],[100000000,'$100m+'],[1000000000,'$1bn+']].map(([v,t])=>`<option value="${v}" ${state.floor===v?'selected':''}>${t}</option>`).join('')}</select></label><label>Sort by<select id="sort">${[['value','Implied value'],['tvl','TVL'],['change','7-day change'],['age','Age'],['name','Name']].map(([v,t])=>`<option value="${v}" ${state.sort===v?'selected':''}>${t}</option>`).join('')}</select></label><label class="check"><input id="watch" type="checkbox" ${state.watch?'checked':''}> Watchlist only</label><button id="reset" class="button quiet">Reset</button><button id="csv" class="button export">⇩ Export CSV</button></section>`;
    return shell(`<main class="page"><div class="intro"><div><div class="eyebrow">LAUNCH VALUE RADAR <i></i> MODEL ${esc(pack.model_version)}</div><h1>Pre-token board</h1><p class="counts">Snapshot ${esc(pack.as_of)} <span>·</span> ${pack.watchlist_size} watchlist <span>·</span> ${pack.board_size} board <span>·</span> ${live.length} live set</p></div><div class="claim-label">MODEL CLAIM <b>USD</b></div></div><section class="stats">${card('BOARD TVL',usd(tvl),'Current filtered set')}${card('MEDIAN IMPLIED VALUE',usd(median),'Display assumptions applied')}${card('TOP CATEGORY BY TVL',leader[0],usd(leader[1])+' represented')}${card('RANK ONE',top.name,usd(top.implied_value_usd)+' submitted value')}</section>${controls}<section class="sandbox"><div class="sandbox-copy"><span class="eyebrow">YOUR VIEW</span><h2>Model sandbox</h2><p>Recomputes displayed values with your assumptions. The submitted board uses the stated constants.</p></div><label>Growth weight <output id="growth-out">${state.growth.toFixed(2)}</output><input id="growth" type="range" min="0" max="1" step="0.01" value="${state.growth}"></label><label>Maturity floor <output id="maturity-out">${state.maturity.toFixed(2)}</output><input id="maturity" type="range" min="0.3" max="0.8" step="0.01" value="${state.maturity}"></label><label>Global multiple <output id="global-out">${state.global.toFixed(2)}×</output><input id="global" type="range" min="0.5" max="2" step="0.01" value="${state.global}"></label></section><div class="table-head"><div><h2>Protocols</h2><p>${rows.length} of ${pack.board_size} protocols <span class="keyboard-tip">↑ ↓ choose · Enter open · Esc board</span></p></div><span>Sorted by ${esc(documentSortName())}</span></div><div class="table-wrap"><table><thead><tr><th>RANK</th><th>PROTOCOL</th><th>TVL</th><th>7D</th><th>AGE</th><th>IMPLIED VALUE</th><th>FARM</th></tr></thead><tbody>${tableRows(rows)}</tbody></table>${rows.length?'':'<div class="empty">No protocols match these filters.</div>'}</div>${methodSection()}</main>${footer()}`);
  }
  function documentSortName(){return ({value:'implied value',tvl:'TVL',change:'seven-day change',age:'age',name:'name'})[state.sort];}
  function detailView(slug) {
    const row=board.find(item=>item.slug===slug);if(!row)return `<main class="page"><a class="button quiet" href="#/">← Back to board</a><h1>Protocol not found</h1></main>`;
    const peers=live.filter(item=>item.category===row.category).slice(0,3);const b=row.model;
    const factors=`${usd(row.tvl_usd)} × ${b.category_multiple.toFixed(2)} × ${b.growth_multiplier.toFixed(3)} × ${b.maturity_multiplier.toFixed(3)} × ${b.chain_multiplier.toFixed(3)} = ${usd(row.implied_value_usd)}`;
    const reason=`${row.name} ranks #${row.rank} with ${usd(row.tvl_usd)} TVL, ${pct(row.change_7d)} seven-day change and ${row.age_days==null?'unknown tracked age':`${row.age_days} tracked days`}; this is a model claim from the snapshot, not a launch prediction.`;
    return shell(`<main class="page detail-page"><a class="button quiet back" href="#/">← Back to board</a><div class="detail-intro"><div class="eyebrow">RANK ${row.rank} <i></i> ${esc(row.category||'UNCATEGORISED')}</div><h1>${esc(row.name)}</h1><p>${esc(row.slug)} <span>·</span> ${(row.chains||[]).map(esc).join(', ')} <span>·</span> Snapshot records no token</p><small>Snapshot ${esc(pack.as_of)}</small></div><section class="stats detail-stats">${card('IMPLIED VALUE',usd(row.implied_value_usd),'Submitted board value')}${card('TVL',usd(row.tvl_usd),'Snapshot value')}${card('7-DAY CHANGE',pct(row.change_7d),'Reported TVL change')}${card('TRACKED AGE',row.age_days==null?'Unknown':`${row.age_days} days`,'At snapshot date')}</section><div class="detail-grid"><section class="panel"><div class="eyebrow">MODEL BREAKDOWN</div><h2>How the value is formed</h2><p class="equation">${factors}</p><p>The category multiple comes from live-token market caps compared with TVL in the sealed snapshot.</p></section><section class="panel"><div class="eyebrow">WHY IT RANKS</div><h2>Snapshot signals</h2><p>${esc(reason)}</p></section><section class="panel farm-panel"><div class="eyebrow">FARM PLAN</div><h2>Six practical steps</h2><ol>${row.farm_steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol></section><section class="panel"><div class="eyebrow">LIVE COMPARABLES</div><h2>Already launched · same category</h2>${peers.length?`<div class="comparables">${peers.map(peer=>`<article><b>${esc(peer.name)}</b><small>${esc(peer.category||'Uncategorised')} · ${(peer.chains||[]).map(esc).join(', ')}</small><span>Market cap ${usd(peer.mcap_usd)} · TVL ${usd(peer.tvl_usd)}</span></article>`).join('')}</div>`:'<p>There are no same-category live comparables in the top set.</p>'}</section></div>${methodSection()}</main>${footer()}`,'board');
  }
  function liveView() {
    return shell(`<main class="page"><div class="eyebrow">MARKET SNAPSHOT <i></i> LIVE SET</div><h1>Already launched</h1><p class="lead">Market cap is the market’s own figure. These protocols are not ranked on the pre-token board.</p><a class="button quiet" href="#/">← Back to board</a><section class="live-grid">${live.map(row=>`<article class="live-card"><div class="eyebrow">${esc(row.category||'UNCATEGORISED')}</div><h2>${esc(row.name)}</h2><p>${(row.chains||[]).map(esc).join(', ')}</p><div><span>MARKET CAP</span><b>${usd(row.mcap_usd)}</b></div><div><span>TVL</span><b>${usd(row.tvl_usd)}</b></div></article>`).join('')}</section>${methodSection()}</main>${footer()}`,'live');
  }
  function methodSection(){return `<section id="method" class="method"><div class="eyebrow">MODEL NOTES</div><h2>Methodology</h2><div class="method-copy"><p>Implied value starts with TVL and multiplies by a category multiple built from live-token market cap divided by TVL. A category needs at least three live protocols; otherwise the overall median applies. The multiple is capped at 2.0.</p><p>Seven-day growth is clamped from −60% to +120% and scaled by the growth weight. Maturity rises along a 1,095-day curve; unknown age uses 365 days. The chain factor adds 2% for each additional chain, up to four.</p><p>The watchlist uses a $50 million TVL floor and excludes wrapped, staked, bridge and exchange records. A protocol records no token when its snapshot entry has no market cap, Gecko id or symbol; that record is not proof.</p><p>Implied value is this entry’s model claim from the sealed snapshot, not a prediction that a token will launch.</p></div><a class="button quiet" href="#/live">See already-launched protocols →</a></section>`;}
  function footer(){return `<footer><span>Source: DefiLlama snapshot as of ${esc(pack.as_of)} · sealed input</span><span>Built for the make.fun token-radar-01 bounty</span></footer>`;}
  function render(){const current=route();if(current.view==='board'){state.category=current.category;root.innerHTML=boardView();wireBoard();}else if(current.view==='live'){root.innerHTML=liveView();}else root.innerHTML=detailView(current.slug);}
  function wireBoard(){
    const bind=(selector,field,convert=value=>value)=>document.querySelector(selector).addEventListener('input',event=>{state[field]=convert(event.target.value);state.focus=-1;render();});
    bind('#search','query');bind('#category','category');bind('#chain','chain');bind('#floor','floor',Number);bind('#sort','sort');
    document.querySelector('#watch').addEventListener('change',event=>{state.watch=event.target.checked;render();});
    document.querySelector('#reset').addEventListener('click',()=>{Object.assign(state,{query:'',category:'',chain:'',watch:false,floor:0,sort:'value',focus:-1});location.hash='#/';render();});
    document.querySelector('#csv').addEventListener('click',()=>exportRows(filteredRows()));
    [['growth','growth','growth-out',v=>Number(v).toFixed(2)],['maturity','maturity','maturity-out',v=>Number(v).toFixed(2)],['global','global','global-out',v=>`${Number(v).toFixed(2)}×`]].forEach(([id,field,out,format])=>document.querySelector(`#${id}`).addEventListener('input',event=>{state[field]=Number(event.target.value);document.querySelector(`#${out}`).textContent=format(state[field]);render();}));
    document.querySelectorAll('tbody tr').forEach(row=>row.addEventListener('click',()=>location.hash=`#/detail/${encodeURIComponent(row.dataset.slug)}`));
  }
  document.addEventListener('keydown',event=>{
    if(route().view!=='board') {if(event.key==='Escape')location.hash='#/';return;}
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    const rows=filteredRows();if(!rows.length)return;
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();state.focus=(state.focus+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length;render();document.querySelector(`[data-row="${state.focus}"]`)?.scrollIntoView({block:'nearest'});}
    if(event.key==='Enter'&&state.focus>=0)location.hash=`#/detail/${encodeURIComponent(rows[state.focus].slug)}`;
    if(event.key==='Escape'){state.focus=-1;location.hash='#/';render();}
  });
  window.addEventListener('hashchange',render);
  render();
})();
