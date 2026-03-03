# sutte

マルイカ釣りに使うスッテの情報を、GitHubで管理しつつGitHub Pagesで閲覧するための静的サイトです。

<br>
https://takamitsu-iida.github.io/sutte/
<br>


## データの管理

- 一覧データ: `static/data/sutte.json`
- 画像: `static/img/uploads/` に保存し、JSON の `image` には `static/img/uploads/xxx.jpg` のように入ります（Decap CMS でアップロードすると自動で設定されます）

GitHub Pagesは静的ホスティングのため、ページ上から直接GitHubへ保存はできません（認証・API連携が必要です）。
編集はGitHub上で `static/data/sutte.json` を更新してコミット（またはPR）してください。

## ブラウザ上で編集して保存（画像アップロード対応）

GitHub Pages上の `./admin/` は Decap CMS の管理画面です。
ここから `static/data/sutte.json` の編集と、画像のアップロード（`static/img/uploads` へ保存）を行い、GitHubへコミットできます。

### 管理画面の使い方（編集・画像アップロード）

1. `https://takamitsu-iida.github.io/sutte/admin/` を開く
2. **Login with GitHub** でログイン
3. 左メニューの **スッテ** → **一覧** を開く
4. `items` の **Add** でスッテを追加、または既存行を開いて編集
5. **画像** フィールドで画像を選ぶ（アップロードされ `static/img/uploads/` に保存されます）
6. 右上の **Save** → **Publish**

※このリポジトリは `publish_mode: simple` のため、保存すると PR を作らず `main` ブランチへ直接コミットされます。

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
