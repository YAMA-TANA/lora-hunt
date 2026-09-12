(() => {
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
  });
})();
