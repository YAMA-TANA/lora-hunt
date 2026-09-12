(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const saved = localStorage.getItem('lora-hunt-locale');
  let locale = saved === 'ja' ? 'ja' : 'en';
  window.LoRAHuntLocale = { get: () => locale };

  const copy = {
    en: {
      filters:'FILTERS', matches:'MATCHES', sort:'Sort by', empty:'No LoRAs match those constraints.', emptyHelp:'Try widening one filter, or search by the exact base model.', reset:'Reset filters', loadMore:'Load more',
      searchPlaceholder:'Try: Japanese roleplay model / FLUX.1-dev anime style', searchButton:'Search LoRAs', heading:'Narrow the catalog', searchPill:'Search LoRAs in plain language',
      intro:'Search by purpose, exact base model, popularity, compatibility, and real-world usage signals.', more:'More filters', author:'Author', minDl:'Minimum downloads', minLikes:'Minimum likes', maxRank:'Maximum LoRA rank', updated:'Updated', baseModel:'Base model',
      reviewTitle:'How did this LoRA perform?', reviewSubmit:'Publish review', review1:'1. Rate the result', review2:'2. Record your setup', openHF:'Open on Hugging Face ↗', writeReview:'Write a review', compatibility:'Compatibility reports', community:'Community rating', live:'Live Hub match',
      back:'← Back to LoRA search', similar:'Find similar LoRAs'
    },
    ja: {
      filters:'フィルター', matches:'検索結果', sort:'並び順', empty:'条件に一致するLoRAがありません', emptyHelp:'条件を広げるか、ベースモデル名で検索してみてください。', reset:'条件をリセット', loadMore:'さらに読み込む',
      searchPlaceholder:'例：日本語のroleplayモデル / FLUX.1-devのアニメ画風', searchButton:'LoRAを検索', heading:'検索条件', searchPill:'自然な言葉でLoRAを検索',
      intro:'用途・正確なベースモデル・人気・互換性・実使用情報からLoRAを探せます。', more:'さらに絞り込む', author:'作者', minDl:'最低ダウンロード数', minLikes:'最低Likes', maxRank:'最大LoRA rank', updated:'更新日', baseModel:'ベースモデル',
      reviewTitle:'このLoRA、実際どうでした？', reviewSubmit:'レビューを投稿', review1:'1. 結果を評価', review2:'2. 使用条件', openHF:'Hugging Faceで見る ↗', writeReview:'レビューを書く', compatibility:'互換性レポート', community:'コミュニティ評価', live:'HFから追加発見',
      back:'← LoRA検索へ戻る', similar:'似たLoRAを探す'
    }
  };

  function setText(selector, value, root=document){ const el=$(selector,root); if(el) el.textContent=value; }
  function apply(){
    const t=copy[locale];
    document.documentElement.lang=locale;
    const picker=$('#lh-locale'); if(picker) picker.value=locale;

    setText('.filter-heading .panel-label',t.filters); setText('.results-toolbar .panel-label',t.matches); setText('.sort-label',t.sort);
    setText('#empty-state .empty-title',t.empty); setText('#empty-state p:not(.empty-title)',t.emptyHelp); setText('#empty-reset',t.reset); setText('#lh-load-more',t.loadMore);
    const input=$('#quick-search-input'); if(input) input.placeholder=t.searchPlaceholder;
    setText('#quick-search-form .primary-button',t.searchButton); setText('.filter-heading h2',t.heading); setText('.search-pill-label',t.searchPill); setText('.intro-copy > p',t.intro);
    setText('.lh-advanced summary',t.more);
    const baseLabel=$('label[for="base-model-query"]'); if(baseLabel) baseLabel.textContent=t.baseModel;
    const advancedLabels={Author:t.author,'Minimum downloads':t.minDl,'Minimum likes':t.minLikes,'Maximum LoRA rank':t.maxRank,Updated:t.updated};
    $$('.lh-advanced .field-label').forEach((el)=>{ const en=el.dataset.en || el.textContent.trim(); el.dataset.en=en; if(advancedLabels[en]) el.textContent=advancedLabels[en]; });

    const fieldNames=locale==='ja'?{'Base family':'ベースモデル系統','Type':'種類','Purpose':'用途','Rating':'評価','Size':'ファイルサイズ','License':'ライセンス'}:{};
    $$('#filter-form > .field-label').forEach((el)=>{ const en=el.dataset.en || el.textContent.trim(); el.dataset.en=en; el.textContent=fieldNames[en] || en; });
    const chipJa={Coding:'コーディング',Japanese:'日本語',Reasoning:'推論',Roleplay:'ロールプレイ',Character:'キャラクター',Style:'スタイル',Motion:'モーション'};
    $$('.check-chip').forEach((label)=>{ const i=$('input',label), s=$('span',label); if(i&&s) s.textContent=locale==='ja'?(chipJa[i.value]||i.value):i.value; });

    const review=$('#review-dialog');
    if(review){
      setText('#review-title',t.reviewTitle,review); setText('button[type=submit]',t.reviewSubmit,review);
      const sections=$$('.lh-review-section strong',review); if(sections[0]) sections[0].textContent=t.review1; if(sections[1]) sections[1].textContent=t.review2;
    }

    $$('.model-card').forEach((card)=>{
      setText('.card-actions a',t.openHF,card); setText('.review-trigger.primary-button',t.writeReview,card); setText('.score-copy strong',t.community,card); setText('.evidence-section h3',t.compatibility,card);
      const live=$('.lh-live-badge',card); if(live) live.textContent=t.live;
      const base=$('.lh-base-line span',card); if(base) base.textContent=t.baseModel;
    });

    setText('.detail-back',t.back); setText('.detail-actions .primary-button',t.openHF); setText('.detail-actions .outline-button',t.similar);
    $$('.detail-facts > div').forEach((item)=>{ const label=$('span',item); if(!label)return; const en=label.dataset.en || label.textContent.trim(); label.dataset.en=en; const ja={'Base model':'ベースモデル','Best for':'主な用途','File':'ファイル','Downloads':'ダウンロード','Likes':'Likes'}; label.textContent=locale==='ja'?(ja[en]||en):en; });
  }

  function addPicker(){
    const nav=$('.header-nav'); if(!nav||$('#lh-locale')) return;
    const select=document.createElement('select'); select.id='lh-locale'; select.className='lh-locale'; select.setAttribute('aria-label','Language');
    select.innerHTML='<option value="en">English</option><option value="ja">日本語</option>';
    select.value=locale; select.addEventListener('change',()=>{ locale=select.value==='ja'?'ja':'en'; localStorage.setItem('lora-hunt-locale',locale); apply(); });
    nav.prepend(select);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    addPicker(); apply();
    const host=$('#model-list'); if(host) new MutationObserver(()=>queueMicrotask(apply)).observe(host,{childList:true});
  });
})();
