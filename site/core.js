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
    return shuffle(["en", "ja"], random).flatMap(language => {
      const order = shuffle(items.filter(item => item.language === language).map(item => item.id), random);
      return order.map(id => ({ language, ids: [id] }));
    });
  }
  // monotonic clockを注入できるようにして、非表示・見直しを決定的に検証する。
  function createItemTimer(clock = () => performance.now()) {
    const records = {};
    let current = null, activeSince = null;
    function flush() {
      if (current !== null && activeSince !== null) {
        const now = clock();
        records[current].activeMs += Math.max(0, now - activeSince);
        activeSince = now;
      }
    }
    function end() { flush(); current = null; activeSince = null; }
    return {
      begin(id, active) {
        end(); current = id;
        records[id] ||= { firstMs: null, activeMs: 0, visits: 0, changes: 0, pauses: 0, lastAnswer: null };
        records[id].visits++;
        activeSince = active ? clock() : null;
      },
      setActive(active) {
        if (current === null) return;
        if (active && activeSince === null) activeSince = clock();
        else if (!active && activeSince !== null) { flush(); activeSince = null; records[current].pauses++; }
      },
      respond(id, value) {
        if (current !== id) return;
        flush();
        const record = records[id];
        if (record.firstMs === null) record.firstMs = record.activeMs;
        if (record.lastAnswer !== null && record.lastAnswer !== value) record.changes++;
        record.lastAnswer = value;
      },
      end,
      snapshot() {
        flush();
        return Object.fromEntries(Object.entries(records).map(([id, r]) => [id, {
          rt_first_ms: r.firstMs === null ? "" : Math.round(r.firstMs),
          active_ms: Math.round(r.activeMs), visit_n: r.visits, change_n: r.changes, pause_n: r.pauses
        }]));
      }
    };
  }
  const timingFields = ["rt_first_ms", "active_ms", "visit_n", "change_n", "pause_n"];
  function progressState(state, itemCount) {
    const total = itemCount + 5; // 背景・日常使用・練習・各項目・自由記述・確認。開始説明は除く。
    const positions = { background: 0, daily: 1, practice: 2, questions: 3 + (state.page || 0), open: itemCount + 3, review: itemCount + 4, done: total };
    const position = positions[state.stage] ?? 0;
    return { total, position, percent: Math.floor(100 * position / total) };
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
    if (!["external", "onsite"].includes(config.participantInformationMode)) return ["participantInformationMode"];
    if (config.mode === "preview") return [];
    const required = config.participantInformationMode === "external" ? ["submissionInstructions"]
      : ["researcher", "affiliation", "contact", "ethicsStatement", "retentionStatement", "withdrawalStatement", "submissionInstructions"];
    return required.filter(key => !String(config[key] ?? "").trim());
  }
  function normalizeDaily(data, values = {}) {
    function selections(key, options) {
      const chosen = Array.isArray(values[key]) ? values[key] : [];
      if (chosen.includes("none")) return ["none"];
      return options.map(([value]) => value).filter(value => chosen.includes(value));
    }
    const exams = selections("exam_types", data.examTypes);
    const materials = selections("reading_materials", data.readingMaterials);
    const scalar = key => String(values[key] ?? "");
    return {
      exam_types: exams.join("|") || "SKIP",
      toeic_lr_total: exams.includes("toeic_lr") ? scalar("toeic_lr_total") : "",
      toeic_lr_reading: exams.includes("toeic_lr") ? scalar("toeic_lr_reading") : "",
      toeic_test_month: exams.includes("toeic_lr") ? scalar("toeic_test_month") : "",
      eiken_latest_passed_grade: exams.includes("eiken") ? scalar("eiken_latest_passed_grade") : "",
      other_exam_details: exams.includes("other") ? scalar("other_exam_details") : "",
      ...Object.fromEntries(data.daily.map(field => [field.id, field.options.some(([value]) => value === values[field.id]) ? values[field.id] : "SKIP"])),
      reading_materials: materials.join("|") || "SKIP",
      reading_materials_other: materials.includes("other") ? scalar("reading_materials_other") : ""
    };
  }
  function buildRecord(config, data, state) {
    if (typeof state.researchUseProhibited !== "boolean") throw new Error("データ利用の意思が選択されていません。");
    const order = (state.pages || []).flatMap(page => page.ids);
    const answers = state.answers || {};
    const prohibited = state.researchUseProhibited === true;
    const record = {
      schema_version: "4",
      study_id: config.studyId,
      instrument_version: config.instrumentVersion,
      consent_version: config.consentVersion,
      data_mode: config.mode,
      response_id: state.id,
      record_type: prohibited ? "refusal" : "response",
      research_use_allowed: prohibited ? "no" : "yes",
      consent: prohibited ? (state.initialResearchConsent ? "withdrawn" : "no") : "yes",
      eligibility_japanese_l1: "yes",
      eligibility_english_learner: "yes",
      eligibility_age_18plus: "yes",
      consented_at_utc: state.consentedAt,
      completed_at_utc: state.completedAt,
      elapsed_seconds: Math.max(0, Math.round(state.elapsedSeconds)),
      participant_name: state.background?.participant_name || "",
      student_id: state.background?.student_id || "",
      ...Object.fromEntries(data.background.map(field => [field.id, state.background?.[field.id] || "SKIP"])),
      ...normalizeDaily(data, state.daily),
      randomization_method: "language_blocks_and_within_language_v1",
      language_block_order: [...new Set((state.pages || []).map(page => page.language))].join("|"),
      timing_method: "single_item_visible_focused_v1",
      presentation_order: order.join("|"),
      ...Object.fromEntries(data.items.map(item => [item.id, answers[item.id]])),
      ...Object.fromEntries(data.items.flatMap(item => timingFields.map(field => [`${item.id}_${field}`, state.timings?.[item.id]?.[field] ?? ""]))),
      scored_response_n: data.items.filter(item => item.dimension !== "attention" && /^[1-5]$/.test(answers[item.id])).length,
      not_applicable_n: data.items.filter(item => answers[item.id] === "NA").length,
      skipped_n: data.items.filter(item => answers[item.id] === "SKIP").length,
      attention_check: answers.AC01 === "2" ? "pass" : ["NA", "SKIP"].includes(answers.AC01) ? "missing" : "flag",
      ...score(data.items, answers),
      ...Object.fromEntries(data.openQuestions.map(field => [field.id, state.openResponses?.[field.id] || ""]))
    };
    if (prohibited) {
      const keep = new Set(["schema_version", "study_id", "instrument_version", "consent_version", "data_mode", "response_id", "record_type", "research_use_allowed", "consent"]);
      return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, keep.has(key) ? value : ""]));
    }
    if (order.length !== data.items.length || new Set(order).size !== data.items.length || data.items.some(item => !order.includes(item.id))) throw new Error("提示順の整合性を確認できません。");
    if (!data.items.every(item => validResponses.has(answers[item.id]))) throw new Error("未回答の項目があります。");
    if (!state.consentedAt || !state.completedAt) throw new Error("回答完了時刻または同意記録がありません。");
    return record;
  }
  const core = { validResponses, shuffle, makePages, createItemTimer, timingFields, progressState, csvCell, toCsv, score, validateStudy, normalizeDaily, buildRecord };
  globalThis.SurveyCore = core;
  if (typeof module !== "undefined") module.exports = core;
})();
