# FB Simulation

[![CI](https://github.com/Zanders214/fb-simulation/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/Zanders214/fb-simulation/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=fb-simulator_fb-simulator&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=fb-simulator_fb-simulator)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=fb-simulator_fb-simulator&metric=coverage)](https://sonarcloud.io/summary/new_code?id=fb-simulator_fb-simulator)

A **BitLife-style football (soccer) management simulation** for iOS and Android. Pick a country and one of its divisions, then create or take over a club, manage your lineup, formation and roles, and play instant-result matches — complete with goals, **yellow/red cards** and **injuries** — across a full season while your players develop. Sendings-off carry a suspension and injuries sideline players for a spell, so squad depth and rotation matter. Each country runs a stacked **league pyramid** with **promotion and relegation** between tiers, so winning your division climbs you up and finishing bottom sends you down. Countries and player nationalities are real, but the clubs, players and league names are **fictional and generated** — no licensed content.

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
| `npm run bench` | Benchmark the simulation engine — per-season timing & heap growth (see [Performance tooling](#performance--efficiency-tooling)) |
| `npm run bench:gc` | Same, with GC exposed for accurate retained/peak memory |
| `npm run analyze` | Build the bundle and open **Expo Atlas** to see what's heavy on the device |
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

The simulation engine is covered by a Jest suite (`src/engine/__tests__/`, plus a save round-trip test in `src/store/__tests__/`): match determinism, scoreline distribution, role behaviour, cards and injuries (rates, suspensions, and that sidelined players never feature), fixture scheduling, standings, full-season play, the country/division pyramid with promotion/relegation, and progression bounds. The UI screens are verified by running the app. Run them with `npm test`.

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

## Performance & efficiency tooling

SonarCloud and the ESLint rules above cover **static code smells**, but they
can't measure how much memory or CPU the app actually uses at runtime. These
three tools fill that gap — making it easier to keep the app fast and light:

- **`eslint-plugin-react-perf`** (runs as part of `npm run lint`) — flags inline
  object / function / JSX literals passed as props, which allocate a new
  reference every render and defeat memoisation, causing avoidable re-renders.
  The codebase is currently clean of these (list rows are extracted into
  `React.memo`'d components with stable `useCallback` handlers), so the rules act
  as a **warning** guard that surfaces any newly-introduced inline props before
  they ship. The `style={[…]}` array rule is disabled: in React Native that's the
  idiomatic StyleSheet-composition pattern and was almost all false positives.
- **`npm run bench`** ([`scripts/bench.ts`](scripts/bench.ts)) — drives the pure
  engine through full seasons and reports world-gen cost, per-season wall-clock,
  and heap growth. The engine is the app's real CPU/memory hotspot, so this is
  the fastest way to catch a change that makes simulation slower or leakier. Use
  `npm run bench:gc` for accurate retained/peak heap. Optional args:
  `npm run bench -- <seasons> <seed>`.
- **`npm run analyze`** — runs an export with [Expo Atlas](https://docs.expo.dev/guides/analyzing-bundles/)
  enabled (`EXPO_UNSTABLE_ATLAS=true`) and opens its viewer on the resulting
  `.expo/atlas.jsonl`, a treemap of exactly which modules bloat the JS bundle
  shipped to the device. (Uses an inline env var, so it's macOS/Linux-friendly.)

## Known limitations

- **No player retirement or youth intake (TODO).** Every player ages one year at
  each season rollover (`applySeasonEnd` in [`src/engine/progression.ts`](src/engine/progression.ts))
  and veterans decline, but no one ever retires and no new/young players are ever
  generated after world creation. The `PROGRESSION.RETIRE_AGE` constant in
  [`src/engine/config.ts`](src/engine/config.ts) is defined but currently unused.
  Over a long save this means squads steadily age and decay toward the attribute
  floor with no replenishment. A proper fix needs design thought, not just wiring:
  retirement triggers (age/ability thresholds), youth-generation cadence and
  quality, how new players slot into clubs, keeping it deterministic from the
  world seed, and the impact on save size. Tracked here until that's designed.

## Licensing

All clubs, players and league names are fictional and procedurally generated — no licensed names, likenesses, crests, or logos. Only real-world country names (which carry no IP) are used. Only the store developer fees apply when publishing (Apple $99/yr, Google $25 one-time).
