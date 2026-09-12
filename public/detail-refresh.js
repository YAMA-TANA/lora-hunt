(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const facts = document.querySelector('.detail-facts');
    if (!facts) return;

    const labels = {
      'Base model':'ベースモデル', 'Best for':'主な用途', 'LoRA rank':'LoRA rank', 'File':'ファイル',
      'Downloads':'Downloads', 'Likes':'Likes'
    };
    facts.querySelectorAll(':scope > div').forEach((item) => {
      const label = item.querySelector('span');
      const value = item.querySelector('strong');
      if (!label) return;
      const original = label.textContent.trim();
      if (labels[original]) label.textContent = labels[original];
      if (original === 'Base model' || original === 'Best for') item.classList.add('lh-wide');
      if (original === 'Downloads' || original === 'Likes') item.classList.add('lh-signal');
      if (value && value.textContent.trim() === 'Not listed') value.textContent = '情報なし';
      if (value && value.textContent.trim() === 'Size n/a') value.textContent = '情報なし';
    });

    const back = document.querySelector('.detail-back');
    if (back) back.textContent = '← LoRA検索へ戻る';
    const primary = document.querySelector('.detail-actions .primary-button');
    if (primary) primary.textContent = 'Hugging Faceで見る ↗';
    const secondary = document.querySelector('.detail-actions .outline-button');
    if (secondary) secondary.textContent = '似たLoRAを探す';

    document.querySelectorAll('.detail-section .panel-label').forEach((label) => {
      if (label.textContent.trim() === 'COMPATIBILITY') label.textContent = '互換性';
      if (label.textContent.trim() === 'USE IT WELL') label.textContent = '使う前に確認';
    });
    document.querySelectorAll('.detail-section h2').forEach((heading) => {
      if (heading.textContent.includes('Where it has been tried')) heading.textContent = 'どの環境で動いた？';
      if (heading.textContent.includes('What to check next')) heading.textContent = '使う前に見るポイント';
    });

    const score = document.querySelector('.detail-score .panel-label');
    if (score) score.textContent = 'コミュニティ評価';
    const author = document.querySelector('.detail-author');
    if (author) author.textContent = author.textContent.replace('updated ', '更新 ');
  });
})();
