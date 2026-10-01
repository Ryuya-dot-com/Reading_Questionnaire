# CSVコードブック

質問紙版：2026-10-01.1。1回答者1行のwide形式。ファイル先頭はUTF-8 BOM、行末はCRLFです。列名は解析しやすいASCII、自由記述は日本語のまま保存します。

## 回答値と欠測

- 1 = まったく当てはまらない
- 2 = あまり当てはまらない
- 3 = どちらともいえない
- 4 = やや当てはまる
- 5 = とてもよく当てはまる
- NA = 経験がなく判断できない
- SKIP = 回答しない

未選択のまま完了はできませんが、SKIPを選択して回答を辞退できます。NA/SKIPを0または3に変換しないでください。背景の未回答はSKIP、任意のTOEIC得点・年月およびコメントの未入力は空欄です。

## 記録列

| 列名 | 定義 |
| --- | --- |
| `schema_version` | CSV列構成の版。現在は1。 |
| `study_id` | 調査識別子。 |
| `instrument_version` | 項目・教示・実施方法・得点化の版。 |
| `consent_version` | 説明・同意文の版。 |
| `data_mode` | preview=動作確認、live=本調査。混ぜて分析しない。 |
| `response_id` | 端末で生成するrq-UUID。再ダウンロード時は同じID。別セッションの重複参加は検出しない。 |
| `consent` | yes=開始時に確認にチェック。previewのチェックは研究参加の同意を意味しない。 |
| `eligibility_japanese_l1` | yes=日本語母語（複数母語を含む）の自己確認。 |
| `eligibility_english_learner` | yes=英語学習者の自己確認。 |
| `eligibility_age_18plus` | yes=18歳以上の自己確認。 |
| `consented_at_utc` | 開始確認時刻。ISO 8601のUTC（末尾Z）。端末時計による。 |
| `completed_at_utc` | 回答完了操作時刻。ISO 8601のUTC。端末時計による。 |
| `elapsed_seconds` | 開始から完了までの経過秒。背景入力・中断を含む。読解時間ではない。 |
| `toeic_lr_reading` | 任意の自己申告TOEIC L&R Reading得点。5〜495、5点刻み。空欄=未入力。総合点・Bridgeとは混ぜない。 |
| `toeic_test_month` | 該当得点の受験年月。YYYY-MM。空欄=不明・未入力。 |
| `presentation_order` | 実際の項目提示順。項目IDを縦棒で連結。回答ページへ戻っても順番は同じ。 |
| `scored_response_n` | 32尺度項目のうち1〜5を選んだ数。注意確認AC01を除く。 |
| `not_applicable_n` | NAの数。33項目（AC01を含む）。 |
| `skipped_n` | SKIPの数。33項目（AC01を含む）。 |
| `attention_check` | pass=AC01が2、flag=1/3/4/5、missing=NA/SKIP。自動除外の指示ではない。 |
| `feedback` | 自由記述（最大500文字）。式として解釈されうる先頭文字にはアポストロフィを付ける。原文の引用符・コンマ・改行はCSV規則で保持。 |

## 任意の背景項目

| 列名 | 質問 | 値 |
| --- | --- | --- |
| `age_group` | 年齢層 | `18_19`=18〜19歳 / `20_24`=20〜24歳 / `25_34`=25〜34歳 / `35_44`=35〜44歳 / `45_plus`=45歳以上 / `SKIP`=回答しない |
| `learner_status` | 現在の立場 | `university`=大学・短大・専門学校の学生 / `graduate`=大学院生 / `secondary`=高校等の生徒（18歳以上） / `working`=社会人 / `other`=その他 / `SKIP`=回答しない |
| `learning_years` | 英語を学んできた期間（合計の目安） | `under_3`=3年未満 / `3_5`=3〜5年 / `6_9`=6〜9年 / `10_plus`=10年以上 / `SKIP`=回答しない |
| `reading_frequency` | 最近1か月で英語の文章を読む頻度（授業を含む） | `rarely`=ほとんど読まない / `monthly`=月に数日 / `weekly_1_2`=週に1〜2日 / `weekly_3_4`=週に3〜4日 / `weekly_5_plus`=週に5日以上 / `SKIP`=回答しない |
| `reading_self_rating` | 自分の英語の読解力についての評価 | `1`=とても低いと思う / `2`=やや低いと思う / `3`=どちらともいえない / `4`=やや高いと思う / `5`=とても高いと思う / `SKIP`=回答しない |
| `classroom_experience` | 英語の授業を受けた経験 | `current`=現在受けている / `past`=以前受けていた / `none`=受けたことがない / `SKIP`=回答しない |

## 生回答列と日本語項目

Aは提供PDFのCMC-FLRAS研究者作成日本語版、Bは同PDFの新作項目、AC01は実装時の注意確認です。以下の番号は固定IDであり、画面の提示番号とは異なります。項目文は提供PDFからの転記で、句読点・空白・改行を整形しています。

| 固定ID | 下位尺度・候補 | 項目文 |
| --- | --- | --- |
| `A01` | cognitive | 英語を読んでいて，隣り合う文同士の意味のつながりが分からないと混乱する。 |
| `A02` | cognitive | 英語の文章を読んでいて，それまでに読んだ内容を覚えられないと混乱する。 |
| `A03` | cognitive | 英語を読んでいて，知らない単語や熟語に出会うと混乱する。 |
| `A04` | cognitive | 文章に新しい単語や文法事項がないのに要旨がつかめないと，心配になる。 |
| `A05` | cognitive | 自分の知らないトピック・話題についての文章を英語で読んでいると不安になる。 |
| `A06` | cognitive | 長くて複雑な構造の文があると，緊張する。 |
| `A07` | cognitive | 英語の文章を読んでいて，意味の分からない単語があると不安になる。 |
| `A08` | cognitive | ある段落の主旨がつかめないと，緊張する。 |
| `A09` | cognitive | 英語を読んでいて，この先の内容が予測できないと混乱する。 |
| `A10` | cognitive | 英語の文章を読んでいて，その内容を理解できているかどうか自信を持てないときに不安になる。 |
| `A11` | cognitive | 形容詞・副詞・接続語などの品詞が見分けられないと，心配になる。 |
| `A12` | cognitive | 英語の文章を読んでいて，知らない文法が出てくると混乱する。 |
| `A13` | metacognitive | 英単語を辞書で調べられないと感じると，気になって落ち着かない。 |
| `A14` | metacognitive | 文章が難しくなっても，読んでいる内容にもっと注意を向けることができないと，緊張する。 |
| `A15` | metacognitive | 覚えておくために文中の情報に下線を引いたり丸で囲んだりすることが許されないと，心配になる。 |
| `A16` | metacognitive | 読んでいる内容がよく分からないのに，読む速さを調整できないと，緊張する。 |
| `A17` | metacognitive | 知らない単語や語句の意味を文脈から推測できないと，ひどく混乱する。 |
| `A18` | metacognitive | 読んでいる内容をよく理解するために，自分の言葉で言い換えることができないと，心配になる。 |
| `A19` | metacognitive | 理解の助けになると分かっていても，読みながらメモを取れないと，緊張する。 |
| `A20` | classroom | 授業で先生に音読を指名されると，気になって落ち着かない。 |
| `A21` | classroom | 一人で英語を読むのはよいが，音読しなさいと言われると嫌な思いになる。 |
| `A22` | classroom | 先生に読解問題の答えを求められると，心配になる。 |
| `A23` | classroom | 先生に英文の一部を日本語に訳すよう指名されると，不安になる。 |
| `B01` | enjoyment_pleasure_candidate | 英語の文章を読むのは楽しい。 |
| `B02` | enjoyment_pleasure_candidate | 英語の文章を読んでいる時間が好きだ。 |
| `B03` | enjoyment_pleasure_candidate | 英語で何かを読み終えたとき，「読んでよかった」と感じることが多い。 |
| `B04` | enjoyment_immersion_candidate | 英語の文章を読んでいて，内容に引き込まれることがある。 |
| `B05` | enjoyment_immersion_candidate | 英語で読んでいると，時間がたつのを忘れることがある。 |
| `B06` | enjoyment_immersion_candidate | 英語の文章を読むと，新しいことを知る面白さを感じる。 |
| `B07` | enjoyment_achievement_candidate | 英語の文章の内容がわかると，うれしくなる。 |
| `B08` | enjoyment_achievement_candidate | 前より英語が読めるようになったと感じると，うれしい。 |
| `B09` | enjoyment_achievement_candidate | 少し難しい英語の文章を読みこなせたとき，達成感を味わう。 |
| `AC01` | attention | 回答の確認のため，この項目では「2 あまり当てはまらない」を選んでください。 |

## 算出列

逆転項目はありません。`_n` は数値回答の数、`_mean_complete` はその下位尺度が全項目1〜5で回答された場合だけの算術平均（小数4桁）です。1つでもNA/SKIPがあれば平均は空欄です。注意確認項目は得点に含めません。

| 接頭辞 | 対象ID | 項目数 | 列 |
| --- | --- | --- | --- |
| `cognitive` | A01, A02, A03, A04, A05, A06, A07, A08, A09, A10, A11, A12 | 12 | `cognitive_n`, `cognitive_mean_complete` |
| `metacognitive` | A13, A14, A15, A16, A17, A18, A19 | 7 | `metacognitive_n`, `metacognitive_mean_complete` |
| `classroom` | A20, A21, A22, A23 | 4 | `classroom_n`, `classroom_mean_complete` |
| `enjoyment_pleasure_candidate` | B01, B02, B03 | 3 | `enjoyment_pleasure_candidate_n`, `enjoyment_pleasure_candidate_mean_complete` |
| `enjoyment_immersion_candidate` | B04, B05, B06 | 3 | `enjoyment_immersion_candidate_n`, `enjoyment_immersion_candidate_mean_complete` |
| `enjoyment_achievement_candidate` | B07, B08, B09 | 3 | `enjoyment_achievement_candidate_n`, `enjoyment_achievement_candidate_mean_complete` |

Aの平均は大きいほど各側面の不安に同意する傾向を表します。Bの平均は大きいほど各候補側面への同意を表しますが、候補の因子構造・妥当性は未検証です。これらはIRT因子得点ではなく、不安全体・enjoyment全体の総得点も算出しません。臨床的閾値や標準化された高低判定はありません。

完全回答時のみ得点化しても、完全ケース分析の偏りがなくなるわけではありません。群別の欠測頻度・理由を報告し、主解析での欠測処理を別途決めてください。CSVは端末で編集できるため、研究者側の解析で生回答から得点を再計算してください。
