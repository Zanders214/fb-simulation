# FB Simulation

[![CI](https://github.com/Zanders214/fb-simulation/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/Zanders214/fb-simulation/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=fb-simulator_fb-simulator&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=fb-simulator_fb-simulator)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=fb-simulator_fb-simulator&metric=coverage)](https://sonarcloud.io/summary/new_code?id=fb-simulator_fb-simulator)

A **BitLife-style football (soccer) management simulation** for iOS and Android. Pick a country and one of its divisions, then create or take over a club, manage your lineup, formation and roles, and play instant-result matches across a full season while your players develop. Each country runs a stacked **league pyramid** with **promotion and relegation** between tiers, so winning your division climbs you up and finishing bottom sends you down. All countries, clubs, players and leagues are **fictional and generated** — no licensed content.

> **Status:** pre-alpha. The v1 season loop is playable end to end.

## Tech stack

- **Expo SDK 54** · React Native · TypeScript
- **Expo Router** (navigation) · **Zustand** (state, with `persist` → AsyncStorage)
- A pure, React-free **simulation engine** (`src/engine/`) with deterministic, seeded RNG — fully unit-tested in plain Node/Jest.

## Getting started

Prerequisites: **Node 20 LTS or 22 LTS** (the project is pinned to Expo SDK 54).

```bash
npm install
```

Run it on your phone (free — no Mac required):

```bash
npm start
```

Then install **Expo Go** (App Store / Google Play) and scan the QR code.

### Useful scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server (run on a device via Expo Go) |
| `npm test` | Run the Jest unit tests |
| `npm run lint` | ESLint (Expo config + SonarCloud-mirroring rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run web` | Run in a browser at http://localhost:8082 |
| `npm run demo` | Print a fully-simulated season to the console (balance/sanity check) |
| `npm run icons` | Regenerate the app icons (`assets/*.png`) from `scripts/generate-icons.mjs` |

## Project structure

```
app/             Expo Router screens (Home, New Game, season hub tabs, match result)
src/engine/      Pure game engine: match sim, world generation (country/division
                 pyramid), fixtures, standings, promotion/relegation, progression
                 — no React, deterministic, unit-tested
src/store/       Zustand store + persistence seam (game save + user preferences)
src/components/  Shared UI components
src/theme/       Theme system: palettes + provider/hooks (light, dark & extra themes)
src/ui/          Formatting helpers
scripts/         Console balance tool (demo.ts) + icon generator (generate-icons.mjs)
```

## Theming

The standard theme follows the device's light/dark setting; a few extra themes
(Midnight, Claret, Sunset, Graphite) can be picked in **Settings → Appearance**.
Screens read the active theme via `useTheme()` / `useThemedStyles()` from
`src/theme`, so a change re-skins the whole app live. The choice is persisted
separately from the save game.

## Tests

The simulation engine is covered by a Jest suite (`src/engine/__tests__/`, plus a save round-trip test in `src/store/__tests__/`): match determinism, scoreline distribution, role behaviour, fixture scheduling, standings, full-season play, the country/division pyramid with promotion/relegation, and progression bounds. The UI screens are verified by running the app. Run them with `npm test`.

## Development workflow

- **`dev` is the default branch.** `main` holds released/production code.
- **Never commit directly to `dev` or `main`.** For every change:
  1. Branch off `dev`:
     ```bash
     git checkout dev
     git pull
     git checkout -b <type>/<short-description>   # e.g. feature/transfers
     ```
  2. Commit your work on that branch and push it.
  3. Open a **pull request into `dev`**.
  4. Wait for the **CI pipeline to pass**, then merge the PR.
- Releases promote `dev` → `main` via a pull request.

Branch name prefixes: `feature/`, `fix/`, `chore/`, `ci/`, `docs/`.

## Continuous integration & code quality

Every pull request — and every push to `dev`/`main` — runs the **CI** workflow ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

1. **Lint** (`eslint`) — Expo's config plus a focused set of rules that mirror the SonarCloud profile (nested ternaries, array-index keys, cognitive complexity, unstable nested components, unused imports), so those smells are caught at PR time instead of after merge.
2. **Type check** (`tsc`)
3. **Unit tests** (`jest`) with coverage
4. **SonarCloud** code-quality analysis with the **quality gate enforced** — the pipeline fails if the gate fails (`-Dsonar.qualitygate.wait=true`). Runs once `SONAR_TOKEN` is configured.

Keep CI green — don't merge a PR into `dev` with a failing pipeline. (Tip: enable branch protection on `dev` in GitHub → Settings → Branches, requiring the CI check to pass before merging.)

### SonarCloud setup (one-time)

CI already contains the SonarCloud step; it stays dormant until you connect the project:

1. Go to **https://sonarcloud.io** and sign in with GitHub.
2. **Analyze a new project** → choose the `Zanders214/fb-simulation` repository.
3. Pick **GitHub Actions** as the analysis method and **turn _Automatic Analysis_ OFF** (CI uploads coverage, which Automatic Analysis can't do).
4. Confirm the **Project Key** and **Organization Key** SonarCloud shows you match [`sonar-project.properties`](sonar-project.properties) (`fb-simulator_fb-simulator` / `fb-simulator`). Update that file if they differ.
5. Generate a token and add it to the repo as a secret named **`SONAR_TOKEN`** (GitHub → Settings → Secrets and variables → Actions → New repository secret).
6. The next pull request will be analysed automatically.

## Licensing

All clubs, players and leagues are fictional and procedurally generated — no licensed names, likenesses, crests, or logos. Only the store developer fees apply when publishing (Apple $99/yr, Google $25 one-time).
