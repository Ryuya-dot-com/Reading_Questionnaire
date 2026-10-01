# CSVコードブック

質問紙版・同意版：2026-10-01.4。CSVスキーマ3、299列、1回答者1行のwide形式。ファイル先頭はUTF-8 BOM、行末はCRLFです。列名は解析しやすいASCII、自由記述は日本語のまま保存します。

## 最初に確認する利用意思

分析対象は `record_type=response` かつ `research_use_allowed=yes` かつ `consent=yes` の本調査回答です。`data_mode=preview` は動作確認用であり、研究には使用しません。

`record_type=refusal` かつ `research_use_allowed=no` は利用不可の管理記録です。この場合、`schema_version`、`study_id`、`instrument_version`、`consent_version`、`data_mode`、`response_id`、`record_type`、`research_use_allowed`、`consent` の9列以外はすべて空欄です。空欄を通常の欠測回答として扱わず、研究分析から除外します。結合スクリプトは同じIDの回答も入力順によらず除外します。既存ファイルや分析結果の削除は研究者側の対応が別途必要です。

## 回答値と欠測

- 1 = まったく当てはまらない
- 2 = あまり当てはまらない
- 3 = どちらともいえない
- 4 = やや当てはまる
- 5 = とてもよく当てはまる
- NA = 経験がなく判断できない
- SKIP = 回答しない

40の気持ち・確認項目は未選択のまま完了できませんが、SKIPを選択して回答を辞退できます。NA/SKIPを0または3に変換しないでください。背景・日常の英語使用の未選択はSKIP、条件付きの得点・年月・合格級・補足記述と自由記述2項目の未入力は空欄です。資格試験や文章の種類の「なし」は明示的な `none` で、未回答とは区別します。

## 記録列

| 列名 | 定義 |
| --- | --- |
| `schema_version` | CSV列構成の版。現在は3。旧版の1・2とは列構成が異なる。 |
| `study_id` | 調査識別子。 |
| `instrument_version` | 項目・教示・実施方法・得点化の版。 |
| `consent_version` | 説明・同意文の版。 |
| `data_mode` | preview=動作確認、live=本調査。混ぜて分析しない。 |
| `response_id` | 端末で生成するrq-UUID。再ダウンロード時は同じID。別セッションの重複参加は検出しない。 |
| `record_type` | response=回答記録、refusal=利用不可の管理記録。 |
| `research_use_allowed` | yes=利用禁止を選択していない、no=利用禁止。previewのyesは本調査での使用許可を意味しない。 |
| `consent` | yes=開始説明を確認し、同意ボタンで開始（previewでは動作確認）、no=開始前から利用禁止、withdrawn=開始後・完了前に利用禁止。 |
| `eligibility_japanese_l1` | yes=日本語母語（複数母語を含む）の自己確認。 |
| `eligibility_english_learner` | yes=英語学習者の自己確認。 |
| `eligibility_age_18plus` | yes=18歳以上の自己確認。 |
| `consented_at_utc` | 開始確認時刻。ISO 8601のUTC（末尾Z）。端末時計による。 |
| `completed_at_utc` | 回答完了操作時刻。ISO 8601のUTC。端末時計による。 |
| `elapsed_seconds` | 開始から完了までの経過秒。背景入力・中断を含む。読解時間ではない。 |
| `randomization_method` | `language_blocks_and_within_language_v1`。言語ブロック順と各言語内の項目順をFisher–Yates法で無作為化。 |
| `language_block_order` | `en|ja` または `ja|en`。独立した無作為割当なので人数が正確に半々になるとは限らない。 |
| `timing_method` | `single_item_visible_focused_v1`。下記の計時定義を参照。 |
| `presentation_order` | 開始時に割り当てた40項目の提示順。固定IDを縦棒で連結。戻っても同じ順番で表示。再訪のイベント順序までは保存せず、回数を項目別に保存。 |
| `scored_response_n` | 39尺度・探索項目のうち1〜5を選んだ数。注意確認AC01を除く。 |
| `not_applicable_n` | NAの数。40項目（AC01を含む）。 |
| `skipped_n` | SKIPの数。40項目（AC01を含む）。 |
| `attention_check` | pass=AC01が2、flag=1/3/4/5、missing=NA/SKIP。自動除外の指示ではない。 |

質問紙への経過時間には、背景・日常の英語使用・練習・自由記述の入力と中断を含みます。練習例の回答は列を設けず、保存・得点化しません。旧版の画面へのコメント `feedback` は削除し、下記の自由記述2列に変更しました。

## 項目別の回答時間・操作回数

英語33項目（注意確認を含む）と日本語7項目を各1画面で提示します。固定IDを `ID` とすると、各項目に次の5列があり、合計200列です。背景・日常使用・練習・自由記述はこの計時の対象外です。

| 列の形式 | 定義 |
| --- | --- |
| `ID_rt_first_ms` | 最初の選択（1〜5、NA、SKIPのいずれか）までの、その項目での累積アクティブ時間。未選択で戻って再訪した場合も、その項目に滞在した時間のみ累積する。再回答しても最初の値を保持。 |
| `ID_active_ms` | その項目の全訪問における累積アクティブ表示時間。初回選択後から「次へ」「戻る」までの滞在・見直しも含む。別項目での時間は含まない。 |
| `ID_visit_n` | その項目を表示した回数。初回は1。前後移動による再表示ごとに増える。タブからの復帰だけでは増やさない。 |
| `ID_change_n` | 選択済みの回答を別の値に変更した回数。最初の選択は0、同じ値の再選択では増やさない。NA/SKIPへの変更も含む。 |
| `ID_pause_n` | その項目の計時中に、非表示またはフォーカス喪失でアクティブ計時が停止した回数。連続したblur/visibilitychangeは重複計上しない。画面を進む操作は中断に含めない。 |

例えば `A01_rt_first_ms=1250`、`A01_active_ms=3000` なら、初回選択までのアクティブ時間は1.25秒、見直し・選択後の滞在を含む合計は3秒です。ミリ秒は整数に丸めます。空欄は計時記録なし、0は0ミリ秒に丸められた記録であり、両者を混同しません。利用禁止の場合はこれらもすべて空欄です。

計時開始は各画面のDOM更新・フォーカス移動後で、実際の画面描画完了を装置で検出した時刻ではありません。`performance.now()` を使い、`document.hidden=false` かつ `document.hasFocus()=true` の区間だけを加算します。別タブ・別ウィンドウへの移動で中断し、戻ると再開します。画面が前面のままの離席・熟考・視線逸脱は除けません。OS休止やブラウザのイベント遅延・時計分解能にも依存するため、1ミリ秒の測定精度を保証しません。

言語ブロックの最初の項目には切替説明を読む時間も入り得ます。項目位置、文の長さ、操作環境、見直しを考慮し、初回時間と累積時間を混ぜないでください。速い回答だけで自動除外する閾値や「不安が強いほど遅い」という得点化は設けていません。データ品質の検討では分布・欠測・操作回数と併せて事前に方針を定めます。`elapsed_seconds` は背景入力や非アクティブ時間を含む全体時間なので、項目別時間の合計とは一致しません。

## 任意の背景項目

| 列名 | 質問 | 値 |
| --- | --- | --- |
| `age_group` | 年齢層 | `18_19`=18〜19歳 / `20_24`=20〜24歳 / `25_34`=25〜34歳 / `35_44`=35〜44歳 / `45_plus`=45歳以上 / `SKIP`=回答しない |
| `learner_status` | 現在の立場 | `university`=大学・短大・専門学校の学生 / `graduate`=大学院生 / `secondary`=高校等の生徒（18歳以上） / `working`=社会人 / `other`=その他 / `SKIP`=回答しない |
| `learning_years` | 英語を学んできた期間（合計の目安） | `under_3`=3年未満 / `3_5`=3〜5年 / `6_9`=6〜9年 / `10_plus`=10年以上 / `SKIP`=回答しない |
| `reading_frequency` | 最近1か月で英語の文章を読む頻度（授業を含む） | `rarely`=ほとんど読まない / `monthly`=月に数日 / `weekly_1_2`=週に1〜2日 / `weekly_3_4`=週に3〜4日 / `weekly_5_plus`=週に5日以上 / `SKIP`=回答しない |
| `reading_self_rating` | 自分の英語の読解力についての評価 | `1`=とても低いと思う / `2`=やや低いと思う / `3`=どちらともいえない / `4`=やや高いと思う / `5`=とても高いと思う / `SKIP`=回答しない |
| `classroom_experience` | 英語の授業を受けた経験 | `current`=現在受けている / `past`=以前受けていた / `none`=受けたことがない / `SKIP`=回答しない |

## 日常の英語使用（6項目、すべて任意）

資格試験の詳細と複数選択の補足を別列にしたため、この6問は12列に対応します。頻度・時間・読むものは最近1か月の生活を目安に回答します。背景の `reading_frequency` は授業を含み、下記の `extra_reading_frequency` は授業・課題外です。

| 列名 | 内容・値 |
| --- | --- |
| `exam_types` | 受験したことのある試験。`toeic_lr` / `eiken` / `other` の複数選択を `|` で連結。`none`=受験したことがない、`SKIP`=未選択。noneは他と併用不可。 |
| `toeic_lr_total` | 最新のTOEIC L&R合計点。10〜990、5点刻み。最高点ではない。空欄=未入力またはTOEIC非選択。 |
| `toeic_lr_reading` | 同じ回のReading点。5〜495、5点刻み。合計点と同時入力した場合、差（Listening点）が5〜495になることも確認。空欄=未入力またはTOEIC非選択。 |
| `toeic_test_month` | 上記の受験年月（YYYY-MM）。不明・未入力・TOEIC非選択は空欄。 |
| `eiken_latest_passed_grade` | 最新の合格級。`1` / `pre_1` / `2` / `pre_2_plus` / `pre_2` / `3` / `4` / `5`、`no_pass`=合格した級なし、`unknown`=覚えていない。未回答・英検非選択は空欄。受験した級やCSE得点ではない。 |
| `other_exam_details` | その他の試験名と最新スコア・級（任意、最大500文字）。その他非選択時は空欄。 |
| `extra_reading_frequency` | 授業・課題外で読む頻度。`daily`=ほぼ毎日 / `weekly`=週に数回 / `monthly`=月に数回 / `rarely`=ほとんどない / `SKIP`。 |
| `extra_reading_time` | 授業・課題外で読む1週間の時間。`none`=0分 / `under_30`=0分超30分未満 / `30_to_59`=30分以上1時間未満 / `60_to_179`=1時間以上3時間未満 / `180_plus`=3時間以上 / `SKIP`。境界を重複させない。連続量の分数として解析しない。 |
| `reading_materials` | 授業以外で読む文章。`social`=SNS・ネット投稿 / `news`=ニュース・記事 / `fiction`=小説・多読本 / `academic`=専門の教科書・論文 / `games_video`=ゲーム・動画の字幕や説明 / `other`。複数選択を `|` で連結。`none`=読むものはない（他と併用不可）、`SKIP`=未選択。 |
| `reading_materials_other` | その他の文章（任意、最大200文字）。その他非選択時は空欄。 |
| `extensive_reading_experience` | 授業などで多読をした経験。`yes`=ある / `no`=ない / `unsure`=分からない・覚えていない / `SKIP`。 |
| `english_country_stay_3months` | 英語圏への1回の連続した3か月以上の滞在経験。旅行・留学・居住を含み、複数回の合計ではない。`yes` / `no` / `unsure` / `SKIP`。 |

複数選択は選んだ順序ではなく、画面の選択肢の定義順で出力します。未選択の条件付き欄に以前入力していた値は消去し、CSVには残しません。「その他」を選んで記述を空欄にすることはできます。資格試験の選択は受験経験、得点・合格級はその詳細なので区別して解釈します。異なる試験の得点や英検級を、根拠なく共通の英語力得点に変換しません。

範囲の参照：[IIBCのTOEIC L&Rスコア説明](https://www.iibc-global.org/toeic/test/lr/guide04.html)、[英検の準2級プラスの案内](https://www.eiken.or.jp/eiken/2025newgrade/)（2025年度導入）。

## 自由記述（2項目、任意）

| 列名 | 質問 |
| --- | --- |
| `free_learning_experience` | これまでの英語学習で，楽しかったことや難しかったことがあれば，自由に書いてください。 |
| `free_reading_feelings` | ふだん英語を読むときに，不安になることや楽しいと感じることがあれば，自由に書いてください。 |

各最大2,000文字、空欄は未回答です。式として解釈されうる先頭文字にはCSV出力時にアポストロフィを付けます（その他の記述欄も同様）。原文の引用符・コンマ・改行はCSV規則で保持します。実装の文字数制限はブラウザの `maxlength` によるため、絵文字等は見かけの文字数と一致しない場合があります。自由記述を研究発表で引用する場合は、氏名以外にも授業・所属・経験の組合せ等から個人が特定されないか研究者が確認してください。

## 生回答列と日本語項目

Aは提供PDFのCMC-FLRAS研究者作成日本語版、Bは同PDFの新作項目、Jは利用者提示の母語読解7項目、AC01は実装時の注意確認です。以下の番号は固定IDであり、画面の提示番号とは異なります。A/Bは提供PDF、Jは利用者提示の文言からの転記で、句読点・空白・改行を整形しています。

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
| `J01` | l1_enjoyment_candidate | 日本語の文章を読むのは楽しい。 |
| `J02` | l1_enjoyment_candidate | 日本語の本や記事を読むことは，好きな趣味の一つだ。 |
| `J03` | l1_enjoyment_candidate | 日本語の文章を読んでいて，内容に引き込まれることがある。 |
| `J04` | l1_anxiety_candidate | 日本語の文章を読んでいて，内容を理解できているか自信が持てないと不安になる。 |
| `J05` | l1_anxiety_candidate | 日本語の文章を読んでいて，隣り合う文同士の意味のつながりが分からないと混乱する。 |
| `J06` | l1_anxiety_candidate | 日本語の文章で，ある段落の主旨がつかめないと，緊張する。 |
| `J07` | l1_anxiety_candidate | 日本語の長い文章を読まなければならないとき，自分の読む力が足りないのではないかと心配になる。 |

J01とB01、J03とB04、J04とA10、J05とA01、J06とA08には内容上の対応があります。J02はPISAの読書への関与項目を参考にした改変、J07は長文読解への不安・自己評価を尋ねる利用者作成項目です。7項目全体をPISA尺度またはRAT-Aの正式な翻訳・短縮版とは呼びません。対応する文言があることだけで言語間の測定不変性は保証されません。

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
| `l1_enjoyment_candidate` | J01, J02, J03 | 3 | `l1_enjoyment_candidate_n`, `l1_enjoyment_candidate_mean_complete` |
| `l1_anxiety_candidate` | J04, J05, J06, J07 | 4 | `l1_anxiety_candidate_n`, `l1_anxiety_candidate_mean_complete` |

Aの平均は大きいほど各側面の不安に同意する傾向を表します。Bの平均は大きいほど各候補側面への同意を表しますが、候補の因子構造・妥当性は未検証です。これらはIRT因子得点ではなく、不安全体・enjoyment全体の総得点も算出しません。臨床的閾値や標準化された高低判定はありません。

完全回答時のみ得点化しても、完全ケース分析の偏りがなくなるわけではありません。群別の欠測頻度・理由を報告し、主解析での欠測処理を別途決めてください。CSVは端末で編集できるため、研究者側の解析で生回答から得点を再計算してください。

日本語の候補平均は、それぞれ楽しさ・関与への同意、不安への同意を暫定的に要約したものです。趣味・没入・楽しさの単一次元性も未確認です。7項目の総得点は作らず、日本語と英語の総平均の差を「英語特有の不安」として計算しません。
