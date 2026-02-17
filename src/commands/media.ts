import type { Command } from "commander";
import { apiPublic } from "../api.js";
import { dim, heading, info, json, printMediaList, ratingStr } from "../utils.js";

// ── Shared detail display ──

function printDetail(data: Record<string, unknown>): void {
  heading(data.title as string);
  info("Year", data.year as number);
  info("Type", data.type as string);
  if (data.anime_type) info("Anime Type", data.anime_type as string);
  info("Status", data.status as string);
  info("Network", data.network as string);
  info("Country", data.country as string);
  info("Runtime", data.runtime as number);
  info("Certification", data.certification as string);
  info("Total Episodes", data.total_episodes as number);
  info("Rank", data.rank as number);
  info("Director", data.director as string);

  const ids = data.ids as Record<string, unknown> | undefined;
  if (ids) {
    const idParts: string[] = [];
    if (ids.simkl) idParts.push(`simkl:${ids.simkl}`);
    if (ids.imdb) idParts.push(`imdb:${ids.imdb}`);
    if (ids.tmdb) idParts.push(`tmdb:${ids.tmdb}`);
    if (ids.tvdb) idParts.push(`tvdb:${ids.tvdb}`);
    if (ids.mal) idParts.push(`mal:${ids.mal}`);
    if (ids.anidb) idParts.push(`anidb:${ids.anidb}`);
    if (ids.anilist) idParts.push(`anilist:${ids.anilist}`);
    if (idParts.length > 0) info("IDs", idParts.join(", "));
  }

  const ratings = data.ratings as Record<string, Record<string, number>> | undefined;
  if (ratings) {
    const parts: string[] = [];
    if (ratings.simkl) parts.push(`Simkl: ${ratingStr(ratings.simkl.rating, ratings.simkl.votes)}`);
    if (ratings.imdb) parts.push(`IMDB: ${ratingStr(ratings.imdb.rating, ratings.imdb.votes)}`);
    if (ratings.mal) parts.push(`MAL: ${ratingStr(ratings.mal.rating, ratings.mal.votes)}`);
    if (parts.length > 0) console.log(`  ${parts.join("  ")}`);
  }

  const genres = data.genres as string[] | undefined;
  if (genres?.length) info("Genres", genres.join(", "));

  const overview = data.overview as string | undefined;
  if (overview) {
    console.log();
    console.log(`  ${dim(overview.replace(/<br\s*\/?>/gi, "\n  ").replace(/<[^>]+>/g, ""))}`);
  }
}

function printEpisodeList(episodes: Array<Record<string, unknown>>): void {
  for (const ep of episodes) {
    const season = ep.season !== undefined ? `S${String(ep.season).padStart(2, "0")}` : "";
    const epNum = ep.episode !== undefined ? `E${String(ep.episode).padStart(2, "0")}` : "";
    const ref = season || epNum ? `${season}${epNum}` : "";
    const aired = ep.aired ? "" : dim(" [not aired]");
    const type = ep.type === "special" ? dim(" [special]") : "";
    const date = ep.date ? dim(` (${String(ep.date).split("T")[0]})`) : "";

    console.log(`  ${ref ? `${ref} ` : ""}${ep.title || "TBA"}${date}${aired}${type}`);
  }
}

// ── Register TV commands ──

export function registerTvCommands(program: Command): void {
  const tv = program.command("tv").description("TV show information and discovery");

  tv.command("info")
    .description("Get detailed info about a TV show")
    .argument("<id>", "Simkl ID or IMDB ID")
    .option("-e, --extended", "Include full details")
    .option("--json", "Output raw JSON")
    .action(async (id, opts) => {
      const params: Record<string, string | number | undefined> = {};
      if (opts.extended) params.extended = "full";

      const data = await apiPublic(`/tv/${id}`, params);

      if (opts.json) {
        json(data);
        return;
      }
      printDetail(data as Record<string, unknown>);
    });

  tv.command("episodes")
    .description("List episodes of a TV show")
    .argument("<id>", "Simkl ID")
    .option("-e, --extended", "Include full details")
    .option("--json", "Output raw JSON")
    .action(async (id, opts) => {
      const params: Record<string, string | number | undefined> = {};
      if (opts.extended) params.extended = "full";

      const data = await apiPublic(`/tv/episodes/${id}`, params);

      if (opts.json) {
        json(data);
        return;
      }

      heading("Episodes:");
      printEpisodeList(data as Array<Record<string, unknown>>);
    });

  tv.command("trending")
    .description("Get trending TV shows")
    .option("-i, --interval <period>", "Time period: today, week, month", "today")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const data = await apiPublic(`/tv/trending/${opts.interval}`);
      if (opts.json) {
        json(data);
        return;
      }
      heading(`Trending TV Shows (${opts.interval}):`);
      printMediaList(data as Array<Record<string, unknown>>);
    });

  tv.command("best")
    .description("Get best TV shows")
    .argument("<filter>", "Filter: year, month, all, voted, watched")
    .option("-t, --type <type>", "Type: series, documentary, entertainment, animation")
    .option("--json", "Output raw JSON")
    .action(async (filter, opts) => {
      const params: Record<string, string | number | undefined> = { type: opts.type };
      const data = await apiPublic(`/tv/best/${filter}`, params);
      if (opts.json) {
        json(data);
        return;
      }
      heading(`Best TV Shows (${filter}):`);
      printMediaList(data as Array<Record<string, unknown>>);
    });

  tv.command("premieres")
    .description("Get latest TV premieres")
    .argument("<param>", "Filter: new, soon")
    .option("-t, --type <type>", "Type: all, entertainment, documentaries, animation-filter")
    .option("--json", "Output raw JSON")
    .action(async (param, opts) => {
      const params: Record<string, string | number | undefined> = { type: opts.type };
      const data = await apiPublic(`/tv/premieres/${param}`, params);
      if (opts.json) {
        json(data);
        return;
      }
      heading(`TV Premieres (${param}):`);
      printMediaList(data as Array<Record<string, unknown>>);
    });

  tv.command("airing")
    .description("Get currently airing TV shows")
    .option("-d, --date <date>", "Date: today, tomorrow, or DD-MM-YYYY", "today")
    .option("-s, --sort <sort>", "Sort: time, rank, popularity")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const params: Record<string, string | number | undefined> = { sort: opts.sort };
      const data = await apiPublic(`/tv/airing`, { ...params, date: opts.date });
      if (opts.json) {
        json(data);
        return;
      }
      heading(`Airing TV Shows (${opts.date}):`);
      const items = data as Array<Record<string, unknown>>;
      for (const item of items) {
        const ep = item.episode as Record<string, unknown> | undefined;
        const epStr = ep
          ? dim(` S${String(ep.season).padStart(2, "0")}E${String(ep.episode).padStart(2, "0")}`)
          : "";
        console.log(`  ${item.title} ${dim(`(${item.year})`)}${epStr}`);
      }
    });

  tv.command("genres")
    .description("Browse TV shows by genre")
    .option("-g, --genre <genre>", "Genre filter", "all")
    .option("-t, --type <type>", "Type: tv-shows, documentaries", "tv-shows")
    .option("-c, --country <country>", "Country code", "all-countries")
    .option("-n, --network <network>", "Network filter", "all-networks")
    .option("-y, --year <year>", "Year filter", "all-years")
    .option("-s, --sort <sort>", "Sort order", "rank")
    .option("-p, --page <n>", "Page number")
    .option("-l, --limit <n>", "Results per page")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const path = `/tv/genres/${opts.genre}/${opts.type}/${opts.country}/${opts.network}/${opts.year}/${opts.sort}`;
      const params: Record<string, string | number | undefined> = {
        page: opts.page,
        limit: opts.limit,
      };
      const data = await apiPublic(path, params);
      if (opts.json) {
        json(data);
        return;
      }
      heading("TV Shows by Genre:");
      printMediaList(data as Array<Record<string, unknown>>);
    });
}

// ── Register Anime commands ──

export function registerAnimeCommands(program: Command): void {
  const anime = program.command("anime").description("Anime information and discovery");

  anime
    .command("info")
    .description("Get detailed info about an anime")
    .argument("<id>", "Simkl ID or IMDB ID")
    .option("-e, --extended", "Include full details")
    .option("--json", "Output raw JSON")
    .action(async (id, opts) => {
      const params: Record<string, string | number | undefined> = {};
      if (opts.extended) params.extended = "full";

      const data = await apiPublic(`/anime/${id}`, params);
      if (opts.json) {
        json(data);
        return;
      }
      printDetail(data as Record<string, unknown>);
    });

  anime
    .command("episodes")
    .description("List episodes of an anime")
    .argument("<id>", "Simkl ID")
    .option("-e, --extended", "Include full details")
    .option("--json", "Output raw JSON")
    .action(async (id, opts) => {
      const params: Record<string, string | number | undefined> = {};
      if (opts.extended) params.extended = "full";

      const data = await apiPublic(`/anime/episodes/${id}`, params);
      if (opts.json) {
        json(data);
        return;
      }
      heading("Episodes:");
      printEpisodeList(data as Array<Record<string, unknown>>);
    });

  anime
    .command("trending")
    .description("Get trending anime")
    .option("-i, --interval <period>", "Time period: today, week, month", "today")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const data = await apiPublic(`/anime/trending/${opts.interval}`);
      if (opts.json) {
        json(data);
        return;
      }
      heading(`Trending Anime (${opts.interval}):`);
      printMediaList(data as Array<Record<string, unknown>>);
    });

  anime
    .command("best")
    .description("Get best anime")
    .argument("<filter>", "Filter: year, month, all, voted, watched")
    .option("-t, --type <type>", "Type: all, tv, movies, ovas, music, onas")
    .option("--json", "Output raw JSON")
    .action(async (filter, opts) => {
      const params: Record<string, string | number | undefined> = { type: opts.type };
      const data = await apiPublic(`/anime/best/${filter}`, params);
      if (opts.json) {
        json(data);
        return;
      }
      heading(`Best Anime (${filter}):`);
      printMediaList(data as Array<Record<string, unknown>>);
    });

  anime
    .command("premieres")
    .description("Get latest anime premieres")
    .argument("<param>", "Filter: new, soon")
    .option("-t, --type <type>", "Type: all, series, movies, ovas")
    .option("--json", "Output raw JSON")
    .action(async (param, opts) => {
      const params: Record<string, string | number | undefined> = { type: opts.type };
      const data = await apiPublic(`/anime/premieres/${param}`, params);
      if (opts.json) {
        json(data);
        return;
      }
      heading(`Anime Premieres (${param}):`);
      printMediaList(data as Array<Record<string, unknown>>);
    });

  anime
    .command("airing")
    .description("Get currently airing anime")
    .option("-d, --date <date>", "Date: today, tomorrow, or DD-MM-YYYY", "today")
    .option("-s, --sort <sort>", "Sort: time, rank, popularity")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const params: Record<string, string | number | undefined> = { sort: opts.sort };
      const data = await apiPublic(`/anime/airing`, { ...params, date: opts.date });
      if (opts.json) {
        json(data);
        return;
      }
      heading(`Airing Anime (${opts.date}):`);
      const items = data as Array<Record<string, unknown>>;
      for (const item of items) {
        const ep = item.episode as Record<string, unknown> | undefined;
        const epStr = ep ? dim(` Ep ${ep.episode}`) : "";
        const type = item.anime_type ? dim(` [${item.anime_type}]`) : "";
        console.log(`  ${item.title} ${dim(`(${item.year})`)}${epStr}${type}`);
      }
    });

  anime
    .command("genres")
    .description("Browse anime by genre")
    .option("-g, --genre <genre>", "Genre filter", "all")
    .option("-t, --type <type>", "Type: all-types, series", "all-types")
    .option("-n, --network <network>", "Network/studio filter", "all-networks")
    .option("-y, --year <year>", "Year filter", "all-years")
    .option("-s, --sort <sort>", "Sort order", "rank")
    .option("-p, --page <n>", "Page number")
    .option("-l, --limit <n>", "Results per page")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const path = `/anime/genres/${opts.genre}/${opts.type}/${opts.network}/${opts.year}/${opts.sort}`;
      const params: Record<string, string | number | undefined> = {
        page: opts.page,
        limit: opts.limit,
      };
      const data = await apiPublic(path, params);
      if (opts.json) {
        json(data);
        return;
      }
      heading("Anime by Genre:");
      printMediaList(data as Array<Record<string, unknown>>);
    });
}

// ── Register Movie commands ──

export function registerMovieCommands(program: Command): void {
  const movie = program.command("movie").description("Movie information and discovery");

  movie
    .command("info")
    .description("Get detailed info about a movie")
    .argument("<id>", "Simkl ID or IMDB ID")
    .option("-e, --extended", "Include full details")
    .option("--json", "Output raw JSON")
    .action(async (id, opts) => {
      const params: Record<string, string | number | undefined> = {};
      if (opts.extended) params.extended = "full";

      const data = await apiPublic(`/movies/${id}`, params);
      if (opts.json) {
        json(data);
        return;
      }
      printDetail(data as Record<string, unknown>);
    });

  movie
    .command("trending")
    .description("Get trending movies")
    .option("-i, --interval <period>", "Time period: today, week, month", "today")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const data = await apiPublic(`/movies/trending/${opts.interval}`);
      if (opts.json) {
        json(data);
        return;
      }
      heading(`Trending Movies (${opts.interval}):`);
      printMediaList(data as Array<Record<string, unknown>>);
    });

  movie
    .command("genres")
    .description("Browse movies by genre")
    .option("-g, --genre <genre>", "Genre filter", "all")
    .option("-c, --country <country>", "Country code", "all-countries")
    .option("-y, --year <year>", "Year filter", "all-years")
    .option("-s, --sort <sort>", "Sort order", "rank")
    .option("-p, --page <n>", "Page number")
    .option("-l, --limit <n>", "Results per page")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const path = `/movies/genres/${opts.genre}/${opts.country}/${opts.year}/${opts.sort}`;
      const params: Record<string, string | number | undefined> = {
        page: opts.page,
        limit: opts.limit,
      };
      const data = await apiPublic(path, params);
      if (opts.json) {
        json(data);
        return;
      }
      heading("Movies by Genre:");
      printMediaList(data as Array<Record<string, unknown>>);
    });
}
