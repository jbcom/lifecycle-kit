/**
 * Rendering a `Path` to SVG.
 *
 * The second renderer exists to prove the seam is genuinely renderer-agnostic.
 * A path description that only Pixi could draw would be a Pixi API with extra
 * steps, and the claim would go untested until the day someone needed a dex
 * entry. Two back ends over one type is the assay for that claim.
 *
 * It is also the practical one for documentation, dex entries and test
 * fixtures: an SVG path string is a stable, diffable, human-readable artifact
 * that can be committed and eyeballed, which a canvas draw call is not.
 *
 * Emits strings, not DOM. This package is pure and node-testable — no
 * `document`, no DOM types — matching the sim-purity rule this package applies to
 * simulation code, and for the same reason: it keeps the tests fast and honest.
 */

import type { Ellipse, Path, Shape, SubPath } from "../path.js";

/**
 * Format a number for SVG output.
 *
 * Trailing-zero noise is trimmed so that geometry which is exactly equal
 * produces byte-identical strings — a fixture that changes only in its float
 * formatting is a false positive in review. `-0` is normalised to `0` for the
 * same reason: mirroring a rule about the y axis legitimately produces
 * negative zero, which is `Object.is`-distinct but geometrically identical and
 * has no business showing up as a diff.
 */
function num(n: number): string {
	if (Object.is(n, -0)) return "0";
	// Six decimals is well past what any renderer resolves and short of where
	// binary floating point starts printing its own artefacts.
	const rounded = Number(n.toFixed(6));
	return String(rounded);
}

/** The `d` attribute for one subpath. */
function subPathData(shape: SubPath): string {
	const parts: string[] = [`M ${num(shape.start.x)} ${num(shape.start.y)}`];
	for (const seg of shape.segments) {
		if (seg.kind === "line") {
			parts.push(`L ${num(seg.to.x)} ${num(seg.to.y)}`);
		} else if (seg.kind === "quadratic") {
			parts.push(
				`Q ${num(seg.control.x)} ${num(seg.control.y)} ${num(seg.to.x)} ${num(seg.to.y)}`,
			);
		} else {
			parts.push(
				`C ${num(seg.control1.x)} ${num(seg.control1.y)} ${num(seg.control2.x)} ${num(seg.control2.y)} ${num(seg.to.x)} ${num(seg.to.y)}`,
			);
		}
	}
	if (shape.closed) parts.push("Z");
	return parts.join(" ");
}

/**
 * An ellipse as path data.
 *
 * SVG has an `<ellipse>` element, but expressing every shape as one `<path>`
 * keeps the output uniform and lets a whole form be one element with one style.
 * Two arc halves are used because a single 360-degree arc is degenerate in
 * SVG — start and end coincide, so the renderer cannot tell which way round to
 * sweep and draws nothing. This is the well-known full-circle-arc trap, and it
 * is why the ellipse is not simply `A rx ry 0 1 0 ...` back to its start.
 */
function ellipseData(shape: Ellipse): string {
	const { center, radiusX, radiusY } = shape;
	const rx = Math.abs(radiusX);
	const ry = Math.abs(radiusY);
	const left = center.x - rx;
	const right = center.x + rx;
	return [
		`M ${num(left)} ${num(center.y)}`,
		`A ${num(rx)} ${num(ry)} 0 1 0 ${num(right)} ${num(center.y)}`,
		`A ${num(rx)} ${num(ry)} 0 1 0 ${num(left)} ${num(center.y)}`,
		"Z",
	].join(" ");
}

/** The `d` attribute for one shape. */
export function shapeToPathData(shape: Shape): string {
	return shape.kind === "ellipse" ? ellipseData(shape) : subPathData(shape);
}

/**
 * A whole path as a single `d` attribute.
 *
 * Subpaths concatenate, which is what `M` is for — one string can carry a body
 * and its six legs, and a consumer styles the result once.
 */
export function toPathData(path: Path): string {
	return path.shapes.map(shapeToPathData).join(" ");
}

/**
 * A complete standalone SVG document.
 *
 * The viewBox is derived from the path's own bounds by the caller rather than
 * assumed here, because a form's extent is a property of the form. Callers that
 * want a fixture usually want a fixed box so that a geometry change shows up as
 * a path diff rather than as a viewBox diff.
 */
export function toSvgDocument(
	path: Path,
	viewBox: { minX: number; minY: number; width: number; height: number },
): string {
	const box = `${num(viewBox.minX)} ${num(viewBox.minY)} ${num(viewBox.width)} ${num(viewBox.height)}`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}"><path d="${toPathData(path)}"/></svg>`;
}
