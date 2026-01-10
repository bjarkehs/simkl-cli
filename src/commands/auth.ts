import chalk from "chalk";
import { Command } from "commander";
import { clearAuth, getAccessToken, getClientId, setAccessToken } from "../config.js";

interface PinResponse {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

interface PinStatusResponse {
  result: "OK" | "KO";
  message?: string;
  access_token?: string;
}

export const authCommand = new Command("auth")
  .description("Authenticate with Simkl using PIN code")
  .option("--logout", "Clear stored authentication")
  .option("--status", "Check authentication status")
  .action(async (options) => {
    if (options.logout) {
      clearAuth();
      console.log(chalk.green("✓ Logged out successfully"));
      return;
    }

    if (options.status) {
      const token = getAccessToken();
      if (token) {
        console.log(chalk.green("✓ Authenticated"));
        console.log(chalk.dim(`  Token: ${token.slice(0, 8)}...`));
      } else {
        console.log(chalk.yellow("Not authenticated"));
        console.log(chalk.dim("  Run `simkl auth` to log in"));
      }
      return;
    }

    const clientId = getClientId();

    if (!clientId) {
      console.error(
        chalk.red("Error: Client ID required. Run `simkl config --client-id <id>` first.")
      );
      console.log(chalk.dim("  Get your API key at: https://simkl.com/settings/developer/"));
      process.exit(1);
    }

    console.log(chalk.blue("Starting PIN authentication...\n"));

    try {
      // Step 1: Request device code
      const pinResponse = await fetch(`https://api.simkl.com/oauth/pin?client_id=${clientId}`);

      if (!pinResponse.ok) {
        throw new Error(`Failed to get PIN: ${pinResponse.statusText}`);
      }

      const pinData = (await pinResponse.json()) as PinResponse;

      // Step 2: Display instructions
      console.log(chalk.bold("  1. Open: ") + chalk.cyan(pinData.verification_url));
      console.log(chalk.bold("  2. Enter code: ") + chalk.yellow.bold(pinData.user_code));
      console.log();
      console.log(chalk.dim(`  Code expires in ${Math.floor(pinData.expires_in / 60)} minutes`));
      console.log(chalk.dim("  Waiting for authorization..."));

      // Step 3: Poll for completion
      const startTime = Date.now();
      const expiresAt = startTime + pinData.expires_in * 1000;
      const pollInterval = (pinData.interval || 5) * 1000;

      while (Date.now() < expiresAt) {
        await sleep(pollInterval);

        const statusResponse = await fetch(
          `https://api.simkl.com/oauth/pin/${pinData.user_code}?client_id=${clientId}`
        );

        if (!statusResponse.ok) {
          continue;
        }

        const statusData = (await statusResponse.json()) as PinStatusResponse;

        if (statusData.result === "OK" && statusData.access_token) {
          setAccessToken(statusData.access_token);
          console.log(chalk.green("\n✓ Authentication successful!"));
          return;
        }
      }

      console.error(chalk.red("\n✗ Authentication timed out. Please try again."));
      process.exit(1);
    } catch (error) {
      console.error(chalk.red(`\nAuthentication failed: ${error}`));
      process.exit(1);
    }
  });

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
