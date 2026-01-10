import { Command } from "commander";
import chalk from "chalk";
import { getAccessToken, getClientId, isAuthenticated } from "../config.js";

export const syncCommand = new Command("sync")
  .description("Add or update items in your watchlist")
  .addCommand(
    new Command("add")
      .description("Add an item to your watchlist")
      .argument("<title>", "Title to search and add")
      .option("-t, --type <type>", "Type: movie, tv, anime")
      .option(
        "-s, --status <status>",
        "Status: watching, plantowatch, completed, hold, dropped",
        "plantowatch"
      )
      .option("--imdb <id>", "IMDB ID (e.g., tt1234567)")
      .option("--tmdb <id>", "TMDB ID")
      .action(async (title, options) => {
        if (!isAuthenticated()) {
          console.error(
            chalk.red("Error: Not authenticated. Run `simkl auth` first.")
          );
          process.exit(1);
        }

        const token = getAccessToken();
        const clientId = getClientId();

        try {
          let itemToAdd: Record<string, unknown>;

          if (options.imdb || options.tmdb) {
            // Use provided ID
            itemToAdd = {
              ids: {
                ...(options.imdb && { imdb: options.imdb }),
                ...(options.tmdb && { tmdb: options.tmdb }),
              },
              to: options.status,
            };
          } else {
            // Search first
            console.log(chalk.dim(`Searching for "${title}"...`));

            const searchType = options.type || "all";
            const searchResponse = await fetch(
              `https://api.simkl.com/search/${searchType}?q=${encodeURIComponent(title)}&limit=1`,
              {
                headers: {
                  "simkl-api-key": clientId!,
                },
              }
            );

            const results = (await searchResponse.json()) as Array<{
              title: string;
              year?: number;
              type: string;
              ids: { simkl?: number; imdb?: string };
            }>;

            if (!results || results.length === 0) {
              console.error(chalk.red(`No results found for "${title}"`));
              process.exit(1);
            }

            const match = results[0];
            console.log(
              chalk.dim(
                `Found: ${match.title} (${match.year}) [${match.type}]`
              )
            );

            itemToAdd = {
              ids: match.ids,
              to: options.status,
            };
          }

          // Determine the correct endpoint based on type
          const type = options.type || "movies";
          const endpoint =
            type === "movie" || type === "movies"
              ? "movies"
              : type === "tv" || type === "show" || type === "shows"
                ? "shows"
                : "anime";

          const syncBody = {
            [endpoint]: [itemToAdd],
          };

          const response = await fetch(
            "https://api.simkl.com/sync/add-to-list",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "simkl-api-key": clientId!,
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(syncBody),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Sync failed: ${response.status} - ${errorText}`);
          }

          const result = await response.json();
          console.log(
            chalk.green(`✓ Added to ${options.status}`)
          );
        } catch (error) {
          console.error(chalk.red(`Error: ${error}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("history")
      .description("Add item to watch history")
      .argument("<title>", "Title to mark as watched")
      .option("-t, --type <type>", "Type: movie, tv, anime")
      .option("--imdb <id>", "IMDB ID")
      .option("--at <datetime>", "When watched (ISO 8601)")
      .action(async (title, options) => {
        if (!isAuthenticated()) {
          console.error(
            chalk.red("Error: Not authenticated. Run `simkl auth` first.")
          );
          process.exit(1);
        }

        const token = getAccessToken();
        const clientId = getClientId();

        try {
          // Search first
          console.log(chalk.dim(`Searching for "${title}"...`));

          const searchType = options.type || "all";
          const searchResponse = await fetch(
            `https://api.simkl.com/search/${searchType}?q=${encodeURIComponent(title)}&limit=1`,
            {
              headers: {
                "simkl-api-key": clientId!,
              },
            }
          );

          const results = (await searchResponse.json()) as Array<{
            title: string;
            year?: number;
            type: string;
            ids: { simkl?: number; imdb?: string };
          }>;

          if (!results || results.length === 0) {
            console.error(chalk.red(`No results found for "${title}"`));
            process.exit(1);
          }

          const match = results[0];
          console.log(
            chalk.dim(`Found: ${match.title} (${match.year}) [${match.type}]`)
          );

          const type = match.type || options.type || "movie";
          const endpoint =
            type === "movie" ? "movies" : type === "tv" ? "shows" : "anime";

          const historyItem: Record<string, unknown> = {
            ids: match.ids,
          };

          if (options.at) {
            historyItem.watched_at = options.at;
          }

          const syncBody = {
            [endpoint]: [historyItem],
          };

          const response = await fetch(
            "https://api.simkl.com/sync/history",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "simkl-api-key": clientId!,
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(syncBody),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Sync failed: ${response.status} - ${errorText}`);
          }

          console.log(chalk.green(`✓ Added "${match.title}" to watch history`));
        } catch (error) {
          console.error(chalk.red(`Error: ${error}`));
          process.exit(1);
        }
      })
  );
