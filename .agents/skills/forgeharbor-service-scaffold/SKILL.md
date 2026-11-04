---
name: forgeharbor-service-scaffold
description: Add a ForgeHarbor service or endpoint consistently with existing language boundaries, gateway paths, configuration, health checks, and documentation.
metadata:
  short-description: Scaffold ForgeHarbor services
---

# ForgeHarbor Service Scaffold

Before scaffolding, read `AGENTS.md`, the architecture/service map, ADR-0001, ADR-0002, ADR-0004, and a neighboring service implementation.

- Use Go by default for new backend control-plane services; keep Rust, Python, and TypeScript within their documented specialties.
- Define health and API paths, auth/ownership expectations, config, timeouts, logs, and data/event contracts before wiring Compose.
- Add a focused build/test path, Docker ignore rules, and gateway route-contract coverage.
- Update the service note, architecture map, changelog, change note, dashboard, and backlog as applicable.
- Do not copy credentials into images or add permissive defaults.
