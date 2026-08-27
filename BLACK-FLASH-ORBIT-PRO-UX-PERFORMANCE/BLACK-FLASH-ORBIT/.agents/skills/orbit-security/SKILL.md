---
name: orbit-security
description: Security patch workflow for auth, XSS, route protection, and sensitive logs.
---

Security patch only.
Protect backend routes with auth.
Prevent XSS/HTML injection in print/export.
Remove or gate sensitive logs.
Do not log prompts, drafts, API keys, tokens, or full OpenRouter responses.
Run npm run test:newsroom and git status --short.