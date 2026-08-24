/**
 * Compositional rules that emit vector geometry.
 *
 * There is no `antForm`. An ant is `repeat` three times along an axis with a
 * narrow `taper` at the waist and `pair` legs at segment boundaries; a
 * centipede is the same rules with more repetitions; a beetle is the same
 * rules with `enclose` over the top. A catalogue of named forms caps variety
 * at however many forms someone had time to write, and that is the failure
 * this package exists to avoid.
 *
 * `Path` is the type at this package's outward seam — resolution-independent,
 * exactly comparable, and renderable by Pixi `Graphics` and SVG alike. See
 * `path.ts` for why each of those constraints shaped it the way it did.
 */
export * from "./path.js";
export * from "./render/pixi.js";
export * from "./render/svg.js";
export * from "./rules/branch.js";
export * from "./rules/enclose.js";
export * from "./rules/pair.js";
export * from "./rules/radiate.js";
export * from "./rules/repeat.js";
export * from "./rules/taper.js";
export * from "./rules/transform.js";
