# simkl-cli

## 0.3.1

### Patch Changes

- af53ea1: Fix: derive CLI version from package.json so releases via Changesets automatically update `simkl --version`.

## 0.3.0

### Minor Changes

- 6bc968a: Rebuild CLI v2 with full Simkl API support

  - OpenAPI-generated TypeScript types for all API endpoints
  - New commands: watch, unwatch, list, checkin, rate/unrate, scrobble, playback, media info, user profile
  - Positional title argument for `watch` command (`simkl watch "Show" 1x05`)
  - Thin fetch wrapper with typed `SimklApiError` for better debugging
  - PIN-based authentication flow
