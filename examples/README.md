# Examples

These examples use only Lifecycle Kit's public package exports.

- [`quick-start.mjs`](./quick-start.mjs) chooses a world's biochemistry and
  advances a newborn through one meal and activity step.
- [`world-creature.mjs`](./world-creature.mjs) carries one world through all
  five stages: chemistry, metabolism, biological scaling, form, pigment, and
  depth-aware assembly.

From a repository checkout:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm check:examples
```

The package is self-referenced by name, so these commands exercise the same
`exports` entries an installed consumer receives instead of importing source
files directly.
