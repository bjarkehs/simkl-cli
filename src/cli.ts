#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import { authCommand } from "./commands/auth.js";
import { configCommand } from "./commands/config.js";
import { searchCommand } from "./commands/search.js";
import { syncCommand } from "./commands/sync.js";
import { watchCommand } from "./commands/watch.js";
import { watchlistCommand } from "./commands/watchlist.js";

const program = new Command();

program
  .name("simkl")
  .description("CLI for Simkl.com - TV, Anime & Movie tracking")
  .version("0.1.0");

program.addCommand(configCommand);
program.addCommand(authCommand);
program.addCommand(searchCommand);
program.addCommand(watchlistCommand);
program.addCommand(syncCommand);
program.addCommand(watchCommand);

// Alias mark-watched for backward compatibility
const markWatchedAlias = new Command("mark-watched")
  .description("Alias for 'watch' command (deprecated, use 'simkl watch' instead)")
  .action(() => {
    console.error(chalk.red("Error: 'mark-watched' is deprecated. Use 'simkl watch' instead."));
    console.error(chalk.dim("Example: 'simkl watch \"The Office\" 1x05'"));
    process.exit(1);
  });
program.addCommand(markWatchedAlias);

program.parse();
