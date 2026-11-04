---
date: 2026-11-03
type: change
area: [web, ui]
status: complete
related: [[00-Home]], [[Web]], [[Roadmap]]
tags: [change, frontend, design]
---

# Refresh the scanner dashboard

## What changed

- Reworked the dashboard into a responsive analysis workspace with a clear task heading, URL/file mode selector, privacy cue, and supporting guidance.
- Replaced the animated ocean gradient with a quieter dark canvas and teal accents; refined URL and upload controls to match.
- Preserved the existing scan request handlers and nested file result mapping.
- Used Watermelon UI, Manus, Cult UI, and Refero as visual references for hierarchy, task focus, dark surfaces, and interface polish.

## Why

- The previous scanner mixed animated ocean styling and playful copy with the security product's core action. The new layout makes URL and file analysis easier to find and keeps visual effects behind the content.

## Verification

| Check | Command | Result |
|---|---|---|
| Web production build | `npm.cmd run build` from `apps/web` | Passed with non-blocking package module-type and stale Browserslist-data warnings |

## Follow-ups

- Add frontend regression coverage for auth, report/history state, and scan result states as tracked in [[Roadmap]].

## Related notes

- [[Change-Log]]
- [[Web]]
- [[Roadmap]]
