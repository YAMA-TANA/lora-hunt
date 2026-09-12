# LoRA Hunt

Hugging Face の LoRA / PEFT adapter を、用途・互換性・実使用条件で探して比較するための小さな検索サイトです。

Live: https://lora-hunt.info/

## Included

- モデル一覧、用途別フィルター、互換性フィルター、ランキング用のURLプリセット
- D1 によるモデル、レビュー、Works / Doesn't work 投票の保存
- Clerk のセッションJWT検証を使ったレビュー・投票API
- Hugging Face Hub API からの管理者同期API（`POST /api/sync`）
- 用途別のHub候補を詳細化してD1へ初期投入する同期スクリプト（`npm run sync:hf`）
- LoRAと分離したデータセット検索インデックス（`datasets` テーブル / `GET /api/datasets`）
- Google Analytics（`G-YZ8R7GTWQR`）、robots.txt、sitemap.xml、IndexNow key file

初期表示には、プロダクトの操作確認用に明示的な demo seed データを入れています。実在モデルの最新値としては扱わず、管理者同期でHubデータを追加してください。

`npm run sync:hf` はHugging Faceの公開Hub APIからモデルカード、adapter_config、README、ファイル一覧を取得し、重み本体を保存せずにD1の検索インデックスを更新します。NSFWを含むHub公開候補も除外せず、content warningを付けて検索できます。データセットは別テーブルとして同期されます。`HF_TOKEN`を環境変数に設定すると、利用可能な公開メタデータの取得上限を広げられます。

## Local development

```bash
npm install
npx wrangler pages dev public --d1=DB=lora-hunt-db --local
```

## Cloudflare Pages / secrets

Cloudflare Pages project: `lora-hunt`

- D1 database: `lora-hunt-db`
- `HF_TOKEN`: 登録済み（Pages production secret）
- Clerk のキーは環境ごとに設定してください。公開キーは `wrangler.jsonc` の `CLERK_PUBLISHABLE_KEY` またはPages Variables、署名検証用の `CLERK_JWT_KEY` はPages Secretに入れます。

```bash
npx wrangler pages secret put CLERK_JWT_KEY --project-name=lora-hunt
npx wrangler pages secret put CLERK_SECRET_KEY --project-name=lora-hunt
npx wrangler pages deploy public --project-name=lora-hunt --branch=main
```

Clerk の publishable key が設定されるまで、画面は公開検索モードで動き、レビュー・投票ボタンはログイン設定案内を表示します。
