/**
 * Colour from diet, exposure and chemistry, via real pigment biology.
 *
 * `Composition` (from `lifecycle-chem`) plus diet history and exposure go in;
 * a palette RAMP — several shading stops, not one flat tint — comes out.
 * `lifecycle-assemblage` consumes the ramp to shade a lit, self-shadowing
 * form.
 */
export * from "./dietHistory.js";
export * from "./palette.js";
export * from "./pigments.js";
