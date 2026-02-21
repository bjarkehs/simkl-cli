import chalk from "chalk";
import type { Command } from "commander";
import {
  clearAuth,
  getAccessToken,
  getClientId,
  getConfigPath,
  isAuthenticated,
  setAccessToken,
  setClientId,
} from "../config.js";

/** PIN code response from /oauth/pin */
interface PinResponse {
  result: string;
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

/** PIN check response from /oauth/pin/{USER_CODE} */
interface PinCheckResponse {
  result: string;
  access_token?: string;
}

export function registerConfigCommand(program: Command): void {
  program
    .command("config")
    .description("Configure the CLI")
    .option("--client-id <id>", "Set your Simkl API client ID")
    .option("--show", "Show current configuration")
    .option("--path", "Show config file path")
    .action((opts) => {
      if (opts.clientId) {
        setClientId(opts.clientId);
        console.log(chalk.green("Client ID saved."));
      }

      if (opts.path) {
        console.log(getConfigPath());
      }

      if (opts.show || (!opts.clientId && !opts.path)) {
        console.log(chalk.bold("Current configuration:"));
        console.log(`  Client ID: ${getClientId() || chalk.dim("not set")}`);
        console.log(
          `  Auth token: ${getAccessToken() ? chalk.green("configured") : chalk.dim("not set")}`
        );
        console.log(`  Config path: ${chalk.dim(getConfigPath())}`);
      }
    });
}

export function registerAuthCommand(program: Command): void {
  program
    .command("auth")
    .description("Authenticate with Simkl using PIN")
    .option("--logout", "Clear saved authentication")
    .option("--status", "Check authentication status")
    .action(async (opts) => {
      if (opts.logout) {
        clearAuth();
        console.log(chalk.green("Logged out successfully."));
        return;
      }

      if (opts.status) {
        if (isAuthenticated()) {
          console.log(chalk.green("Authenticated."));
        } else {
          console.log(chalk.yellow("Not authenticated. Run: simkl auth"));
        }
        return;
      }

      const clientId = getClientId();
      if (!clientId) {
        console.error(
          chalk.red("Client ID not configured. Run: simkl config --client-id <your-id>")
        );
        process.exit(1);
      }

      try {
        // Step 1: Get PIN code
        const pinUrl = `https://api.simkl.com/oauth/pin?client_id=${encodeURIComponent(clientId)}`;
        const pinRes = await fetch(pinUrl);
        if (!pinRes.ok) {
          console.error(chalk.red(`Failed to get PIN: ${pinRes.statusText}`));
          process.exit(1);
        }

        const pinData = (await pinRes.json()) as PinResponse;

        console.log();
        console.log(chalk.bold("To authenticate, visit:"));
        console.log(chalk.cyan(`  ${pinData.verification_url}`));
        console.log();
        console.log(chalk.bold("Enter this code:"));
        console.log(chalk.yellow.bold(`  ${pinData.user_code}`));
        console.log();
        console.log(chalk.dim("Waiting for authorization..."));

        // Step 2: Poll for authorization
        const interval = (pinData.interval || 5) * 1000;
        const expiresAt = Date.now() + pinData.expires_in * 1000;

        while (Date.now() < expiresAt) {
          await new Promise((resolve) => setTimeout(resolve, interval));

          const checkUrl = `https://api.simkl.com/oauth/pin/${pinData.user_code}?client_id=${encodeURIComponent(clientId)}`;
          const checkRes = await fetch(checkUrl);

          if (checkRes.ok) {
            const checkData = (await checkRes.json()) as PinCheckResponse;

            if (checkData.result === "OK" && checkData.access_token) {
              setAccessToken(checkData.access_token);
              console.log(chalk.green("\nAuthenticated successfully!"));
              return;
            }
          }
        }

        console.error(chalk.red("\nAuthorization timed out. Please try again."));
        process.exit(1);
      } catch (err) {
        console.error(
          chalk.red(`Authentication failed: ${err instanceof Error ? err.message : err}`)
        );
        process.exit(1);
      }
    });
}
