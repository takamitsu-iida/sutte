# sutte

マルイカ釣りに使うスッテの情報を、GitHubで管理しつつGitHub Pagesで閲覧するための静的サイトです。

## データの管理

- 一覧データ: `static/data/sutte.json`
- 画像: `static/img/` に保存し、JSONの `image` に `./static/img/xxx.jpg` のように書きます

GitHub Pagesは静的ホスティングのため、ページ上から直接GitHubへ保存はできません（認証・API連携が必要です）。
編集はGitHub上で `static/data/sutte.json` を更新してコミット（またはPR）してください。