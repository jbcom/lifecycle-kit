# @jbcom/lifecycle

The stage stack: chemistry, biological scaling laws, compositional form,
pigment, and 2.5D assembly.

## Install

```sh
pnpm add @jbcom/lifecycle
```

No runtime dependencies.

## Use a stage

Import the stage you need. Subpaths are the primary interface — they keep the
bundle small and make a symbol's provenance obvious.

```ts
import { ... } from "@jbcom/lifecycle/chem";        // elements, bonding, tissue composition
import { ... } from "@jbcom/lifecycle/bio-laws";    // cited biological scaling laws
import { ... } from "@jbcom/lifecycle/forms";       // compositional rules emitting vector geometry
import { ... } from "@jbcom/lifecycle/pigment";     // colour from diet, exposure, chemistry
import { ... } from "@jbcom/lifecycle/assemblage";  // 2.5D assembly, lighting, depth
```

The root export exposes each stage as a namespace:

```ts
import { chem, forms } from "@jbcom/lifecycle";
```

It is namespaced rather than flat on purpose. `chem` and `assemblage` both
export `normalise`, so a flat re-export would silently shadow one depending on
declaration order.

## How the stages relate

`chem`, `forms`, and `bio-laws` stand alone. `pigment` builds on `chem`.
`assemblage` builds on `forms` and `pigment`.

Those were version constraints across six packages that had to be kept in step.
Inside one package they are just imports.
