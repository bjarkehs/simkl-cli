# simkl-cli

CLI for [Simkl.com](https://simkl.com) - TV, Anime & Movie tracking.

## Installation

```bash
# From npm (coming soon)
npm install -g simkl-cli

# Or with bun
bun install -g simkl-cli
```

## Setup

1. Create an app at https://simkl.com/settings/developer/new
2. Configure the CLI with your client ID:

```bash
simkl config --client-id YOUR_CLIENT_ID
```

3. Authenticate using PIN code:

```bash
simkl auth
# Opens: https://simkl.com/pin
# Enter the code shown in CLI
```

## Usage

### Search

```bash
# Search all types
simkl search "Breaking Bad"

# Filter by type
simkl search "Inception" --type movie
simkl search "Attack on Titan" --type anime

# JSON output
simkl search "The Office" --json
```

### Watchlist

```bash
# View your watchlist
simkl watchlist

# Filter by type
simkl watchlist --type shows

# Filter by status
simkl watchlist --status watching
```

### Sync (Watchlist Management)

```bash
# Add to watchlist
simkl sync add "Dune" --type movie --status plantowatch

# Add using IMDB ID
simkl sync add "Movie" --imdb tt1234567
```

**Note:** To mark items as watched, use the `watch` command instead of `sync history`.

### Watch (Mark as Watched)

```bash
# Mark an episode as watched
simkl watch "Breaking Bad" 1x05
simkl watch "Breaking Bad" S01E05
simkl watch "Breaking Bad" 5

# Mark multiple episodes
simkl watch "Breaking Bad" 1x05,1x06,1x07
simkl watch "Breaking Bad" 1-5

# Mark a movie as watched
simkl watch "Dune" --movie

# Mark using ID directly
simkl watch --imdb tt1234567 --episodes 1x01
```

### Configuration

```bash
# Show current config
simkl config --show

# Show config file path
simkl config --path
```

## Development

```bash
# Install dependencies
bun install

# Run in dev mode
bun run dev

# Build
bun run build

# Build standalone binary
bun run build:binary

# Regenerate API types from OpenAPI spec
bun run generate:types
```

## API Types

TypeScript types are auto-generated from the [Simkl API Blueprint](https://simkl.docs.apiary.io/) spec using:

1. `apib2swagger` - Convert API Blueprint to OpenAPI 3.0
2. `openapi-typescript` - Generate TypeScript types from OpenAPI

## License

MIT
