import chalk from "chalk";
import { Command } from "commander";

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
  poster?: string;
  ratings?: {
    simkl?: { rating?: number };
    imdb?: { rating?: number };
  };
}

export const searchCommand = new Command("search")
  .description("Search for movies, TV shows, and anime")
  .argument("<query>", "Search query")
  .option("-t, --type <type>", "Filter by type: movie, tv, anime", "")
  .option("-l, --limit <n>", "Number of results", "10")
  .option("--json", "Output raw JSON")
  .action(async (query, options) => {
    try {
      const apiKey = (await import("../config.js")).getClientId() || process.env.SIMKL_CLIENT_ID;
      if (!apiKey) {
        console.error(chalk.red("Error: Client ID not configured"));
        process.exit(1);
      }

      const searchResponse = await fetch(
        `https://api.simkl.com/search/${options.type || "all"}?q=${encodeURIComponent(query)}&limit=${options.limit}`,
        {
          headers: {
            "simkl-api-key": apiKey,
          },
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`Search failed: ${searchResponse.statusText}`);
      }

      const results = (await searchResponse.json()) as SearchResult[];

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (!results || results.length === 0) {
        console.log(chalk.yellow("No results found"));
        return;
      }

      console.log(chalk.bold(`\nSearch results for "${query}":\n`));

      for (const item of results) {
        const type = chalk.dim(`[${item.type || "unknown"}]`);
        const year = item.year ? chalk.dim(`(${item.year})`) : "";
        const rating = item.ratings?.simkl?.rating
          ? chalk.yellow(`★ ${item.ratings.simkl.rating.toFixed(1)}`)
          : "";
        const imdb = item.ids?.imdb ? chalk.dim(`imdb:${item.ids.imdb}`) : "";

        console.log(`  ${chalk.green(item.title)} ${year} ${type}`);
        if (rating || imdb) {
          console.log(`    ${rating} ${imdb}`);
        }
        console.log();
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });
