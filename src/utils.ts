import chalk from "chalk";
import type { OperationResponse } from "./api.js";

// ── Response types from generated OpenAPI spec ──

/** Search result item (from /search/{type}) */
export type SearchResult = OperationResponse<"Get items based on text query">;

/** Search by ID result (from /search/id) */
export type SearchIdResult = OperationResponse<"Get items by ID">;

/** File search result (from /search/file) */
export type FileSearchResult = OperationResponse<"Find show, anime or movie by file">;

/** Rating info (from /ratings) */
export type RatingInfo = OperationResponse<"Get movie, TV show, or anime rating">;

/** Watchlist ratings (from /ratings/{type}) */
export type WatchlistRatingsResult = OperationResponse<"Get ratings for the watchlist's items">;

/** Playback session (from /sync/playback/{type}) */
export type PlaybackResult = OperationResponse<"Get Playback Sessions">;

/** User settings (from /users/settings) */
export type UserSettings = OperationResponse<"Receive settings">;

/** User stats (from /users/{user_id}/stats) */
export type UserStats = OperationResponse<"Get watched statistics">;

// ── Shared interfaces for media display ──

export interface MediaItem {
  title?: string;
  year?: number;
  type?: string;
  endpoint_type?: string;
  anime_type?: string;
  ids?: { simkl_id?: number; simkl?: number; slug?: string };
  ratings?: {
    simkl?: { rating?: number; votes?: number };
    imdb?: { rating?: number; votes?: number };
    mal?: { rating?: number; votes?: number };
  };
  rank?: number | null;
  status?: string;
  url?: string;
  total_episodes?: number;
  ep_count?: number;
  poster?: string;
}

// ── Output helpers ──

export function json(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function heading(text: string): void {
  console.log(chalk.bold.cyan(text));
}

export function info(label: string, value: string | number | null | undefined): void {
  if (value !== null && value !== undefined && value !== "") {
    console.log(`  ${chalk.gray(`${label}:`)} ${value}`);
  }
}

export function warn(text: string): void {
  console.error(chalk.yellow(text));
}

export function error(text: string): void {
  console.error(chalk.red(text));
}

export function success(text: string): void {
  console.log(chalk.green(text));
}

export function dim(text: string): string {
  return chalk.dim(text);
}

// ── Rating display ──

export function ratingStr(rating: number | undefined, votes?: number): string {
  if (!rating) return dim("N/A");
  const stars =
    rating >= 8 ? chalk.green(rating) : rating >= 6 ? chalk.yellow(rating) : chalk.red(rating);
  return votes !== undefined ? `${stars} ${dim(`(${votes} votes)`)}` : String(stars);
}

// ── Table-like list display ──

export function printMediaList(items: MediaItem[]): void {
  if (!items || items.length === 0) {
    console.log(dim("  No results found."));
    return;
  }

  for (const item of items) {
    const type = item.endpoint_type || item.type || item.anime_type || "";
    const typeTag = type ? chalk.dim(`[${type}]`) : "";
    const year = item.year ? chalk.dim(`(${item.year})`) : "";
    const id = item.ids?.simkl_id || item.ids?.simkl || "";

    console.log(`  ${chalk.bold(item.title || "Unknown")} ${year} ${typeTag} ${dim(`#${id}`)}`);

    const ratings: string[] = [];
    if (item.ratings?.simkl?.rating) {
      ratings.push(`Simkl: ${ratingStr(item.ratings.simkl.rating, item.ratings.simkl.votes)}`);
    }
    if (item.ratings?.imdb?.rating) {
      ratings.push(`IMDB: ${ratingStr(item.ratings.imdb.rating, item.ratings.imdb.votes)}`);
    }
    if (item.ratings?.mal?.rating) {
      ratings.push(`MAL: ${ratingStr(item.ratings.mal.rating, item.ratings.mal.votes)}`);
    }
    if (ratings.length > 0) {
      console.log(`    ${ratings.join("  ")}`);
    }

    if (item.status) {
      console.log(`    ${dim("Status:")} ${item.status}`);
    }
  }
}

// ── Episode reference parsing ──

export interface EpisodeRef {
  season: number;
  episodes: number[];
}

export function parseEpisodeRef(ref: string, defaultSeason: number = 1): EpisodeRef {
  // Format: S01E05 or 1x05
  const seMatch = ref.match(/^[Ss](\d+)[Ee](\d+)$/);
  if (seMatch) {
    return { season: parseInt(seMatch[1]!, 10), episodes: [parseInt(seMatch[2]!, 10)] };
  }

  const xMatch = ref.match(/^(\d+)[xX](\d+)$/);
  if (xMatch) {
    return { season: parseInt(xMatch[1]!, 10), episodes: [parseInt(xMatch[2]!, 10)] };
  }

  // Range: 1-5 or 1,2,3
  if (ref.includes("-") || ref.includes(",")) {
    const episodes = parseEpisodeNumbers(ref);
    return { season: defaultSeason, episodes };
  }

  // Single number
  const num = parseInt(ref, 10);
  if (!Number.isNaN(num)) {
    return { season: defaultSeason, episodes: [num] };
  }

  throw new Error(
    `Invalid episode reference: "${ref}". Use formats like: 5, 1x05, S01E05, 1-5, 1,3,5`
  );
}

function parseEpisodeNumbers(input: string): number[] {
  const episodes: number[] = [];
  const parts = input.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [startStr = "", endStr = ""] = trimmed.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (Number.isNaN(start) || Number.isNaN(end)) throw new Error(`Invalid range: "${trimmed}"`);
      for (let i = start; i <= end; i++) {
        episodes.push(i);
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (Number.isNaN(num)) throw new Error(`Invalid episode number: "${trimmed}"`);
      episodes.push(num);
    }
  }
  return episodes;
}
