# sutte

マルイカ釣りに使うスッテの情報を、GitHubで管理しつつGitHub Pagesで閲覧するための静的サイトです。

## データの管理

- 一覧データ: `static/data/sutte.json`
- 画像: `static/img/` に保存し、JSONの `image` に `./static/img/xxx.jpg` のように書きます

GitHub Pagesは静的ホスティングのため、ページ上から直接GitHubへ保存はできません（認証・API連携が必要です）。
編集はGitHub上で `static/data/sutte.json` を更新してコミット（またはPR）してください。

## ブラウザ上で編集して保存（画像アップロード対応）

GitHub Pages上の `./admin/` は Decap CMS の管理画面です。
ここから `static/data/sutte.json` の編集と、画像のアップロード（`static/img/uploads` へ保存）を行い、GitHubへコミットできます。

ただし、GitHub OAuth は「client secret」を安全に保持するサーバが必要なため、OAuthプロバイダを別途デプロイします。

### 手順（Cloudflare Worker想定）

1) GitHubで OAuth App を作成
- Homepage URL: GitHub PagesのURL
- Authorization callback URL: `https://<あなたのWorkerドメイン>/callback`

2) OAuthプロバイダをデプロイ
- このリポジトリの `oauth-provider/` を Cloudflare Workers にデプロイします
- `wrangler.toml` を使う場合の例:
	- `cd oauth-provider`
	- `wrangler deploy`
	- `wrangler secret put GITHUB_CLIENT_ID`
	- `wrangler secret put GITHUB_CLIENT_SECRET`

3) 管理画面設定を更新
- `admin/config.yml` の `backend.base_url` を Worker の URL に置き換えます
	- 例: `https://sutte-decap-oauth.<your-subdomain>.workers.dev`

これで `https://<GitHub Pages>/admin/` からログインし、データ編集＋画像アップロード→GitHubへ保存ができるようになります。