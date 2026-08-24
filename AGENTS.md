# AGENTS.md

Operating instructions for coding agents working in this repository.

## What this package is

`lifecycle-kit` is a deterministic, ESM-only TypeScript
library: five independent pipeline stages (`chem`, `bio-laws`, `forms`,
`pigment`, `assemblage`) exported as separate subpaths plus a root export
that chains them. Every function is pure — plain-object in, plain-object
out, no hidden randomness, no DOM/browser globals, no rendering-engine
lock-in. Read `src/index.ts` for the stage order and `README.md` for
worked examples before changing behavior.

## Repository layout

- `src/<stage>/` — one directory per pipeline stage, each with its own
  `index.ts` barrel export and `__tests__/` alongside the code it tests.
- `src/<stage>/validate.ts` — boundary validation (a `quantities()`-style
  guard) called at the top of every exported function that takes
  structured input. Invalid input must fail here, not produce `NaN`
  downstream.
- `examples/` — runnable `.mjs` scripts against the *built* package
  (`dist/esm`), executed in CI (`pnpm check:examples`) so they cannot
  drift from the released API.
- `docs/` — a separate pnpm workspace member: a Sourcey site. TypeDoc extracts
  the public TSDoc into ignored `docs/api/` Markdown immediately before each
  Sourcey build; Sourcey is the only documentation renderer. Document behavior
  in TSDoc on the exported symbol, not in generated API Markdown.

## Build, verify, test

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm verify   # lint, typecheck, coverage, build, examples, package checks — the CI gate
```

Individual commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm coverage`, `pnpm build`, `pnpm check:examples`, `pnpm check:package`.

Coverage floors are enforced (currently ~99% statements/lines, 95% branch,
100% functions — see `vitest.config.ts` for exact numbers). A change that
drops coverage below the floor fails CI; write the test, don't lower the
floor.

To build and preview the docs site:

```sh
pnpm --filter lifecycle-kit-docs dev     # local Sourcey server
pnpm docs:build                                        # extracts API Markdown and builds docs/dist
```

Sourcey resolves configuration paths relative to `docs/sourcey.config.ts`.
Its configured `baseUrl` is `/lifecycle-kit/`, so local and production builds
exercise the same subdirectory deployment paths.

## Conventions that matter

- **Conventional Commits, enforced.** `.pre-commit-config.yaml` runs
  `conventional-pre-commit` on the commit-msg hook. Release Please reads
  these prefixes to compute the next version and changelog — do not
  hand-edit `CHANGELOG.md`, `package.json#version`, or
  `.release-please-manifest.json`.
- **Use relative links in Sourcey Markdown.** The production site is mounted
  beneath `/lifecycle-kit/`; relative links keep guides and API pages portable.
- **New exported symbols need TSDoc, not a generated-doc edit.** The TypeDoc
  extraction reads the five `src/<stage>/index.ts` barrels configured in
  `docs/typedoc.json`; Sourcey then renders that generated Markdown.
- **New GitHub Actions steps must use a pinned commit SHA**, resolved via
  `gh api repos/<owner>/<repo>/commits/<tag>` — never a floating major tag
  and never a SHA from memory/training data.
- **`docs/` is its own pnpm workspace package** (`lifecycle-kit-docs`,
  private) with its own `node_modules`. Root-level `pnpm verify` does not
  touch it; run its scripts with `pnpm --filter lifecycle-kit-docs <script>`.

## Where things run

- `ci.yml` — lint/typecheck/coverage/build/package-shape checks, plus a
  Node 24/26/Windows compatibility matrix. Runs on every PR and push to
  `main`.
- `codeql.yml` — static analysis, PR + push + weekly schedule.
- `release.yml` — Release Please opens/updates the release PR; merging it
  triggers a provenance npm publish.
- `cd.yml` — builds and deploys `docs/` to GitHub Pages on every push to
  `main`.
