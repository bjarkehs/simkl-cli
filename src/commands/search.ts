import type { Command } from "commander";
import { api, apiPublic } from "../api.js";
import type { operations } from "../generated/api-types.js";
import type { MediaItem } from "../utils.js";
import { dim, heading, info, json, printMediaList } from "../utils.js";

/** Search result from /search/{type} */
type SearchResponse = NonNullable<
  operations["Get items based on text query"]["responses"]["200"]["content"]["application/json"]
>;

/** Search by ID result from /search/id */
type SearchIdResponse = NonNullable<
  operations["Get items by ID"]["responses"]["200"]["content"]["application/json"]
>;

/** File search result from /search/file */
type FileSearchResponse = NonNullable<
  operations["Find show, anime or movie by file"]["responses"]["200"]["content"]["application/json"]
>;

export function registerSearchCommands(program: Command): void {
  // ── Search by text query ──
  program
    .command("search")
    .description("Search for TV shows, movies, or anime")
    .argument("<query>", "Search text or URL (IMDB, Letterboxd, etc.)")
    .option("-t, --type <type>", "Filter by type: tv, movie, anime", "movie")
    .option("-l, --limit <n>", "Results per page", "10")
    .option("-p, --page <n>", "Page number", "1")
    .option("-e, --extended", "Include ratings and additional info")
    .option("--json", "Output raw JSON")
    .action(async (query, opts) => {
      const params: Record<string, string | number | undefined> = {
        q: query,
        page: opts.page,
        limit: opts.limit,
      };
      if (opts.extended) {
        params.extended = "full";
      }

      const data = await apiPublic<SearchResponse>(`/search/${opts.type}`, params);

      if (opts.json) {
        json(data);
        return;
      }

      heading(`Search results for "${query}" (${opts.type}):`);
      printMediaList(data as MediaItem[]);
    });

  // ── Search by external ID ──
  program
    .command("search-id")
    .description("Look up items by external ID (IMDB, TMDB, TVDB, MAL, etc.)")
    .option("--simkl <id>", "Simkl ID")
    .option("--imdb <id>", "IMDB ID (e.g. tt1234567)")
    .option("--tmdb <id>", "TMDB ID")
    .option("--tvdb <id>", "TVDB ID")
    .option("--mal <id>", "MyAnimeList ID")
    .option("--anidb <id>", "AniDB ID")
    .option("--anilist <id>", "AniList ID")
    .option("--kitsu <id>", "Kitsu ID")
    .option("--hulu <id>", "Hulu ID")
    .option("--netflix <id>", "Netflix ID")
    .option("--crunchyroll <id>", "Crunchyroll ID")
    .option("--livechart <id>", "LiveChart ID")
    .option("--anisearch <id>", "aniSearch ID")
    .option("--animeplanet <id>", "Anime-Planet ID/slug")
    .option("--title <title>", "Title (for narrowing results)")
    .option("--year <year>", "Release year")
    .option("-t, --type <type>", "Type for TMDB lookups: show, movie")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const params: Record<string, string | number | undefined> = {};
      const idFields = [
        "simkl",
        "imdb",
        "tmdb",
        "tvdb",
        "mal",
        "anidb",
        "anilist",
        "kitsu",
        "hulu",
        "netflix",
        "crunchyroll",
        "livechart",
        "anisearch",
        "animeplanet",
      ];
      for (const field of idFields) {
        if (opts[field]) params[field] = opts[field];
      }
      if (opts.title) params.title = opts.title;
      if (opts.year) params.year = opts.year;
      if (opts.type) params.type = opts.type;

      const data = await apiPublic<SearchIdResponse>("/search/id", params);

      if (opts.json) {
        json(data);
        return;
      }

      heading("Search by ID results:");
      printMediaList(Array.isArray(data) ? (data as MediaItem[]) : [data as MediaItem]);
    });

  // ── Search by filename ──
  program
    .command("search-file")
    .description("Find show/anime/movie by filename")
    .argument("<file>", "Filename or path to match")
    .option("--part <n>", "Part number for multi-episode files")
    .option("--json", "Output raw JSON")
    .action(async (file, opts) => {
      const body: Record<string, unknown> = { file };
      if (opts.part) body.part = parseInt(opts.part, 10);

      const data = await api<FileSearchResponse>("/search/file", {
        method: "POST",
        body,
      });

      if (opts.json) {
        json(data);
        return;
      }

      const d = data as Record<string, unknown>;
      heading("File match:");
      info("Type", d.type as string);

      const show = d.show as Record<string, unknown> | undefined;
      const movie = d.movie as Record<string, unknown> | undefined;
      const episode = d.episode as Record<string, unknown> | undefined;

      if (show) {
        info("Show", show.title as string);
        info("Year", show.year as number);
      }
      if (movie) {
        info("Movie", movie.title as string);
        info("Year", movie.year as number);
      }
      if (episode) {
        info("Season", episode.season as number);
        info("Episode", episode.episode as number);
        info("Title", episode.title as string);
      }
    });

  // ── Random search ──
  program
    .command("random")
    .description("Find a random show, anime, or movie")
    .option("-t, --type <type>", "Type: tv, movie, anime")
    .option("--genre <genre>", "Filter by genre")
    .option("--rating-from <n>", "Minimum rating (1-10)")
    .option("--rating-to <n>", "Maximum rating (1-10)")
    .option("--year-from <n>", "Minimum year")
    .option("--year-to <n>", "Maximum year")
    .option("--rank-limit <n>", "Maximum rank")
    .option("-l, --limit <n>", "Number of results")
    .option("--service <service>", "Service: simkl, netflix", "simkl")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const params: Record<string, string | number | undefined> = {
        service: opts.service,
        type: opts.type,
        genre: opts.genre,
        rating_from: opts.ratingFrom,
        rating_to: opts.ratingTo,
        year_from: opts.yearFrom,
        year_to: opts.yearTo,
        rank_limit: opts.rankLimit,
        limit: opts.limit,
      };

      const data = await apiPublic("/search/random", params);

      if (opts.json) {
        json(data);
        return;
      }

      heading("Random pick:");
      if (Array.isArray(data)) {
        printMediaList(data as MediaItem[]);
      } else {
        const d = data as Record<string, unknown>;
        console.log(`  ${d.title || "Unknown"} ${dim(`(${d.year || "?"})`)}`);
      }
    });
}
