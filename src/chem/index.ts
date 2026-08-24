/**
 * The chemistry stage.
 *
 * Elements with real masses, valences, abundances and PBR properties;
 * biomolecules with real formulas; the backbone element derived from a world's
 * temperature and composition rather than assumed; and the metabolism that
 * turns food plus activity into tissue.
 *
 * `Composition` is the type at this package's outward seam — everything
 * downstream (pigment, forms) consumes it, and everything here produces it.
 */
export * from "./biochemistry.js";
export * from "./biomolecules.js";
export * from "./elements.js";
export * from "./metabolism.js";
