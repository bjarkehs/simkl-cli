import { Command } from "commander";
import chalk from "chalk";
import { createServer } from "http";
import open from "open";
import {
  getClientId,
  getClientSecret,
  setAccessToken,
  clearAuth,
  getAccessToken,
} from "../config.js";

const REDIRECT_PORT = 8484;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

export const authCommand = new Command("auth")
  .description("Authenticate with Simkl")
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
    const clientSecret = getClientSecret();

    if (!clientId || !clientSecret) {
      console.error(
        chalk.red(
          "Error: Client ID and secret required. Run `simkl config` first."
        )
      );
      console.log(
        chalk.dim("  Get your API key at: https://simkl.com/settings/developer/")
      );
      process.exit(1);
    }

    console.log(chalk.blue("Starting OAuth flow..."));

    // Start local server to receive callback
    const server = createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${REDIRECT_PORT}`);

      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");

        if (code) {
          try {
            // Exchange code for token
            const tokenResponse = await fetch(
              "https://api.simkl.com/oauth/token",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  code,
                  client_id: clientId,
                  client_secret: clientSecret,
                  redirect_uri: REDIRECT_URI,
                  grant_type: "authorization_code",
                }),
              }
            );

            const data = (await tokenResponse.json()) as {
              access_token?: string;
              error?: string;
            };

            if (data.access_token) {
              setAccessToken(data.access_token);
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(
                "<html><body><h1>Success!</h1><p>You can close this window.</p></body></html>"
              );
              console.log(chalk.green("\n✓ Authentication successful!"));
            } else {
              throw new Error(data.error || "Failed to get access token");
            }
          } catch (error) {
            res.writeHead(500, { "Content-Type": "text/html" });
            res.end(
              `<html><body><h1>Error</h1><p>${error}</p></body></html>`
            );
            console.error(chalk.red(`\nAuthentication failed: ${error}`));
          }
        } else {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<html><body><h1>Error</h1><p>No code received</p></body></html>");
        }

        // Shutdown server after handling
        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 1000);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      const authUrl = `https://simkl.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
      console.log(chalk.dim("Opening browser for authentication..."));
      console.log(chalk.dim(`URL: ${authUrl}\n`));
      open(authUrl);
    });

    server.on("error", (err) => {
      console.error(chalk.red(`Server error: ${err.message}`));
      process.exit(1);
    });
  });
