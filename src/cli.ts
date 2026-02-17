#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import { registerAuthCommand, registerConfigCommand } from "./commands/auth.js";
import {
  registerCheckinCommand,
  registerListCommand,
  registerRatingCommands,
  registerUnwatchCommand,
  registerWatchCommand,
  registerWatchlistCommand,
} from "./commands/library.js";
import {
  registerAnimeCommands,
  registerMovieCommands,
  registerTvCommands,
} from "./commands/media.js";
import { registerPlaybackCommand, registerScrobbleCommands } from "./commands/scrobble.js";
import { registerSearchCommands } from "./commands/search.js";
import { registerUserCommands } from "./commands/user.js";

const program = new Command();

program
  .name("simkl")
  .description("CLI for Simkl.com - TV, Anime & Movie tracking")
  .version("0.2.0");

// ── Configuration & Auth ──
registerConfigCommand(program);
registerAuthCommand(program);

// ── Search ──
registerSearchCommands(program);

// ── Media Info & Discovery ──
registerTvCommands(program);
registerAnimeCommands(program);
registerMovieCommands(program);

// ── Library Management ──
registerWatchlistCommand(program);
registerWatchCommand(program);
registerUnwatchCommand(program);
registerListCommand(program);
registerCheckinCommand(program);

// ── Ratings ──
registerRatingCommands(program);

// ── Scrobble & Playback ──
registerScrobbleCommands(program);
registerPlaybackCommand(program);

// ── User ──
registerUserCommands(program);

// ── Error handling ──
program.hook("postAction", () => {});

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof Error) {
      console.error(chalk.red(`Error: ${err.message}`));
      if (process.env.DEBUG) {
        console.error(err.stack);
      }
    } else {
      console.error(chalk.red("An unexpected error occurred."));
    }
    process.exit(1);
  }
}

main();
