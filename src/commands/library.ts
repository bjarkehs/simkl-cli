import chalk from "chalk";
import type { Command } from "commander";
import { api, apiPublic } from "../api.js";
import { dim, heading, info, json, parseEpisodeRef, success } from "../utils.js";

// ── Helper: search and pick first result ──

async function resolveItem(
  opts: Record<string, string | undefined>
): Promise<{ ids: Record<string, unknown>; title?: string; year?: number } | null> {
  // Direct ID provided
  if (opts.simkl) return { ids: { simkl: parseInt(opts.simkl, 10) } };
  if (opts.imdb) return { ids: { imdb: opts.imdb } };
  if (opts.tmdb) return { ids: { tmdb: parseInt(opts.tmdb, 10) } };

  // Search by title
  if (opts.title) {
    const type = opts.movie ? "movie" : opts.type || "tv";
    const results = (await apiPublic(`/search/${type}`, { q: opts.title })) as Array<{
      title: string;
      year: number;
      ids: Record<string, unknown>;
    }>;
    const first = results[0];
    if (!first) return null;
    return {
      ids: { simkl: first.ids.simkl_id || first.ids.simkl },
      title: first.title,
      year: first.year,
    };
  }

  return null;
}

// ── Watchlist ──

export function registerWatchlistCommand(program: Command): void {
  program
    .command("watchlist")
    .description("View your watchlist")
    .option("-t, --type <type>", "Type: shows, movies, anime")
    .option("-s, --status <status>", "Status: watching, plantowatch, completed, hold, dropped")
    .option("--extended <fields>", "Extended info: full, full_anime_seasons")
    .option("--date-from <date>", "Filter by date (ISO 8601)")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const type = opts.type || "shows";
      const status = opts.status || "watching";
      const params: Record<string, string | number | undefined> = {
        extended: opts.extended,
        date_from: opts.dateFrom,
      };

      const data = await api(`/sync/all-items/${type}/${status}`, {
        params,
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.log(dim("  No items in your watchlist."));
        return;
      }

      heading(`Watchlist (${type} - ${status}):`);
      const items = data as Array<Record<string, unknown>>;
      for (const item of items) {
        const show = item.show as Record<string, unknown> | undefined;
        const movie = item.movie as Record<string, unknown> | undefined;
        const anime = item.anime as Record<string, unknown> | undefined;
        const media = show || movie || anime;
        if (!media) continue;

        const title = media.title as string;
        const year = media.year as number;
        const lastWatched = item.last_watched_at as string | undefined;
        const userRating = item.user_rating as number | undefined;
        const totalEps = item.total_episodes_count as number | undefined;
        const watchedEps = item.watched_episodes_count as number | undefined;

        let line = `  ${chalk.bold(title)} ${dim(`(${year})`)}`;
        if (watchedEps !== undefined && totalEps !== undefined) {
          line += ` ${dim(`[${watchedEps}/${totalEps} eps]`)}`;
        }
        if (userRating) {
          line += ` ${chalk.yellow(`★${userRating}`)}`;
        }
        if (lastWatched) {
          line += ` ${dim(`last: ${lastWatched.split("T")[0]}`)}`;
        }
        console.log(line);
      }
    });
}

// ── Watch (mark as watched) ──

export function registerWatchCommand(program: Command): void {
  program
    .command("watch")
    .description("Mark episodes or movies as watched")
    .argument("[episode-ref]", "Episode reference: 5, 1x05, S01E05, 1-5, 1,3,5")
    .option("--title <title>", "Show/movie title to search")
    .option("--movie", "Mark a movie as watched")
    .option("--season <n>", "Season number (default: 1)")
    .option("--imdb <id>", "IMDB ID")
    .option("--tmdb <id>", "TMDB ID")
    .option("--simkl <id>", "Simkl ID")
    .option("--mal <id>", "MAL ID")
    .option("--at <datetime>", "When watched (ISO 8601)")
    .option("--json", "Output raw JSON")
    .action(async (episodeRef, opts) => {
      if (opts.movie) {
        // Mark movie as watched
        const item = await resolveItem(opts);
        if (!item) {
          console.error(
            chalk.red("Could not find movie. Provide --title, --imdb, --tmdb, or --simkl.")
          );
          process.exit(1);
        }

        const body: Record<string, unknown> = {
          movies: [
            {
              ...item,
              ...(opts.at ? { watched_at: opts.at } : {}),
            },
          ],
        };

        const data = await api("/sync/history", {
          method: "POST",
          body,
          authenticated: true,
        });

        if (opts.json) {
          json(data);
          return;
        }
        success(`Marked movie as watched${item.title ? `: ${item.title}` : ""}`);
        return;
      }

      // Mark episodes as watched
      const item = await resolveItem(opts);
      if (!item) {
        console.error(
          chalk.red("Could not find show. Provide --title, --imdb, --tmdb, or --simkl.")
        );
        process.exit(1);
      }

      const defaultSeason = opts.season ? parseInt(opts.season, 10) : 1;
      let episodes: Array<{ number: number }>;

      if (episodeRef) {
        const ref = parseEpisodeRef(episodeRef, defaultSeason);
        episodes = ref.episodes.map((n) => ({ number: n }));
        // Use season from ref if it was explicit (SxxExx format)
        const season = ref.season;
        const body: Record<string, unknown> = {
          shows: [
            {
              ...item,
              seasons: [
                {
                  number: season,
                  episodes: episodes.map((ep) => ({
                    ...ep,
                    ...(opts.at ? { watched_at: opts.at } : {}),
                  })),
                },
              ],
            },
          ],
        };

        const data = await api("/sync/history", {
          method: "POST",
          body,
          authenticated: true,
        });

        if (opts.json) {
          json(data);
          return;
        }

        const epList = episodes.map((e) => e.number).join(", ");
        success(
          `Marked S${String(season).padStart(2, "0")} episodes [${epList}] as watched${item.title ? ` for ${item.title}` : ""}`
        );
      } else {
        console.error(
          chalk.red("Provide an episode reference: simkl watch 1x05 --title 'Show Name'")
        );
        process.exit(1);
      }
    });
}

// ── Unwatch (remove from history) ──

export function registerUnwatchCommand(program: Command): void {
  program
    .command("unwatch")
    .description("Remove items from watched history")
    .option("--title <title>", "Show/movie title")
    .option("--movie", "Remove a movie")
    .option("--season <n>", "Season to remove")
    .option("--episodes <eps>", "Episodes to remove (1,2,3 or 1-5)")
    .option("--imdb <id>", "IMDB ID")
    .option("--tmdb <id>", "TMDB ID")
    .option("--simkl <id>", "Simkl ID")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const item = await resolveItem(opts);
      if (!item) {
        console.error(
          chalk.red("Could not find item. Provide --title, --imdb, --tmdb, or --simkl.")
        );
        process.exit(1);
      }

      let body: Record<string, unknown>;

      if (opts.movie) {
        body = { movies: [item] };
      } else {
        const showItem: Record<string, unknown> = { ...item };
        if (opts.season) {
          const seasonNum = parseInt(opts.season, 10);
          if (opts.episodes) {
            const ref = parseEpisodeRef(opts.episodes, seasonNum);
            showItem.seasons = [
              {
                number: seasonNum,
                episodes: ref.episodes.map((n) => ({ number: n })),
              },
            ];
          } else {
            showItem.seasons = [{ number: seasonNum }];
          }
        }
        body = { shows: [showItem] };
      }

      const data = await api("/sync/history/remove", {
        method: "POST",
        body,
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }
      success("Removed from watched history.");
    });
}

// ── Add to list ──

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("Add items to a specific list")
    .option("--title <title>", "Show/movie title")
    .option("--movie", "Target is a movie")
    .option("-t, --type <type>", "Search type: tv, movie, anime")
    .option(
      "-s, --status <status>",
      "List: plantowatch, watching, completed, hold, dropped",
      "plantowatch"
    )
    .option("--imdb <id>", "IMDB ID")
    .option("--tmdb <id>", "TMDB ID")
    .option("--simkl <id>", "Simkl ID")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const item = await resolveItem(opts);
      if (!item) {
        console.error(
          chalk.red("Could not find item. Provide --title, --imdb, --tmdb, or --simkl.")
        );
        process.exit(1);
      }

      const isMovie = opts.movie || opts.type === "movie";
      const body: Record<string, unknown> = isMovie
        ? { movies: [{ ...item, to: opts.status }] }
        : { shows: [{ ...item, to: opts.status }] };

      const data = await api("/sync/add-to-list", {
        method: "POST",
        body,
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }
      success(`Added to ${opts.status}${item.title ? `: ${item.title}` : ""}`);
    });
}

// ── Checkin ──

export function registerCheckinCommand(program: Command): void {
  program
    .command("checkin")
    .description("Check in to an item (sets 'watching now' status)")
    .option("--title <title>", "Show/movie title")
    .option("--movie", "Check in to a movie")
    .option("--season <n>", "Season number")
    .option("--episode <n>", "Episode number")
    .option("--imdb <id>", "IMDB ID")
    .option("--tmdb <id>", "TMDB ID")
    .option("--simkl <id>", "Simkl ID")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const item = await resolveItem(opts);
      if (!item) {
        console.error(
          chalk.red("Could not find item. Provide --title, --imdb, --tmdb, or --simkl.")
        );
        process.exit(1);
      }

      let body: Record<string, unknown>;

      if (opts.movie) {
        body = { movie: { ...item } };
      } else {
        body = {
          show: { ...item },
        };
        if (opts.season && opts.episode) {
          (body.show as Record<string, unknown>).episode = {
            season: parseInt(opts.season, 10),
            number: parseInt(opts.episode, 10),
          };
        }
      }

      const data = await api("/checkin", {
        method: "POST",
        body,
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }
      success("Checked in successfully.");
    });
}

// ── Ratings ──

export function registerRatingCommands(program: Command): void {
  program
    .command("rate")
    .description("Rate a movie or show")
    .option("--title <title>", "Show/movie title")
    .option("--movie", "Rate a movie")
    .option("-t, --type <type>", "Search type: tv, movie, anime")
    .option("-r, --rating <n>", "Rating (1-10)", "10")
    .option("--imdb <id>", "IMDB ID")
    .option("--tmdb <id>", "TMDB ID")
    .option("--simkl <id>", "Simkl ID")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const item = await resolveItem(opts);
      if (!item) {
        console.error(
          chalk.red("Could not find item. Provide --title, --imdb, --tmdb, or --simkl.")
        );
        process.exit(1);
      }

      const isMovie = opts.movie || opts.type === "movie";
      const body: Record<string, unknown> = isMovie ? { movies: [item] } : { shows: [item] };

      const data = await api("/sync/ratings", {
        method: "POST",
        body,
        params: { rating: opts.rating },
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }
      success(`Rated ${opts.rating}/10${item.title ? `: ${item.title}` : ""}`);
    });

  program
    .command("ratings")
    .description("View your ratings")
    .option("-t, --type <type>", "Type: shows, movies, anime", "shows")
    .option("-r, --rating <n>", "Filter by rating (1-10, or comma-separated)")
    .option("--date-from <date>", "Filter by date (ISO 8601)")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const rating = opts.rating || "1,2,3,4,5,6,7,8,9,10";
      const params: Record<string, string | number | undefined> = {
        date_from: opts.dateFrom,
      };

      const data = await api(`/sync/ratings/${opts.type}/${rating}`, {
        method: "POST",
        params,
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }

      heading("Your Ratings:");
      const items = data as Array<Record<string, unknown>> | null;
      if (!items || items.length === 0) {
        console.log(dim("  No ratings found."));
        return;
      }

      for (const item of items) {
        const show = item.show as Record<string, unknown> | undefined;
        const movie = item.movie as Record<string, unknown> | undefined;
        const anime = item.anime as Record<string, unknown> | undefined;
        const media = show || movie || anime;
        if (!media) continue;

        const rating = item.rating as number;
        const ratedAt = item.rated_at as string | undefined;
        console.log(
          `  ${chalk.yellow(`★${rating}`)} ${chalk.bold(media.title as string)} ${dim(`(${media.year})`)}${ratedAt ? dim(` rated ${ratedAt.split("T")[0]}`) : ""}`
        );
      }
    });

  program
    .command("unrate")
    .description("Remove a rating")
    .option("--title <title>", "Show/movie title")
    .option("--movie", "Unrate a movie")
    .option("-t, --type <type>", "Search type: tv, movie, anime")
    .option("--imdb <id>", "IMDB ID")
    .option("--tmdb <id>", "TMDB ID")
    .option("--simkl <id>", "Simkl ID")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const item = await resolveItem(opts);
      if (!item) {
        console.error(
          chalk.red("Could not find item. Provide --title, --imdb, --tmdb, or --simkl.")
        );
        process.exit(1);
      }

      const isMovie = opts.movie || opts.type === "movie";
      const body: Record<string, unknown> = isMovie ? { movies: [item] } : { shows: [item] };

      const data = await api("/sync/ratings/remove", {
        method: "POST",
        body,
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }
      success("Rating removed.");
    });

  // ── Get ratings for an item ──
  program
    .command("item-rating")
    .description("Get ratings for a specific movie, show, or anime")
    .option("--simkl <id>", "Simkl ID")
    .option("--imdb <id>", "IMDB ID")
    .option("--tmdb <id>", "TMDB ID")
    .option("--tvdb <id>", "TVDB ID")
    .option("--mal <id>", "MAL ID")
    .option("-t, --type <type>", "Type: show, movie, tv, anime")
    .option("--fields <fields>", "Fields: simkl,ext,rank,status,year,reactions,has_trailer")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const params: Record<string, string | number | undefined> = {
        simkl: opts.simkl,
        imdb: opts.imdb,
        tmdb: opts.tmdb,
        tvdb: opts.tvdb,
        mal: opts.mal,
        type: opts.type,
        fields: opts.fields || "simkl,ext,rank,reactions,year,has_trailer",
      };

      const data = await apiPublic("/ratings", params);

      if (opts.json) {
        json(data);
        return;
      }

      const d = data as Record<string, unknown>;
      heading("Item Rating:");
      info("Simkl Link", d.link as string);
      info("Year", d.release_year as string);
      info("Rank", (d.rank as Record<string, string>)?.value);

      const simklRating = d.simkl as Record<string, number> | undefined;
      if (simklRating) {
        console.log(`  Simkl: ${simklRating.rating} (${simklRating.votes} votes)`);
      }

      const imdbRating = d.IMDB as Record<string, number> | undefined;
      if (imdbRating) {
        console.log(`  IMDB: ${imdbRating.rating} (${imdbRating.votes} votes)`);
      }
    });

  // ── Get ratings for watchlist items ──
  program
    .command("watchlist-ratings")
    .description("Get updated ratings for items in your watchlist")
    .argument("<type>", "Type: tv, anime, movies")
    .option(
      "-s, --status <status>",
      "Watchlist status: all, watching, plantowatch, completed, dropped, hold",
      "all"
    )
    .option("--fields <fields>", "Fields: simkl,ext,rank,release_status,year")
    .option("--json", "Output raw JSON")
    .action(async (type, opts) => {
      const params: Record<string, string | number | undefined> = {
        user_watchlist: opts.status,
        fields: opts.fields || "simkl,ext,rank,release_status,year",
      };

      const data = await api(`/ratings/${type}`, {
        params: { ...params },
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }

      heading(`Watchlist Ratings (${type} - ${opts.status}):`);
      const items = data as Array<Record<string, unknown>> | null;
      if (!items || items.length === 0) {
        console.log(dim("  No items found."));
        return;
      }

      for (const item of items) {
        const simklR = item.simkl as Record<string, unknown> | undefined;
        const ratingStr = simklR?.rating ? ` ${chalk.yellow(`★${simklR.rating}`)}` : "";
        const status = item.release_status ? dim(` [${item.release_status}]`) : "";
        console.log(
          `  ${chalk.bold(String(item.link || `#${item.id}`))} ${dim(`(${item.release_year || "?"})`)}` +
            `${ratingStr}${status}`
        );
      }
    });
}
