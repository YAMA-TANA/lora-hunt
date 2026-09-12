DELETE FROM models
WHERE id IN (
  'demo/qwen3-japanese-coding',
  'demo/llama3-jp-reasoning',
  'demo/gemma-roleplay-ja',
  'demo/flux-ink-line',
  'demo/wan-motion-soft',
  'demo/ltx-motion-detail',
  'demo/sdxl-anime-character',
  'demo/music-texture-v1'
);
