import chalk from "chalk";
import type { Command } from "commander";
import { api } from "../api.js";
import type { operations } from "../generated/api-types.js";
import { dim, heading, info, json, success } from "../utils.js";

// ── Response types from generated OpenAPI spec ──

type ScrobbleResponse = NonNullable<
  operations["Start watching"]["responses"]["201"]["content"]["application/json"]
>;

type PlaybackResponse = NonNullable<
  operations["Get Playback Sessions"]["responses"]["200"]["content"]["application/json"]
>;

export function registerScrobbleCommands(program: Command): void {
  const scrobble = program
    .command("scrobble")
    .description("Scrobble management (start/pause/stop)");

  scrobble
    .command("start")
    .description("Start watching (scrobble)")
    .option("--title <title>", "Movie/show title")
    .option("--movie", "Scrobble a movie")
    .option("--progress <n>", "Playback progress percentage (0-100)")
    .option("--season <n>", "Season number")
    .option("--episode <n>", "Episode number")
    .option("--imdb <id>", "IMDB ID")
    .option("--tmdb <id>", "TMDB ID")
    .option("--simkl <id>", "Simkl ID")
    .option("--mal <id>", "MAL ID")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const body = buildScrobbleBody(opts);

      const data = await api<ScrobbleResponse>("/scrobble/start", {
        method: "POST",
        body,
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }
      success("Scrobble started.");
      printScrobbleResponse(data as Record<string, unknown>);
    });

  scrobble
    .command("pause")
    .description("Pause watching (saves progress)")
    .option("--title <title>", "Movie/show title")
    .option("--movie", "Pause a movie")
    .option("--progress <n>", "Current progress percentage")
    .option("--season <n>", "Season number")
    .option("--episode <n>", "Episode number")
    .option("--imdb <id>", "IMDB ID")
    .option("--tmdb <id>", "TMDB ID")
    .option("--simkl <id>", "Simkl ID")
    .option("--mal <id>", "MAL ID")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const body = buildScrobbleBody(opts);

      const data = await api("/scrobble/pause", {
        method: "POST",
        body,
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }
      success("Scrobble paused.");
      printScrobbleResponse(data as Record<string, unknown>);
    });

  scrobble
    .command("stop")
    .description("Stop watching")
    .option("--title <title>", "Movie/show title")
    .option("--movie", "Stop a movie")
    .option("--progress <n>", "Final progress percentage")
    .option("--season <n>", "Season number")
    .option("--episode <n>", "Episode number")
    .option("--imdb <id>", "IMDB ID")
    .option("--tmdb <id>", "TMDB ID")
    .option("--simkl <id>", "Simkl ID")
    .option("--mal <id>", "MAL ID")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const body = buildScrobbleBody(opts);

      const data = await api("/scrobble/stop", {
        method: "POST",
        body,
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }
      success("Scrobble stopped.");
      printScrobbleResponse(data as Record<string, unknown>);
    });
}

export function registerPlaybackCommand(program: Command): void {
  program
    .command("playback")
    .description("View paused playback sessions (continue watching)")
    .option("-t, --type <type>", "Type: movies, episodes", "episodes")
    .option("-l, --limit <n>", "Number of results")
    .option("--hide-watched", "Hide already watched items")
    .option("--date-from <date>", "Filter from date (ISO 8601)")
    .option("--date-to <date>", "Filter to date (ISO 8601)")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const params: Record<string, string | number | undefined> = {
        limit: opts.limit,
        hide_watched: opts.hideWatched ? "true" : undefined,
        date_from: opts.dateFrom,
        date_to: opts.dateTo,
      };

      const data = await api<PlaybackResponse>(`/sync/playback/${opts.type}`, {
        params,
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }

      heading("Playback Sessions:");
      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.log(dim("  No active playback sessions."));
        return;
      }

      const items = data as Array<Record<string, unknown>>;
      for (const item of items) {
        const show = item.show as Record<string, unknown> | undefined;
        const movie = item.movie as Record<string, unknown> | undefined;
        const episode = item.episode as Record<string, unknown> | undefined;
        const progress = item.progress as number;
        const pausedAt = item.paused_at as string | undefined;

        const title = (show?.title || movie?.title || "Unknown") as string;
        let line = `  ${chalk.bold(title)}`;

        if (episode) {
          line += dim(
            ` S${String(episode.season).padStart(2, "0")}E${String(episode.number || episode.episode).padStart(2, "0")}`
          );
        }

        line += ` ${chalk.cyan(`${progress}%`)}`;

        if (pausedAt) {
          line += dim(` paused ${pausedAt.split("T")[0]}`);
        }

        const id = item.id as number;
        line += dim(` (id:${id})`);

        console.log(line);
      }
    });

  program
    .command("playback-delete")
    .description("Delete a paused playback session")
    .argument("<id>", "Playback session ID")
    .action(async (id) => {
      await api(`/sync/playback/${id}`, {
        method: "DELETE",
        authenticated: true,
      });
      success("Playback session deleted.");
    });
}

// ── Helpers ──

function buildScrobbleBody(opts: Record<string, string | undefined>): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (opts.progress) {
    body.progress = parseFloat(opts.progress);
  }

  const ids: Record<string, unknown> = {};
  if (opts.imdb) ids.imdb = opts.imdb;
  if (opts.tmdb) ids.tmdb = parseInt(opts.tmdb, 10);
  if (opts.simkl) ids.simkl = parseInt(opts.simkl, 10);
  if (opts.mal) ids.mal = parseInt(opts.mal, 10);

  if (opts.movie) {
    body.movie = {
      ...(opts.title ? { title: opts.title } : {}),
      ids,
    };
  } else if (opts.mal) {
    // Anime (MAL ID implies anime)
    body.anime = { ids };
    if (opts.season || opts.episode) {
      body.episode = {
        ...(opts.season ? { season: parseInt(opts.season, 10) } : {}),
        ...(opts.episode ? { number: parseInt(opts.episode, 10) } : {}),
      };
    }
  } else {
    body.show = {
      ...(opts.title ? { title: opts.title } : {}),
      ids,
    };
    if (opts.season || opts.episode) {
      body.episode = {
        ...(opts.season ? { season: parseInt(opts.season, 10) } : {}),
        ...(opts.episode ? { number: parseInt(opts.episode, 10) } : {}),
      };
    }
  }

  return body;
}

function printScrobbleResponse(data: Record<string, unknown>): void {
  info("Action", data.action as string);
  info("Progress", `${data.progress}%`);

  const movie = data.movie as Record<string, unknown> | undefined;
  const show = data.show as Record<string, unknown> | undefined;
  const anime = data.anime as Record<string, unknown> | undefined;
  const episode = data.episode as Record<string, unknown> | undefined;

  if (movie) info("Movie", movie.title as string);
  if (show) info("Show", show.title as string);
  if (anime) info("Anime", anime.title as string);
  if (episode) {
    info("Episode", `S${episode.season}E${episode.number} ${episode.title || ""}`);
  }
}
