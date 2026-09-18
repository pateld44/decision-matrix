(function () {
  "use strict";

  const STORAGE_KEY = "decisionMatrix.v2";
  const LEGACY_STORAGE_KEY = "decisionMatrixState.v1";
  const MAX_OPTIONS = 5;
  const MAX_CRITERIA = 8;
  const HISTORY_PATTERN_MIN_COUNT = 2;
  const HISTORY_HIGH_WEIGHT_THRESHOLD = 7;

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

  function nowIso() {
    return new Date().toISOString();
  }

  // ---------- State ----------

  function newDecision() {
    return {
      id: uid(),
      title: "",
      options: [{ id: uid(), name: "" }, { id: uid(), name: "" }],
      criteria: [],
      scores: {},
      dismissedTemplate: false,
      createdAt: nowIso(),
    };
  }

  function defaultState() {
    return {
      currentDecision: newDecision(),
      history: [],
      view: "setup", // "setup" | "history"
      historySelectedId: null,
    };
  }

  function migrateLegacyState() {
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return null;
      const legacy = JSON.parse(raw);
      const s = defaultState();
      s.currentDecision = {
        id: uid(),
        title: legacy.decisionTitle || "",
        options: (legacy.options || []).map((o) => ({ id: o.id || uid(), name: o.name || "" })),
        criteria: (legacy.criteria || []).map((c) => ({ id: c.id || uid(), name: c.name || "", weight: c.weight || 5 })),
        scores: legacy.scores || {},
        dismissedTemplate: !!legacy.dismissedTemplate,
        createdAt: nowIso(),
      };
      return s;
    } catch (e) {
      return null;
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore corrupt state */ }
    return migrateLegacyState() || defaultState();
  }

  let state = loadState();

  function isDecisionComplete(decision) {
    return (
      decision.options.length >= 2 &&
      decision.options.every((o) => o.name.trim()) &&
      decision.criteria.length >= 1 &&
      decision.criteria.every((c) => c.name.trim())
    );
  }

  function syncCurrentIntoHistory() {
    const cur = state.currentDecision;
    if (!isDecisionComplete(cur)) return;
    const existingIdx = state.history.findIndex((h) => h.id === cur.id);
    const snapshot = {
      id: cur.id,
      title: cur.title,
      options: cur.options.map((o) => ({ id: o.id, name: o.name })),
      criteria: cur.criteria.map((c) => ({ id: c.id, name: c.name, weight: c.weight })),
      scores: JSON.parse(JSON.stringify(cur.scores)),
      createdAt: existingIdx >= 0 ? state.history[existingIdx].createdAt : cur.createdAt,
      updatedAt: nowIso(),
      outcome: existingIdx >= 0 ? state.history[existingIdx].outcome : null,
    };
    if (existingIdx >= 0) state.history[existingIdx] = snapshot;
    else state.history.push(snapshot);
  }

  function saveState() {
    syncCurrentIntoHistory();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getScore(decision, optionId, criterionId) {
    const v = decision.scores[optionId] && decision.scores[optionId][criterionId];
    return typeof v === "number" ? v : 5;
  }

  function setScore(decision, optionId, criterionId, value) {
    if (!decision.scores[optionId]) decision.scores[optionId] = {};
    decision.scores[optionId][criterionId] = value;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  // ---------- Template suggestion (keyword based) ----------

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
    const cur = state.currentDecision;
    if (cur.criteria.length > 0 || cur.dismissedTemplate) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    const tpl = suggestTemplate(cur.title);
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
    useBtn.addEventListener("click", () => applyTemplate(tpl));
    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.textContent = "Dismiss";
    dismissBtn.style.background = "transparent";
    dismissBtn.style.color = "var(--text-muted)";
    dismissBtn.addEventListener("click", () => {
      cur.dismissedTemplate = true;
      saveState();
      renderAll();
    });
    btnWrap.appendChild(useBtn);
    btnWrap.appendChild(dismissBtn);
    el.appendChild(span);
    el.appendChild(btnWrap);
  }

  function applyTemplate(tpl) {
    const cur = state.currentDecision;
    const room = MAX_CRITERIA - cur.criteria.length;
    const existingNames = new Set(cur.criteria.map((c) => c.name.trim().toLowerCase()));
    tpl.criteria
      .filter((name) => !existingNames.has(name.trim().toLowerCase()))
      .slice(0, room)
      .forEach((name) => cur.criteria.push({ id: uid(), name, weight: 5 }));
    cur.dismissedTemplate = true;
    saveState();
    renderAll();
  }

  // ---------- History-based signals ----------

  function otherHistory() {
    return state.history.filter((h) => h.id !== state.currentDecision.id);
  }

  function computeFrequentCriteria(historyEntries) {
    const map = new Map(); // key: lowercase name -> {name, totalWeight, count}
    historyEntries.forEach((h) => {
      h.criteria.forEach((c) => {
        const key = c.name.trim().toLowerCase();
        if (!key) return;
        if (!map.has(key)) map.set(key, { name: c.name.trim(), totalWeight: 0, count: 0 });
        const entry = map.get(key);
        entry.totalWeight += c.weight;
        entry.count += 1;
      });
    });
    const results = [];
    map.forEach((v) => {
      const avg = v.totalWeight / v.count;
      if (v.count >= HISTORY_PATTERN_MIN_COUNT && avg >= HISTORY_HIGH_WEIGHT_THRESHOLD) {
        results.push({ name: v.name, avg, count: v.count });
      }
    });
    results.sort((a, b) => b.avg - a.avg);
    return results.slice(0, 3);
  }

  function computeDivergencePattern(historyEntries) {
    const tally = new Map(); // key: lowercase name -> {name, count}
    historyEntries.forEach((h) => {
      if (!h.outcome || h.outcome.matchedRecommendation) return;
      const results = computeWeightedScores(h);
      if (results.length < 2) return;
      const recommended = results[0];
      const chosen = results.find((r) => r.option.id === h.outcome.actualOptionId);
      if (!chosen || chosen.option.id === recommended.option.id) return;

      let bestCrit = null;
      let bestDiff = -Infinity;
      h.criteria.forEach((crit) => {
        const chosenScore = getScore(h, chosen.option.id, crit.id);
        const recScore = getScore(h, recommended.option.id, crit.id);
        const diff = crit.weight * (chosenScore - recScore);
        if (diff > bestDiff) {
          bestDiff = diff;
          bestCrit = crit;
        }
      });
      if (bestCrit && bestDiff > 0) {
        const key = bestCrit.name.trim().toLowerCase();
        if (!key) return;
        if (!tally.has(key)) tally.set(key, { name: bestCrit.name.trim(), count: 0 });
        tally.get(key).count += 1;
      }
    });
    let top = null;
    tally.forEach((v) => {
      if (v.count >= HISTORY_PATTERN_MIN_COUNT && (!top || v.count > top.count)) top = v;
    });
    return top;
  }

  function renderHistorySignals() {
    const card = document.getElementById("history-signals-card");
    const container = document.getElementById("history-signals");
    const others = otherHistory();

    if (others.length < HISTORY_PATTERN_MIN_COUNT) {
      card.classList.add("hidden");
      container.innerHTML = "";
      return;
    }

    const frequent = computeFrequentCriteria(others);
    const divergence = computeDivergencePattern(others);

    if (frequent.length === 0 && !divergence) {
      card.classList.add("hidden");
      container.innerHTML = "";
      return;
    }

    card.classList.remove("hidden");
    container.innerHTML = "";

    if (frequent.length > 0) {
      const label = document.createElement("p");
      label.className = "hint";
      label.style.margin = "0 0 8px";
      label.textContent = "You've weighted these highly before:";
      container.appendChild(label);

      const chips = document.createElement("div");
      chips.className = "chip-row";
      const cur = state.currentDecision;
      const existingNames = new Set(cur.criteria.map((c) => c.name.trim().toLowerCase()));
      frequent.forEach((f) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        const already = existingNames.has(f.name.toLowerCase());
        chip.textContent = (already ? "✓ " : "+ ") + f.name + " (avg " + f.avg.toFixed(1) + ")";
        if (already || cur.criteria.length >= MAX_CRITERIA) chip.disabled = true;
        chip.addEventListener("click", () => {
          if (cur.criteria.length >= MAX_CRITERIA) return;
          cur.criteria.push({ id: uid(), name: f.name, weight: Math.round(f.avg) });
          saveState();
          renderAll();
        });
        chips.appendChild(chip);
      });
      container.appendChild(chips);
    }

    if (divergence) {
      const note = document.createElement("p");
      note.className = "history-note";
      note.innerHTML =
        "In " + divergence.count + " past decisions where you went against the recommendation, " +
        "<strong>" + escapeHtml(divergence.name) + "</strong> tended to be the criterion that swung it for you. " +
        "Worth weighting deliberately either way.";
      container.appendChild(note);
    }
  }

  // ---------- Options ----------

  function renderOptions() {
    const list = document.getElementById("options-list");
    list.innerHTML = "";
    const cur = state.currentDecision;
    cur.options.forEach((opt, idx) => {
      const row = document.createElement("div");
      row.className = "option-row";

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Option " + (idx + 1);
      input.value = opt.name;
      input.addEventListener("input", (e) => {
        opt.name = e.target.value;
        saveState();
        updateScoreTableHeader(opt.id, opt.name);
        renderResults();
        renderSensitivity();
        renderHistorySignals();
      });
      row.appendChild(input);

      if (cur.options.length > 2) {
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "btn-remove";
        rm.textContent = "✕";
        rm.title = "Remove option";
        rm.addEventListener("click", () => {
          cur.options = cur.options.filter((o) => o.id !== opt.id);
          delete cur.scores[opt.id];
          saveState();
          renderAll();
        });
        row.appendChild(rm);
      }
      list.appendChild(row);
    });

    document.getElementById("add-option").disabled = cur.options.length >= MAX_OPTIONS;
  }

  function updateScoreTableHeader(optionId, name) {
    const td = document.querySelector('.score-table td[data-option-id="' + optionId + '"]');
    if (td) td.textContent = name || "Option";
  }

  // ---------- Criteria ----------

  function renderCriteria() {
    const list = document.getElementById("criteria-list");
    list.innerHTML = "";
    const cur = state.currentDecision;

    if (cur.criteria.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No criteria yet. Add what matters to this decision.";
      list.appendChild(empty);
    }

    const totalWeight = cur.criteria.reduce((s, c) => s + c.weight, 0);

    cur.criteria.forEach((crit) => {
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
      const weightPct = document.createElement("span");
      weightPct.className = "weight-pct";
      weightPct.setAttribute("data-crit-id", crit.id);
      weightPct.textContent = totalWeight > 0 ? "(" + Math.round((crit.weight / totalWeight) * 100) + "%)" : "";
      slider.addEventListener("input", (e) => {
        crit.weight = Number(e.target.value);
        weightVal.textContent = String(crit.weight);
        saveState();
        refreshWeightPercentages();
        refreshRunningTotals();
        renderResults();
        renderSensitivity();
      });
      weightWrap.appendChild(slider);
      weightWrap.appendChild(weightVal);
      weightWrap.appendChild(weightPct);

      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn-remove";
      rm.textContent = "✕";
      rm.title = "Remove criterion";
      rm.addEventListener("click", () => {
        cur.criteria = cur.criteria.filter((c) => c.id !== crit.id);
        saveState();
        renderAll();
      });

      row.appendChild(nameInput);
      row.appendChild(weightWrap);
      row.appendChild(rm);
      list.appendChild(row);
    });

    document.getElementById("add-criterion").disabled = cur.criteria.length >= MAX_CRITERIA;
  }

  function refreshWeightPercentages() {
    const cur = state.currentDecision;
    const totalWeight = cur.criteria.reduce((s, c) => s + c.weight, 0);
    cur.criteria.forEach((crit) => {
      const span = document.querySelector('.weight-pct[data-crit-id="' + crit.id + '"]');
      if (span) span.textContent = totalWeight > 0 ? "(" + Math.round((crit.weight / totalWeight) * 100) + "%)" : "";
    });
  }

  function updateScoreTableCritHeader(critId, name) {
    const th = document.querySelector('.score-table th[data-crit-id="' + critId + '"]');
    if (th) th.textContent = name || "Criterion";
  }

  // ---------- Scoring grid ----------

  function renderScoringGrid() {
    const container = document.getElementById("scoring-grid");
    container.innerHTML = "";
    const cur = state.currentDecision;

    if (cur.options.length === 0 || cur.criteria.length === 0) {
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
    cur.criteria.forEach((crit) => {
      const th = document.createElement("th");
      th.textContent = crit.name || "Criterion";
      th.setAttribute("data-crit-id", crit.id);
      headRow.appendChild(th);
    });
    const totalTh = document.createElement("th");
    totalTh.textContent = "Weighted total";
    headRow.appendChild(totalTh);
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    cur.options.forEach((opt) => {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.textContent = opt.name || "Option";
      nameCell.setAttribute("data-option-id", opt.id);
      row.appendChild(nameCell);

      cur.criteria.forEach((crit) => {
        const cell = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        input.min = "1";
        input.max = "10";
        input.step = "1";
        input.value = String(getScore(cur, opt.id, crit.id));
        input.addEventListener("input", (e) => {
          let v = Math.round(Number(e.target.value));
          if (Number.isNaN(v)) v = 1;
          v = Math.max(1, Math.min(10, v));
          setScore(cur, opt.id, crit.id, v);
          saveState();
          refreshRunningTotals();
          renderResults();
          renderSensitivity();
        });
        cell.appendChild(input);
        row.appendChild(cell);
      });

      const totalCell = document.createElement("td");
      totalCell.className = "running-total";
      totalCell.setAttribute("data-total-option-id", opt.id);
      totalCell.textContent = "—";
      row.appendChild(totalCell);

      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);

    refreshRunningTotals();
  }

  function refreshRunningTotals() {
    const cur = state.currentDecision;
    const totalWeight = cur.criteria.reduce((s, c) => s + c.weight, 0);
    cur.options.forEach((opt) => {
      const cell = document.querySelector('[data-total-option-id="' + opt.id + '"]');
      if (!cell) return;
      if (totalWeight === 0) {
        cell.textContent = "—";
        return;
      }
      let sum = 0;
      cur.criteria.forEach((crit) => {
        sum += crit.weight * getScore(cur, opt.id, crit.id);
      });
      cell.textContent = (sum / totalWeight).toFixed(1) + " / 10";
    });
  }

  // ---------- Computation (works on any decision-shaped object) ----------

  function computeWeightedScores(decision) {
    const totalWeight = decision.criteria.reduce((s, c) => s + c.weight, 0);
    const results = decision.options.map((opt) => {
      let sum = 0;
      const contributions = [];
      decision.criteria.forEach((crit) => {
        const score = getScore(decision, opt.id, crit.id);
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

  function computeConfidence(decision) {
    const results = computeWeightedScores(decision);
    if (results.length < 2) return null;
    const leader = results[0];
    const runnerUp = results[1];
    const gap = leader.weighted - runnerUp.weighted;
    const gapPct = leader.weighted > 0 ? (gap / leader.weighted) * 100 : 0;
    let label;
    if (gapPct <= 5) label = "Very close call";
    else if (gapPct <= 15) label = "Close call";
    else label = "Clear win";
    return { leader, runnerUp, gapPct, label };
  }

  // Sensitivity: for the top 2 options only, find the weight each criterion
  // would need (holding other weights fixed) for the runner-up to overtake the leader.
  function computeSensitivity(decision) {
    const results = computeWeightedScores(decision);
    if (results.length < 2 || decision.criteria.length === 0) return [];

    const leader = results[0];
    const challenger = results[1];
    const findings = [];

    decision.criteria.forEach((crit) => {
      const otherCriteria = decision.criteria.filter((c) => c.id !== crit.id);
      const K_leader = otherCriteria.reduce(
        (s, c) => s + c.weight * getScore(decision, leader.option.id, c.id), 0
      );
      const K_challenger = otherCriteria.reduce(
        (s, c) => s + c.weight * getScore(decision, challenger.option.id, c.id), 0
      );
      const a = getScore(decision, leader.option.id, crit.id);
      const b = getScore(decision, challenger.option.id, crit.id);

      if (a === b) return;

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

    findings.sort((f1, f2) => Math.abs(f1.crossWeight - f1.currentWeight) - Math.abs(f2.crossWeight - f2.currentWeight));
    return findings;
  }

  // ---------- Results rendering (reusable for setup view + history detail) ----------

  function renderResultsInto(container, decision) {
    container.innerHTML = "";

    if (!isDecisionComplete(decision)) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Fill in option names and at least one criterion to see a result.";
      container.appendChild(empty);
      return;
    }

    const results = computeWeightedScores(decision);
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

  function renderResults() {
    renderResultsInto(document.getElementById("results"), state.currentDecision);
  }

  function renderSensitivityInto(container, decision) {
    container.innerHTML = "";

    if (!isDecisionComplete(decision) || decision.options.length < 2) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Sensitivity analysis will appear once you have at least 2 options, criteria, and scores.";
      container.appendChild(empty);
      return;
    }

    const confidence = computeConfidence(decision);
    if (confidence) {
      const line = document.createElement("p");
      line.className = "confidence-line";
      line.innerHTML =
        "<strong>" + escapeHtml(confidence.label) + "</strong> — " +
        escapeHtml(confidence.leader.option.name || "Leader") + " leads " +
        escapeHtml(confidence.runnerUp.option.name || "the runner-up") + " by " +
        Math.abs(Math.round(confidence.gapPct)) + "%.";
      container.appendChild(line);
    }

    const findings = computeSensitivity(decision);

    if (findings.length === 0) {
      const stable = document.createElement("p");
      stable.className = "sensitivity-stable";
      stable.textContent = "This result looks stable — no single weight, moved within its 1–10 range, flips the top 2.";
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
        "<span class=\"flip-to\">" + escapeHtml(f.challenger.name || "the runner-up") + "</span> would overtake " +
        escapeHtml(f.leader.name || "the current leader") + ".";
      container.appendChild(item);
    });
  }

  function renderSensitivity() {
    renderSensitivityInto(document.getElementById("sensitivity"), state.currentDecision);
  }

  // ---------- View switching ----------

  function switchView(view) {
    state.view = view;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderViewChrome();
  }

  function renderViewChrome() {
    document.getElementById("view-setup").classList.toggle("hidden", state.view !== "setup");
    document.getElementById("view-history").classList.toggle("hidden", state.view !== "history");
    document.getElementById("tab-setup").classList.toggle("active", state.view === "setup");
    document.getElementById("tab-history").classList.toggle("active", state.view === "history");

    const countEl = document.getElementById("history-count");
    if (state.history.length > 0) {
      countEl.textContent = String(state.history.length);
      countEl.classList.remove("hidden");
    } else {
      countEl.classList.add("hidden");
    }

    if (state.view === "history") {
      if (state.historySelectedId) {
        renderHistoryDetail(state.historySelectedId);
      } else {
        renderHistoryList();
      }
    }
  }

  // ---------- History list & detail ----------

  function renderHistoryList() {
    document.getElementById("history-list-view").classList.remove("hidden");
    document.getElementById("history-detail-view").classList.add("hidden");

    const container = document.getElementById("history-list");
    container.innerHTML = "";

    const entries = state.history.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No past decisions yet. Complete a decision on the Current Decision tab and it'll show up here.";
      container.appendChild(empty);
      return;
    }

    entries.forEach((entry) => {
      const results = computeWeightedScores(entry);
      const winner = results[0];

      const row = document.createElement("div");
      row.className = "history-row";

      const main = document.createElement("div");
      main.className = "history-row-main";
      main.addEventListener("click", () => {
        state.historySelectedId = entry.id;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderHistoryDetail(entry.id);
      });

      const title = document.createElement("div");
      title.className = "history-row-title";
      title.textContent = entry.title || "Untitled decision";

      const meta = document.createElement("div");
      meta.className = "history-row-meta";
      meta.textContent = formatDate(entry.updatedAt) + " · recommended " + (winner.option.name || "—");

      main.appendChild(title);
      main.appendChild(meta);

      const badge = document.createElement("span");
      if (entry.outcome) {
        badge.className = "badge " + (entry.outcome.matchedRecommendation ? "badge-match" : "badge-diverge");
        badge.textContent = entry.outcome.matchedRecommendation ? "✓ Matched" : "↔ Diverged";
      } else {
        badge.className = "badge badge-pending";
        badge.textContent = "Not logged";
      }

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn-remove";
      del.textContent = "✕";
      del.title = "Delete this decision";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm('Delete "' + (entry.title || "Untitled decision") + '"? This cannot be undone.')) return;
        state.history = state.history.filter((h) => h.id !== entry.id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderHistoryList();
        renderViewChrome();
      });

      row.appendChild(main);
      row.appendChild(badge);
      row.appendChild(del);
      container.appendChild(row);
    });
  }

  function renderHistoryDetail(entryId) {
    const entry = state.history.find((h) => h.id === entryId);
    if (!entry) {
      state.historySelectedId = null;
      renderHistoryList();
      return;
    }

    document.getElementById("history-list-view").classList.add("hidden");
    document.getElementById("history-detail-view").classList.remove("hidden");

    const content = document.getElementById("history-detail-content");
    content.innerHTML = "";

    const h2 = document.createElement("h2");
    h2.textContent = entry.title || "Untitled decision";
    content.appendChild(h2);

    const meta = document.createElement("p");
    meta.className = "hint";
    meta.textContent = "Saved " + formatDate(entry.createdAt) + (entry.updatedAt !== entry.createdAt ? " · updated " + formatDate(entry.updatedAt) : "");
    content.appendChild(meta);

    const resultsBlock = document.createElement("div");
    content.appendChild(resultsBlock);
    renderResultsInto(resultsBlock, entry);

    const sensBlock = document.createElement("div");
    sensBlock.className = "detail-sensitivity";
    const sensHeading = document.createElement("h3");
    sensHeading.className = "detail-subheading";
    sensHeading.textContent = "Sensitivity analysis";
    content.appendChild(sensHeading);
    content.appendChild(sensBlock);
    renderSensitivityInto(sensBlock, entry);

    const actions = document.createElement("div");
    actions.className = "detail-actions";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-add";
    editBtn.textContent = "Edit this decision";
    editBtn.addEventListener("click", () => {
      state.currentDecision = {
        id: entry.id,
        title: entry.title,
        options: entry.options.map((o) => ({ id: o.id, name: o.name })),
        criteria: entry.criteria.map((c) => ({ id: c.id, name: c.name, weight: c.weight })),
        scores: JSON.parse(JSON.stringify(entry.scores)),
        dismissedTemplate: true,
        createdAt: entry.createdAt,
      };
      state.historySelectedId = null;
      saveState();
      switchView("setup");
      renderAll();
    });
    actions.appendChild(editBtn);
    content.appendChild(actions);

    const outcomeSection = document.createElement("div");
    outcomeSection.className = "outcome-section";
    const outcomeHeading = document.createElement("h3");
    outcomeHeading.className = "detail-subheading";
    outcomeHeading.textContent = "What did you actually choose?";
    outcomeSection.appendChild(outcomeHeading);

    renderOutcomeForm(outcomeSection, entry);
    content.appendChild(outcomeSection);
  }

  function renderOutcomeForm(container, entry) {
    const existing = entry.outcome;

    if (existing) {
      const summary = document.createElement("div");
      summary.className = "outcome-summary";
      const badge = document.createElement("span");
      badge.className = "badge " + (existing.matchedRecommendation ? "badge-match" : "badge-diverge");
      badge.textContent = existing.matchedRecommendation ? "✓ Matched recommendation" : "↔ Went a different way";
      summary.appendChild(badge);
      const chosen = document.createElement("p");
      chosen.innerHTML = "You chose: <strong>" + escapeHtml(existing.actualOptionName) + "</strong>";
      summary.appendChild(chosen);
      if (existing.note) {
        const note = document.createElement("p");
        note.className = "outcome-note";
        note.textContent = "“" + existing.note + "”";
        summary.appendChild(note);
      }
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn-text";
      editBtn.textContent = "Edit outcome";
      editBtn.addEventListener("click", () => {
        summary.remove();
        editBtn.remove();
        renderOutcomeFormFields(container, entry);
      });
      container.appendChild(summary);
      container.appendChild(editBtn);
      return;
    }

    renderOutcomeFormFields(container, entry);
  }

  function renderOutcomeFormFields(container, entry) {
    const form = document.createElement("div");
    form.className = "outcome-form";

    const radioGroup = document.createElement("div");
    radioGroup.className = "outcome-options";
    entry.options.forEach((opt) => {
      const label = document.createElement("label");
      label.className = "outcome-radio";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "outcome-choice-" + entry.id;
      input.value = opt.id;
      if (entry.outcome && entry.outcome.actualOptionId === opt.id) input.checked = true;
      label.appendChild(input);
      label.appendChild(document.createTextNode(" " + (opt.name || "Option")));
      radioGroup.appendChild(label);
    });
    form.appendChild(radioGroup);

    const noteInput = document.createElement("textarea");
    noteInput.className = "outcome-note-input";
    noteInput.placeholder = "Why? (optional)";
    noteInput.rows = 2;
    if (entry.outcome && entry.outcome.note) noteInput.value = entry.outcome.note;
    form.appendChild(noteInput);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn-add";
    saveBtn.textContent = "Save outcome";
    saveBtn.addEventListener("click", () => {
      const checked = radioGroup.querySelector('input[type="radio"]:checked');
      if (!checked) {
        alert("Pick which option you actually chose.");
        return;
      }
      const optionId = checked.value;
      const option = entry.options.find((o) => o.id === optionId);
      const results = computeWeightedScores(entry);
      const recommended = results[0];
      entry.outcome = {
        actualOptionId: optionId,
        actualOptionName: option.name,
        note: noteInput.value.trim(),
        matchedRecommendation: recommended.option.id === optionId,
        loggedAt: nowIso(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderHistoryDetail(entry.id);
    });
    form.appendChild(saveBtn);

    container.appendChild(form);
  }

  // ---------- Wiring ----------

  function renderAll() {
    document.getElementById("decision-title").value = state.currentDecision.title;
    renderTemplateSuggestion();
    renderHistorySignals();
    renderOptions();
    renderCriteria();
    renderScoringGrid();
    renderResults();
    renderSensitivity();
    renderViewChrome();
  }

  function init() {
    document.getElementById("decision-title").addEventListener("input", (e) => {
      state.currentDecision.title = e.target.value;
      saveState();
      renderTemplateSuggestion();
    });

    document.getElementById("add-option").addEventListener("click", () => {
      const cur = state.currentDecision;
      if (cur.options.length >= MAX_OPTIONS) return;
      cur.options.push({ id: uid(), name: "" });
      saveState();
      renderAll();
    });

    document.getElementById("add-criterion").addEventListener("click", () => {
      const cur = state.currentDecision;
      if (cur.criteria.length >= MAX_CRITERIA) return;
      cur.criteria.push({ id: uid(), name: "", weight: 5 });
      saveState();
      renderAll();
    });

    document.getElementById("new-decision-btn").addEventListener("click", () => {
      state.currentDecision = newDecision();
      saveState();
      renderAll();
    });

    document.getElementById("tab-setup").addEventListener("click", () => {
      state.historySelectedId = null;
      switchView("setup");
    });
    document.getElementById("tab-history").addEventListener("click", () => switchView("history"));
    document.getElementById("history-back-btn").addEventListener("click", () => {
      state.historySelectedId = null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderHistoryList();
    });
    document.getElementById("clear-history-btn").addEventListener("click", () => {
      if (state.history.length === 0) return;
      if (!confirm("Delete all past decisions? This cannot be undone.")) return;
      state.history = [];
      state.historySelectedId = null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderViewChrome();
    });

    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
