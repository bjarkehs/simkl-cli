import { Command } from "commander";
import chalk from "chalk";
import { getAccessToken, getClientId, isAuthenticated } from "../config.js";

interface WatchlistItem {
  show?: {
    title?: string;
    year?: number;
    ids?: { simkl?: number; imdb?: string };
  };
  movie?: {
    title?: string;
    year?: number;
    ids?: { simkl?: number; imdb?: string };
  };
  anime?: {
    title?: string;
    year?: number;
    ids?: { simkl?: number; imdb?: string };
  };
  status?: string;
  last_watched_at?: string;
  user_rating?: number;
  total_episodes_count?: number;
  watched_episodes_count?: number;
}

interface WatchlistResponse {
  movies?: WatchlistItem[];
  shows?: WatchlistItem[];
  anime?: WatchlistItem[];
}

export const watchlistCommand = new Command("watchlist")
  .description("View and manage your watchlist")
  .option("-t, --type <type>", "Filter by type: movies, shows, anime")
  .option(
    "-s, --status <status>",
    "Filter by status: watching, plantowatch, completed, hold, dropped"
  )
  .option("--json", "Output raw JSON")
  .action(async (options) => {
    if (!isAuthenticated()) {
      console.error(chalk.red("Error: Not authenticated. Run `simkl auth` first."));
      process.exit(1);
    }

    try {
      const token = getAccessToken();
      const clientId = getClientId();

      // Fetch watchlist
      const endpoint = options.type
        ? `https://api.simkl.com/sync/all-items/${options.type}`
        : "https://api.simkl.com/sync/all-items/";

      const params = new URLSearchParams();
      if (options.status) {
        params.set("status", options.status);
      }

      const url = params.toString() ? `${endpoint}?${params}` : endpoint;

      const response = await fetch(url, {
        headers: {
          "simkl-api-key": clientId!,
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error(
            chalk.red("Error: Authentication expired. Run `simkl auth` again.")
          );
          process.exit(1);
        }
        throw new Error(`Failed to fetch watchlist: ${response.statusText}`);
      }

      const data = (await response.json()) as WatchlistResponse;

      if (options.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      console.log(chalk.bold("\n📺 Your Watchlist\n"));

      const printItems = (items: WatchlistItem[], type: string) => {
        if (!items || items.length === 0) return;

        console.log(chalk.cyan.bold(`${type}:`));
        for (const item of items) {
          const media = item.show || item.movie || item.anime;
          if (!media) continue;

          const status = item.status ? chalk.dim(`[${item.status}]`) : "";
          const year = media.year ? chalk.dim(`(${media.year})`) : "";
          const rating = item.user_rating
            ? chalk.yellow(`★ ${item.user_rating}`)
            : "";

          let progress = "";
          if (item.total_episodes_count) {
            const watched = item.watched_episodes_count || 0;
            progress = chalk.dim(
              `${watched}/${item.total_episodes_count} eps`
            );
          }

          console.log(`  ${chalk.green(media.title)} ${year} ${status}`);
          if (rating || progress) {
            console.log(`    ${rating} ${progress}`);
          }
        }
        console.log();
      };

      if (data.movies) printItems(data.movies, "Movies");
      if (data.shows) printItems(data.shows, "TV Shows");
      if (data.anime) printItems(data.anime, "Anime");

      const total =
        (data.movies?.length || 0) +
        (data.shows?.length || 0) +
        (data.anime?.length || 0);

      if (total === 0) {
        console.log(chalk.yellow("Your watchlist is empty"));
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });
