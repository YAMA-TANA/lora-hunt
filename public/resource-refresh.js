(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(v)=>new Intl.NumberFormat('en-US',{notation:Number(v)>=100000?'compact':'standard',maximumFractionDigits:1}).format(Number(v||0));
  const list=(v)=>{if(Array.isArray(v))return v;try{return JSON.parse(v||'[]')}catch{return[]}};
  let offset=0,loading=false,timer;

  function words(){const ja=window.LoRAHuntLocale?.get?.()==='ja';return ja?{title:'LoRAファイル',repo:'親リポジトリ',base:'ベースモデル',trigger:'Trigger',weight:'推奨Weight',rank:'Rank / Alpha',size:'サイズ',signals:'親repoの人気',examples:'作例あり',enriched:'詳細解析済み',open:'HFでファイルを見る',detail:'repo詳細',more:'さらに表示',empty:'ファイル単位では一致なし'}:{title:'LoRA files',repo:'Repository',base:'Base model',trigger:'Trigger words',weight:'Recommended weight',rank:'Rank / Alpha',size:'File size',signals:'Repository signals',examples:'Example images',enriched:'Metadata enriched',open:'Open file on HF',detail:'Repository details',more:'Load more files',empty:'No file-level matches yet'};}

  function host(){let h=$('#resource-results');if(h)return h;const models=$('#model-list');if(!models)return null;h=document.createElement('section');h.id='resource-results';h.className='lh-resources';models.parentNode.insertBefore(h,models);return h;}
  function params(){const p=typeof apiParams==='function'?apiParams():new URLSearchParams();p.set('limit','24');p.set('offset',String(offset));const base=$('#base-model-query');if(base?.value)p.set('baseModel',base.value);return p;}

  function card(r){
    const t=words(),triggers=list(r.trigger_words).slice(0,6),targets=list(r.target_modules).slice(0,6);
    const weight=r.recommended_weight_min==null?'—':Number(r.recommended_weight_min)===Number(r.recommended_weight_max)?String(r.recommended_weight_min):`${r.recommended_weight_min}–${r.recommended_weight_max}`;
    const rank=r.lora_rank?`r${r.lora_rank}${r.alpha?` / α${r.alpha}`:''}`:'—';
    const size=r.size_mb?`${num(r.size_mb)} MB`:'—';
    return `<article class="lh-resource-card"><div class="lh-resource-top"><div><span class="lh-resource-path">${esc(r.path)}</span><h3>${esc(r.filename)}</h3><p>${t.repo}: <a href="/lora/${esc(r.repo_slug)}/">${esc(r.author)}/${esc(r.repo_name)}</a></p></div><div class="lh-resource-badges">${r.enriched_at?`<span>${t.enriched}</span>`:''}${Number(r.has_examples)?`<span>${t.examples}</span>`:''}<span>${esc(r.format)}</span></div></div><div class="lh-resource-base"><span>${t.base}</span><strong>${esc(r.base_model||'Unknown base')}</strong></div><div class="lh-resource-grid"><div><span>${t.trigger}</span><strong>${triggers.length?triggers.map(esc).join(', '):'—'}</strong></div><div><span>${t.weight}</span><strong>${esc(weight)}</strong></div><div><span>${t.rank}</span><strong>${esc(rank)}</strong></div><div><span>${t.size}</span><strong>${esc(size)}</strong></div></div>${targets.length?`<div class="lh-targets">${targets.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}<div class="lh-resource-foot"><span>${t.signals}: <b>↓ ${num(r.downloads)}</b> · ♥ ${num(r.likes)}</span><div><a class="outline-button" href="/lora/${esc(r.repo_slug)}/">${t.detail}</a><a class="primary-button" href="${esc(r.source_url)}" target="_blank" rel="noreferrer">${t.open}</a></div></div></article>`;
  }

  async function load(append=false){
    if(loading)return;if(!append)offset=0;const h=host();if(!h)return;loading=true;if(!append)h.innerHTML='<div class="lh-resource-loading">Searching individual LoRA files…</div>';
    try{const res=await fetch(`/api/resources?${params().toString()}`,{headers:{Accept:'application/json'}});if(!res.ok)throw new Error();const data=await res.json(),items=Array.isArray(data.resources)?data.resources:[],t=words(),cards=items.map(card).join('');if(!append)h.innerHTML=`<div class="lh-resource-head"><div><p class="panel-label">FILE INDEX</p><h2>${t.title} <span>${num(data.total)}</span></h2></div><p>Filename, nested path, base model, trigger words and extracted metadata.</p></div><div class="lh-resource-list">${cards||`<div class="lh-resource-empty">${t.empty}</div>`}</div><div class="lh-resource-more"></div>`;else $('.lh-resource-list',h)?.insertAdjacentHTML('beforeend',cards);offset+=items.length;const more=$('.lh-resource-more',h);if(more)more.innerHTML=offset<Number(data.total||0)?`<button class="outline-button" id="lh-resource-more" type="button">${t.more}</button>`:'';$('#lh-resource-more')?.addEventListener('click',()=>load(true));}catch{if(!append)h.innerHTML='';}finally{loading=false;}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>load(false),220);}
  document.addEventListener('DOMContentLoaded',()=>{load(false);$('#quick-search-form')?.addEventListener('submit',()=>setTimeout(schedule,0));$('#filter-form')?.addEventListener('change',schedule);$('#filter-form')?.addEventListener('input',schedule);$('#sort')?.addEventListener('change',schedule);$('#reset-filters')?.addEventListener('click',()=>setTimeout(schedule,0));document.querySelectorAll('[data-query]').forEach(b=>b.addEventListener('click',()=>setTimeout(schedule,0)));document.addEventListener('change',e=>{if(e.target?.id==='lh-locale')setTimeout(()=>load(false),0)});});
})();
