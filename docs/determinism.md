---
title: Determinism and validation
description: The package's invariants for reproducible procedural generation.
---

Given equal inputs, every Lifecycle Kit function returns equal output. Random
selection, time, storage, browser APIs, and rendering engines are intentionally
outside the package boundary.

## Input validation

Every exported function that accepts structured input validates its boundary.
That means malformed quantities, impossible fractions, and invalid geometry
fail early with an actionable error instead of yielding a downstream `NaN`.

Units are documented on the exported symbols in the [generated API reference](./api/README/).
In common use, temperatures are kelvin, scaling-law masses are kilograms, and
fractions such as tissue, exposure, and material properties are in `0..1`.

## Reproducible application code

If an application needs randomness, select or generate its seed outside
Lifecycle Kit and pass the resulting values as regular inputs. Persist those
inputs with the application state. This keeps simulation replay, tests, and
parallel generation predictable.
