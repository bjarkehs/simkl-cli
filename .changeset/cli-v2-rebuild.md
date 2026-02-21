---
"simkl-cli": minor
---

Rebuild CLI v2 with full Simkl API support

- OpenAPI-generated TypeScript types for all API endpoints
- New commands: watch, unwatch, list, checkin, rate/unrate, scrobble, playback, media info, user profile
- Positional title argument for `watch` command (`simkl watch "Show" 1x05`)
- Thin fetch wrapper with typed `SimklApiError` for better debugging
- PIN-based authentication flow
