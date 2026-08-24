---
title: Render a creature
description: Turn Lifecycle Kit geometry and palette data into SVG, Pixi, or a custom renderer without losing deterministic draw order.
---

Lifecycle Kit creates visual data; your application chooses where and how to
draw it. Keep that boundary explicit: the library produces a `Path`, a
`PaletteRamp`, and depth-aware `AssembledPart` records, while the renderer owns
canvas lifetime, GPU objects, input, animation, and assets.

## Start with SVG

`forms.toSvgDocument()` is the smallest complete renderer. It serializes a
`Path` without a browser global, so it is useful for server rendering, saved
previews, test fixtures, and any application that can display an SVG string.

```ts
import { bounds, repeat, taper, toSvgDocument } from "lifecycle-kit/forms";

const segment = taper({ from: 0.22, to: 0.12, bulgeAt: 0.45, length: 0.48, part: "segment" });
const creature = repeat(segment, {
  axis: { x: 1, y: 0 },
  count: 4,
  spacing: 0.42,
  part: "segment",
});

const extent = bounds(creature);
if (!extent) throw new Error("expected the creature to contain a shape");

const svg = toSvgDocument(creature, {
  minX: extent.min.x - 0.1,
  minY: extent.min.y - 0.1,
  width: extent.max.x - extent.min.x + 0.2,
  height: extent.max.y - extent.min.y + 0.2,
});
```

The string is geometry only. Apply palette fills in the consumer when you need
one colour per part or material effects beyond SVG's basic path fill.

## Use Pixi without coupling the core

`forms.drawPath()` and `forms.drawShape()` accept a small `GraphicsLike`
surface rather than importing Pixi itself. Pass a compatible Pixi `Graphics`
instance from the application edge. This keeps Pixi out of the package's
runtime dependency graph and lets tests use a small recording implementation.

Do not put a Pixi `Graphics` object into simulation state. Persist the plain
inputs and rebuild the graphics when a scene is mounted.

## Draw assembled parts in order

`assemblage.assemble(shapes, light)` returns a new, depth-sorted list. Draw it
in the order returned: lower depth first, larger depth later. That makes nearer
parts land on top. Each item gives you the original `shape`, its `light` value,
and an `occlusion` measurement.

```ts
import { assemble, DEFAULT_LIGHT, shade } from "lifecycle-kit/assemblage";
import { derivePigments, paletteRamp } from "lifecycle-kit/pigment";

const pigments = derivePigments(tissue, diet, { uvExposure: 0.65, genetics: 0.55 });
const palette = paletteRamp(tissue, pigments, { metallic: 0.08, roughness: 0.72, opacity: 1 });

for (const part of assemble(creature.shapes, DEFAULT_LIGHT)) {
  const fill = shade(palette.pigment, part.light);
  drawShapeInYourRenderer(part.shape, { fill, depth: part.depth, occlusion: part.occlusion });
}
```

`shade()` accepts a hex colour and the assembled light level. If a renderer has
its own physically based material system, use `PaletteRamp` and the surface
properties directly instead; the library does not require its simple shading
helper.

## Coordinate and tag conventions

Form space is abstract, not pixels. A body conventionally runs along `+x`;
bilateral pairs are mirrored across that body axis. Scale or transform the
finished `Path` at the renderer boundary to fit a viewport.

Rules attach optional or explicit part tags such as `segment`, `leg`, or
`antenna`. Preserve a tag through your adapter when you need targeted animation,
materials, accessibility labels, or debugging. Do not infer anatomical meaning
from an array index: a tag is the stable semantic identity.

## Keep derived data disposable

`Path`, `PaletteRamp`, and `AssembledPart` are deterministic views. A durable
save should keep the world abundance/temperature, metabolic state, diet
history, and the rule parameters that created a form. Recompute visual output
after loading rather than serializing engine objects or trusting stale cached
geometry.
