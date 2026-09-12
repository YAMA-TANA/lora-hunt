(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(v)=>new Intl.NumberFormat('en-US',{notation:Number(v)>=100000?'compact':'standard',maximumFractionDigits:1}).format(Number(v||0));
  const list=(v)=>{if(Array.isArray(v))return v;try{return JSON.parse(v||'[]')}catch{return[]}};
  let resources=[];

  function copy(){
    const ja=window.LoRAHuntLocale?.get?.()==='ja';
    return ja?{title:'このrepoのLoRAファイル',desc:'repo内の重みをファイル単位で表示します。Trigger・推奨Weight・Rankなどは取得できた場合のみ表示します。',base:'ベースモデル',trigger:'Trigger',weight:'推奨Weight',rank:'Rank / Alpha',size:'サイズ',examples:'作例あり',enriched:'詳細解析済み',mirrors:'同一weight',open:'HFで開く'}:{title:'LoRA files in this repository',desc:'Individual weight files indexed from this repository. Trigger words, recommended weight and rank appear when the metadata could be extracted.',base:'Base model',trigger:'Trigger words',weight:'Recommended weight',rank:'Rank / Alpha',size:'File size',examples:'Example images',enriched:'Metadata enriched',mirrors:'identical copies',open:'Open on HF'};
  }

  function repoId(){
    const href=$('.detail-actions .primary-button')?.href||'';
    try{const url=new URL(href);return decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g,''));}catch{return'';}
  }

  function renderFiles(){
    let section=$('#detail-files');
    if(!section){
      const facts=$('.detail-facts'); if(!facts)return;
      section=document.createElement('section');section.id='detail-files';section.className='lh-detail-files';facts.insertAdjacentElement('afterend',section);
    }
    const t=copy();
    if(!resources.length){section.innerHTML='';return;}
    section.innerHTML=`<div class="lh-resource-head"><div><p class="panel-label">FILE INDEX</p><h2>${t.title} <span>${resources.length}</span></h2></div><p>${t.desc}</p></div><div class="lh-detail-file-list">${resources.map((r)=>{
      const triggers=list(r.trigger_words).slice(0,8),dupes=Number(r.duplicate_count||1);
      const weight=r.recommended_weight_min==null?'—':Number(r.recommended_weight_min)===Number(r.recommended_weight_max)?String(r.recommended_weight_min):`${r.recommended_weight_min}–${r.recommended_weight_max}`;
      const rank=r.lora_rank?`r${r.lora_rank}${r.alpha?` / α${r.alpha}`:''}`:'—';
      const size=r.size_mb?`${num(r.size_mb)} MB`:'—';
      return `<article class="lh-detail-file"><div class="lh-resource-top"><div><span class="lh-resource-path">${esc(r.path)}</span><h3>${esc(r.filename)}</h3></div><div class="lh-resource-badges">${r.enriched_at?`<span>${t.enriched}</span>`:''}${Number(r.has_examples)?`<span>${t.examples}</span>`:''}${dupes>1?`<span>${dupes} ${t.mirrors}</span>`:''}<span>${esc(r.format)}</span></div></div><div class="lh-resource-base"><span>${t.base}</span><strong>${esc(r.base_model||'Unknown base')}</strong></div><div class="lh-resource-grid"><div><span>${t.trigger}</span><strong>${triggers.length?triggers.map(esc).join(', '):'—'}</strong></div><div><span>${t.weight}</span><strong>${esc(weight)}</strong></div><div><span>${t.rank}</span><strong>${esc(rank)}</strong></div><div><span>${t.size}</span><strong>${esc(size)}</strong></div></div><div class="lh-detail-file-foot"><a class="outline-button" href="${esc(r.source_url)}" target="_blank" rel="noreferrer">${t.open} ↗</a></div></article>`;
    }).join('')}</div>`;
  }

  async function loadFiles(){
    const repo=repoId(); if(!repo)return;
    try{const response=await fetch(`/api/resources?q=${encodeURIComponent(`repo:${repo}`)}&limit=60&sort=downloads`,{headers:{Accept:'application/json'}});if(!response.ok)return;const payload=await response.json();resources=Array.isArray(payload.resources)?payload.resources:[];renderFiles();}catch{}
  }

  document.addEventListener('DOMContentLoaded', () => {
    const facts = document.querySelector('.detail-facts');
    if (!facts) return;

    facts.querySelectorAll(':scope > div').forEach((item) => {
      const label = item.querySelector('span');
      const value = item.querySelector('strong');
      if (!label) return;
      const original = label.textContent.trim();
      if (original === 'Base model' || original === 'Best for') item.classList.add('lh-wide');
      if (original === 'Downloads' || original === 'Likes') item.classList.add('lh-signal');
      if (value && value.textContent.trim() === '情報なし') value.textContent = 'Not listed';
    });

    const back = document.querySelector('.detail-back');
    if (back) back.textContent = '← Back to LoRA search';
    const primary = document.querySelector('.detail-actions .primary-button');
    if (primary) primary.textContent = 'Open on Hugging Face ↗';
    const secondary = document.querySelector('.detail-actions .outline-button');
    if (secondary) secondary.textContent = 'Find similar LoRAs';
    const score = document.querySelector('.detail-score .panel-label');
    if (score) score.textContent = 'COMMUNITY SIGNAL';

    loadFiles();
    document.addEventListener('change',(event)=>{if(event.target?.id==='lh-locale')setTimeout(renderFiles,0)});
  });
})();
