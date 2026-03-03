# sutte

マルイカ釣りに使うスッテの情報を、GitHubで管理しつつGitHub Pagesで閲覧するための静的サイトです。

<br>
https://takamitsu-iida.github.io/sutte/
<br>


## データの管理

- 一覧データ: `static/data/sutte.json`
- 画像: `static/img/` に保存し、JSONの `image` に `./static/img/xxx.jpg` のように書きます

GitHub Pagesは静的ホスティングのため、ページ上から直接GitHubへ保存はできません（認証・API連携が必要です）。
編集はGitHub上で `static/data/sutte.json` を更新してコミット（またはPR）してください。

## ブラウザ上で編集して保存（画像アップロード対応）

GitHub Pages上の `./admin/` は Decap CMS の管理画面です。
ここから `static/data/sutte.json` の編集と、画像のアップロード（`static/img/uploads` へ保存）を行い、GitHubへコミットできます。

ただし、GitHub OAuth は「client secret」を安全に保持するサーバが必要なため、OAuthプロバイダを別途デプロイします。

<br>

### 手順（Cloudflare Worker想定）

Cloudflare (githubアカウントでログイン)

- https://www.cloudflare.com/ja-jp/developer-platform/products/workers/


1. Cloudflare ダッシュボード
2. Workers & Pages
3. Create application
4. Create Worker
5. Start with Hello World!
6. Worker 名を sutte-oauth にする

作成したらEdit codeを開き、中身をworker.jsの内容で丸ごと置き換え

Settingsの「Variables and Secrets」を追加

- 変数名 GITHUB_CLIENT_ID
- 変数名 GITHUB_CLIENT_SECRET

値はそれぞれGithubのページからコピーする

<br><br>

GitHubで (githubアカウントでログイン)

Settings　（レポジトリではなくアカウントのSettings）

Developer settings　（左の一番下）

OAuth Apps　（左側メニュー）

- Homepage URL: `https://takamitsu-iida.github.io/sutte/`

- Authorization callback URL: `https://sutte-oauth.takamitsu-iida.workers.dev/callback`


#### トラブルシュート

- `.../auth?...` が `404` の場合: そのURLにOAuthプロバイダがデプロイされていません（別のWorker/サイト配信が動いている可能性があります）。
- 期待される挙動: `https://<worker>/` は `{"ok": true, ...}` のJSON、`https://<worker>/auth?...` は GitHub の認可画面へ `302` リダイレクトします。

よくある原因:

- Worker 名（`wrangler.toml` の `name`）が、別用途の Worker/配信と衝突している
	- この場合、`https://<name>.<account>.workers.dev/` にアクセスすると JSON ではなく HTML が返ってきます（＝OAuth Worker ではない）
	- 対策: OAuth 用 Worker を別名（例: `sutte-oauth`）でデプロイし、Decap CMS の `base_url` をそのURLへ変更します

これで `https://<GitHub Pages>/admin/` からログインし、データ編集＋画像アップロード→GitHubへ保存ができるようになります。