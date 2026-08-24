---
title: Contributing
description: Native development, verification, and release conventions for Lifecycle Kit.
---

Lifecycle Kit uses pnpm, TypeScript, Biome, Vitest, TypeDoc extraction, and
Sourcey.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` runs formatting and lint checks, strict TypeScript checking,
coverage thresholds, the production library build, executable examples,
package-shape checks, and the Sourcey docs build.

Use [Conventional Commits](https://www.conventionalcommits.org/) such as
`fix:`, `feat:`, `docs:`, `refactor:`, `test:`, and `chore:`. Release Please
derives versions and changelog entries from those commits; do not edit the
version or changelog by hand.

Open a pull request from an upstream branch. CI, dependency review, CodeQL,
repository policy checks, CodeRabbit, and SonarCloud (when its GitHub app is
connected) provide machine feedback. Merge with a merge commit after every
required automated policy passes; squash and rebase merging are intentionally
disabled to preserve history.
