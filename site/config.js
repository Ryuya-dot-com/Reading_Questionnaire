/* 調査ごとの設定。提供者の氏名を全調査の責任者として固定しない。
   他の研究者は複製した公開先で実施者・窓口・調査IDを設定する。README.md参照。 */
globalThis.SURVEY_CONFIG = Object.freeze({
  mode: "preview", // preview（動作確認）または live（本調査）
  studyId: "reading-emotions-ja",
  instrumentVersion: "2026-10-01.5",
  consentVersion: "2026-10-01.5",
  researcher: "", // この調査の研究責任者。プラットフォーム提供者とは別。
  affiliation: "",
  contact: "", // この調査の問い合わせ・撤回窓口。機関の研究窓口等でも可。
  ethicsStatement: "",
  retentionStatement: "",
  withdrawalStatement: "",
  submissionInstructions: "保存したCSVファイルを、調査担当者から指定された大学のLMS・提出フォーム等に提出してください。",
  submissionUrl: "",
  minimumAge: 18
});
