(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const num = (v) => new Intl.NumberFormat('en-US', {notation:Number(v)>=100000?'compact':'standard', maximumFractionDigits:1}).format(Number(v||0));

  function expandBaseFamilies(){
    const select=$('#base-family');
    if(!select) return;
    ['Mistral','SDXL','Illustrious','Pony'].forEach((value)=>{
      if(![...select.options].some((option)=>option.value===value||option.textContent===value)) select.add(new Option(value,value), Math.max(1,select.options.length-1));
    });
  }

  function addBaseModelFilter(){
    const form=$('#filter-form');
    if(!form||$('#base-model-query',form)) return;
    const family=$('#base-family');
    if(!family) return;
    const oldCompat=$('#compatible-only')?.closest('.switch-row');
    if(oldCompat) oldCompat.remove();
    family.insertAdjacentHTML('afterend', '<label class="field-label" for="base-model-query">Base model</label><input class="field-control" id="base-model-query" name="compatible" placeholder="e.g. black-forest-labs/FLUX.1-dev">');
  }

  function addAdvancedFilters(){
    const form=$('#filter-form');
    if(!form||$('.lh-advanced',form)) return;
    form.insertAdjacentHTML('beforeend', `<details class="lh-advanced"><summary>More filters</summary><div class="lh-advanced-grid"><label class="lh-wide"><span class="field-label">Author</span><input class="field-control" name="author" placeholder="e.g. ostris"></label><label><span class="field-label">Minimum downloads</span><select class="field-control" name="minDownloads"><option value="">Any</option><option value="100">100+</option><option value="1000">1,000+</option><option value="10000">10,000+</option><option value="100000">100,000+</option></select></label><label><span class="field-label">Minimum likes</span><select class="field-control" name="minLikes"><option value="">Any</option><option value="10">10+</option><option value="100">100+</option><option value="1000">1,000+</option></select></label><label><span class="field-label">Maximum LoRA rank</span><select class="field-control" name="maxRank"><option value="">Any</option><option value="4">r4 or lower</option><option value="8">r8 or lower</option><option value="16">r16 or lower</option><option value="32">r32 or lower</option><option value="64">r64 or lower</option></select></label><label><span class="field-label">Updated</span><select class="field-control" name="updatedDays"><option value="">Any time</option><option value="7">Past 7 days</option><option value="30">Past 30 days</option><option value="90">Past 90 days</option><option value="365">Past year</option></select></label></div><div class="lh-query-guide">Natural-language search works too: <code>Japanese roleplay model</code>, <code>Qwen coding LoRA</code>, or even Japanese text.</div></details>`);
  }

  function addLoadMore(){
    const list=$('#model-list');
    if(!list||$('#lh-load-more')) return;
    const button=document.createElement('button');
    button.id='lh-load-more'; button.className='outline-button lh-load-more'; button.type='button'; button.textContent='Load more'; button.hidden=true;
    list.insertAdjacentElement('afterend',button);
  }

  function updateLoadMore(){
    const button=$('#lh-load-more');
    if(!button) return;
    button.hidden = !state._indexedTotal || state._indexedLoaded >= state._indexedTotal;
    button.disabled = false;
    delete button.dataset.state;
  }

  function polishEnglish(){
    const title=$('#page-title'); if(title) title.innerHTML='Find the LoRA<br><span>that actually fits.</span>';
    const intro=$('.intro-copy > p'); if(intro) intro.textContent='Search by purpose, exact base model, popularity, compatibility, and real-world usage signals.';
    const input=$('#quick-search-input'); if(input) input.placeholder='Try: Japanese roleplay model / FLUX.1-dev anime style';
    const button=$('#quick-search-form .primary-button'); if(button) button.textContent='Search LoRAs';
    const heading=$('.filter-heading h2'); if(heading) heading.textContent='Narrow the catalog';
    const pill=$('.search-pill-label'); if(pill) pill.textContent='Search LoRAs in plain language';
    const reset=$('#reset-filters'); if(reset) reset.textContent='Reset';
    const tray=$('.search-tray-foot'); if(tray&&!$('.lh-search-help',tray)) tray.insertAdjacentHTML('beforeend','<span class="lh-search-help"><strong>Natural language:</strong> English and Japanese queries are both understood.</span>');
    const sort=$('#sort');
    if(sort){
      const labels={fit:'Best fit',rating:'Highest rated',downloads:'Most downloaded',updated:'Recently updated'};
      [...sort.options].forEach(o=>{if(labels[o.value])o.textContent=labels[o.value]});
      [['likes','Most liked'],['reviews','Most reviewed'],['smallest','Smallest files'],['rank','Lowest LoRA rank']].forEach(([v,l])=>{if(![...sort.options].some(o=>o.value===v))sort.add(new Option(l,v))});
    }
  }

  async function loadMore(){
    const button=$('#lh-load-more'); if(!button||button.disabled) return;
    button.disabled=true; button.dataset.state='loading';
    try{
      const params=apiParams(); params.set('limit','50'); params.set('offset',String(state._indexedLoaded||0));
      const response=await fetch(`/api/search?${params.toString()}`,{headers:{Accept:'application/json'}});
      if(!response.ok) throw new Error('search unavailable');
      const payload=await response.json();
      const incoming=(Array.isArray(payload.models)?payload.models:[]).filter((model)=>model.source!=='hub-live');
      const seen=new Set(state.models.map((model)=>String(model.id)));
      const fresh=incoming.filter((model)=>!seen.has(String(model.id)));
      state.models.push(...fresh);
      state._indexedLoaded=(state._indexedLoaded||0)+incoming.length;
      state._indexedTotal=Number(payload.indexedTotal??state._indexedTotal??0);
      state.total=state._indexedTotal+Number(state._liveCount||0);
      render();
      $('#result-count').textContent=num(state.total);
      updateLoadMore();
    } catch {
      button.disabled=false; delete button.dataset.state;
    }
  }

  function install(){
    if(!$('#filter-form')||typeof state==='undefined') return;
    expandBaseFamilies();
    addBaseModelFilter();
    addAdvancedFilters();
    addLoadMore();
    const baseGet=getFilters;
    getFilters=function(){
      const base=baseGet(); const data=new FormData($('#filter-form'));
      return {...base,author:data.get('author')||'',minDownloads:data.get('minDownloads')||'',minLikes:data.get('minLikes')||'',maxRank:data.get('maxRank')||'',updatedDays:data.get('updatedDays')||''};
    };
    const baseRemove=removeFilter;
    removeFilter=function(button){
      if(button?.dataset?.removeFilter==='compatible'){
        const input=$('#base-model-query'); if(input) input.value='';
        syncUrl(); render(); refreshModels({immediate:true}); return;
      }
      return baseRemove(button);
    };
    clientFilter=(models)=>models;
    refreshModels=async function({immediate=false}={}){
      clearTimeout(refreshTimer);
      const run=async()=>{
        try{
          const params=apiParams(); params.set('limit','50'); params.delete('offset');
          const response=await fetch(`/api/search?${params.toString()}`,{headers:{Accept:'application/json'}});
          if(!response.ok) throw new Error('search unavailable');
          const payload=await response.json();
          state.models=Array.isArray(payload.models)?payload.models:[];
          state._indexedLoaded=state.models.filter((model)=>model.source!=='hub-live').length;
          state._indexedTotal=Number(payload.indexedTotal??payload.total??state._indexedLoaded);
          state._liveCount=Number(payload.liveCount||0);
          state.total=Number(payload.total||state.models.length);
          render();
          $('#result-count').textContent=num(state.total);
          if(state.query) $('#results-context').textContent=`${num(state.total)} candidates${payload.liveCount?` · ${payload.liveCount} discovered live from Hugging Face`:''}`;
          updateLoadMore();
        }catch{ render(); updateLoadMore(); }
      };
      if(immediate) await run(); else refreshTimer=setTimeout(run,160);
    };
    $('#lh-load-more')?.addEventListener('click',loadMore);
    refreshModels({immediate:true});
  }

  document.addEventListener('DOMContentLoaded',()=>{polishEnglish();install();});
})();
