import chalk from "chalk";
import { Command } from "commander";
import { getAccessToken, getClientId, isAuthenticated } from "../config.js";

interface SearchResult {
  title?: string;
  year?: number;
  type?: string;
  ids?: {
    simkl?: number;
    imdb?: string;
    tmdb?: string;
    slug?: string;
  };
}

/**
 * Parse episode reference in various formats:
 * - "1x05" or "1X05" (season x episode)
 * - "S01E05" or "s01e05" (S prefix, E prefix)
 * - "1.5" (season.episode)
 * - "5" (just episode number, defaults to season 1)
 * - "1-5" (range: episodes 1-5 in season 1)
 * - "1:5" (alternative range notation)
 */
function parseEpisodeRef(ref: string): { season: number; episodes: number[] } | null {
  const cleanRef = ref.trim().toLowerCase();

  // Handle S##E## or ##x## format
  const sxMatch = cleanRef.match(/s?(\d+)x(\d+)/);
  if (sxMatch) {
    const season = parseInt(sxMatch[1], 10);
    const episode = parseInt(sxMatch[2], 10);
    return { season, episodes: [episode] };
  }

  // Handle S##E## format
  const seMatch = cleanRef.match(/s(\d+)e(\d+)/);
  if (seMatch) {
    const season = parseInt(seMatch[1], 10);
    const episode = parseInt(seMatch[2], 10);
    return { season, episodes: [episode] };
  }

  // Handle "season.episode" format
  const dotMatch = cleanRef.match(/^(\d+)\.(\d+)$/);
  if (dotMatch) {
    const season = parseInt(dotMatch[1], 10);
    const episode = parseInt(dotMatch[2], 10);
    return { season, episodes: [episode] };
  }

  // Handle single episode number (defaults to season 1)
  const singleMatch = cleanRef.match(/^(\d+)$/);
  if (singleMatch) {
    const episode = parseInt(singleMatch[1], 10);
    return { season: 1, episodes: [episode] };
  }

  // Handle range "1-5" or "1:5" (episodes 1-5 in season 1)
  const rangeMatch = cleanRef.match(/^(\d+)[-:](\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (start >= 1 && end >= start) {
      const episodes: number[] = [];
      for (let i = start; i <= end; i++) {
        episodes.push(i);
      }
      return { season: 1, episodes };
    }
  }

  return null;
}

/**
 * Parse multiple episode references separated by commas
 * Examples: "1x05,1x06,1x07" or "1-5,7"
 */
function parseMultipleEpisodeRefs(refs: string): Array<{ season: number; episode: number }> {
  const result: Array<{ season: number; episode: number }> = [];
  const parts = refs.split(",").map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const parsed = parseEpisodeRef(part);
    if (parsed) {
      for (const ep of parsed.episodes) {
        result.push({ season: parsed.season, episode: ep });
      }
    }
  }

  return result.sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    return a.episode - b.episode;
  });
}

export const watchCommand = new Command("watch")
  .description("Mark episodes or movies as watched")
  .argument("[episode-ref]", "Episode reference (e.g., '1x05', 'S01E05', '5', '1-5')")
  .option("-m, --movie", "Mark a movie as watched (instead of a TV episode)")
  .option("-t, --title <title>", "Show or movie title to search for")
  .option("-s, --season <number>", "Season number (for TV shows)", "1")
  .option("-e, --episodes <episodes>", "Episode numbers (e.g., '1,2,3' or '1-5')", "1")
  .option("--imdb <id>", "IMDB ID of the show/movie")
  .option("--tmdb <id>", "TMDB ID of the show/movie")
  .option("--simkl <id>", "Simkl ID of the show/movie")
  .option("--next", "Mark the next unwatched episode")
  .option("--at <datetime>", "When watched (ISO 8601 UTC, e.g., '2024-01-15T20:30:00Z')")
  .option("--json", "Output raw JSON")
  .action(async (episodeRef, options) => {
    if (!isAuthenticated()) {
      console.error(chalk.red("Error: Not authenticated. Run `simkl auth` first."));
      process.exit(1);
    }

    const token = getAccessToken();
    const clientId = getClientId();
    const isMovie = options.movie;

    // Validate arguments
    if (!isMovie && !episodeRef && !options.next) {
      console.error(
        chalk.red(
          "Error: Episode reference required. Use format like '1x05', 'S01E05', '5', or '--next' flag."
        )
      );
      process.exit(1);
    }

    if ((episodeRef || options.episodes !== "1") && options.next) {
      console.error(chalk.red("Error: Cannot use both episode reference and --next flag."));
      process.exit(1);
    }

    try {
      let ids: { simkl?: number; imdb?: string; tmdb?: number } | null = null;

      // If ID is provided directly, use it
      if (options.imdb || options.tmdb || options.simkl) {
        ids = {
          ...(options.simkl && { simkl: parseInt(options.simkl, 10) }),
          ...(options.imdb && { imdb: options.imdb }),
          ...(options.tmdb && { tmdb: parseInt(options.tmdb, 10) }),
        };
      } else if (options.title) {
        // Search for the show/movie first
        console.log(chalk.dim(`Searching for "${options.title}"...`));

        const searchType = isMovie ? "movie" : "tv";
        const searchResponse = await fetch(
          `https://api.simkl.com/search/${searchType}?q=${encodeURIComponent(options.title)}&limit=1`,
          {
            headers: {
              "simkl-api-key": clientId!,
            },
          }
        );

        if (!searchResponse.ok) {
          throw new Error(`Search failed: ${searchResponse.statusText}`);
        }

        const results = (await searchResponse.json()) as SearchResult[];

        const match = results?.[0];
        if (!match) {
          console.error(chalk.red(`No results found for "${options.title}"`));
          process.exit(1);
        }

        if (!match.ids?.simkl) {
          console.error(chalk.red(`"${match.title}" does not have a Simkl ID`));
          process.exit(1);
        }

        ids = {
          simkl: match.ids.simkl,
          imdb: match.ids.imdb,
          tmdb: match.ids.tmdb ? parseInt(match.ids.tmdb as string, 10) : undefined,
        };

        console.log(
          chalk.dim(
            `Found: ${match.title} (${match.year || "unknown year"}) [${match.type || "unknown"}]`
          )
        );
      } else {
        console.error(chalk.red("Error: Title or ID required. Use --title, --imdb, --tmdb, or --simkl."));
        process.exit(1);
      }

      let responseData: unknown;

      if (isMovie) {
        // Mark movie as watched
        console.log(chalk.dim(`Marking movie as watched...`));

        const movieObj: Record<string, unknown> = {
          ids: ids!,
        };

        if (options.at) {
          movieObj.watched_at = options.at;
        }

        const syncBody = {
          movies: [movieObj],
        };

        const response = await fetch("https://api.simkl.com/sync/history", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "simkl-api-key": clientId!,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(syncBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to mark movie as watched: ${response.status} - ${errorText}`);
        }

        responseData = await response.json();

        if (options.json) {
          console.log(JSON.stringify(responseData, null, 2));
          return;
        }

        console.log(chalk.green("✓ Marked movie as watched"));
      } else {
        // Mark episodes as watched (TV shows)
        let episodesToMark: Array<{ season: number; episode: number }> = [];

        if (options.next) {
          // TODO: Fetch next unwatched episode
          console.error(chalk.red("Error: --next flag not yet implemented. Please specify episode reference."));
          process.exit(1);
        } else if (episodeRef) {
          // Parse the episode reference (could be single or multiple via comma)
          const parsed = parseMultipleEpisodeRefs(episodeRef);
          if (parsed.length === 0) {
            console.error(chalk.red(`Error: Invalid episode reference "${episodeRef}"`));
            console.error(chalk.dim("Use format like: '1x05', 'S01E05', '5', '1-5', or '1x05,1x06'"));
            process.exit(1);
          }
          episodesToMark = parsed;
        } else {
          // Fallback to --episodes flag parsing
          const seasonNumber = parseInt(options.season, 10);
          const epNumbers = parseEpisodeNumbers(options.episodes);

          if (Number.isNaN(seasonNumber) || seasonNumber < 1) {
            console.error(chalk.red("Error: Season number must be a positive integer"));
            process.exit(1);
          }

          if (epNumbers.length === 0) {
            console.error(chalk.red("Error: No valid episode numbers provided"));
            process.exit(1);
          }

          episodesToMark = epNumbers.map((ep) => ({
            season: seasonNumber,
            episode: ep,
          }));
        }

        // Group episodes by season for display
        const seasonGroups = new Map<number, number[]>();
        for (const ep of episodesToMark) {
          const existing = seasonGroups.get(ep.season) || [];
          existing.push(ep.episode);
          seasonGroups.set(ep.season, existing.sort((a, b) => a - b));
        }

        const displayParts: string[] = [];
        for (const [season, episodes] of seasonGroups) {
          if (episodes.length === 1) {
            displayParts.push(`S${season}E${episodes[0].toString().padStart(2, "0")}`);
          } else {
            const start = episodes[0];
            const end = episodes[episodes.length - 1];
            displayParts.push(`S${season}E${start.toString().padStart(2, "0")}-E${end.toString().padStart(2, "0")}`);
          }
        }

        console.log(chalk.dim(`Marking ${displayParts.join(", ")} as watched...`));

        // Build the episode objects
        const episodeObjects = episodesToMark.map((ep) => {
          const episodeObj: Record<string, unknown> = {
            ids: ids!,
            season: ep.season,
            number: ep.episode,
          };

          if (options.at) {
            episodeObj.watched_at = options.at;
          }

          return episodeObj;
        });

        const syncBody = {
          episodes: episodeObjects,
        };

        const response = await fetch("https://api.simkl.com/sync/history", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "simkl-api-key": clientId!,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(syncBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to mark episodes as watched: ${response.status} - ${errorText}`);
        }

        responseData = await response.json();

        if (options.json) {
          console.log(JSON.stringify(responseData, null, 2));
          return;
        }

        console.log(
          chalk.green(`✓ Marked ${episodesToMark.length} episode(s) as watched`)
        );
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

/**
 * Parse episode numbers from a string that may contain ranges and/or commas.
 * Examples: "1,2,3" -> [1, 2, 3]
 *           "1-5" -> [1, 2, 3, 4, 5]
 *           "1,3-5,7" -> [1, 3, 4, 5, 7]
 */
function parseEpisodeNumbers(episodesStr: string): number[] {
  const episodes: Set<number> = new Set();
  const parts = episodesStr.split(",");

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes("-")) {
      // Handle range (e.g., "1-5")
      const [startStr, endStr] = trimmed.split("-");
      if (!startStr || !endStr) continue;
      const start = parseInt(startStr.trim(), 10);
      const end = parseInt(endStr.trim(), 10);

      if (Number.isNaN(start) || Number.isNaN(end) || start < 1 || end < start) {
        continue;
      }

      for (let i = start; i <= end; i++) {
        episodes.add(i);
      }
    } else {
      // Handle single number
      const num = parseInt(trimmed, 10);
      if (!Number.isNaN(num) && num >= 1) {
        episodes.add(num);
      }
    }
  }

  return Array.from(episodes).sort((a, b) => a - b);
}
