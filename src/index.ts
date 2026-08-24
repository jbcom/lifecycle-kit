/**
 * lifecycle-kit — the stage stack.
 *
 * Chemistry, biological scaling laws, compositional form, pigment, and 2.5D
 * assembly. Previously six separate packages; they are one system and their own
 * READMEs described them that way, so they ship as one package with subpath
 * exports.
 *
 * Prefer importing a stage directly — it keeps the bundle small and makes the
 * provenance of a symbol obvious:
 *
 *   import { ... } from "lifecycle-kit/chem";
 *   import { ... } from "lifecycle-kit/forms";
 *
 * This root module re-exports the stages as namespaces rather than flatly.
 * A flat re-export is not possible without silently shadowing: `chem` and
 * `assemblage` both export `normalise`, so merging them would make which one
 * you get depend on declaration order. Namespacing keeps both reachable and
 * unambiguous — a collision the six-package split had hidden.
 */
export * as assemblage from "./assemblage/index.js";
export * as bioLaws from "./bio-laws/index.js";
export * as chem from "./chem/index.js";
export * as forms from "./forms/index.js";
export * as pigment from "./pigment/index.js";
