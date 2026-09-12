(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const dialog = document.querySelector('#review-dialog');
    if (!dialog) return;
    const q = (selector) => dialog.querySelector(selector);
    const title = q('#review-title'); if (title) title.textContent = 'How did this LoRA perform?';
    const kicker = q('.panel-label'); if (kicker) kicker.textContent = 'COMMUNITY REVIEW';
    const lede = q('#review-model-name'); if (lede) lede.textContent = 'Rate the result and record the actual setup you used so other people can reproduce it.';

    const rating = q('.rating-grid');
    if (rating && !q('.lh-review-section[data-section="rating"]')) rating.insertAdjacentHTML('beforebegin', '<div class="lh-review-section" data-section="rating"><strong>1. Rate the result</strong><span>Give the output a simple 1–5 score.</span></div>');
    const conditions = q('.condition-grid');
    if (conditions && !q('.lh-review-section[data-section="conditions"]')) conditions.insertAdjacentHTML('beforebegin', '<div class="lh-review-section" data-section="conditions"><strong>2. Record your setup</strong><span>Optional, but useful for reproducibility and compatibility reports.</span></div>');

    const submit = q('button[type=submit]'); if (submit) submit.textContent = 'Publish review';
    const base = q('input[name=baseModel]'); if (base) base.placeholder = 'e.g. black-forest-labs/FLUX.1-dev';
    const runtime = q('input[name=runtime]'); if (runtime) runtime.placeholder = 'e.g. ComfyUI / diffusers / llama.cpp';
    const hardware = q('input[name=hardware]'); if (hardware) hardware.placeholder = 'e.g. RTX 4090 24GB';
    const note = q('textarea[name=note]'); if (note) note.placeholder = 'What worked, what broke, recommended settings, trigger words, caveats…';
  });
})();
