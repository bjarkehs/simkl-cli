import chalk from "chalk";
import type { Command } from "commander";
import { api, apiPublic } from "../api.js";
import type { operations } from "../generated/api-types.js";
import { dim, heading, info, json } from "../utils.js";

// ── Response types from generated OpenAPI spec ──

type UserSettingsResponse = NonNullable<
  operations["Receive settings"]["responses"]["200"]["content"]["application/json"]
>;

type UserStatsResponse = NonNullable<
  operations["Get watched statistics"]["responses"]["201"]["content"]["application/json"]
>;

type ActivitiesResponse = NonNullable<
  operations["Get last activity"]["responses"]["200"]["content"]["application/json"]
>;

export function registerUserCommands(program: Command): void {
  // ── User profile/settings ──
  program
    .command("user")
    .description("View your Simkl profile and settings")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const data = await api<UserSettingsResponse>("/users/settings", {
        method: "POST",
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }

      heading("User Profile:");
      if (data.user) {
        info("Name", data.user.name);
        info("Bio", data.user.bio);
        info("Location", data.user.loc);
        info("Gender", data.user.gender);
        info("Age", data.user.age);
        info("Joined", data.user.joined_at);
      }
      if (data.account) {
        info("Account ID", data.account.id);
        info("Timezone", data.account.timezone);
        info("Type", data.account.type);
      }
    });

  // ── User stats ──
  program
    .command("stats")
    .description("View watching statistics")
    .argument("[user-id]", "User ID (defaults to authenticated user)")
    .option("--json", "Output raw JSON")
    .action(async (userId, opts) => {
      let data: UserStatsResponse;

      if (userId) {
        data = await apiPublic<UserStatsResponse>(`/users/${userId}/stats`);
      } else {
        // Get own user ID first
        const settings = await api<UserSettingsResponse>("/users/settings", {
          method: "POST",
          authenticated: true,
        });

        const accountId = settings.account?.id;
        data = await apiPublic<UserStatsResponse>(`/users/${accountId}/stats`);
      }

      if (opts.json) {
        json(data);
        return;
      }

      const d = data as Record<string, unknown>;
      heading("Watching Statistics:");

      const totalMins = d.total_mins as number | undefined;
      if (totalMins !== undefined) {
        const hours = Math.floor(totalMins / 60);
        const days = Math.floor(hours / 24);
        console.log(
          `  ${chalk.bold("Total time:")} ${days} days, ${hours % 24} hours (${totalMins.toLocaleString()} min)`
        );
      }

      const categories = ["movies", "tv", "anime"] as const;
      for (const cat of categories) {
        const catData = d[cat] as Record<string, unknown> | undefined;
        if (!catData) continue;

        console.log();
        heading(`  ${cat.charAt(0).toUpperCase() + cat.slice(1)}:`);

        const catMins = catData.total_mins as number | undefined;
        if (catMins !== undefined) {
          const h = Math.floor(catMins / 60);
          info("  Time", `${h} hours (${catMins.toLocaleString()} min)`);
        }

        const statuses = [
          "watching",
          "completed",
          "plantowatch",
          "hold",
          "dropped",
          "notinteresting",
        ] as const;
        for (const status of statuses) {
          const statusData = catData[status] as Record<string, unknown> | undefined;
          if (!statusData) continue;
          const count = statusData.count as number | undefined;
          if (count !== undefined && count > 0) {
            const eps = statusData.total_episodes as number | undefined;
            const epsStr = eps ? ` (${eps} episodes)` : "";
            info(`  ${status}`, `${count} items${epsStr}`);
          }
        }
      }

      const lastWeek = d.watched_last_week as Record<string, unknown> | undefined;
      if (lastWeek) {
        console.log();
        heading("  Last Week:");
        for (const [key, value] of Object.entries(lastWeek)) {
          if (typeof value === "number" && value > 0) {
            info(`  ${key}`, value);
          }
        }
      }
    });

  // ── Activities (last sync timestamps) ──
  program
    .command("activities")
    .description("Get last activity timestamps (for sync)")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const data = await api<ActivitiesResponse>("/sync/activities", {
        method: "POST",
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }

      const d = data as Record<string, unknown>;
      heading("Last Activity:");

      const activityCategories = ["all", "tv_shows", "anime", "movies", "settings"] as const;
      for (const cat of activityCategories) {
        const catData = d[cat] as Record<string, string> | undefined;
        if (!catData) continue;

        console.log(`  ${chalk.bold(cat)}:`);
        for (const [key, value] of Object.entries(catData)) {
          if (value) {
            console.log(`    ${dim(`${key}:`)} ${value}`);
          }
        }
      }
    });

  // ── Sync watched status check ──
  program
    .command("check-watched")
    .description("Check if specific items are in a user's watched list")
    .option("--simkl <ids>", "Comma-separated Simkl IDs")
    .option("--imdb <ids>", "Comma-separated IMDB IDs")
    .option("--tmdb <ids>", "Comma-separated TMDB IDs")
    .option("--extended <fields>", "Fields: counters, episodes, specials")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const items: Array<Record<string, unknown>> = [];

      if (opts.simkl) {
        for (const id of opts.simkl.split(",")) {
          items.push({ simkl: parseInt(id.trim(), 10) });
        }
      }
      if (opts.imdb) {
        for (const id of opts.imdb.split(",")) {
          items.push({ imdb: id.trim() });
        }
      }
      if (opts.tmdb) {
        for (const id of opts.tmdb.split(",")) {
          items.push({ tmdb: parseInt(id.trim(), 10) });
        }
      }

      if (items.length === 0) {
        console.error(chalk.red("Provide at least one ID: --simkl, --imdb, or --tmdb"));
        process.exit(1);
      }

      const params: Record<string, string | number | undefined> = {
        extended: opts.extended,
      };

      const data = await api("/sync/watched", {
        method: "POST",
        body: items,
        params,
        authenticated: true,
      });

      if (opts.json) {
        json(data);
        return;
      }

      heading("Watched Status:");
      const results = data as Array<Record<string, unknown>>;
      for (const item of results) {
        const result = item.result as string;
        const list = item.list as string | undefined;
        const title = item.title as string | undefined;
        const icon =
          result === "true"
            ? chalk.green("✓")
            : result === "false"
              ? chalk.red("✗")
              : chalk.yellow("?");

        console.log(
          `  ${icon} ${title || "Unknown"} ${list ? dim(`[${list}]`) : ""} ${dim(`(${result})`)}`
        );
      }
    });
}
