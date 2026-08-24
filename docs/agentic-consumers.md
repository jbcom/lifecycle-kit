---
title: Agentic consumers
description: A narrow, deterministic contract for coding agents and other automated systems that integrate Lifecycle Kit.
---

Lifecycle Kit is a good fit for automated integration because its public API is
pure, typed, and free of ambient state. That does not mean an agent should guess
at a body plan or silently repair invalid data. Treat this page as the operating
contract for any agent that writes code against the package.

## Choose the smallest public entry point

Import a documented package subpath, never an internal `src/` file:

```ts
import * as chem from "lifecycle-kit/chem";
import * as forms from "lifecycle-kit/forms";
import * as pigment from "lifecycle-kit/pigment";
import * as assemblage from "lifecycle-kit/assemblage";
```

Use the root `lifecycle-kit` entry only when namespaces are genuinely useful.
The package is ESM-only; CommonJS callers need dynamic `import()`. The
[generated API reference](./api-reference/) is authoritative for exact
signatures and units.

## Preserve the deterministic boundary

The package does not choose a seed, read time, access storage, mutate input, or
draw. Keep each of those responsibilities in the host application.

- Generate any random choices outside the library, persist the resulting
  parameters, and pass them in as ordinary values.
- Persist metabolic state through `writeMetabolicState()` and load through
  `readMetabolicState()`. Do not hand-roll a partial state serializer.
- Treat `Path`, palette, and assemblage output as derived render data. Rebuild
  them from persisted inputs instead of saving renderer objects.
- Call the same exported function with equal values when reproducibility is
  required; do not add retries or fallback randomness around a valid call.

## Let validation fail visibly

Structured inputs are checked at public boundaries. Fractions are commonly
`0..1`, temperatures are kelvin, and scaling-law masses are kilograms. Invalid
input throws a named `TypeError` or `RangeError`; surface that error to the
calling workflow with the original field name. Do not coerce `NaN`, negatives,
or out-of-range fractions into apparently valid biology.

The form stage also limits output size: `repeat` caps copies at 10,000 and
`branch` caps both recursive depth and total copies. When an input crosses a
limit, revise the requested form rather than retrying it.

## Build one transparent pipeline

Keep the causal chain readable in generated code. A full integration generally
has these stages:

1. Derive a world's backbone with `chem.deriveBiochemistry()`.
2. Advance one explicit `MetabolicState` with `chem.metabolise()` and calculate
   `chem.composition()`.
3. Record meals with `pigment.recordMeal()`, then derive pigments and a palette.
4. Create a `forms.Path` from named rules such as `taper`, `repeat`, and `pair`.
5. Pass `path.shapes` to `assemblage.assemble()` and adapt the returned data at
   the rendering edge.

The checked-in [`world-creature.mjs`](https://github.com/jbcom/lifecycle-kit/blob/main/examples/world-creature.mjs)
is the canonical runnable instance of that chain. Prefer adapting it over
inventing a new call sequence.

## Boundaries an agent must not cross

- Do not import unpublished internal modules or rely on generated `docs/api`
  files; the supported contract is the package export map and TSDoc-derived API
  reference.
- Do not introduce browser globals, clocks, hidden mutable module state, or a
  renderer dependency into the library to make an integration convenient.
- Do not flatten root exports: names such as `normalise` intentionally collide
  across stages, and namespaces preserve their provenance.
- Do not claim scientific precision beyond the cited scaling relationships and
  documented abstractions. This library is a deterministic procedural model,
  not a biological simulator or a source of medical, ecological, or safety
  decisions.

For rendering ownership and draw order, continue to [Render a creature](./rendering/).
