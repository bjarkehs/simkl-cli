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

export const markWatchedCommand = new Command("mark-watched")
  .description("Mark episodes as watched")
  .argument("<show>", "Show title to search for")
  .option("-s, --season <number>", "Season number", "1")
  .option(
    "-e, --episodes <episodes>",
    "Episode numbers to mark as watched (e.g., '1,2,3' or '1-5')",
    "1"
  )
  .option("-t, --type <type>", "Filter by type: movie, tv, anime", "tv")
  .option("--imdb <id>", "IMDB ID of the show")
  .option("--tmdb <id>", "TMDB ID of the show")
  .option(
    "--at <datetime>",
    "When watched (ISO 8601 UTC, e.g., '2024-01-15T20:30:00Z')"
  )
  .option("--json", "Output raw JSON")
  .action(async (show, options) => {
    if (!isAuthenticated()) {
      console.error(chalk.red("Error: Not authenticated. Run `simkl auth` first."));
      process.exit(1);
    }

    const token = getAccessToken();
    const clientId = getClientId();

    try {
      let showIds: { simkl?: number; imdb?: string; tmdb?: number } | null = null;

      // If ID is provided directly, use it
      if (options.imdb || options.tmdb) {
        showIds = {
          ...(options.imdb && { imdb: options.imdb }),
          ...(options.tmdb && { tmdb: parseInt(options.tmdb, 10) }),
        };
      } else {
        // Search for the show first
        console.log(chalk.dim(`Searching for "${show}"...`));

        const searchType = options.type || "all";
        const searchResponse = await fetch(
          `https://api.simkl.com/search/${searchType}?q=${encodeURIComponent(show)}&limit=1`,
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
          console.error(chalk.red(`No results found for "${show}"`));
          process.exit(1);
        }

        if (!match.ids?.simkl) {
          console.error(chalk.red(`Show "${match.title}" does not have a Simkl ID`));
          process.exit(1);
        }

        showIds = {
          simkl: match.ids.simkl,
          imdb: match.ids.imdb,
          tmdb: match.ids.tmdb ? parseInt(match.ids.tmdb as string, 10) : undefined,
        };

        console.log(
          chalk.dim(
            `Found: ${match.title} (${match.year || "unknown year"}) [${match.type || "unknown"}]`
          )
        );
      }

      // Parse episode numbers/ranges
      const episodes = parseEpisodeNumbers(options.episodes);
      const seasonNumber = parseInt(options.season, 10);

      if (isNaN(seasonNumber) || seasonNumber < 1) {
        console.error(chalk.red("Error: Season number must be a positive integer"));
        process.exit(1);
      }

      if (episodes.length === 0) {
        console.error(chalk.red("Error: No valid episode numbers provided"));
        process.exit(1);
      }

      console.log(
        chalk.dim(
          `Marking season ${seasonNumber}, episodes ${episodes.join(", ")} as watched...`
        )
      );

      // Build the episode objects
      const episodeObjects = episodes.map((ep) => {
        const episodeObj: Record<string, unknown> = {
          ids: showIds!,
          season: seasonNumber,
          number: ep,
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

      const responseData = await response.json();

      if (options.json) {
        console.log(JSON.stringify(responseData, null, 2));
        return;
      }

      console.log(
        chalk.green(
          `✓ Marked ${episodes.length} episode(s) in season ${seasonNumber} as watched`
        )
      );
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
      const start = parseInt(startStr.trim(), 10);
      const end = parseInt(endStr.trim(), 10);

      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        continue;
      }

      for (let i = start; i <= end; i++) {
        episodes.add(i);
      }
    } else {
      // Handle single number
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1) {
        episodes.add(num);
      }
    }
  }

  return Array.from(episodes).sort((a, b) => a - b);
}
