import { Command } from "commander";
import chalk from "chalk";
import {
  config,
  getClientId,
  getClientSecret,
  setClientId,
  setClientSecret,
  isAuthenticated,
} from "../config.js";

export const configCommand = new Command("config")
  .description("Configure API credentials")
  .option("--client-id <id>", "Set your Simkl API client ID")
  .option("--client-secret <secret>", "Set your Simkl API client secret")
  .option("--show", "Show current configuration")
  .option("--path", "Show config file path")
  .action((options) => {
    if (options.clientId) {
      setClientId(options.clientId);
      console.log(chalk.green("✓ Client ID saved"));
    }

    if (options.clientSecret) {
      setClientSecret(options.clientSecret);
      console.log(chalk.green("✓ Client secret saved"));
    }

    if (options.path) {
      console.log(chalk.dim("Config path:"), config.path);
      return;
    }

    if (options.show || (!options.clientId && !options.clientSecret)) {
      console.log(chalk.bold("\nSimkl CLI Configuration\n"));
      console.log(
        `  Client ID:     ${getClientId() ? chalk.green("configured") : chalk.yellow("not set")}`
      );
      console.log(
        `  Client Secret: ${getClientSecret() ? chalk.green("configured") : chalk.yellow("not set")}`
      );
      console.log(
        `  Authenticated: ${isAuthenticated() ? chalk.green("yes") : chalk.yellow("no")}`
      );
      console.log(chalk.dim(`\n  Config file: ${config.path}`));

      if (!getClientId()) {
        console.log(
          chalk.dim(
            "\n  Get your API key at: https://simkl.com/settings/developer/"
          )
        );
      }
    }
  });
