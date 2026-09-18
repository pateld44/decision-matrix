# Decision Matrix

Weigh your options with real numbers instead of gut feel.

Enter a decision, add 2-5 options, define up to 8 criteria and how much each one matters (weight 1-10), then score each option against each criterion. The tool computes a weighted recommendation and explains **why** it won.

## What makes it more than a spreadsheet

**Sensitivity analysis** — for every criterion, the tool calculates exactly how much its weight would need to shift for a different option to win. Example: *"If you valued Salary 35% less (weight 10 → 6.5), Job B would overtake Job A."* This shows how fragile or robust your conclusion actually is.

**Smart starting criteria** — type a decision like "choosing between two job offers" and the tool suggests a relevant starting set of criteria (job, housing, or school templates, with a general fallback).

## Scope

Deliberately left out of v1: accounts/saving to the cloud, more than 5 options or 8 criteria, and collaborative/shared decisions. State persists locally in your browser (localStorage) so a refresh doesn't lose your work, but nothing is sent anywhere — this is a fully static, client-side app.

## Running locally

Just open `index.html` in a browser, or serve the folder with any static file server:

```
npx serve .
```

## Tech

Plain HTML/CSS/JS, no build step, no dependencies. Deployed via GitHub Pages.
