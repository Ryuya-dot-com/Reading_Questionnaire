/* 静的ページのみで動作。回答を送信する処理やブラウザへの永続保存は行わない。 */
(function () {
  "use strict";
  const config = globalThis.SURVEY_CONFIG;
  const data = globalThis.SurveyData;
  const core = globalThis.SurveyCore;
  const app = document.querySelector("#app");
  const byId = Object.fromEntries(data.items.map(item => [item.id, item]));
  let state = { stage: "welcome" };
  let fileUrl = "";
  let fileName = "";
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const preview = config.mode === "preview";
  function button(id, text, secondary = false) { return `<button type="button" id="${id}"${secondary ? ' class="secondary"' : ""}>${text}</button>`; }
  function errorBox() { return '<p id="error" class="error" role="alert" hidden></p>'; }
  function fail(message) { const el = document.querySelector("#error"); el.textContent = message; el.hidden = false; }
  function focusTop() { const title = app.querySelector("h1,h2"); title?.setAttribute("tabindex", "-1"); title?.focus(); window.scrollTo(0, 0); }
  function on(id, fn) { document.getElementById(id)?.addEventListener("click", fn); }
  function submissionLink() {
    try {
      const url = new URL(config.submissionUrl);
      if (url.protocol !== "https:") return "";
      return `<p><a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">指定された提出先を開く ↗</a></p>`;
    } catch { return ""; }
  }
  function progress() {
    const shown = ["background", "questions", "review"].includes(state.stage);
    document.querySelector("#progress-area").hidden = !shown;
    if (!shown) return;
    const answered = Object.values(state.answers).filter(value => core.validResponses.has(value)).length;
    document.querySelector("#progress").value = answered;
    document.querySelector("#progress-text").textContent = `${answered} / ${data.items.length} 項目を選択済み`;
    document.querySelector("#step-label").textContent = state.stage === "background" ? "はじめに · あなたについて" : state.stage === "review" ? "最後に · 回答の確認" : `パート${state.pages[state.page].part} · ${state.page + 1} / ${state.pages.length} ページ`;
  }
  function welcome() {
    app.innerHTML = `<div class="hero"><p class="eyebrow">READING EXPERIENCE SURVEY</p><h1>英語を読むとき、<br>どんな気持ちになりますか。</h1><p class="lead">ふだん英語の文章を読むときの気持ちをお聞きします。<br>英語力を判定するテストではありません。正解も不正解もありません。</p><div class="facts"><span><strong>32</strong>項目 ＋ 確認1項目</span><span><strong>10–15</strong>分程度（目安）</span><span>氏名・学籍番号の入力なし</span></div></div>
      <section class="card"><h2>参加する前に</h2><p>日本語を母語とする、18歳以上の英語学習者を対象としています。日本語が複数の母語の一つである方も含みます。</p><ul class="list"><li>目的は、英語を読むときの不安や楽しさと、学習経験との関連を調べることです。</li><li>参加は自由です。回答したくない項目は「回答しない」を選べます。経験がなく判断できない場合は、その選択肢を選んでください。</li><li>気持ちについて考えることで負担を感じた場合は、いつでも中止できます。参加しないことによる不利益はありません。</li><li>回答はこのページを開いている間だけ保持します。再読み込みや終了で消えるため、最後にCSVを保存してください。</li><li>この画面から回答は自動送信されません。CSVの提出先では、LMS等のアカウントによって提出者が分かる場合があります。</li></ul>
      ${preview ? '<div class="notice"><strong>現在は動作確認用の試作版です。</strong><br>研究の募集は行っていません。出力するCSVにも「preview」と記録します。責任者・問い合わせ先・データの保管や撤回の説明は、本調査の開始前に設定します。試したCSVは本調査の回答として提出しないでください。</div>' : `<p>研究責任者：${escape(config.researcher)}<br>所属：${escape(config.affiliation)}<br>問い合わせ先：${escape(config.contact)}</p><p>${escape(config.ethicsStatement)}</p><p>データの保管・利用：${escape(config.retentionStatement)}</p><p>提出後の撤回：${escape(config.withdrawalStatement)}</p>`}
      <p class="quiet">サイトの配信にはGitHub Pagesを利用しています。ページへのアクセス情報は配信サービス側で処理されます。アンケートの回答にアクセス情報を追加することはありません。</p></section>
      <form id="consent-form" class="card"><h2>${preview ? "試作版を試す" : "参加の確認"}</h2>
      <label class="consent-check"><input type="checkbox" name="age" required><span>18歳以上です。</span></label>
      <label class="consent-check"><input type="checkbox" name="language" required><span>日本語が母語で、英語を学んでいます。</span></label>
      <label class="consent-check"><input type="checkbox" name="consent" required><span>${preview ? "上の説明を読み、動作確認用の試作版であることを理解して試します。" : "上の説明を読み、自分の意思でこの調査に参加することに同意します。"}</span></label>
      <div class="actions"><span class="quiet">当てはまる場合のみチェックしてください。</span>${button("start", preview ? "試作版をはじめる →" : "同意してはじめる →")}</div></form>`;
    document.querySelector("#consent-form").addEventListener("submit", event => event.preventDefault());
    on("start", () => {
      if (!document.querySelector("#consent-form").reportValidity()) return;
      state = { stage: "background", id: `rq-${crypto.randomUUID()}`, consentedAt: new Date().toISOString(), startedClock: performance.now(), pages: core.makePages(data.items), page: 0, answers: {}, background: {}, feedback: "" };
      render();
    });
  }
  function background() {
    app.innerHTML = `<p class="eyebrow">BEFORE WE BEGIN</p><h2>あなたについて</h2><p class="lead">すべて任意です。答えたくない質問は、そのまま次へ進めます。</p><form id="background-form" class="card"><div class="fields">
      ${data.background.map(field => `<label class="field">${escape(field.label)}<select name="${field.id}"><option value="SKIP">回答しない</option>${field.options.map(([value, label]) => `<option value="${value}"${state.background[field.id] === value ? " selected" : ""}>${escape(label)}</option>`).join("")}</select></label>`).join("")}
      <label class="field">TOEIC L&RのReadingスコア（任意）<input type="number" name="toeic_lr_reading" min="5" max="495" step="5" inputmode="numeric" value="${escape(state.background.toeic_lr_reading)}"><small>Listeningとの合計ではなく、Readingのみ（5〜495点）。受験したことがなければ空欄で構いません。</small></label>
      <label class="field">そのテストの受験年月（任意）<input type="month" name="toeic_test_month" min="1979-01" max="${new Date().toISOString().slice(0, 7)}" value="${escape(state.background.toeic_test_month)}"><small>分からない場合は空欄で構いません。</small></label></div></form>${errorBox()}
      <div class="actions"><span class="quiet">次は、ふだん英語を読むときの気持ちについてです。</span>${button("next", "質問へ進む →")}</div><button type="button" class="text-button" id="quit">中止して回答を消去する</button>`;
    const form = document.querySelector("#background-form");
    form.addEventListener("submit", event => event.preventDefault());
    form.addEventListener("input", event => { state.background[event.target.name] = event.target.value; });
    on("next", () => {
      if (!form.reportValidity()) return;
      state.background = Object.fromEntries(new FormData(form));
      if (state.background.toeic_test_month && !state.background.toeic_lr_reading) { fail("受験年月を記入する場合はReadingスコアも入力するか、両方を空欄にしてください。"); return; }
      state.stage = "questions"; state.page = 0; render();
    });
  }
  function questionCard(id, position) {
    const item = byId[id];
    return `<fieldset class="question" id="question-${id}"><legend><span class="number">${String(position).padStart(2, "0")}</span>${escape(item.text)}</legend>
      <div class="likert">${data.choices.map(([value, label]) => `<label class="option"><input type="radio" name="${id}" value="${value}"${state.answers[id] === value ? " checked" : ""}><span><b>${value}</b>${label}</span></label>`).join("")}</div>
      <div class="missing-options">${[["NA", "経験がなく判断できない"], ["SKIP", "回答しない"]].map(([value, label]) => `<label><input type="radio" name="${id}" value="${value}"${state.answers[id] === value ? " checked" : ""}>${label}</label>`).join("")}</div></fieldset>`;
  }
  function questions() {
    const page = state.pages[state.page];
    const offset = state.pages.slice(0, state.page).reduce((n, p) => n + p.ids.length, 0);
    app.innerHTML = `<p class="eyebrow">PART ${page.part} · EVERYDAY READING</p><h2>${page.part === "A" ? "英語を読むときの気持ち" : "英語を読む経験について"}</h2><p class="lead">特定の授業だけでなく、ふだん英語の文章を読むときのことを思い浮かべてください。それぞれの文について、最もよく当てはまるものを選んでください。</p><p class="quiet">授業場面の項目では授業の経験を思い浮かべてください。経験がなく判断できない場合は、無理に想像する必要はありません。</p>
      <div id="questions">${page.ids.map((id, i) => questionCard(id, offset + i + 1)).join("")}</div>${errorBox()}
      <div class="actions">${button("back", "← 戻る", true)}${button("next", state.page === state.pages.length - 1 ? "回答を確認する →" : "次へ →")}</div><button type="button" class="text-button" id="quit">中止して回答を消去する</button>`;
    document.querySelector("#questions").addEventListener("change", event => {
      const input = event.target;
      if (!byId[input.name] || !core.validResponses.has(input.value)) return;
      state.answers[input.name] = input.value;
      input.closest("fieldset").classList.remove("invalid");
      const remaining = page.ids.filter(id => !core.validResponses.has(state.answers[id])).length;
      const message = document.querySelector("#error");
      if (remaining === 0) message.hidden = true;
      else if (!message.hidden) fail(`このページに未選択の項目が${remaining}件あります。回答しない場合は「回答しない」を選んでください。`);
      progress();
    });
    on("back", () => { if (state.page === 0) state.stage = "background"; else state.page--; render(); });
    on("next", () => {
      const missing = page.ids.filter(id => !core.validResponses.has(state.answers[id]));
      if (missing.length) {
        fail(`このページに未選択の項目が${missing.length}件あります。回答しない場合は「回答しない」を選んでください。`);
        missing.forEach(id => document.querySelector(`#question-${id}`).classList.add("invalid"));
        document.querySelector(`#question-${missing[0]} input`).focus(); return;
      }
      if (state.page === state.pages.length - 1) state.stage = "review"; else state.page++;
      render();
    });
  }
  function responseLabel(value) { return ({ NA: "経験がなく判断できない", SKIP: "回答しない" })[value] || `${value} ${data.choices.find(choice => choice[0] === value)?.[1] ?? ""}`; }
  function review() {
    const actual = data.items.filter(item => item.dimension !== "attention");
    const count = value => actual.filter(item => state.answers[item.id] === value).length;
    app.innerHTML = `<p class="eyebrow">REVIEW & SAVE</p><h2>回答を確認して、CSVを保存</h2><p class="lead">保存する前に、回答を確認できます。保存後は、調査担当者が指定する提出先へCSVを提出してください。</p><div class="summary"><div><strong>${actual.filter(item => /^[1-5]$/.test(state.answers[item.id])).length}</strong><span class="quiet">1〜5の回答</span></div><div><strong>${count("NA")}</strong><span class="quiet">判断できない</span></div><div><strong>${count("SKIP")}</strong><span class="quiet">回答しない</span></div></div>
      <details><summary>これまでの回答を表示</summary><table class="review-table"><tbody>${state.pages.flatMap(page => page.ids).map(id => `<tr><th scope="row">${escape(byId[id].text)}</th><td>${escape(responseLabel(state.answers[id]))}</td></tr>`).join("")}</tbody></table></details>
      <label class="field card">質問文や画面について気づいたこと（任意）<textarea id="feedback" rows="3" maxlength="500" placeholder="分かりにくい表現などがあればご記入ください。">${escape(state.feedback)}</textarea><small>500文字以内。氏名・学籍番号・連絡先などは書かないでください。</small></label>
      <div class="notice">${preview ? "試作版のCSVには preview と記録します。本調査の回答には使用しないでください。" : escape(config.submissionInstructions)}<br>この操作だけでは、研究者に回答は届きません。</div>${errorBox()}
      <div class="actions">${button("back", "← 回答を見直す", true)}${button("complete", "回答を完了してCSVを保存 ↓")}</div><button type="button" class="text-button" id="quit">中止して回答を消去する</button>`;
    document.querySelector("#feedback").addEventListener("input", event => { state.feedback = event.target.value; });
    on("back", () => { state.stage = "questions"; state.page = state.pages.length - 1; render(); });
    on("complete", () => {
      if (state.stage !== "review") return;
      try {
        state.completedAt = new Date().toISOString();
        state.elapsedSeconds = (performance.now() - state.startedClock) / 1000;
        const record = core.buildRecord(config, data, state);
        const csv = core.toCsv([record]);
        if (fileUrl) URL.revokeObjectURL(fileUrl);
        fileUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        fileName = `reading_${config.mode}_${state.id}.csv`;
        state.stage = "done";
        render();
        document.querySelector("#download").click();
      } catch (error) { fail(`CSVを作成できませんでした。${error.message} 回答はこの画面に保持しています。`); }
    });
  }
  function done() {
    app.innerHTML = `<div class="hero"><div class="check-icon" aria-hidden="true">✓</div><p class="eyebrow">READY TO DOWNLOAD</p><h1>回答が完了しました。</h1><p class="lead">CSVファイルのダウンロードを開始しました。<br>端末のダウンロード一覧または「ファイル」アプリで保存を確認してください。</p></div><section class="card"><h2>ファイルを確認してください</h2><p class="filename">${escape(fileName)}</p><p class="quiet">保存画面が開く場合は保存先を指定してください。保存されていない場合は、下のボタンから同じCSVをもう一度保存できます。</p><p><a id="download" class="button" href="${fileUrl}" download="${escape(fileName)}">CSVをもう一度保存 ↓</a></p><p class="quiet">Excelで日本語を読みやすい形式（UTF-8 BOM付き）です。</p></section>
      <section class="card"><h2>${preview ? "動作確認はここまでです" : "最後に、CSVを提出してください"}</h2><p>${preview ? "これは試作版の回答です。研究データとして提出せず、保存できることをご確認ください。" : escape(config.submissionInstructions)}</p>${preview ? "" : submissionLink()}<p class="quiet">このページには提出完了を確認する機能はありません。${preview ? "" : "提出先の受付画面もご確認ください。"}</p></section><p class="quiet">このアンケートは、個人の不安を診断したり、英語力を判定したりするものではありません。</p><button type="button" class="text-button" id="clear">画面内の回答を消去して終了する</button>`;
    on("clear", () => reset());
  }
  function reset() {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    fileUrl = ""; fileName = ""; state = { stage: "welcome" }; render();
  }
  function render() {
    ({ welcome, background, questions, review, done })[state.stage]();
    progress();
    on("quit", () => { if (confirm("この画面内の回答を消去して中止します。よろしいですか？")) reset(); });
    focusTop();
  }
  window.addEventListener("beforeunload", event => {
    if (["background", "questions", "review"].includes(state.stage)) { event.preventDefault(); event.returnValue = ""; }
  });
  const configErrors = core.validateStudy(config);
  if (configErrors.length) {
    app.innerHTML = `<div class="notice"><h2>調査の準備中です</h2><p>設定が完了するまで回答を開始できません。</p><p class="quiet">設定項目：${escape(configErrors.join("、"))}</p></div>`;
    return;
  }
  if (preview) {
    const banner = document.querySelector("#mode-banner"); banner.hidden = false;
    banner.textContent = "試作版 · 現在は動作確認用です。本調査の募集は開始していません。";
  }
  render();
})();
