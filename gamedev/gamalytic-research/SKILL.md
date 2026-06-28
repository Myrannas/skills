---
name: gamalytic-research
description: Use this skill when researching Steam game markets with the Gamalytic API, especially for comparing genres, tags, comparable games, revenue distributions, release windows, indie opportunity sizing, market saturation, and Steam positioning. Use it when the user asks for current or recent game genre research, market validation, competitor lists, or Gamalytic-backed evidence.
---

# Gamalytic Research

Use the bundled Node script to query Gamalytic instead of hand-building API URLs. Prefer recent release windows for opportunity research unless the user asks for lifetime data.

## Quick Start

Run from this skill folder:

```sh
node scripts/gamalytic.mjs --help
```

The script loads `GAMALYTIC_API_KEY` from the environment, then a local `.env` file in the current working directory, then `~/.config/skills.env` if the key is still undefined. Never print or commit the key.

If the key is in another project, pass it explicitly as an env file:

```sh
node scripts/gamalytic.mjs --env-file /path/to/.env stats --since 2024-01-01 --until 2026-06-28 --tags "Mining,Automation" --format json
```

## Research Workflow

1. Use `stats` to estimate market shape for a candidate tag or genre combination.
2. Use `games` to inspect the top and middle performers.
3. Use `game <steamId>` for detailed checks on strong comparables.
4. Keep date windows and filters consistent when comparing niches.
5. Treat revenue, sales, and wishlist numbers as directional estimates.

Default recent window:

```sh
--since 2024-01-01 --until 2026-06-28
```

For user-facing summaries, report:

- game count
- median revenue
- top 25%, top 10%, and top 5% revenue when present
- representative top games
- caveats about broad tags, multiplayer skew, AAA skew, free-to-play skew, and weak genre fit

## Commands

### Stats

Use `stats` for aggregate market summaries:

```sh
node scripts/gamalytic.mjs stats --since 2024-01-01 --until 2026-06-28 --tags "Mining,Automation" --format json
```

### Games

Use `games` for comparable lists:

```sh
node scripts/gamalytic.mjs games \
  --since 2024-01-01 \
  --until 2026-06-28 \
  --tags "Automation,Base Building" \
  --sort revenue \
  --limit 25 \
  --fields steamId,name,releaseDate,price,reviews,reviewScore,revenue,copiesSold,wishlists,tags \
  --format table
```

### Game

Use `game` to inspect one title:

```sh
node scripts/gamalytic.mjs game <steamId> --format json
```

### Genres

Use `genres` to group market stats by genre or tag:

```sh
node scripts/gamalytic.mjs genres --key tags --n-tags 5 --since 2024-01-01 --sort medianRevenue
```

### Raw

Use `raw` for documented GET endpoints not covered by the wrapper:

```sh
node scripts/gamalytic.mjs raw /steam-games/list --param limit=5 --param sort=revenue --param sort_mode=desc --format json
```

## Useful Filters

Common filters accepted by `games`, `genres`, and `stats`:

- `--since YYYY-MM-DD`
- `--until YYYY-MM-DD`
- `--genres <csv>`
- `--tags <csv>`
- `--tags-exclude <csv>`
- `--features <csv>`
- `--revenue-min <n>` / `--revenue-max <n>`
- `--reviews-min <n>` / `--reviews-max <n>`
- `--wishlists-min <n>` / `--wishlists-max <n>`
- `--sold-min <n>` / `--sold-max <n>`
- `--score-min <n>` / `--score-max <n>`
- `--price-min <n>` / `--price-max <n>`
- `--release-status all|released|unreleased|early_access|full_release`

Use `--format table` for quick inspection, `--format json` for exact values, and `--format csv` for spreadsheet-style analysis.
