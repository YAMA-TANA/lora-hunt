(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const dialog = document.querySelector('#review-dialog');
    if (!dialog) return;
    const q = (selector) => dialog.querySelector(selector);
    const title = q('#review-title'); if (title) title.textContent = 'このLoRA、実際どうでした？';
    const kicker = q('.panel-label'); if (kicker) kicker.textContent = 'コミュニティレビュー';
    const lede = q('#review-model-name'); if (lede) lede.textContent = '評価だけでなく、実際に使った条件も残すと他の人が再現しやすくなります。';

    const names = {
      'Overall':'総合評価', 'Output quality':'出力品質', 'Matches description':'説明どおりか',
      'Ease of use':'導入しやすさ', 'Documentation':'ドキュメント', 'Base model':'実際に使ったベースモデル',
      'Runtime':'実行環境', 'Quantization':'量子化', 'LoRA strength':'LoRA強度', 'Hardware':'ハードウェア', 'Note':'使用メモ'
    };
    dialog.querySelectorAll('label').forEach((label) => {
      const node = [...label.childNodes].find((item) => item.nodeType === Node.TEXT_NODE && item.textContent.trim());
      if (node && names[node.textContent.trim()]) node.textContent = names[node.textContent.trim()];
    });

    const rating = q('.rating-grid');
    if (rating) rating.insertAdjacentHTML('beforebegin', '<div class="lh-review-section"><strong>1. 結果を評価</strong><span>実際の出力を5段階で評価してください。</span></div>');
    const conditions = q('.condition-grid');
    if (conditions) conditions.insertAdjacentHTML('beforebegin', '<div class="lh-review-section"><strong>2. 使用条件</strong><span>分かる範囲だけでOKです。再現性のための情報です。</span></div>');

    const submit = q('button[type=submit]'); if (submit) submit.textContent = 'レビューを投稿';
    const base = q('input[name=baseModel]'); if (base) base.placeholder = '例：Qwen/Qwen3-8B';
    const runtime = q('input[name=runtime]'); if (runtime) runtime.placeholder = '例：ComfyUI / llama.cpp / diffusers';
    const hardware = q('input[name=hardware]'); if (hardware) hardware.placeholder = '例：RTX 3070 Ti 8GB';
    const note = q('textarea[name=note]'); if (note) note.placeholder = '良かった点、崩れやすい条件、推奨設定など';
  });
})();
