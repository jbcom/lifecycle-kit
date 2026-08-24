---
title: Get started
description: Install Lifecycle Kit and run a deterministic chemistry-to-form example.
---

## Install

```sh
pnpm add lifecycle-kit
```

Lifecycle Kit is ESM-only and supports Node.js 22 or newer plus modern
bundlers. CommonJS applications can load it with dynamic `import()`.

## Use a stage

Subpath imports are the primary interface. They minimize the imported surface
and make dependencies visible at the call site.

```ts
import { compositionColor, deriveBiochemistry, normalise } from "lifecycle-kit/chem";

const { backbone } = deriveBiochemistry({ Si: 30 }, 500);
// backbone: "Si"

const body = normalise({ sugar: 0, protein: 3, lipid: 1, mineral: 0, chitin: 0, keratin: 0 });
compositionColor(body); // "#beb5af"
```

Structured inputs are validated at the exported-function boundary. Invalid
physical quantities throw a named error instead of propagating `NaN` into a
later stage.

## Run the repository examples

The repository includes two examples that execute against the built package
export map in CI:

```sh
pnpm build
pnpm check:examples
```

- [`quick-start.mjs`](https://github.com/jbcom/lifecycle-kit/blob/main/examples/quick-start.mjs)
  demonstrates a compact chemistry and form pipeline.
- [`world-creature.mjs`](https://github.com/jbcom/lifecycle-kit/blob/main/examples/world-creature.mjs)
  carries a world and creature through the full pipeline.

Next, read [How the pipeline stays deterministic](./determinism/) or browse the
[API reference](./api-reference/).
