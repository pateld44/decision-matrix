# Decision Roulette

Weigh your options with real numbers instead of gut feel.

Enter a decision, add 2-5 options, define up to 8 criteria and how much each one matters (weight 1-10), then score each option against each criterion. The tool computes a weighted recommendation and explains **why** it won.

## What makes it more than a spreadsheet

**Sensitivity analysis** — comparing your top 2 options, the tool calculates exactly how much a criterion's weight would need to shift for the runner-up to overtake the leader, live as you adjust weights. Example: *"If you valued Growth potential 67% less (weight 5 → 1.7), Job A would overtake Job B."* Includes a plain-language confidence read ("Very close call" / "Close call" / "Clear win") based on the score gap.

**Smart starting criteria** — type a decision like "choosing between two job offers" and the tool suggests a relevant starting set of criteria (job, housing, or school templates, with a general fallback).

**Decision history that learns, lightly** — once a decision has a recommendation, it's saved automatically to a "Past Decisions" tab. Go back later and log what you actually chose and why; the tool flags whether it matched the recommendation. On your *next* decision, it surfaces two passive signals from history (never an automatic override): criteria you've consistently weighted highly, and — if you've gone against the tool's recommendation more than once — which criterion tended to be the one that swung your gut choice.

## Scope

Deliberately left out of v1: collaborative/shared decision-making, more than 5 options or 8 criteria, decimal scores (integers 1-10 only), and any proactive nudges/pop-ups based on history — learning signals only surface when you're actively setting up a new decision. State persists locally in your browser (localStorage) so a refresh doesn't lose your work, but nothing is sent anywhere — this is a fully static, client-side app with no accounts and no backend.

## Running locally

Just open `index.html` in a browser, or serve the folder with any static file server:

```
npx serve .
```

## Tech

Plain HTML/CSS/JS, no build step, no dependencies. Deployed via GitHub Pages.
