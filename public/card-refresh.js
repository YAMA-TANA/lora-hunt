(() => {
  const labelMap = { 'Base':'ベース', 'Best for':'用途', 'Rank':'LoRA rank', 'Files':'ファイル' };
  function decorateCards() {
    if (typeof state === 'undefined') return;
    document.querySelectorAll('.model-card').forEach((card) => {
      const model = state.models.find((item) => String(item.id) === String(card.dataset.modelId));
      if (!model) return;

      card.querySelectorAll('.model-meta strong').forEach((label) => {
        const key = label.textContent.trim();
        if (labelMap[key]) label.textContent = labelMap[key];
      });

      const hf = card.querySelector('.card-actions a');
      if (hf) hf.textContent = 'Hugging Faceで見る ↗';
      const review = card.querySelector('.review-trigger.primary-button');
      if (review) review.textContent = 'レビューを書く';
      const evidence = card.querySelector('.score-copy strong');
      if (evidence) evidence.textContent = 'コミュニティ評価';
      const works = card.querySelector('.evidence-section h3');
      if (works) works.textContent = '互換性レポート';

      if (model.source === 'hub-live') {
        const title = card.querySelector('.model-title a');
        if (title) {
          title.href = model.hf_url;
          title.target = '_blank';
          title.rel = 'noreferrer';
        }
        if (review) review.remove();
        if (!card.querySelector('.lh-live-badge')) {
          const badges = card.querySelector('.card-topline');
          if (badges) badges.insertAdjacentHTML('beforeend', '<span class="type-badge lh-live-badge">HFから追加発見</span>');
        }
        const score = card.querySelector('.evidence-column');
        if (score) score.innerHTML = '<div class="evidence-section"><h3>Hugging Faceライブ検索</h3><p class="evidence-note">まだLoRA Huntには未収録です。詳細・ライセンス・ファイルは元のモデルカードで確認してください。</p></div>';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const host = document.querySelector('#model-list');
    if (!host) return;
    decorateCards();
    new MutationObserver(decorateCards).observe(host, { childList: true });
  });
})();
