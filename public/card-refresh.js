(() => {
  const number = (value) => new Intl.NumberFormat('en-US', { notation: Number(value) >= 100000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(Number(value || 0));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function decorateCards() {
    if (typeof state === 'undefined') return;
    document.querySelectorAll('.model-card').forEach((card) => {
      const model = state.models.find((item) => String(item.id) === String(card.dataset.modelId));
      if (!model) return;

      const title = card.querySelector('.model-title');
      if (title && !card.querySelector('.lh-base-line')) {
        title.insertAdjacentHTML('afterend', `<div class="lh-base-line"><span>Base model</span><strong>${esc(model.base_model || 'Unknown base')}</strong></div>`);
      }

      const description = card.querySelector('.model-description');
      if (description && !card.querySelector('.lh-purpose-row')) {
        const purposes = String(model.purpose || 'General').split(',').map((x) => x.trim()).filter(Boolean);
        description.insertAdjacentHTML('afterend', `<div class="lh-purpose-row">${purposes.map((p) => `<span class="lh-purpose">${esc(p)}</span>`).join('')}</div>`);
      }

      const meta = card.querySelector('.model-meta');
      if (meta) meta.hidden = true;
      const data = card.querySelector('.data-line');
      if (data) data.hidden = true;

      const main = card.querySelector('.model-main');
      if (main && !card.querySelector('.lh-card-metrics')) {
        const size = model.file_size_mb ? `${number(model.file_size_mb)} MB` : 'Not indexed';
        const rank = model.lora_rank ? `r${model.lora_rank}` : 'Not listed';
        main.insertAdjacentHTML('beforeend', `<div class="lh-card-metrics"><div class="lh-card-metric is-signal"><span>Downloads</span><strong>${number(model.downloads)}</strong></div><div class="lh-card-metric is-signal"><span>Likes</span><strong>${number(model.likes)}</strong></div><div class="lh-card-metric"><span>LoRA rank</span><strong>${esc(rank)}</strong></div><div class="lh-card-metric"><span>File size</span><strong>${esc(size)}</strong></div></div>`);
      }

      const hf = card.querySelector('.card-actions a');
      if (hf) hf.textContent = 'Open on Hugging Face ↗';
      const review = card.querySelector('.review-trigger.primary-button');
      if (review) review.textContent = 'Write a review';
      const evidence = card.querySelector('.score-copy strong');
      if (evidence) evidence.textContent = 'Community rating';
      const works = card.querySelector('.evidence-section h3');
      if (works) works.textContent = 'Compatibility reports';

      if (model.source === 'hub-live') {
        const link = card.querySelector('.model-title a');
        if (link) { link.href = model.hf_url; link.target = '_blank'; link.rel = 'noreferrer'; }
        if (review) review.remove();
        const badges = card.querySelector('.card-topline');
        if (badges && !card.querySelector('.lh-live-badge')) badges.insertAdjacentHTML('beforeend', '<span class="type-badge lh-live-badge">Live Hub match</span>');
        const score = card.querySelector('.evidence-column');
        if (score) score.innerHTML = '<div class="evidence-section"><h3>Discovered live on Hugging Face</h3><p class="evidence-note">This LoRA is not in the local index yet. Verify files, license, trigger words, and usage details on the source model card.</p></div>';
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
