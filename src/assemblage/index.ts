/**
 * 2.5D assembly, lighting and depth over composed forms.
 *
 * `lifecycle-forms` emits tagged outlines and says nothing about depth or
 * colour. This package places those outlines in depth bands, lights them from
 * a direction, and shades their fills — which is what makes a creature read as
 * grown rather than as parts stacked in a fixed order.
 *
 * Pure functions over geometry. No canvas, no Pixi, no DOM: a consumer renders
 * the result through whatever back end it already has, which is also what
 * makes this assertable numerically rather than by screenshot.
 */
export * from "./assemble.js";
