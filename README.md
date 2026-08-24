# @jbcom/lifecycle-kit

The stage stack: chemistry, biological scaling laws, compositional form,
pigment, and 2.5D assembly.

## Install

```sh
pnpm add @jbcom/lifecycle-kit
```

No runtime dependencies.

## Use a stage

Import the stage you need. Subpaths are the primary interface — they keep the
bundle small and make a symbol's provenance obvious.

### `chem` — elements, bonding, tissue composition

```ts
import { deriveBiochemistry, normalise, compositionColor } from "@jbcom/lifecycle-kit/chem";

// Which backbone element wins on this world, from its temperature and
// element abundances.
const { backbone, rationale } = deriveBiochemistry({ Si: 30 }, 500);
// backbone: "Si", rationale: "Silicon, narrowly — no liquid water to break
// its chains, and plenty of it"

// A raw tissue tally, normalised to fractions that sum to 1.
const body = normalise({ sugar: 0, protein: 3, lipid: 1, mineral: 0, chitin: 0, keratin: 0 });
// { sugar: 0, protein: 0.75, lipid: 0.25, mineral: 0, chitin: 0, keratin: 0 }

compositionColor(body); // "#beb5af" — a real hex colour, never NaN
```

### `bio-laws` — cited biological scaling laws

```ts
import { expectedBrainMass, encephalizationQuotient, maxGroupSize } from "@jbcom/lifecycle-kit/bio-laws";

expectedBrainMass(70); // ~0.24 kg, from Jerison's mammalian brain/body scaling
encephalizationQuotient(1.4, 62); // ~6.3, a human-scale EQ (Jerison 1973)
maxGroupSize(4.1); // ~148 — Dunbar's number, from his own neocortex-ratio regression
```

### `forms` — compositional rules emitting vector geometry

```ts
import { taper, repeat, bounds } from "@jbcom/lifecycle-kit/forms";

// A single tapered body segment.
const segment = taper({ from: 0.2, to: 0.1, bulgeAt: 0.5, length: 0.4, part: "seg" });

// Three of them in a row — a centipede-style body, not a bespoke shape.
const body = repeat(segment, { axis: { x: 1, y: 0 }, count: 3, spacing: 0.5, part: "seg" });

bounds(body); // { min: { x, y }, max: { x, y } } — the emitted geometry's exact extent
```

### `pigment` — colour from diet, exposure, chemistry

```ts
import { derivePigments, paletteRamp, NO_DIET_HISTORY, recordMeal } from "@jbcom/lifecycle-kit/pigment";
import { EMPTY_COMPOSITION } from "@jbcom/lifecycle-kit/chem";

const diet = recordMeal(NO_DIET_HISTORY, 0.8); // a mostly plant-matter meal
const composition = { ...EMPTY_COMPOSITION, keratin: 1 };

const pigments = derivePigments(composition, diet, { uvExposure: 0.6, genetics: 0.5 });
// { melanin, carotenoid, pterin, purine, porphyrin } — real concentrations, never NaN

paletteRamp(composition, pigments, { metallic: 0.1, roughness: 0.7, opacity: 1 });
// { shadow, base, pigment, highlight } — four hex stops a renderer shades with
```

### `assemblage` — 2.5D assembly, lighting, depth

```ts
import { assemble, shade, DEFAULT_LIGHT } from "@jbcom/lifecycle-kit/assemblage";
import { taper } from "@jbcom/lifecycle-kit/forms";

const segment = taper({ from: 0.2, to: 0.1, bulgeAt: 0.5, length: 0.4, part: "seg" });

// Place tagged shapes in depth bands and light them.
const [part] = assemble(segment.shapes, DEFAULT_LIGHT);
// { shape, depth, light, direct, occlusion } — depth-sorted, ready to draw

shade("#beb5af", part.light); // the tissue colour, shaded by that part's light level
```

The root export exposes each stage as a namespace:

```ts
import { chem, forms } from "@jbcom/lifecycle-kit";

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
