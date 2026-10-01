# 英語読解の気持ちに関するアンケート

日本語母語の英語学習者向けの、HTML・CSS・JavaScriptだけで動く質問紙です。

公開URL：**https://ryuya-dot-com.github.io/Reading_Questionnaire/**

**現在は動作確認用の試作版（preview）です。本調査の参加募集は開始していません。**

- 読解不安：CMC-FLRASを基にした提供ドラフトの日本語23項目。
- 読解の楽しさ：提供ドラフトの新作9項目。妥当性は未検証。
- 注意確認1項目、任意の学習背景、任意の画面・文言へのコメント。
- 同意→背景→6ページの質問→確認→CSV保存。
- パート内のランダム提示、戻る・修正、未選択確認、回答辞退・経験なし。
- 1回答者1行のCSV。UTF-8 BOM、CRLF、引用符処理、自由記述の数式解釈防止。
- 回答完了操作でダウンロードを開始。再保存ボタンも用意。回答者がLMS等に提出します。

## 研究資料

- [文献レビュー・問いと調査設計・検証上の限界](docs/literature-review.md)
- [CSVのコードブックと全項目](docs/codebook.md)
- [実施した検証と未確認事項](docs/validation.md)

このサイトから回答を送信する処理はありません。研究者の端末にCSVが自動で集まる仕組みではありません。GitHub Pagesは静的配信です。LMS等で回収したファイルを機関の保管先で管理してください。回答データ、提供PDF、文献の全文を公開リポジトリに追加しないでください。

## 手元で開く

`site/index.html` をブラウザで開けば動きます。ローカルサーバーを使う場合は：

```sh
python3 -m http.server 8000 --directory site --bind 127.0.0.1
```

ブラウザで `http://127.0.0.1:8000/` を開きます。依存パッケージ、ビルド、APIキーは不要です。

## 本調査用の設定

`site/config.js` を編集します。初期状態は `mode: "preview"` で、試作CSVを `data_mode=preview` として出力します。

1. 研究責任者 `researcher`、所属 `affiliation`、問い合わせ先 `contact` を記入。
2. 実際の研究に即した倫理手続の説明 `ethicsStatement`、保管・利用方針 `retentionStatement`、提出後の撤回方法 `withdrawalStatement` を記入。承認を受けていないのに承認済みと記載しない。
3. 提出先の説明 `submissionInstructions` を確定。任意の `submissionUrl` にHTTPSのLMS・提出フォームURLを設定すると、完了画面にリンクが出ます。
4. 項目・教示・対象者・得点化と文献の利用条件を研究計画と照合。現在は18歳以上の説明・年齢選択肢なので、未成年を対象にする場合は画面や同意手続も変更。
5. 説明文・項目を変更したときは `consentVersion` / `instrumentVersion` を更新。`mode: "live"` に切り替える。必要な設定が空欄の場合、本調査の開始はブロックされます。

氏名を尋ねなくても、LMS提出では提出者が分かる場合があります。完全匿名とは説明していません。回答はページ内のメモリだけに保存し、localStorage・Cookie・アクセス解析・外部フォントは使いません。再読み込みやタブ終了で未保存回答は消えます。配信元GitHubによるアクセス情報の処理は別です。

## GitHub Pagesの公開

`.github/workflows/pages.yml` は `main` へのpushで、テスト後に **siteフォルダだけ** を公開します。GitHubの Settings → Pages → Build and deployment → Source は **GitHub Actions** を使用します。ルートの研究メモ・スクリプトをサイト配信に混ぜない構成です（公開リポジトリ内のドキュメント自体はGitHubで閲覧可能です）。

公開URLにプロジェクト名が含まれていても動くよう、CSS・JSは相対パスです。独自ドメインやサーバー契約は不要です。

## 回収CSVを結合する

個別CSVを `responses/raw/` に置き、入力フォルダ外に出力します。Python 3の標準ライブラリだけを使います。

```sh
python3 scripts/merge_csv.py responses/raw responses/combined.csv
```

試作版の動作確認CSVを結合する場合だけ `--include-preview` を追加します。

```sh
python3 scripts/merge_csv.py responses/raw responses/preview_combined.csv --include-preview
```

完全に同じID・内容の再ダウンロードは重複除去します。同じIDで内容が違う場合や、版・モードが混在する場合は停止します。既存ファイルは上書きしません。このツールはデータの認証、別IDでの重複参加検出、欠測補完や尺度の妥当性検証を行いません。CSV内の得点は取り込み時に再計算することを推奨します。

## CSVと得点の扱い

1〜5の数値と `NA`（経験がなく判断できない）、`SKIP`（回答しない）を区別します。欠測を0や3に変換しません。下位尺度が完全回答のときだけ平均を計算します。不安全体の合計点、検証済みではないenjoyment総得点、低・中・高の分類は生成しません。表示・記録される時間は質問紙への経過時間であって、英文の読解速度ではありません。

UTF-8 BOMを付けると通常のExcelで日本語を扱いやすくなります。地域設定によって列分割されない場合は、Excelの「データ→テキスト/CSVから」で **UTF-8・コンマ区切り** を指定してください。すべてのアプリ・端末での挙動を保証するものではありません。自動ダウンロードが保存の確認画面になるブラウザもあります。

## 検証コマンド

```sh
node --test tests/core.test.cjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

画面テストはPlaywrightとChromeのある環境で、ローカルサーバーの起動後に実行します（サイト自体には不要）。

```sh
node tests/browser.cjs
```

## 技術上の参照

- [GitHub Pagesの静的サイト配信](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub ActionsによるPages公開](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Microsoft：UTF-8のCSVをExcelで開くときのBOM](https://support.microsoft.com/en-us/excel/opening-csv-utf-8-files-correctly-in-excel)

原尺度と研究者作成訳・新作項目は区別して引用してください。このリポジトリでは、第三者尺度に包括的なソフトウェアライセンスを付与していません。
