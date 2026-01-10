#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { configCommand } from "./commands/config.js";
import { authCommand } from "./commands/auth.js";
import { searchCommand } from "./commands/search.js";
import { watchlistCommand } from "./commands/watchlist.js";
import { syncCommand } from "./commands/sync.js";

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

program.parse();
