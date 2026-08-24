/**
 * Rendering a `Path` through Pixi `Graphics`.
 *
 * This package does not depend on `pixi.js` and will not. The renderer is
 * written against a structural interface describing the handful of
 * `GraphicsContext` methods it calls, so a real `Graphics` satisfies it by
 * having the right shape and the library stays installable by a consumer that
 * has no Pixi at all — SVG-only documentation tooling, for instance.
 *
 * It also makes the renderer testable without a canvas, a GPU or a headless
 * browser: a recording object with the same method names captures the exact
 * call sequence, so the tests assert what would be drawn rather than what a
 * screenshot looked like. That is the same argument as vectors-over-pixels,
 * applied one level down.
 *
 * The signatures below are taken from Pixi 8.18.1's `GraphicsContext`.
 */

import type { Path, Shape } from "../path.js";

/**
 * The subset of Pixi's `GraphicsContext` a path can possibly need.
 *
 * Methods return `unknown` rather than `this` because Pixi returns itself for
 * chaining and this renderer never chains — accepting a wider return type is
 * what lets a real `Graphics` satisfy the interface without the consumer
 * casting anything.
 */
export interface GraphicsLike {
	moveTo(x: number, y: number): unknown;
	lineTo(x: number, y: number): unknown;
	quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): unknown;
	bezierCurveTo(
		cp1x: number,
		cp1y: number,
		cp2x: number,
		cp2y: number,
		x: number,
		y: number,
	): unknown;
	ellipse(x: number, y: number, radiusX: number, radiusY: number): unknown;
	closePath(): unknown;
}

/**
 * Issue one shape's geometry.
 *
 * Deliberately geometry only — no `fill()` and no `stroke()`. A form rule says
 * where the outline is; colour comes from `lifecycle-pigment` and light from
 * `lifecycle-assemblage`. The consumer calls `fill`/`stroke` itself after this
 * returns, which is exactly the pattern the existing renderers already
 * use (`g.ellipse(...).fill({ color, alpha })`) and so requires no rewrite.
 */
export function drawShape(g: GraphicsLike, shape: Shape): void {
	if (shape.kind === "ellipse") {
		g.ellipse(shape.center.x, shape.center.y, shape.radiusX, shape.radiusY);
		return;
	}

	g.moveTo(shape.start.x, shape.start.y);
	for (const seg of shape.segments) {
		if (seg.kind === "line") {
			g.lineTo(seg.to.x, seg.to.y);
		} else if (seg.kind === "quadratic") {
			g.quadraticCurveTo(seg.control.x, seg.control.y, seg.to.x, seg.to.y);
		} else {
			g.bezierCurveTo(
				seg.control1.x,
				seg.control1.y,
				seg.control2.x,
				seg.control2.y,
				seg.to.x,
				seg.to.y,
			);
		}
	}
	if (shape.closed) g.closePath();
}

/** Issue a whole path's geometry, in order. Order is draw order. */
export function drawPath(g: GraphicsLike, path: Path): void {
	for (const shape of path.shapes) drawShape(g, shape);
}
