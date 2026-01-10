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

1. Get your API credentials at https://simkl.com/settings/developer/
2. Configure the CLI:

```bash
simkl config --client-id YOUR_CLIENT_ID --client-secret YOUR_SECRET
```

3. Authenticate:

```bash
simkl auth
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

### Sync

```bash
# Add to watchlist
simkl sync add "Dune" --type movie --status plantowatch

# Add using IMDB ID
simkl sync add "Movie" --imdb tt1234567

# Add to watch history
simkl sync history "Blade Runner 2049" --type movie
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
