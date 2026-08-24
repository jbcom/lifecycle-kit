# @jbdevprimary/lifecycle-kit

![Elemental chemistry flowing through tissue into a segmented procedural organism](./docs/public/lifecycle-kit-hero.webp)

[![CI](https://github.com/jbcom/lifecycle-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/jbcom/lifecycle-kit/actions/workflows/ci.yml)
[![MIT license](https://img.shields.io/badge/license-MIT-365c4a.svg)](./LICENSE)

Lifecycle Kit is a deterministic TypeScript stage stack for growing procedural
creatures from causes rather than catalogs. A world's chemistry determines its
tissue, lived diet and activity reshape that tissue, biological laws scale the
organism, compositional rules emit its form, and pigment plus self-shadowing
turn the result into renderer-neutral visual data.

Use one stage independently or carry the same creature through the full
pipeline. The package has no runtime dependencies, browser globals, hidden
randomness, or rendering-engine lock-in.

## Why Lifecycle Kit

Many procedural-creature systems select from authored body parts and recolor
the result. Lifecycle Kit keeps the causal chain intact:

- real elemental properties and biomolecule formulas decide what can grow;
- cited allometric laws replace hand-tuned size and life-history guesses;
- a small vocabulary of continuous vector rules creates body plans;
- diet, exposure, tissue, depth, and light remain visible in the final palette;
- pure POJO inputs and outputs are serializable, replayable, and easy to test.

## Install

```sh
pnpm add @jbdevprimary/lifecycle-kit
```

No runtime dependencies.

Lifecycle Kit is ESM-only and supports Node.js 22 or newer, plus modern
bundlers. CommonJS applications can load it with dynamic `import()`.

There is no global configuration or environment-variable contract. Each pure
function receives the world, creature state, or rendering parameters it needs,
which keeps parallel simulations isolated and deterministic.

## Use a stage

Import the stage you need. Subpaths are the primary interface — they keep the
bundle small and make a symbol's provenance obvious.

### `chem` — elements, bonding, tissue composition

```ts
import {
  NEWBORN,
  compositionColor,
  deriveBiochemistry,
  metabolise,
  normalise,
  readMetabolicState,
  writeMetabolicState,
} from "@jbdevprimary/lifecycle-kit/chem";

// Which backbone element wins on this world, from its temperature and
// element abundances.
const { backbone, rationale } = deriveBiochemistry({ Si: 30 }, 500);
// backbone: "Si", rationale: "Silicon, narrowly — no liquid water to break
// its chains, and plenty of it"

// A raw tissue tally, normalised to fractions that sum to 1. Invalid or
// negative quantities fail at this boundary instead of becoming NaN later.
const body = normalise({ sugar: 0, protein: 3, lipid: 1, mineral: 0, chitin: 0, keratin: 0 });
// { sugar: 0, protein: 0.75, lipid: 0.25, mineral: 0, chitin: 0, keratin: 0 }

compositionColor(body); // "#beb5af" — a real hex colour, never NaN

// Safely persist an evolving body. Writes reject invalid state; reads migrate
// partial legacy tissue records and fall back to a fresh newborn if corrupt.
const next = metabolise(NEWBORN, { protein: 1 }, { exertion: 1, growth: 0.3, rest: 0 });
const saved = writeMetabolicState(next);
readMetabolicState(saved); // a canonical MetabolicState
```

### `bio-laws` — cited biological scaling laws

```ts
import { expectedBrainMass, encephalizationQuotient, maxGroupSize } from "@jbdevprimary/lifecycle-kit/bio-laws";

expectedBrainMass(70); // ~0.24 kg, from Jerison's mammalian brain/body scaling
encephalizationQuotient(1.4, 62); // ~6.3, a human-scale EQ (Jerison 1973)
maxGroupSize(4.1); // ~148 — Dunbar's number, from his own neocortex-ratio regression
```

### `forms` — compositional rules emitting vector geometry

```ts
import { taper, repeat, bounds } from "@jbdevprimary/lifecycle-kit/forms";

// A single tapered body segment.
const segment = taper({ from: 0.2, to: 0.1, bulgeAt: 0.5, length: 0.4, part: "seg" });

// Three of them in a row — a centipede-style body, not a bespoke shape.
const body = repeat(segment, { axis: { x: 1, y: 0 }, count: 3, spacing: 0.5, part: "seg" });

bounds(body); // { min: { x, y }, max: { x, y } } — the emitted geometry's exact extent
```

### `pigment` — colour from diet, exposure, chemistry

```ts
import { derivePigments, paletteRamp, NO_DIET_HISTORY, recordMeal } from "@jbdevprimary/lifecycle-kit/pigment";
import { EMPTY_COMPOSITION } from "@jbdevprimary/lifecycle-kit/chem";

const diet = recordMeal(NO_DIET_HISTORY, 0.8); // a mostly plant-matter meal
const composition = { ...EMPTY_COMPOSITION, keratin: 1 };

const pigments = derivePigments(composition, diet, { uvExposure: 0.6, genetics: 0.5 });
// { melanin, carotenoid, pterin, purine, porphyrin } — real concentrations, never NaN

paletteRamp(composition, pigments, { metallic: 0.1, roughness: 0.7, opacity: 1 });
// { shadow, base, pigment, highlight } — four hex stops a renderer shades with
```

### `assemblage` — 2.5D assembly, lighting, depth

```ts
import { assemble, shade, DEFAULT_LIGHT } from "@jbdevprimary/lifecycle-kit/assemblage";
import { taper } from "@jbdevprimary/lifecycle-kit/forms";

const segment = taper({ from: 0.2, to: 0.1, bulgeAt: 0.5, length: 0.4, part: "seg" });

// Place tagged shapes in depth bands and light them.
const [part] = assemble(segment.shapes, DEFAULT_LIGHT);
// { shape, depth, light, direct, occlusion } — depth-sorted, ready to draw

shade("#beb5af", part.light); // the tissue colour, shaded by that part's light level
```

The root export exposes each stage as a namespace:

```ts
import { chem, forms } from "@jbdevprimary/lifecycle-kit";

chem.normalise(/* ... */);
forms.taper(/* ... */);
```

It is namespaced rather than flat on purpose. `chem` and `assemblage` both
export `normalise`, so a flat re-export would silently shadow one depending on
declaration order.

## How the stages relate

`chem`, `forms`, and `bio-laws` stand alone. `pigment` builds on `chem`.
`assemblage` builds on `forms` and `pigment`.

Those were version constraints across six packages that had to be kept in step.
Inside one package they are just imports.

```text
world abundance + temperature
            │
            ▼
          chem ───────► bio-laws
            │              │
            ▼              │
         pigment           │
            │              │
            └──────┐       │
                   ▼       ▼
forms ─────────► assemblage ──► renderer-ready geometry, colour, depth, light
```

The stage boundaries are plain data: `Composition`, `Path`, `PaletteRamp`, and
`AssembledPart`. No stage owns a clock, random-number source, DOM, canvas, or
game-engine object. Consumers decide persistence, seeding, scheduling, and the
final renderer.

The [complete API reference](https://jonbogaty.com/lifecycle-kit/reference/)
lists every public function and type, including units, validation behavior,
persistence fallbacks, and renderer contracts.

For code you can run unchanged, start with the
[two-stage quick start](./examples/quick-start.mjs), then follow the
[complete world-to-creature pipeline](./examples/world-creature.mjs). The
examples execute in CI against the package's built export map, so they cannot
quietly drift away from the released API.

## Development

The repository pins Node 22 and pnpm 11.23.0. The same command used by CI
checks formatting and lint rules, TypeScript, the full coverage floor, the
production build, runnable examples, and the packed package's ESM
declarations:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm verify
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the change and release workflow.

Individual commands are available when iterating:

```sh
pnpm lint            # Biome formatting and static rules
pnpm typecheck       # strict TypeScript without emitting
pnpm test            # 500+ unit, regression, and integration assertions
pnpm coverage        # tests plus enforced coverage floors
pnpm build           # ESM JavaScript, declarations, maps, and source maps
pnpm check:examples  # execute both examples through the built export map
pnpm check:package   # publint plus arethetypeswrong
```

The full documentation site, including a typedoc-generated API reference for
every subpath export, is published at
[jonbogaty.com/lifecycle-kit](https://jonbogaty.com/lifecycle-kit/) and built
from `docs/` with `pnpm --filter docs build`.

## Compatibility

The public package targets ES2022 and is tested on Node.js 22, 24, and 26, with
an additional Windows CI run. Its runtime modules use no Node-only APIs, so
modern ESM bundlers can tree-shake the subpath exports for browser games.
CommonJS callers must use dynamic `import()`; a synchronous `require()` build
is intentionally not shipped.

## Troubleshooting

- **`ERR_REQUIRE_ESM`:** use `import` syntax, set `"type": "module"`, or load
  from CommonJS with `await import("@jbdevprimary/lifecycle-kit/chem")`.
- **An input throws instead of being clamped:** validation is deliberate.
  Temperatures are kelvin, composition and exposure fractions are 0..1, masses
  are kilograms where documented, and negative physical quantities are caller
  errors. Error messages name the function and field.
- **A save will not load:** `readMetabolicState` never throws for corrupt or
  older JSON; it migrates partial known tissue or returns a fresh newborn.
  Use `writeMetabolicState` to reject invalid state before persisting it.
- **A bundle includes more than expected:** import a stage subpath such as
  `@jbdevprimary/lifecycle-kit/forms` instead of the root namespace module.

If behavior still looks wrong, open a
[bug report](https://github.com/jbcom/lifecycle-kit/issues/new/choose) with a
minimal input and exact runtime version. Report vulnerabilities privately as
described in [SECURITY.md](./SECURITY.md).

## Contributing, releases, and license

Contributions are welcome under the process in
[CONTRIBUTING.md](./CONTRIBUTING.md) and the
[Code of Conduct](./CODE_OF_CONDUCT.md). Release Please builds changelog entries
and versions from Conventional Commits; a release tag triggers a verified
package build and npm publication with provenance.

Lifecycle Kit is available under the [MIT License](./LICENSE).
