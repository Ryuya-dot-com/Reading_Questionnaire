/* 共通版は各実施者が授業・LMS等で事前説明して利用する。
   画面内に個別説明を表示する場合は、専用公開先でonsiteを選び、実施者等を設定する。README.md参照。 */
globalThis.SURVEY_CONFIG = Object.freeze({
  mode: "live", // live（正式公開）または preview（動作確認）
  participantInformationMode: "external", // external: 授業・LMS等で事前説明 / onsite: 以下を画面内に表示
  studyId: "reading-questionnaire-shared", // 共通版の識別子。研究ごとの専用公開では変更する。
  instrumentVersion: "2026-10-01.7",
  consentVersion: "2026-10-01.7",
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
