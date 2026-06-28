# Game Development Skills

This repository is a collection of Codex skills for game development research and tooling.

## Layout

```text
skills/
  gamedev/
    gamalytic-research/
      SKILL.md
      agents/openai.yaml
      scripts/gamalytic.mjs
```

Each skill should live in its own folder under `skills/<category>/<skill-name>/` and include a `SKILL.md` file. Skill-specific scripts, assets, and Codex app metadata should stay inside that skill folder.

## Current Skills

### `gamalytic-research`

Research Steam markets with the Gamalytic API. Use it for genre and tag comparisons, comparable-game lists, revenue distributions, release-window analysis, market saturation, and positioning research.

Run from the repository root:

```sh
pnpm gamalytic --help
```

Or run the script directly:

```sh
node skills/gamedev/gamalytic-research/scripts/gamalytic.mjs --help
```

Example:

```sh
pnpm gamalytic stats --since 2024-01-01 --until 2026-06-28 --tags "Mining,Automation" --format json
```

## Secrets

Do not commit API keys.

The Gamalytic script looks for `GAMALYTIC_API_KEY` in this order:

1. Existing process environment
2. Explicit `--env-file <path>`, or `.env` in the current working directory by default
3. `~/.config/skills.env` if `GAMALYTIC_API_KEY` is still undefined

Recommended shared local setup:

```sh
mkdir -p ~/.config
chmod 700 ~/.config
printf 'GAMALYTIC_API_KEY=your_key_here\n' >> ~/.config/skills.env
chmod 600 ~/.config/skills.env
```

The repository `.gitignore` excludes local `.env` files, logs, build output, and `node_modules`.

## Development

Use Node 20 or newer. This repo uses `pnpm` for package scripts.

```sh
pnpm check
```

When adding a new CLI or one-off script, use TypeScript or Rust. For one-off scripts, use Node with TypeScript and `pnpm`.
