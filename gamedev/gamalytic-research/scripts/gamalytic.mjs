#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const BASE_URL = "https://api.gamalytic.com";

const COMMON_FILTERS = {
  "price-min": "price_min",
  "price-max": "price_max",
  genres: "genres",
  tags: "tags",
  "tags-exclude": "tags_exclude",
  features: "features",
  "revenue-min": "revenue_min",
  "revenue-max": "revenue_max",
  "reviews-min": "reviews_min",
  "reviews-max": "reviews_max",
  "followers-min": "followers_min",
  "followers-max": "followers_max",
  "wishlists-min": "wishlists_min",
  "wishlists-max": "wishlists_max",
  "sold-min": "sold_min",
  "sold-max": "sold_max",
  "score-min": "score_min",
  "score-max": "score_max",
  "avg-playtime-min": "avg_playtime_min",
  "avg-playtime-max": "avg_playtime_max",
  title: "title",
  appids: "appids",
  "release-status": "release_status",
  "early-access": "early_access"
};

const DEFAULT_GAME_FIELDS = [
  "steamId",
  "name",
  "releaseDate",
  "price",
  "reviews",
  "reviewScore",
  "revenue",
  "copiesSold",
  "wishlists",
  "genres",
  "tags"
].join(",");

class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

class GamalyticClient {
  constructor(apiKey, baseUrl = BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async get(path, query = {}) {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }

    const headers = { accept: "application/json" };
    if (this.apiKey) headers["api-key"] = this.apiKey;

    const response = await fetch(url, { headers });
    const bodyText = await response.text();
    const body = parseResponseBody(bodyText);

    if (!response.ok) {
      const detail = typeof body === "string" ? body : JSON.stringify(body);
      throw new CliError(`Gamalytic API returned ${response.status} ${response.statusText}: ${detail}`);
    }

    return body;
  }
}

async function main() {
  const args = parseArgv(process.argv.slice(2));
  loadEnvFiles(args);

  if (!args.command || hasFlag(args, "help") || args.command === "help") {
    printHelp(args.command === "help" ? args.positional[0] : args.command);
    return;
  }

  const apiKey = stringOpt(args, "api-key") ?? process.env.GAMALYTIC_API_KEY;
  const client = new GamalyticClient(apiKey, stringOpt(args, "base-url") ?? BASE_URL);

  switch (args.command) {
    case "games":
      await runGames(client, args);
      break;
    case "game":
      await runGame(client, args);
      break;
    case "genres":
      await runGenres(client, args);
      break;
    case "stats":
      await runStats(client, args);
      break;
    case "raw":
      await runRaw(client, args);
      break;
    default:
      throw new CliError(`Unknown command: ${args.command}. Run --help for usage.`);
  }
}

function parseArgv(argv) {
  const parsed = { positional: [], options: {} };
  const tokens = [...argv];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith("--")) {
      if (!parsed.command) parsed.command = token;
      else parsed.positional.push(token);
      continue;
    }

    const withoutPrefix = token.slice(2);
    const eqIndex = withoutPrefix.indexOf("=");
    const key = eqIndex >= 0 ? withoutPrefix.slice(0, eqIndex) : withoutPrefix;
    const inlineValue = eqIndex >= 0 ? withoutPrefix.slice(eqIndex + 1) : undefined;
    const next = tokens[i + 1];
    const value = inlineValue ?? (next && !next.startsWith("--") ? tokens[++i] : true);

    if (key === "param") {
      const existing = parsed.options[key];
      parsed.options[key] = Array.isArray(existing) ? [...existing, String(value)] : [String(value)];
    } else {
      parsed.options[key] = value;
    }
  }

  return parsed;
}

function loadDotEnv(path) {
  const envPath = resolveEnvPath(path);
  if (!existsSync(envPath)) return;

  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    process.env[key] = unquoteEnvValue(rawValue);
  }
}

function loadEnvFiles(args) {
  loadDotEnv(stringOpt(args, "env-file") ?? ".env");
  if (!process.env.GAMALYTIC_API_KEY) loadDotEnv("~/.config/skills.env");
}

function resolveEnvPath(path) {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return resolve(process.cwd(), path);
}

function unquoteEnvValue(value) {
  const quote = value[0];
  if ((quote === `"` || quote === "'") && value[value.length - 1] === quote) {
    const inner = value.slice(1, -1);
    return quote === `"` ? inner.replaceAll("\\n", "\n").replaceAll('\\"', '"') : inner;
  }
  return value;
}

async function runGames(client, args) {
  const query = commonQuery(args);
  query.page = numberOpt(args, "page") ?? 0;
  query.limit = numberOpt(args, "limit") ?? 25;
  query.fields = stringOpt(args, "fields") ?? DEFAULT_GAME_FIELDS;
  query.sort = stringOpt(args, "sort") ?? "revenue";
  query.sort_mode = stringOpt(args, "sort-mode") ?? "desc";

  const data = await client.get("/steam-games/list", query);
  const format = formatOpt(args);
  if (isRecord(data) && Array.isArray(data.result)) {
    print(data.result, format, [
      "steamId",
      "name",
      "releaseDate",
      "price",
      "reviews",
      "reviewScore",
      "revenue",
      "copiesSold",
      "wishlists"
    ]);
    if (format === "table") process.stderr.write(`\nTotal: ${data.total ?? "unknown"} | Pages: ${data.pages ?? "unknown"}\n`);
    return;
  }
  print(data, format);
}

async function runGame(client, args) {
  const id = args.positional[0];
  if (!id) throw new CliError("Missing Steam app id. Usage: gamalytic game <steamId>");

  const query = {
    fields: stringOpt(args, "fields"),
    include_pre_release_history: boolOpt(args, "include-pre-release-history")
  };

  const data = await client.get(`/game/${encodeURIComponent(id)}`, query);
  print(data, formatOpt(args));
}

async function runGenres(client, args) {
  const query = commonQuery(args);
  query.key = stringOpt(args, "key") ?? "genres";
  query.n_tags = numberOpt(args, "n-tags");

  const data = await client.get("/steam-games/genres/stats", query);
  const rows = Array.isArray(data) ? [...data] : data;
  if (Array.isArray(rows)) {
    const sortKey = stringOpt(args, "sort");
    if (sortKey) rows.sort((a, b) => numericValue(b, sortKey) - numericValue(a, sortKey));
    print(rows, formatOpt(args), [
      "label",
      "numberOfGames",
      "totalRevenue",
      "medianRevenue",
      "top25",
      "top10",
      "top5",
      "averageRevenue",
      "averagePrice",
      "averagePlayTime"
    ]);
    return;
  }
  print(rows, formatOpt(args));
}

async function runStats(client, args) {
  const data = await client.get("/steam-games/stats", commonQuery(args));
  print(data, formatOpt(args));
}

async function runRaw(client, args) {
  const path = args.positional[0];
  if (!path || !path.startsWith("/")) throw new CliError("Missing API path. Usage: gamalytic raw /steam-games/list --param limit=5");

  const query = {};
  const params = args.options.param;
  for (const param of Array.isArray(params) ? params : params ? [String(params)] : []) {
    const [key, ...valueParts] = param.split("=");
    if (!key || valueParts.length === 0) throw new CliError(`Invalid --param value: ${param}. Expected key=value.`);
    query[key] = valueParts.join("=");
  }

  const data = await client.get(path, query);
  print(data, formatOpt(args));
}

function commonQuery(args) {
  const query = {};
  for (const [optionName, queryName] of Object.entries(COMMON_FILTERS)) {
    const value = args.options[optionName];
    if (value !== undefined) query[queryName] = value;
  }

  const since = stringOpt(args, "since");
  const until = stringOpt(args, "until");
  if (since) query.first_release_date_min = toEpochMillis(since, "since");
  if (until) query.first_release_date_max = toEpochMillis(until, "until", true);

  return query;
}

function formatOpt(args) {
  const value = stringOpt(args, "format") ?? "table";
  if (value === "table" || value === "json" || value === "csv") return value;
  throw new CliError(`Unsupported format: ${value}. Use table, json, or csv.`);
}

function print(data, format, preferredColumns) {
  if (format === "json") {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (format === "csv") {
    console.log(toCsv(Array.isArray(data) ? data : [data]));
    return;
  }

  if (Array.isArray(data)) console.log(toTable(data, preferredColumns));
  else console.log(JSON.stringify(data, null, 2));
}

function toTable(rows, preferredColumns) {
  const records = rows.filter(isRecord);
  if (records.length === 0) return "(no rows)";

  const allColumns = [...new Set(records.flatMap((row) => Object.keys(row)))];
  const columns = preferredColumns
    ? [...preferredColumns.filter((column) => allColumns.includes(column)), ...allColumns.filter((column) => !preferredColumns.includes(column)).slice(0, 4)]
    : allColumns.slice(0, 10);

  const normalized = records.map((row) => Object.fromEntries(columns.map((column) => [column, formatCell(row[column], column)])));
  const widths = Object.fromEntries(
    columns.map((column) => [
      column,
      Math.min(42, Math.max(column.length, ...normalized.map((row) => String(row[column] ?? "").length)))
    ])
  );

  const header = columns.map((column) => pad(column, widths[column])).join("  ");
  const divider = columns.map((column) => "-".repeat(widths[column])).join("  ");
  const body = normalized.map((row) => columns.map((column) => pad(String(row[column] ?? ""), widths[column])).join("  ")).join("\n");

  return `${header}\n${divider}\n${body}`;
}

function toCsv(rows) {
  const records = rows.filter(isRecord);
  if (records.length === 0) return "";
  const columns = [...new Set(records.flatMap((row) => Object.keys(row)))];
  return [
    columns.map(csvEscape).join(","),
    ...records.map((row) => columns.map((column) => csvEscape(formatCsvCell(row[column]))).join(","))
  ].join("\n");
}

function formatCell(value, column = "") {
  if (value === undefined || value === null) return "";
  if (isIdentifierColumn(column)) return String(value);
  if (typeof value === "number") {
    if (Number.isInteger(value) && Math.abs(value) > 10_000_000_000) return new Date(value).toISOString().slice(0, 10);
    if (Math.abs(value) >= 1_000) return Math.round(value).toLocaleString("en-US");
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (Array.isArray(value)) return value.map((item) => String(item)).slice(0, 3).join("; ");
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  return text.length > 42 ? `${text.slice(0, 39)}...` : text;
}

function isIdentifierColumn(column) {
  const normalized = column.toLowerCase();
  return normalized === "id" || normalized.endsWith("id") || normalized.endsWith("ids");
}

function formatCsvCell(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function csvEscape(value) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function pad(value, width) {
  const targetWidth = width ?? value.length;
  return value.length >= targetWidth ? value : `${value}${" ".repeat(targetWidth - value.length)}`;
}

function parseResponseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numericValue(value, key) {
  if (!isRecord(value)) return 0;
  const field = value[key];
  return typeof field === "number" ? field : 0;
}

function toEpochMillis(value, optionName, endOfDay = false) {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(isoDate ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : value);
  if (Number.isNaN(date.getTime())) throw new CliError(`Invalid --${optionName} date: ${value}`);
  return date.getTime();
}

function hasFlag(args, key) {
  return args.options[key] === true;
}

function stringOpt(args, key) {
  const value = args.options[key];
  if (value === undefined || value === false) return undefined;
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}

function numberOpt(args, key) {
  const value = stringOpt(args, key);
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new CliError(`--${key} must be a number.`);
  return number;
}

function boolOpt(args, key) {
  const value = args.options[key];
  if (value === undefined) return undefined;
  if (value === true || value === "true") return true;
  if (value === "false") return false;
  throw new CliError(`--${key} must be true or false.`);
}

function printHelp(command) {
  const common = `
Common options:
  --api-key <key>                 Defaults to GAMALYTIC_API_KEY
  --env-file <path>               Load an env file before reading GAMALYTIC_API_KEY
  --base-url <url>                Defaults to https://api.gamalytic.com
  --format table|json|csv         Defaults to table
  --since YYYY-MM-DD              First release date lower bound
  --until YYYY-MM-DD              First release date upper bound
  --genres <csv>                  Required genres
  --tags <csv>                    Required Steam tags
  --tags-exclude <csv>            Excluded Steam tags
  --features <csv>                Required Steam features
  --revenue-min <n>               Metric filters also support max variants
  --reviews-min <n>
  --wishlists-min <n>
  --sold-min <n>
  --score-min <n>
  --price-min <n>
`;

  const helpByCommand = {
    games: `Usage: gamalytic games [options]

List games from /steam-games/list.

Options:
  --page <n>                      Zero-indexed page, default 0
  --limit <n>                     Items per page, default 25
  --fields <csv>                  Returned fields
  --sort <field>                  Default revenue
  --sort-mode asc|desc            Default desc
  --release-status <status>       all|released|unreleased|early_access|full_release
${common}`,
    game: `Usage: gamalytic game <steamId> [options]

Fetch details from /game/{id}.

Options:
  --fields <csv>                  Returned fields
  --include-pre-release-history true|false
  --format table|json|csv
  --api-key <key>
  --env-file <path>
`,
    genres: `Usage: gamalytic genres [options]

Group market stats from /steam-games/genres/stats.

Options:
  --key genres|tags|releaseDate   Default genres
  --n-tags <n>                    Applies when --key tags
  --sort <field>                  Client-side sort, e.g. medianRevenue or top25
${common}`,
    stats: `Usage: gamalytic stats [options]

Fetch global filtered stats from /steam-games/stats.
${common}`,
    raw: `Usage: gamalytic raw <path> --param key=value [--param key=value]

Call a documented Gamalytic GET endpoint directly.

Options:
  --param key=value               Repeatable query parameter
  --format table|json|csv
  --api-key <key>
  --env-file <path>
`
  };

  console.log(
    command && helpByCommand[command]
      ? helpByCommand[command]
      : `Usage: gamalytic <command> [options]

Commands:
  games       List and filter Steam games
  game        Fetch details for one Steam app id
  genres      Aggregate genre or tag stats
  stats       Aggregate stats for a filtered market slice
  raw         Call a documented GET endpoint directly

Run: gamalytic help <command>
${common}`
  );
}

main().catch((error) => {
  if (error instanceof CliError) {
    console.error(error.message);
    process.exit(error.exitCode);
  }
  console.error(error);
  process.exit(1);
});
