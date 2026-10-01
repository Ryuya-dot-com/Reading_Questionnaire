/* 回答はブラウザ内だけで処理する。データ利用禁止時には回答内容を出力しない。 */
(function () {
  "use strict";
  const config = globalThis.SURVEY_CONFIG;
  const data = globalThis.SurveyData;
  const core = globalThis.SurveyCore;
  const app = document.querySelector("#app");
  const byId = Object.fromEntries(data.items.map(item => [item.id, item]));
  const preview = config.mode === "preview";
  let state = { stage: "welcome" };
  let itemTimer = null;
  let fileUrl = "", fileName = "";
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const checked = value => value ? " checked" : "";
  function button(id, text, secondary = false) { return `<button type="button" id="${id}"${secondary ? ' class="secondary"' : ""}>${text}</button>`; }
  function errorBox() { return '<p id="error" class="error" role="alert" hidden></p>'; }
  function fail(message) { const el = document.querySelector("#error"); el.textContent = message; el.hidden = false; }
  function focusTop() { const title = app.querySelector("h1,h2"); title?.setAttribute("tabindex", "-1"); title?.focus(); window.scrollTo(0, 0); }
  function on(id, fn) { document.getElementById(id)?.addEventListener("click", fn); }
  function quitButton() { return '<button type="button" class="text-button" id="quit">中止して回答を消去する</button>'; }
  function submissionLink() {
    try {
      const url = new URL(config.submissionUrl);
      return url.protocol === "https:" ? `<p><a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">指定された提出先を開く ↗</a></p>` : "";
    } catch { return ""; }
  }
  function selectField(field, values) {
    return `<label class="field">${escape(field.label)}<select name="${field.id}"><option value="SKIP">回答しない</option>${field.options.map(([value, label]) => `<option value="${value}"${values[field.id] === value ? " selected" : ""}>${escape(label)}</option>`).join("")}</select></label>`;
  }
  function checkGroup(name, options, values = []) {
    return `<div class="check-options">${options.map(([value, label]) => `<label><input type="checkbox" name="${name}" value="${value}"${checked(values.includes(value))}><span>${label}</span></label>`).join("")}</div>`;
  }
  function useControl() {
    return `<section class="card"><h3>データの利用について</h3><label class="consent-check"><input type="checkbox" id="prohibit-use"${checked(state.researchUseProhibited)}><span>データの使用を一切禁止します。</span></label><p class="quiet">利用を禁止したい場合はチェックを入れてください。チェックした場合は，質問への回答内容をCSVに含めず，利用不可という意思と照合用ID・質問紙版などの管理情報だけを記録します。研究の分析・発表には使用しません。</p><p class="quiet">既にCSVを提出した後で利用を取りやめたい場合は，研究責任者に連絡してください。このチェックだけで提出済みのファイルが自動的に削除されることはありません。</p></section>`;
  }
  function bindUseControl(buttonId) {
    const input = document.querySelector("#prohibit-use");
    const update = () => {
      state.researchUseProhibited = input.checked;
      const text = input.checked ? "利用不可の記録だけを保存 ↓" : buttonId === "start" ? (preview ? "試作版をはじめる →" : "研究利用に同意してはじめる →") : "回答を完了してCSVを保存 ↓";
      document.getElementById(buttonId).textContent = text;
    };
    input.addEventListener("change", update); update();
  }
  function progress() {
    const shown = ["background", "daily", "practice", "questions", "open", "review", "done"].includes(state.stage) && !(state.stage === "done" && state.researchUseProhibited);
    document.querySelector("#progress-area").hidden = !shown;
    if (!shown) return;
    const answered = Object.values(state.answers).filter(value => core.validResponses.has(value)).length;
    const { total, position, percent } = core.progressState(state, data.items.length);
    const bar = document.querySelector("#progress"); bar.max = total; bar.value = position;
    bar.setAttribute("aria-valuetext", `全体の進捗 ${percent}%`);
    document.querySelector("#progress-text").textContent = `全体の進捗 ${percent}%`;
    document.querySelector("#progress-detail").textContent = state.stage === "done" ? "すべての画面が完了しました" : `画面 ${position + 1} / ${total} · 気持ちの質問 ${answered} / ${data.items.length} 項目を選択済み`;
    const labels = { background: "あなたについて", daily: "日常の英語使用", practice: "回答のしかた", open: "自由記述（任意）", review: "回答の確認", done: "完了" };
    document.querySelector("#step-label").textContent = labels[state.stage] || (state.pages[state.page].language === "ja" ? "日本語を読むときの気持ち" : "英語を読むときの気持ち");
  }
  function welcome() {
    app.innerHTML = `<div class="hero"><p class="eyebrow">READING EXPERIENCE SURVEY</p><h1>英語を読むとき、<br>どんな気持ちになりますか。</h1><p class="lead">英語を読むときに困ること・不安に思うことについて，あなたがどのように感じているのかを尋ねます。あわせて，英語を読む楽しさや日常の英語使用，母語である日本語を読むときの気持ちもお聞きします。</p><p class="quiet">英語力・日本語力を判定するテストではありません。正解も不正解もありません。</p><div class="facts"><span>英語の気持ち32項目・日本語の気持ち7項目 ＋ 確認1項目</span><span>学習経験など12項目・自由記述2項目</span><span><strong>15–20</strong>分程度（目安）</span></div></div>
      <section class="card"><h2>参加する前に</h2><p>日本語を母語とする，18歳以上の英語学習者を対象としています。日本語が複数の母語の一つである方も含みます。</p><ul class="list"><li>参加は自由です。回答したくない項目は「回答しない」を選べます。背景・日常の英語使用・自由記述は空欄のまま進めます。</li><li><strong>アンケートの結果によって成績が下がることはありません。</strong>参加しないこと，途中で中止すること，データの利用を禁止することによる不利益もありません。</li><li><strong>アンケート結果を個人が特定されるような形式で公開することはありません。</strong>自由記述を紹介する場合も，個人が特定される情報を除くなどの対応をします。</li><li>気持ちについて考えることで負担を感じた場合は，いつでも中止できます。</li><li>氏名・学籍番号は尋ねません。ただし，LMS等への提出時には提出者が分かる場合があります。</li><li>回答はページを開いている間だけ保持します。再読み込みや終了で消えるため，最後にCSVを保存してください。この画面からの自動送信はありません。</li></ul>
      ${preview ? '<div class="notice"><strong>現在は動作確認用の試作版です。</strong><br>研究の募集は行っていません。出力CSVには「preview」と記録します。研究責任者・問い合わせ先・データの保管や撤回の説明は，本調査の開始前に設定します。試したCSVは本調査の回答として提出しないでください。</div>' : `<p>研究責任者：${escape(config.researcher)}<br>所属：${escape(config.affiliation)}<br>問い合わせ先：${escape(config.contact)}</p><p>${escape(config.ethicsStatement)}</p><p>データの保管・利用：${escape(config.retentionStatement)}</p><p>提出後の撤回：${escape(config.withdrawalStatement)}</p>`}
      <p>気持ちの質問は1画面ずつ表示します。質問の順序と，項目ごとの回答時間・表示回数・回答変更回数・計時中断回数をCSVに記録します。別のタブやウィンドウに移っている間は項目の計時を止めます。回答を急ぐ必要はありません。</p><p class="quiet">サイトの配信にはGitHub Pagesを利用しています。アクセス情報は配信サービス側で処理されます。アンケートの回答にアクセス情報を追加することはありません。</p></section>
      <form id="consent-form" class="card"><h2>${preview ? "試作版を試す" : "参加の確認"}</h2>
      <label class="consent-check"><input type="checkbox" name="age" required><span>18歳以上です。</span></label>
      <label class="consent-check"><input type="checkbox" name="language" required><span>日本語が母語で，英語を学んでいます。</span></label>
      <label class="consent-check"><input type="checkbox" name="consent" required><span>${preview ? "上の説明を読み，動作確認用の試作版であることを理解しました。" : "上の説明を読み，参加やデータ利用を断れることを理解しました。"}</span></label></form>
      ${useControl()}${errorBox()}<div class="actions"><span class="quiet">${preview ? "試作版の回答は研究に使用しません。" : "利用を禁止せず開始した場合は，回答の研究利用に同意したものとします。"}</span>${button("start", "はじめる →")}</div>`;
    document.querySelector("#consent-form").addEventListener("submit", event => event.preventDefault());
    bindUseControl("start");
    on("start", () => {
      const prohibited = state.researchUseProhibited;
      if (!prohibited && !document.querySelector("#consent-form").reportValidity()) return;
      state = { stage: "background", id: `rq-${crypto.randomUUID()}`, consentedAt: new Date().toISOString(), startedClock: performance.now(), initialResearchConsent: !prohibited, researchUseProhibited: prohibited, pages: prohibited ? [] : core.makePages(data.items), page: 0, answers: {}, background: {}, daily: {}, openResponses: {}, practiceAnswer: "" };
      itemTimer = prohibited ? null : core.createItemTimer();
      if (prohibited) complete(); else render();
    });
  }
  function background() {
    app.innerHTML = `<h2>あなたについて</h2><p class="lead">すべて任意です。答えたくない質問は，そのまま次へ進めます。</p><form id="background-form" class="card"><div class="fields">${data.background.map(field => selectField(field, state.background)).join("")}</div></form><div class="actions"><span class="quiet">次は，日常の英語使用についてです。</span>${button("next", "次へ →")}</div>${quitButton()}`;
    const form = document.querySelector("#background-form");
    form.addEventListener("submit", event => event.preventDefault());
    form.addEventListener("input", event => { state.background[event.target.name] = event.target.value; });
    on("next", () => { state.background = Object.fromEntries(new FormData(form)); state.stage = "daily"; render(); });
  }
  function daily() {
    const values = state.daily;
    const exams = values.exam_types || [];
    const materials = values.reading_materials || [];
    const scalar = id => escape(values[id] || "");
    const section = (number, content) => `<section class="card"><p class="eyebrow">${number} / 6</p>${content}</section>`;
    app.innerHTML = `<h2>日常の英語使用</h2><p class="lead">すべて任意です。頻度・時間・読むものは，最近1か月の生活を目安にお答えください。</p><form id="daily-form">
      ${section(1, `<fieldset class="plain-fieldset"><legend>受験したことのある英語資格試験と，最新のスコア・級を教えてください。</legend><p class="quiet">当てはまる試験をすべて選んでください。スコア等が不明な場合は空欄にできます。</p>${checkGroup("exam_types", data.examTypes, exams)}</fieldset>
      <div id="toeic-fields" class="dependent fields"><label class="field">最新のTOEIC L&R合計スコア<input name="toeic_lr_total" type="number" min="10" max="990" step="5" inputmode="numeric" value="${scalar("toeic_lr_total")}"><small>ListeningとReadingの合計（10〜990点）。最高点ではなく最新の得点です。</small></label><label class="field">同じ回のReadingスコア（分かる場合）<input name="toeic_lr_reading" type="number" min="5" max="495" step="5" inputmode="numeric" value="${scalar("toeic_lr_reading")}"><small>Readingのみ（5〜495点）。</small></label><label class="field">そのテストの受験年月（分かる場合）<input name="toeic_test_month" type="month" min="1979-01" max="${new Date().toISOString().slice(0, 7)}" value="${scalar("toeic_test_month")}"></label></div>
      <div id="eiken-fields" class="dependent"><label class="field">英検の最新の合格級<select name="eiken_latest_passed_grade"><option value="">回答しない</option>${data.eikenGrades.map(([value, label]) => `<option value="${value}"${values.eiken_latest_passed_grade === value ? " selected" : ""}>${label}</option>`).join("")}</select><small>まだ合格したことがない場合は「合格した級はない」を選べます。</small></label></div>
      <div id="other-exam-fields" class="dependent"><label class="field">その他の試験名と最新のスコア・級<textarea name="other_exam_details" rows="2" maxlength="500">${scalar("other_exam_details")}</textarea></label></div>`)}
      ${section(2, selectField(data.daily[0], values))}
      ${section(3, selectField(data.daily[1], values))}
      ${section(4, `<fieldset class="plain-fieldset"><legend>授業以外で読む英語の文章に当てはまるものをすべて選んでください。</legend>${checkGroup("reading_materials", data.readingMaterials, materials)}</fieldset><div id="other-material-fields" class="dependent"><label class="field">その他の文章（任意）<input name="reading_materials_other" type="text" maxlength="200" value="${scalar("reading_materials_other")}"></label></div>`)}
      ${section(5, selectField(data.daily[2], values))}
      ${section(6, selectField(data.daily[3], values) + '<p class="quiet">旅行・留学・居住など，1回の連続した滞在が3か月以上の場合を含みます。複数回の合計期間ではありません。</p>')}
      </form>${errorBox()}<div class="actions">${button("back", "← 戻る", true)}${button("next", "回答のしかたへ →")}</div>${quitButton()}`;
    const form = document.querySelector("#daily-form");
    form.addEventListener("submit", event => event.preventDefault());
    function selection(name) { return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value); }
    function dependents() {
      const selectedExams = selection("exam_types"), selectedMaterials = selection("reading_materials");
      for (const [id, visible] of [["toeic-fields", selectedExams.includes("toeic_lr")], ["eiken-fields", selectedExams.includes("eiken")], ["other-exam-fields", selectedExams.includes("other")], ["other-material-fields", selectedMaterials.includes("other")]]) {
        const group = document.getElementById(id); group.hidden = !visible;
        for (const input of group.querySelectorAll("input,select,textarea")) { input.disabled = !visible; if (!visible) input.value = ""; }
      }
    }
    function capture() { state.daily = { ...Object.fromEntries(new FormData(form)), exam_types: selection("exam_types"), reading_materials: selection("reading_materials") }; }
    form.addEventListener("input", () => { capture(); document.querySelector("#error").hidden = true; });
    form.addEventListener("change", event => {
      const input = event.target;
      if (["exam_types", "reading_materials"].includes(input.name) && input.checked) {
        for (const other of form.querySelectorAll(`input[name="${input.name}"]`)) {
          if (other !== input && (input.value === "none" || other.value === "none")) other.checked = false;
        }
      }
      dependents(); capture();
    });
    dependents();
    on("back", () => { capture(); state.stage = "background"; render(); });
    on("next", () => {
      if (!form.reportValidity()) return;
      capture();
      const total = state.daily.toeic_lr_total, reading = state.daily.toeic_lr_reading;
      if (total && reading && (Number(total) - Number(reading) < 5 || Number(total) - Number(reading) > 495)) { fail("合計スコアとReadingスコアをご確認ください。同じ回のListeningスコアに相当する差は5〜495点です。"); return; }
      state.stage = "practice"; render();
    });
  }
  function likert(name, selected) {
    return `<div class="likert">${data.choices.map(([value, label]) => `<label class="option"><input type="radio" name="${name}" value="${value}"${checked(selected === value)}><span><b>${value}</b>${label}</span></label>`).join("")}</div>`;
  }
  function practice() {
    app.innerHTML = `<h2>回答のしかた</h2><p class="lead">これから，自分にどのくらい当てはまるかを1〜5から選んでいただきます。数字が大きいほど「よく当てはまる」を表します。</p><p class="quiet">英語と日本語の質問は，それぞれまとまって表示されます。画面に示された言語についてお答えください。選択後に「次へ」で進みます。自動では切り替わりません。</p><fieldset class="question"><legend>回答例：私は，夏より冬が好きだ。</legend>${likert("practice", state.practiceAnswer)}</fieldset><p class="quiet">とてもよく当てはまると感じたら「5」，まったく当てはまらないと感じたら「1」，どちらともいえない場合は「3」を選びます。正解はありません。</p><div class="notice">この例は操作を試すためのものです。選ばずに進んでも構いません。練習の回答は保存・分析しません。本番では「回答しない」や「経験がなく判断できない」も選べます。</div><p class="quiet">上の進捗バーは画面数を基準にしています。残り時間の予測ではありません。前の画面に戻ると進捗も戻ります。</p><div class="actions">${button("back", "← 戻る", true)}${button("next", "質問をはじめる →")}</div>${quitButton()}`;
    for (const input of app.querySelectorAll('[name="practice"]')) input.addEventListener("change", event => { state.practiceAnswer = event.target.value; });
    on("back", () => { state.stage = "daily"; render(); });
    on("next", () => { state.stage = "questions"; state.page = 0; render(); });
  }
  function questionCard(id, position) {
    const item = byId[id];
    return `<fieldset class="question" id="question-${id}"><legend><span class="number">${String(position).padStart(2, "0")}</span>${escape(item.text)}</legend>${likert(id, state.answers[id])}<div class="missing-options">${[["NA", "経験がなく判断できない"], ["SKIP", "回答しない"]].map(([value, label]) => `<label><input type="radio" name="${id}" value="${value}"${checked(state.answers[id] === value)}>${label}</label>`).join("")}</div></fieldset>`;
  }
  function questions() {
    const page = state.pages[state.page];
    const language = page.language === "ja" ? "日本語" : "英語";
    const blockPages = state.pages.filter(p => p.language === page.language);
    const blockPosition = blockPages.indexOf(page) + 1;
    app.innerHTML = `<h2>${language}を読むときの気持ち</h2><p class="language-label">${language}について · ${blockPosition} / ${blockPages.length} 項目</p><p class="lead">${blockPosition === 1 ? `ここからは${language}の読解についてお聞きします。` : ""}ふだん${language}の文章を読むときの自分に，最もよく当てはまるものを選んでください。</p>${byId[page.ids[0]].dimension === "classroom" ? '<p class="quiet">この項目では授業の経験を思い浮かべてください。経験がなく判断できない場合は，無理に想像する必要はありません。</p>' : ""}<div id="questions">${questionCard(page.ids[0], state.page + 1)}</div>${errorBox()}<div class="actions">${button("back", "← 戻る", true)}${button("next", state.page === state.pages.length - 1 ? "自由記述へ →" : "次へ →")}</div>${quitButton()}`;
    document.querySelector("#questions").addEventListener("change", event => {
      const input = event.target;
      if (!byId[input.name] || !core.validResponses.has(input.value)) return;
      itemTimer?.respond(input.name, input.value);
      state.answers[input.name] = input.value;
      input.closest("fieldset").classList.remove("invalid");
      const remaining = page.ids.filter(id => !core.validResponses.has(state.answers[id])).length;
      const message = document.querySelector("#error");
      if (remaining === 0) message.hidden = true;
      else if (!message.hidden) fail(`このページに未選択の項目が${remaining}件あります。回答しない場合は「回答しない」を選んでください。`);
      progress();
    });
    on("back", () => { if (state.page === 0) state.stage = "practice"; else state.page--; render(); });
    on("next", () => {
      const missing = page.ids.filter(id => !core.validResponses.has(state.answers[id]));
      if (missing.length) { fail(`このページに未選択の項目が${missing.length}件あります。回答しない場合は「回答しない」を選んでください。`); missing.forEach(id => document.querySelector(`#question-${id}`).classList.add("invalid")); document.querySelector(`#question-${missing[0]} input`).focus(); return; }
      if (state.page === state.pages.length - 1) state.stage = "open"; else state.page++;
      render();
    });
  }
  function open() {
    app.innerHTML = `<h2>自由記述（任意）</h2><p class="lead">書ける範囲で構いません。空欄のまま次へ進むこともできます。</p><p class="quiet">氏名・学籍番号・連絡先や，あなた・他の人が特定される詳しい情報は書かないでください。各2,000文字以内です。</p>${data.openQuestions.map(field => `<label class="field card">${field.label}<textarea id="${field.id}" rows="5" maxlength="2000">${escape(state.openResponses[field.id])}</textarea></label>`).join("")}<div class="actions">${button("back", "← 戻る", true)}${button("next", "回答を確認する →")}</div>${quitButton()}`;
    for (const field of data.openQuestions) document.getElementById(field.id).addEventListener("input", event => { state.openResponses[field.id] = event.target.value; });
    on("back", () => { state.stage = "questions"; state.page = state.pages.length - 1; render(); });
    on("next", () => { state.stage = "review"; render(); });
  }
  function responseLabel(value) { return ({ NA: "経験がなく判断できない", SKIP: "回答しない" })[value] || `${value} ${data.choices.find(choice => choice[0] === value)?.[1] ?? ""}`; }
  function review() {
    const actual = data.items.filter(item => item.dimension !== "attention");
    const count = value => actual.filter(item => state.answers[item.id] === value).length;
    app.innerHTML = `<h2>回答を確認して，CSVを保存</h2><p class="lead">保存前に回答を確認できます。変更する場合は「戻る」から前の画面へ移動してください。</p><div class="summary"><div><strong>${actual.filter(item => /^[1-5]$/.test(state.answers[item.id])).length}</strong><span class="quiet">1〜5の回答</span></div><div><strong>${count("NA")}</strong><span class="quiet">判断できない</span></div><div><strong>${count("SKIP")}</strong><span class="quiet">回答しない</span></div></div><details><summary>気持ちの質問への回答を表示</summary><table class="review-table"><tbody>${state.pages.flatMap(page => page.ids).map(id => `<tr><th scope="row">${escape(byId[id].text)}</th><td>${escape(responseLabel(state.answers[id]))}</td></tr>`).join("")}</tbody></table></details>${useControl()}<div class="notice">${preview ? "試作版のCSVには preview と記録します。本調査の回答には使用しないでください。" : escape(config.submissionInstructions)}<br>保存しただけでは，研究者に回答は届きません。</div>${errorBox()}<div class="actions">${button("back", "← 戻る", true)}${button("complete", "回答を完了してCSVを保存 ↓")}</div>${quitButton()}`;
    bindUseControl("complete");
    on("back", () => { state.stage = "open"; render(); });
    on("complete", complete);
  }
  function complete() {
    try {
      itemTimer?.end();
      state.timings = itemTimer?.snapshot() || {};
      state.completedAt = new Date().toISOString();
      state.elapsedSeconds = (performance.now() - state.startedClock) / 1000;
      const csv = core.toCsv([core.buildRecord(config, data, state)]);
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      fileUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      fileName = `reading_${config.mode}_${state.researchUseProhibited ? "no_use_" : ""}${state.id}.csv`;
      if (state.researchUseProhibited) { state.answers = {}; state.background = {}; state.daily = {}; state.openResponses = {}; state.practiceAnswer = ""; state.pages = []; state.timings = {}; }
      itemTimer = null;
      state.stage = "done"; render(); document.querySelector("#download").click();
    } catch (error) { fail(`CSVを作成できませんでした。${error.message} 回答はこの画面に保持しています。`); }
  }
  function done() {
    const prohibited = state.researchUseProhibited;
    app.innerHTML = `<div class="hero"><div class="check-icon" aria-hidden="true">✓</div><h1>${prohibited ? "データを利用しない意思を記録しました。" : "回答が完了しました。"}</h1><p class="lead">CSVファイルのダウンロードを開始しました。端末のダウンロード一覧または「ファイル」アプリで保存を確認してください。</p>${prohibited ? '<div class="notice">CSVには質問への回答内容・得点・自由記述を含めていません。画面内の回答内容も消去しました。このファイルは利用不可の意思を伝えるための記録です。</div>' : ""}</div><section class="card"><h2>ファイルを確認してください</h2><p class="filename">${escape(fileName)}</p><p class="quiet">保存画面が開く場合は保存先を指定してください。保存されていない場合は，同じCSVをもう一度保存できます。</p><p><a id="download" class="button" href="${fileUrl}" download="${escape(fileName)}">CSVをもう一度保存 ↓</a></p><p class="quiet">Excelで日本語を読みやすい形式（UTF-8 BOM付き）です。</p></section><section class="card"><h2>${preview ? "動作確認はここまでです" : prohibited ? "必要に応じて利用不可の記録を提出してください" : "最後に，CSVを提出してください"}</h2><p>${preview ? "これは試作版の記録です。研究データとして提出せず，保存できることをご確認ください。" : escape(config.submissionInstructions)}</p>${preview ? "" : submissionLink()}${prohibited ? '<p class="quiet">既に回答CSVを提出した場合は，そのファイルの回答者IDとともに研究責任者へ連絡してください。別の回に作成したIDとは自動照合できません。</p>' : ""}<p class="quiet">このページには提出完了を確認する機能はありません。</p></section><p class="quiet">このアンケートは，個人の不安を診断したり，英語力を判定したりするものではありません。</p><button type="button" class="text-button" id="clear">画面内の記録を消去して終了する</button>`;
    on("clear", reset);
  }
  function reset() { itemTimer = null; if (fileUrl) URL.revokeObjectURL(fileUrl); fileUrl = ""; fileName = ""; state = { stage: "welcome" }; render(); }
  function render() {
    itemTimer?.end();
    ({ welcome, background, daily, practice, questions, open, review, done })[state.stage](); progress();
    on("quit", () => { if (confirm("この画面内の回答を消去して中止します。よろしいですか？")) reset(); });
    focusTop();
    if (state.stage === "questions") itemTimer?.begin(state.pages[state.page].ids[0], !document.hidden && document.hasFocus());
  }
  const updateTimingVisibility = () => itemTimer?.setActive(!document.hidden && document.hasFocus());
  document.addEventListener("visibilitychange", updateTimingVisibility);
  window.addEventListener("focus", updateTimingVisibility);
  window.addEventListener("blur", updateTimingVisibility);
  window.addEventListener("beforeunload", event => { if (!["welcome", "done"].includes(state.stage)) { event.preventDefault(); event.returnValue = ""; } });
  const configErrors = core.validateStudy(config);
  if (configErrors.length) { app.innerHTML = `<div class="notice"><h2>調査の準備中です</h2><p>設定が完了するまで回答を開始できません。</p><p class="quiet">設定項目：${escape(configErrors.join("、"))}</p></div>`; return; }
  if (preview) { const banner = document.querySelector("#mode-banner"); banner.hidden = false; banner.textContent = "試作版 · 現在は動作確認用です。本調査の募集は開始していません。"; }
  render();
})();
