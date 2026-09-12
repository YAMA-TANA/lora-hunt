(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const text = (selector, value) => { const el = document.querySelector(selector); if (el) el.textContent = value; };
    text('.filter-heading .panel-label', 'フィルター');
    text('.results-toolbar .panel-label', '検索結果');
    text('.sort-label', '並び順');
    text('#empty-state .empty-title', '条件に一致するLoRAがありません');
    text('#empty-state p:not(.empty-title)', '条件を少し広げるか、ベースモデル名で検索してみてください。');
    text('#empty-reset', '条件をリセット');

    const fieldNames = { 'Base family':'ベースモデル系統', 'Type':'種類', 'Purpose':'用途', 'Rating':'評価', 'Size':'ファイルサイズ', 'License':'ライセンス' };
    document.querySelectorAll('#filter-form .field-label').forEach((el) => {
      const key = el.textContent.trim(); if (fieldNames[key]) el.textContent = fieldNames[key];
    });
    const chipNames = { Coding:'コーディング', Japanese:'日本語', Reasoning:'推論', Roleplay:'ロールプレイ', Character:'キャラクター', Style:'スタイル', Motion:'モーション' };
    document.querySelectorAll('.check-chip').forEach((label) => {
      const input = label.querySelector('input'); const span = label.querySelector('span');
      if (input && span && chipNames[input.value]) span.textContent = chipNames[input.value];
    });

    const replacements = {
      'All families':'すべて', 'All types':'すべて', 'Any':'指定なし', 'Any license':'指定なし',
      'Commercial-friendly':'商用利用しやすい', 'Open source':'オープン系', '4.5 and up':'4.5以上',
      '4.0 and up':'4.0以上', '3.0 and up':'3.0以上'
    };
    document.querySelectorAll('#filter-form option').forEach((option) => {
      const key = option.textContent.trim(); if (replacements[key]) option.textContent = replacements[key];
    });

    document.querySelectorAll('.switch-row').forEach((row) => {
      const input = row.querySelector('input'); const span = row.querySelector('span:last-child');
      if (!input || !span) return;
      if (input.name === 'compatible') span.textContent = 'Qwen3-8B互換のみ';
      if (input.name === 'safetensors') span.textContent = 'safetensorsあり';
      if (input.name === 'docs') span.textContent = 'ドキュメント品質 4以上';
    });
  });
})();
