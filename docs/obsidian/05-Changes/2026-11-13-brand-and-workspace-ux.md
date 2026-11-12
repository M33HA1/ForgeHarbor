---
date: 2026-11-13
type: change
area: [web, design, ux]
status: locally-verified
updated: 2026-11-13
related: [Web]
tags: [change, branding, frontend, accessibility]
---

# Original identity and workspace usability

## What changed and why

Replace the stock anchor identity with an original SVG: a cut-metal F and opposing harbor pier, separated by an open diagonal channel. One locally served asset supplies header, footer and favicon. Keep Manrope and the existing ink #173239, sea #087f75, mist #f6f8f8, line #e0e7e7 and mint #6fd0bb palette. The mark carries the visual distinction; operational controls stay quiet. No registry component code or new dependency was introduced.

- Searchable workspace shortcuts: native modal dialog; Ctrl/Command+K; visible trigger; page-name/description filtering; Arrow Down and Enter navigation; bounded Tab focus; Escape and original-focus restoration; helpful empty state. It searches navigation, not user records.
- Evidence-copy control: copy a URL or filename without opening it; announce success and explain clipboard-denial recovery. No automatic clipboard reads or new network requests.
- File review: one filename, readable binary size, clear remove/change actions and announced readiness. Collapse the large drop target after selection. Reject a multiple-file drop rather than silently scanning its first file; retain any previously selected evidence with explicit feedback. Preserve the 32 MiB bound.

## Verification

Strict TypeScript/Vite production build passed. Thirteen deterministic browser groups pass, including keyboard focus containment/restoration, filtered and keyboard-only navigation, copy success/denial without extra analysis calls, file review and multiple-file rejection. Existing auth, scan-result, report, upload-bound and mobile regressions remain covered. Fixtures make zero backend writes/provider calls.

Automated axe A/AA checks reported no violation groups in tested public/account/workspace states at 320/768/1440 pixels and in the new dialog/file-review states. This is automated coverage, not accessibility certification. Visual review includes desktop and mobile screenshots. The initial 320-pixel header overflow and modal Tab edge case were reproduced and corrected. The touched change index was normalized to UTF-8 while preserving valid content.

[MDN dialog guidance](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) supports native modal/inert behavior and explicit close/focus handling. The current revision's PR checks are the canonical hosted verification; main protection remains enabled. No auth, ownership, provider, deployment or cloud-spending behavior changed. [[AWS-Deployment]] and [[Security-Review]] retain the external launch gates.

- [[Web]]
- [[Change-Log]]
- [[2026-11-11-demo-finalisation]]
- [[2026-11-12-dependency-followup]]
