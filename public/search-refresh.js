(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const num = (v) => new Intl.NumberFormat('ja-JP', {notation:Number(v)>=100000?'compact':'standard', maximumFractionDigits:1}).format(Number(v||0));

  function addAdvancedFilters(){
    const form=$('#filter-form');
    if(!form||$('.lh-advanced',form)) return;
    form.insertAdjacentHTML('beforeend', `<details class="lh-advanced"><summary>さらに絞り込む</summary><div class="lh-advanced-grid"><label class="lh-wide"><span class="field-label">作者</span><input class="field-control" name="author" placeholder="例: ostris"></label><label><span class="field-label">最低DL数</span><select class="field-control" name="minDownloads"><option value="">指定なし</option><option value="100">100+</option><option value="1000">1,000+</option><option value="10000">10,000+</option><option value="100000">100,000+</option></select></label><label><span class="field-label">最低Likes</span><select class="field-control" name="minLikes"><option value="">指定なし</option><option value="10">10+</option><option value="100">100+</option><option value="1000">1,000+</option></select></label><label><span class="field-label">最大LoRA rank</span><select class="field-control" name="maxRank"><option value="">指定なし</option><option value="4">r4以下</option><option value="8">r8以下</option><option value="16">r16以下</option><option value="32">r32以下</option><option value="64">r64以下</option></select></label><label><span class="field-label">更新日</span><select class="field-control" name="updatedDays"><option value="">指定なし</option><option value="7">7日以内</option><option value="30">30日以内</option><option value="90">90日以内</option><option value="365">1年以内</option></select></label></div><div class="lh-query-guide">「日本語のroleplayモデル」のように文章で検索できます。</div></details>`);
  }

  function translate(){
    const title=$('#page-title'); if(title) title.textContent='条件に合うLoRAを探す。';
    const intro=$('.intro-copy > p'); if(intro) intro.textContent='用途・ベースモデル・人気・互換性までまとめて比較できます。';
    const input=$('#quick-search-input'); if(input) input.placeholder='例：日本語のroleplayモデル / QwenのコーディングLoRA';
    const button=$('#quick-search-form .primary-button'); if(button) button.textContent='検索';
    const heading=$('.filter-heading h2'); if(heading) heading.textContent='絞り込み';
    const pill=$('.search-pill-label'); if(pill) pill.textContent='自然な言葉でLoRAを検索';
    const reset=$('#reset-filters'); if(reset) reset.textContent='リセット';
    const tray=$('.search-tray-foot'); if(tray&&!$('.lh-search-help',tray)) tray.insertAdjacentHTML('beforeend','<span class="lh-search-help"><strong>文章検索OK：</strong> 日本語・英語を混ぜても検索できます</span>');
    const sort=$('#sort');
    if(sort){
      const labels={fit:'おすすめ',rating:'評価が高い',downloads:'ダウンロード数',updated:'更新が新しい'};
      [...sort.options].forEach(o=>{if(labels[o.value])o.textContent=labels[o.value]});
      [['likes','Likesが多い'],['reviews','レビューが多い'],['smallest','軽い順'],['rank','LoRA rankが小さい順']].forEach(([v,l])=>{if(![...sort.options].some(o=>o.value===v))sort.add(new Option(l,v))});
    }
  }

  function install(){
    if(!$('#filter-form')||typeof state==='undefined') return;
    addAdvancedFilters();
    const baseGet=getFilters;
    getFilters=function(){
      const base=baseGet(); const data=new FormData($('#filter-form'));
      return {...base,author:data.get('author')||'',minDownloads:data.get('minDownloads')||'',minLikes:data.get('minLikes')||'',maxRank:data.get('maxRank')||'',updatedDays:data.get('updatedDays')||''};
    };
    clientFilter=(models)=>models;
    refreshModels=async function({immediate=false}={}){
      clearTimeout(refreshTimer);
      const run=async()=>{
        try{
          const response=await fetch(`/api/search?${apiParams().toString()}`,{headers:{Accept:'application/json'}});
          if(!response.ok) throw new Error('search unavailable');
          const payload=await response.json();
          state.models=Array.isArray(payload.models)?payload.models:[];
          state.total=Number(payload.total||state.models.length);
          render();
          $('#result-count').textContent=num(state.total);
          if(state.query) $('#results-context').textContent=`${state.total}件候補${payload.liveCount?` · ${payload.liveCount}件をHugging Faceから追加発見`:''}`;
        }catch{ render(); }
      };
      if(immediate) await run(); else refreshTimer=setTimeout(run,160);
    };
    refreshModels({immediate:true});
  }

  document.addEventListener('DOMContentLoaded',()=>{translate();install();});
})();
