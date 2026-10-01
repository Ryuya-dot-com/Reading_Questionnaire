(function () {
  "use strict";
  const validResponses = new Set(["1", "2", "3", "4", "5", "NA", "SKIP"]);
  function shuffle(values, random = Math.random) {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function makePages(items, random = Math.random) {
    return ["A", "B"].flatMap(part => {
      const order = shuffle(items.filter(item => item.part === part).map(item => item.id), random);
      const pages = [];
      for (let i = 0; i < order.length; i += 6) pages.push({ part, ids: order.slice(i, i + 6) });
      return pages;
    });
  }
  function csvCell(value) {
    let text = String(value ?? "");
    // 自由記述を表計算ソフトに読み込むときの数式解釈を防ぐ。
    if (/^[\s\uFEFF]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }
  function toCsv(rows) {
    if (!rows.length) throw new Error("CSVに出力する行がありません。");
    const headers = Object.keys(rows[0]);
    if (rows.some(row => JSON.stringify(Object.keys(row)) !== JSON.stringify(headers))) throw new Error("列の構成が一致しません。");
    return "\uFEFF" + [headers, ...rows.map(row => headers.map(key => row[key]))]
      .map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }
  function score(items, answers) {
    const result = {};
    for (const dimension of new Set(items.filter(item => item.dimension !== "attention").map(item => item.dimension))) {
      const subset = items.filter(item => item.dimension === dimension);
      const values = subset.map(item => answers[item.id]).filter(v => /^[1-5]$/.test(String(v))).map(Number);
      result[`${dimension}_n`] = values.length;
      result[`${dimension}_mean_complete`] = values.length === subset.length
        ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(4) : "";
    }
    return result;
  }
  function validateStudy(config) {
    if (!["preview", "live"].includes(config.mode)) return ["mode"];
    if (config.minimumAge !== 18) return ["minimumAge（現在の対象者説明は18歳以上専用）"];
    if (config.mode === "preview") return [];
    return ["researcher", "affiliation", "contact", "ethicsStatement", "retentionStatement", "withdrawalStatement", "submissionInstructions"]
      .filter(key => !String(config[key] ?? "").trim());
  }
  function buildRecord(config, data, state) {
    const order = state.pages.flatMap(page => page.ids);
    if (order.length !== data.items.length || new Set(order).size !== data.items.length || data.items.some(item => !order.includes(item.id))) throw new Error("提示順の整合性を確認できません。");
    if (!data.items.every(item => validResponses.has(state.answers[item.id]))) throw new Error("未回答の項目があります。");
    if (!state.consentedAt || !state.completedAt) throw new Error("回答完了時刻または同意記録がありません。");
    return {
      schema_version: "1",
      study_id: config.studyId,
      instrument_version: config.instrumentVersion,
      consent_version: config.consentVersion,
      data_mode: config.mode,
      response_id: state.id,
      consent: "yes",
      eligibility_japanese_l1: "yes",
      eligibility_english_learner: "yes",
      eligibility_age_18plus: "yes",
      consented_at_utc: state.consentedAt,
      completed_at_utc: state.completedAt,
      elapsed_seconds: Math.max(0, Math.round(state.elapsedSeconds)),
      ...Object.fromEntries(data.background.map(field => [field.id, state.background[field.id] || "SKIP"])),
      toeic_lr_reading: state.background.toeic_lr_reading || "",
      toeic_test_month: state.background.toeic_test_month || "",
      presentation_order: order.join("|"),
      ...Object.fromEntries(data.items.map(item => [item.id, state.answers[item.id]])),
      scored_response_n: data.items.filter(item => item.dimension !== "attention" && /^[1-5]$/.test(state.answers[item.id])).length,
      not_applicable_n: data.items.filter(item => state.answers[item.id] === "NA").length,
      skipped_n: data.items.filter(item => state.answers[item.id] === "SKIP").length,
      attention_check: state.answers.AC01 === "2" ? "pass" : ["NA", "SKIP"].includes(state.answers.AC01) ? "missing" : "flag",
      ...score(data.items, state.answers),
      feedback: state.feedback || ""
    };
  }
  const core = { validResponses, shuffle, makePages, csvCell, toCsv, score, validateStudy, buildRecord };
  globalThis.SurveyCore = core;
  if (typeof module !== "undefined") module.exports = core;
})();
