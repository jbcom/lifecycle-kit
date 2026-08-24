---
title: Pipeline architecture
description: How Lifecycle Kit's independent stages exchange renderer-neutral data.
---

Lifecycle Kit is a library of five independent stages, not a framework. A
consumer owns scheduling, persistence, seeding, and final rendering; the
package owns deterministic transformation and validation of the data it
receives.

## Boundary types

The important handoffs are plain data:

- `Composition` represents tissue fractions.
- `Path` represents vector geometry from the forms stage.
- `PaletteRamp` contains shadow, base, pigment, and highlight colours.
- `AssembledPart` carries geometry, depth, light, and occlusion ready for a renderer.

The stages deliberately do not own a DOM, canvas, game-engine object, clock,
or random-number source. A game can therefore persist a state as JSON, replay
it, or process multiple creatures concurrently without cross-talk.

## Renderer adapters

The forms package includes SVG and Pixi adapters as convenience renderers, but
the core geometry and assemblage outputs are renderer-neutral. Keep engine
objects at the edge of an application: feed plain Lifecycle Kit inputs in and
adapt its output at the final drawing boundary.

## Persistence

Metabolic state is the one deliberately evolving state model. Use
`writeMetabolicState()` before persisting it; the writer rejects invalid state.
Use `readMetabolicState()` when loading; it migrates known partial legacy
records and falls back to a fresh newborn state for corrupt input.
