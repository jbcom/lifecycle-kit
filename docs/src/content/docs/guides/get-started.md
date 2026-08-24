---
title: Get started
description: Install Lifecycle Kit and run its two-stage quick start.
---

## Install

```sh
pnpm add @jbdevprimary/lifecycle-kit
```

No runtime dependencies. Lifecycle Kit is ESM-only and supports Node.js 22 or
newer, plus modern bundlers. CommonJS applications can load it with dynamic
`import()`.

## Use a stage

Import the stage you need. Subpaths are the primary interface — they keep the
bundle small and make a symbol's provenance obvious.

```ts
import {
	deriveBiochemistry,
	normalise,
	compositionColor,
} from "@jbdevprimary/lifecycle-kit/chem";

const { backbone, rationale } = deriveBiochemistry({ Si: 30 }, 500);

const body = normalise({
	sugar: 0,
	protein: 3,
	lipid: 1,
	mineral: 0,
	chitin: 0,
	keratin: 0,
});

compositionColor(body); // a real hex colour, never NaN
```

See the [API reference](../../reference/) for every export across all five
stages, or the runnable
[examples on GitHub](https://github.com/jbcom/lifecycle-kit/tree/main/examples)
for the full world-to-creature pipeline.
