# Lifecycle Kit API

Lifecycle Kit is an ESM-only TypeScript package. Import from the stage subpath
you need; the root entry point exposes the same stages as namespaces.

```ts
import { chem } from "@jbdevprimary/lifecycle-kit";
import { taper } from "@jbdevprimary/lifecycle-kit/forms";
```

Public calculations are deterministic and have no hidden clock, renderer, or
storage dependency. Quantities are ordinary JavaScript numbers; units are
called out below where they matter.

## `@jbdevprimary/lifecycle-kit/chem`

### World biochemistry

| API | Contract |
| --- | --- |
| `Backbone` | The supported chain-forming elements: `"C"`, `"Si"`, or `"S"`. |
| `Biochemistry` | The selected `backbone`, winning `margin`, and a human-readable `rationale`. |
| `chainStability(symbol, kelvin)` | Relative self-chain stability at a positive absolute temperature. |
| `backboneScore(symbol, abundances, kelvin?)` | Scores catenation, local abundance, temperature, and hydrolysis pressure. |
| `deriveBiochemistry(abundances, kelvin?)` | Chooses the highest-scoring supported backbone for a world. |
| `inBackbone(template, backbone)` | Replaces formula placeholder `X` with the selected backbone. |

Temperature is kelvin. Invalid non-finite values and negative abundances are
rejected at the calculation boundary. Unsupported backbone strings are also
rejected at runtime, including for untyped JavaScript callers.

### Elements and biomolecules

| API | Contract |
| --- | --- |
| `Element`, `ELEMENTS` | Atomic mass, valence, electronegativity, abundance, CPK colour, and surface properties through chlorine. |
| `CATENATION`, `HYDROLYSIS` | Relative chain strength and water susceptibility for supported backbone candidates. |
| `molecularMass(counts)` | Formula mass in atomic mass units. Unknown symbols are ignored; invalid or negative counts throw. |
| `scarcity(counts)` | Mean elemental scarcity score. Unknown symbols are ignored; an empty/unsupported formula scores zero. |
| `Biomolecule`, `BiomoleculeId`, `BIOMOLECULES` | The six tissue-building molecular templates and their biological roles. |
| `Composition`, `EMPTY_COMPOSITION` | Tissue quantities keyed by biomolecule ID. |
| `normalise(raw)` | Converts a non-negative tissue tally to fractions summing to one. An all-zero tally becomes all sugar. |
| `asBackbone(id, backbone?)` | Expresses a biomolecule formula using the selected backbone. |
| `unitMass(id, backbone?)` | Molecular mass of one biomolecule unit. |
| `growthCost(id, backbone?)` | Scarcity-derived tissue construction cost. |
| `dominantTissue(composition)` | Returns the largest tissue fraction, with sugar winning ties. |
| `compositionColor(composition, backbone?)` | Produces a six-digit CPK-weighted hex colour. |

### Metabolism and persistence

| API | Contract |
| --- | --- |
| `FoodProfile` | Partial biomolecule quantities supplied by a meal. |
| `ActivityDemand` | `exertion`, `growth`, and `rest` demand values. |
| `MetabolicState` | Unnormalised `tissue` plus unspent `reserve`. |
| `NEWBORN` | The standard starting state: two sugar units and one protein unit. |
| `metabolise(state, food, activity, backbone?)` | Advances tissue and reserve by one deterministic intake/activity step. |
| `composition(state)` | Returns the state's normalised tissue composition. |
| `bodyMass(state)` | Total tissue units. |
| `KG_PER_TISSUE_UNIT` | Conversion constant, currently `0.05` kg per tissue unit. |
| `bodyMassKg(state)` | Total mass converted to kilograms for the biological laws. |
| `writeMetabolicState(state)` | Validates, canonicalises, and serialises a state. Invalid quantities throw before JSON can turn them into `null`. |
| `readMetabolicState(raw)` | Reads the serialized form, fills missing legacy tissue keys with zero, defaults a missing legacy reserve to zero, and returns a fresh `NEWBORN`-equivalent state when corrupt. |

Unknown numeric tissue keys are ignored when a state is canonicalised, which
allows a newer save to be read by an older client. At least one known tissue
must remain. Direct metabolism calls reject unknown food keys, negative or
non-finite demand, invalid state quantities, and unsupported backbones with the
function and argument named in the error.

## `@jbdevprimary/lifecycle-kit/bio-laws`

These functions implement the cited relationships documented beside their
source. Mass inputs are kilograms unless stated otherwise.

| API | Result |
| --- | --- |
| `vonBertalanffyMass(age, maxMass, growthRate, t0?, b?)` | Mass on a von Bertalanffy growth curve. |
| `clutchSize(parentMass, offspringMass, rSelected?)` | Whole offspring count from the size/number trade-off. |
| `ageAtFirstReproduction(maxLifespan)` | First-reproduction age in the caller's lifespan unit. |
| `populationDensity(massKg)` | Damuth population density estimate. |
| `expectedBrainMass(bodyMassKg)` | Expected mammalian brain mass in kilograms. |
| `encephalizationQuotient(brainMassKg, bodyMassKg)` | Brain mass relative to the size-derived expectation. |
| `maxGroupSize(neocortexRatio)` | Dunbar regression estimate from neocortex/rest-of-brain volume ratio. |
| `costOfTransport[gait](massKg)` | Energy per distance and mass in J/(kg·m) for swimming, flying, running, or burrowing. |
| `Gait` | Keys of `costOfTransport`. |
| `gutRetentionTime(massKg)` | Mean retention time in hours. |
| `REFERENCE_TEMPERATURE_K` | The 293.15 K normalization point. |
| `thermalRateFactor(kelvin)` | Boltzmann-Arrhenius metabolic-rate multiplier relative to 20 °C. |

Non-finite and physically negative inputs throw. Functions with a meaningful
zero boundary return zero there; `thermalRateFactor` requires a temperature
strictly above absolute zero.

## `@jbdevprimary/lifecycle-kit/forms`

### Geometry model

`Vec2`, `LineSegment`, `QuadraticSegment`, `CubicSegment`, `Segment`,
`SubPath`, `Ellipse`, `PartTag`, `Shape`, and `Path` describe renderer-neutral
vector geometry. `EMPTY_PATH` is the empty value.

| API | Contract |
| --- | --- |
| `concatPaths(...paths)` | Concatenates shape lists in draw order. |
| `tagPath(path, part, index)` | Tags every shape with an anatomical part and repetition index. |
| `groupByPart(path)` | Groups tagged shapes without changing first-seen or within-group order. |
| `bounds(path)` | Exact axis-aligned bounds, including Bézier extrema; `null` for an empty path. |
| `partBounds(path)` | Bounds for every anatomical part in draw order. |
| `Timed<T>`, `at(value, phase)` | A constant or phase-driven parameter and its evaluator. Phase is measured in turns. |
| `Animated`, `still(path)` | A phase-to-path function and adapter for static geometry. |

### Compositional rules

Rule configuration is strongly typed by `Axis`, `TaperParams`, `RepeatParams`,
`PairParams`, `RadiateParams`, `BranchParams`, and `EncloseParams`. These types
document required geometry, counts, part labels, and optional phase or index
values without coupling a caller to a renderer.

| API | Effect |
| --- | --- |
| `taper(params)` | Emits one bilaterally tapered closed segment. |
| `repeat(unit, params)` | Repeats a path along any vector axis. |
| `pair(unit, params)` | Mirrors a path around a bilateral axis. |
| `radiate(unit, params)` | Places copies around a hub in turn-space. |
| `branch(unit, params)` | Builds diverging copies from a shared origin. |
| `enclose(unit, params)` | Wraps a path in an enclosing ellipse. |
| `translate`, `scale`, `mirrorX`, `mirrorY`, `rotateTurns` | Pure geometric transformations. |

Rule parameter bags validate finite coordinates and dimensions, whole counts,
rule-specific positive sizes, documented 0..1 fractions, and non-empty part
names before emitting geometry. Rules that allocate repeated geometry reject
more than 10,000 copies; recursive branches also cap depth at 64 and reject
parameter combinations that would emit more than 10,000 copies.

### Rendering adapters

| API | Contract |
| --- | --- |
| `GraphicsLike` | Minimal Pixi-compatible drawing surface; Pixi is not a dependency. |
| `drawShape`, `drawPath` | Send vector commands to a `GraphicsLike` target. |
| `shapeToPathData`, `toPathData` | Produce SVG path-data strings. |
| `toSvgDocument(path, viewBox)` | Produce a complete SVG document string. |

## `@jbdevprimary/lifecycle-kit/pigment`

| API | Contract |
| --- | --- |
| `DietHistory`, `MealPlantFraction`, `NO_DIET_HISTORY` | Running plant-matter intake state. |
| `recordMeal(history, plantFraction)` | Folds one 0..1 meal fraction into the bounded running average. |
| `PigmentInputs` | UV exposure and genetic expression, both 0..1. |
| `PigmentConcentrations` | Melanin, carotenoid, pterin, purine, and porphyrin concentrations. |
| `derivePigments(composition, diet, inputs)` | Derives biological pigment concentrations from tissue, diet, UV, and genetics. |
| `SurfaceProperties` | Metallic, roughness, and opacity values, each 0..1. |
| `PaletteRamp` | Shadow, base, pigment, and highlight hex stops plus surface properties. |
| `paletteRamp(composition, pigments, surface)` | Builds a renderer-ready palette from composition and pigment concentrations. |

Pigment inputs reject missing, non-finite, or out-of-range values rather than
silently clamping values expressed in the wrong units. Supplied tissue
fractions are checked in 0..1; omitted legacy tissue keys are treated as zero.

## `@jbdevprimary/lifecycle-kit/assemblage`

| API | Contract |
| --- | --- |
| `Light`, `DEFAULT_LIGHT` | Direction and 0..1 ambient floor for upper-left default lighting. |
| `normalise(direction)` | Unit direction; degenerate input falls back to the default light. |
| `litness(point, light)` | Directional light level in 0..1. |
| `shade(hex, light)` | Shades a six-digit hex colour without discarding its hue. |
| `Box`, `Caster`, `shapeBox`, `offsetBox`, `overlapArea`, `boxArea` | Bounds and overlap primitives used by vector self-shadowing. |
| `occlusion(receiver, casters, light)` | Fraction of a receiver covered by nearer parts. |
| `shadowed(light, coverage)` | Applies bounded cast-shadow loss to a direct light level. |
| `AssembledPart` | A shape with depth, final light, direct light, and occlusion terms. |
| `assemble(shapes, light?)` | Depth-sorts shapes, lights them, and applies shadows cast by nearer parts. |

Assemblage is deliberately fail-soft for malformed geometry: non-finite
coordinates and degenerate directions use finite fallbacks so one bad part
cannot turn every rendered colour into NaN. `shade` still rejects malformed
colour strings, because silently drawing black would hide the source error.
