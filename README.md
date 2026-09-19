# Decision Roulette — Product Requirements Document

**Live app:** [pateld44.github.io/decision-matrix](https://pateld44.github.io/decision-matrix/) &middot; **Source:** this repo

## 1. Overview

**Problem:** People facing big, high-stakes decisions (job offers, apartments, schools) often juggle multiple competing criteria in their heads. This leads to either decision paralysis (overthinking every angle) or gut-feel choices that can't be explained or revisited later. There's no lightweight tool that forces structure onto a fuzzy decision without requiring a full spreadsheet.

**Solution:** A web app where a user inputs a decision, defines the options and criteria that matter to them, weights those criteria, and receives a structured recommendation, along with a sensitivity analysis showing how robust that recommendation is to changes in their priorities. After the decision plays out, the user can log what they actually chose and why, so the tool builds a history of past decisions that informs future recommendations (e.g., criteria the user tends to undervalue, or where their gut choice diverged from the weighted recommendation).

**Target user:** Someone actively facing a specific, high-stakes decision with 2 to 5 discrete options, who wants a faster and more defensible way to reason through it than a mental pros/cons list.

## 2. Goals

- Let a user go from "I don't know how to think about this" to a structured, explainable recommendation in under 5 minutes.
- Make the "why" behind the recommendation as visible as the recommendation itself.
- Keep the tool simple enough to use for a real decision on the first try, with no tutorial needed.

## 3. Non-goals (v1)

- No collaborative or shared decision-making (e.g., two people scoring together).
- No support for more than 5 options or 8 criteria per decision.
- No mobile-native app; responsive web only.
- No proactive coaching or nudges based on history (e.g., no "we noticed you always undervalue work-life balance" pop-ups); the learning surfaces only when the user is actively setting up a new decision.

## 4. Core user flow

1. **Name the decision.** User enters a short title (e.g., "Job Offer A vs Job Offer B").
2. **Add options.** User adds 2 to 5 options they're choosing between (e.g., "Company A," "Company B").
3. **Add criteria.** User adds the factors that matter to them (e.g., salary, growth, work-life balance, location, team). Optionally, the app suggests common criteria based on keywords in the decision title.
4. **Weight criteria.** User assigns each criterion a weight (1 to 10, or a slider) representing how much it matters relative to the others.
5. **Score options.** User scores each option against each criterion (1 to 10).
6. **View recommendation.** App calculates a weighted score per option and highlights the top result, with a breakdown showing which criteria drove the outcome.
7. **View sensitivity analysis.** App shows how the recommendation would change if the user adjusted a given criterion's weight, so the user can see how close or clear-cut the decision is.
8. **Log the outcome** (later, after the decision plays out). User returns to the decision and records what they actually chose and a short note on why, including whether it matched the tool's recommendation.
9. **Benefit from history on future decisions.** When setting up a new decision, the app surfaces relevant patterns from past logged decisions (e.g., criteria the user has consistently weighted highly, or cases where they went against the recommendation and what they said afterward).

## 5. Feature requirements

### 5.1 Decision setup

- Text input for decision title.
- Add/remove option (min 2, max 5), each with a short label.
- Add/remove criterion (min 1, max 8), each with a short label.

### 5.2 Weighting

- Each criterion gets a weight from 1 to 10 (slider or numeric input).
- Display weights as a normalized percentage of total, so users can see relative emphasis at a glance.

### 5.3 Scoring

- Grid or table view: options as rows, criteria as columns.
- Each cell is a 1 to 10 score, entered by the user.
- Running total visible per option as scores are entered.

### 5.4 Recommendation

- Weighted score formula: for each option, sum of (criterion score × criterion weight), normalized across options.
- Clear visual winner (e.g., highest score highlighted).
- Breakdown showing each criterion's contribution to the winning option's score, so the "why" is visible, not just the number.

### 5.5 Sensitivity analysis

- For the top 2 options, show the weight threshold at which the ranking would flip (e.g., "If you valued salary 20% less, Job B would win instead").
- This should update live as the user adjusts weights, not just as a static one-time calculation.

### 5.6 Decision history and learning

- After a decision reaches a recommendation, the app keeps it in a "Past Decisions" list rather than discarding it at the end of the session.
- User can revisit a past decision and log: which option they actually chose, and a short free-text note on why.
- App flags whether the actual choice matched the tool's recommendation, so the user (and the tool) can see track record over time.
- When starting a new decision, the app surfaces lightweight, relevant signals from history, for example:
  - Criteria the user has repeatedly weighted highly across past decisions, offered as suggestions.
  - A note if the user has a pattern of going against the tool's recommendation on a particular criterion, so they can decide if that's still true this time.
- This is meant to be a light touch (a suggestion or note), not an automated override of the user's own weighting.

## 6. Success metrics (for the PM narrative, not literal tracking in v1)

- % of users who complete a full decision cycle (setup through recommendation) without abandoning.
- Time to decision (from starting setup to viewing the recommendation).
- Whether users report the recommendation matched or clarified their gut feeling (informal, e.g., a one-question exit prompt).
- % of completed decisions that later get an outcome logged (a proxy for whether users find the history feature worth returning for).
- Whether history-based suggestions on a new decision are accepted or dismissed by the user, as a signal of whether the "learning" is actually useful versus noise.

## 7. Key trade-off to be ready to discuss

**Simplicity vs. flexibility.** More criteria and options make the tool more powerful for complex decisions, but increase the time and cognitive load to set up, risking abandonment. V1 deliberately caps options at 5 and criteria at 8 to keep the tool usable in one sitting, at the cost of not fully serving very complex decisions.

**Personalization vs. trust.** Surfacing patterns from a user's past decisions can make recommendations feel smarter and more tailored, but if it's too aggressive or opaque, it risks feeling like the tool is steering the user rather than helping them reason. V1 deliberately keeps history-based signals as passive suggestions the user can ignore, rather than automatically adjusting weights or scores on their behalf.

## 8. Technical implementation notes

- Because past decisions now need to persist across sessions, this requires either browser local storage (simplest, no backend, but tied to one device/browser) or a lightweight backend with a database (more durable, enables cross-device access later). For v1, local storage is likely sufficient to prove the concept.
- Suggested stack: React (or plain HTML/CSS/JS) for the front end. If persistence goes beyond local storage, a minimal backend (e.g., a simple API plus a lightweight database) would be needed.
- Sensitivity analysis can be computed client-side: for each pair of top-ranked options, solve for the weight adjustment on a given criterion that would equalize their scores.
- History-based suggestions (5.6) can start as simple rule-based pattern matching over stored past decisions (e.g., "average weight given to criterion X across past decisions"), rather than requiring a trained model. An LLM call could later be used to generate more natural-language pattern summaries, but that's not required to prove the core concept.
- Keep the primary decision-setup flow to a single page with sections; a separate "Past Decisions" view can hold the list and outcome-logging UI.

## 9. Open questions

- Should criteria suggestions (based on decision type) be hardcoded pattern matches, or should this later call an LLM for a more flexible suggestion feature?
- Should scores be 1 to 10 integers, or allow decimals for finer-grained input?
- Is a "confidence" indicator (how close the top two options are) worth adding to v1, or does that belong in the sensitivity analysis instead?

---

## What was actually built (v1 implementation notes)

The above is the PRD as written. Decisions made while implementing it:

- **Criteria suggestions:** kept hardcoded/rule-based (keyword match on decision title, plus rule-based pattern matching over history). No LLM call — avoids needing a backend or API key in what's otherwise a fully static site, per the PRD's own note that this isn't required to prove the concept.
- **Score precision:** integers only, 1–10. Keeps the scoring grid and the weight sliders consistent, and the sensitivity math simple.
- **Confidence indicator:** folded into the sensitivity analysis section as a plain-language line ("Close call — Job B leads Job A by 5%") rather than a separate UI element.
- **Stack:** plain HTML/CSS/JS, no build step, no dependencies. State persists in browser `localStorage` only — no accounts, no backend, nothing leaves the browser.

## Running locally

Open `index.html` for the landing page, or `app.html` directly for the tool. Or serve the folder:

```
npx serve .
```
