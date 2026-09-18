(function () {
  "use strict";

  const STORAGE_KEY = "decisionMatrixState.v1";
  const MAX_OPTIONS = 5;
  const MAX_CRITERIA = 8;

  const TEMPLATES = [
    {
      key: "job",
      keywords: ["job", "offer", "position", "career", "work", "employer", "role"],
      criteria: ["Salary", "Growth potential", "Work-life balance", "Team & culture", "Location / commute"],
    },
    {
      key: "housing",
      keywords: ["apartment", "rent", "housing", "lease", "flat", "condo", "house", "move"],
      criteria: ["Rent / price", "Location", "Size / layout", "Amenities", "Commute"],
    },
    {
      key: "school",
      keywords: ["school", "college", "university", "program", "degree", "grad", "masters", "phd"],
      criteria: ["Cost", "Reputation", "Location", "Program fit", "Career outcomes"],
    },
    {
      key: "general",
      keywords: [],
      criteria: ["Cost", "Quality", "Convenience", "Long-term value"],
    },
  ];

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore corrupt state */ }
    return null;
  }

  function defaultState() {
    const o1 = { id: uid(), name: "" };
    const o2 = { id: uid(), name: "" };
    return {
      decisionTitle: "",
      options: [o1, o2],
      criteria: [],
      scores: {},
      dismissedTemplate: false,
    };
  }

  let state = loadState() || defaultState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getScore(optionId, criterionId) {
    const v = state.scores[optionId] && state.scores[optionId][criterionId];
    return typeof v === "number" ? v : 5;
  }

  function setScore(optionId, criterionId, value) {
    if (!state.scores[optionId]) state.scores[optionId] = {};
    state.scores[optionId][criterionId] = value;
  }

  // ---------- Template suggestion ----------

  function suggestTemplate(title) {
    const t = title.toLowerCase();
    if (!t.trim()) return null;
    for (const tpl of TEMPLATES) {
      if (tpl.key === "general") continue;
      if (tpl.keywords.some((kw) => t.includes(kw))) return tpl;
    }
    return null;
  }

  function renderTemplateSuggestion() {
    const el = document.getElementById("template-suggestion");
    if (state.criteria.length > 0 || state.dismissedTemplate) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    const tpl = suggestTemplate(state.decisionTitle);
    if (!tpl) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    el.classList.remove("hidden");
    el.innerHTML = "";
    const span = document.createElement("span");
    span.textContent = "Suggested criteria: " + tpl.criteria.join(", ");
    const btnWrap = document.createElement("div");
    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.textContent = "Use these";
    useBtn.addEventListener("click", () => {
      applyTemplate(tpl);
    });
    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.textContent = "Dismiss";
    dismissBtn.style.background = "transparent";
    dismissBtn.style.color = "var(--text-muted)";
    dismissBtn.addEventListener("click", () => {
      state.dismissedTemplate = true;
      saveState();
      renderAll();
    });
    btnWrap.appendChild(useBtn);
    btnWrap.appendChild(dismissBtn);
    el.appendChild(span);
    el.appendChild(btnWrap);
  }

  function applyTemplate(tpl) {
    const room = MAX_CRITERIA - state.criteria.length;
    const toAdd = tpl.criteria.slice(0, room);
    toAdd.forEach((name) => {
      state.criteria.push({ id: uid(), name, weight: 5 });
    });
    state.dismissedTemplate = true;
    saveState();
    renderAll();
  }

  // ---------- Options ----------

  function renderOptions() {
    const list = document.getElementById("options-list");
    list.innerHTML = "";
    state.options.forEach((opt, idx) => {
      const row = document.createElement("div");
      row.className = "option-row";

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Option " + (idx + 1);
      input.value = opt.name;
      input.addEventListener("input", (e) => {
        opt.name = e.target.value;
        saveState();
        renderResults();
        renderSensitivity();
        // keep table headers in sync without full re-render (avoid focus loss)
        updateScoreTableHeader(opt.id, opt.name);
      });
      row.appendChild(input);

      if (state.options.length > 2) {
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "btn-remove";
        rm.textContent = "✕";
        rm.title = "Remove option";
        rm.addEventListener("click", () => {
          state.options = state.options.filter((o) => o.id !== opt.id);
          delete state.scores[opt.id];
          saveState();
          renderAll();
        });
        row.appendChild(rm);
      }
      list.appendChild(row);
    });

    document.getElementById("add-option").disabled = state.options.length >= MAX_OPTIONS;
  }

  function updateScoreTableHeader(optionId, name) {
    const td = document.querySelector('.score-table td[data-option-id="' + optionId + '"]');
    if (td) td.textContent = name || "Option";
  }

  // ---------- Criteria ----------

  function renderCriteria() {
    const list = document.getElementById("criteria-list");
    list.innerHTML = "";

    if (state.criteria.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No criteria yet. Add what matters to this decision.";
      list.appendChild(empty);
    }

    state.criteria.forEach((crit) => {
      const row = document.createElement("div");
      row.className = "criterion-row";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "crit-name";
      nameInput.placeholder = "Criterion name";
      nameInput.value = crit.name;
      nameInput.addEventListener("input", (e) => {
        crit.name = e.target.value;
        saveState();
        updateScoreTableCritHeader(crit.id, crit.name);
        renderResults();
        renderSensitivity();
      });

      const weightWrap = document.createElement("div");
      weightWrap.className = "crit-weight-wrap";
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "1";
      slider.max = "10";
      slider.value = String(crit.weight);
      const weightVal = document.createElement("span");
      weightVal.className = "weight-value";
      weightVal.textContent = String(crit.weight);
      slider.addEventListener("input", (e) => {
        crit.weight = Number(e.target.value);
        weightVal.textContent = String(crit.weight);
        saveState();
        renderResults();
        renderSensitivity();
      });
      weightWrap.appendChild(slider);
      weightWrap.appendChild(weightVal);

      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn-remove";
      rm.textContent = "✕";
      rm.title = "Remove criterion";
      rm.addEventListener("click", () => {
        state.criteria = state.criteria.filter((c) => c.id !== crit.id);
        saveState();
        renderAll();
      });

      row.appendChild(nameInput);
      row.appendChild(weightWrap);
      row.appendChild(rm);
      list.appendChild(row);
    });

    document.getElementById("add-criterion").disabled = state.criteria.length >= MAX_CRITERIA;
  }

  function updateScoreTableCritHeader(critId, name) {
    const th = document.querySelector('.score-table th[data-crit-id="' + critId + '"]');
    if (th) th.textContent = name || "Criterion";
  }

  // ---------- Scoring grid ----------

  function renderScoringGrid() {
    const container = document.getElementById("scoring-grid");
    container.innerHTML = "";

    if (state.options.length === 0 || state.criteria.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Add options and criteria above to start scoring.";
      container.appendChild(empty);
      return;
    }

    const table = document.createElement("table");
    table.className = "score-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const corner = document.createElement("th");
    corner.textContent = "";
    headRow.appendChild(corner);
    state.criteria.forEach((crit) => {
      const th = document.createElement("th");
      th.textContent = crit.name || "Criterion";
      th.setAttribute("data-crit-id", crit.id);
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    state.options.forEach((opt) => {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.textContent = opt.name || "Option";
      nameCell.setAttribute("data-option-id", opt.id);
      row.appendChild(nameCell);

      state.criteria.forEach((crit) => {
        const cell = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        input.min = "1";
        input.max = "10";
        input.value = String(getScore(opt.id, crit.id));
        input.addEventListener("input", (e) => {
          let v = Number(e.target.value);
          if (Number.isNaN(v)) v = 1;
          v = Math.max(1, Math.min(10, v));
          setScore(opt.id, crit.id, v);
          saveState();
          renderResults();
          renderSensitivity();
        });
        cell.appendChild(input);
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  // ---------- Computation ----------

  function computeWeightedScores() {
    const totalWeight = state.criteria.reduce((s, c) => s + c.weight, 0);
    const results = state.options.map((opt) => {
      let sum = 0;
      const contributions = [];
      state.criteria.forEach((crit) => {
        const score = getScore(opt.id, crit.id);
        const contribution = crit.weight * score;
        sum += contribution;
        contributions.push({ criterion: crit, score, contribution });
      });
      const weighted = totalWeight > 0 ? sum / totalWeight : 0;
      return { option: opt, weighted, contributions };
    });
    results.sort((a, b) => b.weighted - a.weighted);
    return results;
  }

  function renderResults() {
    const container = document.getElementById("results");
    container.innerHTML = "";

    const hasNames = state.options.every((o) => o.name.trim());
    if (state.criteria.length === 0 || !hasNames) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Fill in option names and at least one criterion to see a result.";
      container.appendChild(empty);
      return;
    }

    const results = computeWeightedScores();
    const maxScore = Math.max(...results.map((r) => r.weighted), 1);
    const winner = results[0];

    const banner = document.createElement("div");
    banner.className = "winner-banner";
    banner.textContent = "🏆 " + (winner.option.name || "Option") + " comes out ahead";
    container.appendChild(banner);

    results.forEach((r, idx) => {
      const row = document.createElement("div");
      row.className = "result-row" + (idx === 0 ? " winner" : "");
      const name = document.createElement("div");
      name.className = "result-name";
      name.textContent = r.option.name || "Option";
      const track = document.createElement("div");
      track.className = "result-bar-track";
      const fill = document.createElement("div");
      fill.className = "result-bar-fill";
      fill.style.width = (maxScore > 0 ? (r.weighted / maxScore) * 100 : 0) + "%";
      track.appendChild(fill);
      const scoreEl = document.createElement("div");
      scoreEl.className = "result-score";
      scoreEl.textContent = r.weighted.toFixed(1);
      row.appendChild(name);
      row.appendChild(track);
      row.appendChild(scoreEl);
      container.appendChild(row);
    });

    // Why breakdown for the winner
    const why = document.createElement("div");
    why.className = "why-breakdown";
    const h3 = document.createElement("h3");
    h3.textContent = "Why " + (winner.option.name || "this option") + " won";
    why.appendChild(h3);

    const sortedContribs = winner.contributions.slice().sort((a, b) => b.contribution - a.contribution);
    const totalContrib = sortedContribs.reduce((s, c) => s + c.contribution, 0) || 1;
    sortedContribs.forEach((c) => {
      const item = document.createElement("div");
      item.className = "why-item";
      const label = document.createElement("span");
      label.textContent = c.criterion.name || "Criterion";
      const pct = document.createElement("span");
      pct.className = "contrib";
      pct.textContent = Math.round((c.contribution / totalContrib) * 100) + "% of score · rated " + c.score + "/10";
      item.appendChild(label);
      item.appendChild(pct);
      why.appendChild(item);
    });
    container.appendChild(why);
  }

  // ---------- Sensitivity analysis ----------
  // For the current leader vs each other option, find the weight a criterion
  // would need for that option to overtake the leader (holding other weights fixed).

  function computeSensitivity() {
    const results = computeWeightedScores();
    if (results.length < 2 || state.criteria.length === 0) return [];

    const leader = results[0];
    const findings = [];

    results.slice(1).forEach((challenger) => {
      state.criteria.forEach((crit) => {
        const otherCriteria = state.criteria.filter((c) => c.id !== crit.id);
        const K_leader = otherCriteria.reduce(
          (s, c) => s + c.weight * getScore(leader.option.id, c.id), 0
        );
        const K_challenger = otherCriteria.reduce(
          (s, c) => s + c.weight * getScore(challenger.option.id, c.id), 0
        );
        const a = getScore(leader.option.id, crit.id);
        const b = getScore(challenger.option.id, crit.id);

        if (a === b) return; // no crossover possible by moving this weight alone

        const wCross = (K_challenger - K_leader) / (a - b);

        if (wCross >= 0 && wCross <= 10 && Math.abs(wCross - crit.weight) > 0.05) {
          const currentWeight = crit.weight;
          const delta = wCross - currentWeight;
          const pctChange = currentWeight > 0 ? (delta / currentWeight) * 100 : null;
          findings.push({
            criterion: crit,
            leader: leader.option,
            challenger: challenger.option,
            currentWeight,
            crossWeight: wCross,
            pctChange,
          });
        }
      });
    });

    // Sort by smallest magnitude change first (most fragile / interesting first)
    findings.sort((f1, f2) => Math.abs(f1.crossWeight - f1.currentWeight) - Math.abs(f2.crossWeight - f2.currentWeight));
    return findings.slice(0, 6);
  }

  function renderSensitivity() {
    const container = document.getElementById("sensitivity");
    container.innerHTML = "";

    const hasNames = state.options.every((o) => o.name.trim());
    if (state.criteria.length === 0 || !hasNames || state.options.length < 2) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Sensitivity analysis will appear once you have at least 2 options, criteria, and scores.";
      container.appendChild(empty);
      return;
    }

    const findings = computeSensitivity();

    if (findings.length === 0) {
      const stable = document.createElement("p");
      stable.className = "sensitivity-stable";
      stable.textContent = "This result looks stable — no single weight, moved within its 1–10 range, flips the winner.";
      container.appendChild(stable);
      return;
    }

    findings.forEach((f) => {
      const item = document.createElement("div");
      item.className = "sensitivity-item";
      const dir = f.crossWeight > f.currentWeight ? "more" : "less";
      const pctText = f.pctChange !== null ? Math.abs(Math.round(f.pctChange)) + "%" : "a different amount";
      item.innerHTML =
        "If you valued <strong>" + escapeHtml(f.criterion.name || "this criterion") + "</strong> " +
        pctText + " " + dir + " (weight " + f.currentWeight + " → " + f.crossWeight.toFixed(1) + "), " +
        "<span class=\"flip-to\">" + escapeHtml(f.challenger.name || "another option") + "</span> would overtake " +
        escapeHtml(f.leader.name || "the current leader") + ".";
      container.appendChild(item);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Wiring ----------

  function renderAll() {
    document.getElementById("decision-title").value = state.decisionTitle;
    renderTemplateSuggestion();
    renderOptions();
    renderCriteria();
    renderScoringGrid();
    renderResults();
    renderSensitivity();
  }

  function init() {
    document.getElementById("decision-title").addEventListener("input", (e) => {
      state.decisionTitle = e.target.value;
      saveState();
      renderTemplateSuggestion();
    });

    document.getElementById("add-option").addEventListener("click", () => {
      if (state.options.length >= MAX_OPTIONS) return;
      state.options.push({ id: uid(), name: "" });
      saveState();
      renderAll();
    });

    document.getElementById("add-criterion").addEventListener("click", () => {
      if (state.criteria.length >= MAX_CRITERIA) return;
      state.criteria.push({ id: uid(), name: "", weight: 5 });
      saveState();
      renderAll();
    });

    document.getElementById("reset-btn").addEventListener("click", () => {
      if (!confirm("Reset everything? This clears your current decision.")) return;
      state = defaultState();
      saveState();
      renderAll();
    });

    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
