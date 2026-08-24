import { bounds, concatPaths, type Path, tagPath } from "../path.js";
import {
	params as checkParams,
	path as checkPath,
	finite,
	partName,
} from "../validate.js";

export interface EncloseParams {
	/** How far the shell extends past the enclosed geometry's bounds. */
	readonly thickness: number;
	readonly part: string;
}

/**
 * Add a shell around a unit's own bounds.
 *
 * The rule that turns a beetle-shaped `repeat`+`pair` body into an actual
 * beetle: an elytra is not a different body plan, it is the same insect body
 * with a shell rule applied over the top. `enclose` reads the enclosed unit's
 * bounds and emits an ellipse sized to just cover them plus `thickness`, so
 * the shell is a continuous function of what it encloses — a body built
 * slightly bigger gets a slightly bigger shell, with no separate size table.
 *
 * Draw order matters here more than in the other rules: the shell is emitted
 * AFTER the enclosed geometry, so it draws on top the way a beetle's elytra
 * actually occludes the body beneath it. A consumer that wants the body
 * fully hidden strokes and fills the shell opaque; one that wants a visible
 * body under a translucent shell (a cicada's wing case) controls that with
 * fill alpha, which is `lifecycle-assemblage`'s job, not this rule's.
 *
 * An empty unit encloses nothing and is returned unchanged — there is no
 * "shell with no bounds" to draw.
 */
export function enclose(unit: Path, params: EncloseParams): Path {
	checkParams("enclose", params);
	checkPath("enclose", "unit", unit);
	finite("enclose", "thickness", params.thickness);
	partName("enclose", "part", params.part);

	const box = bounds(unit);
	if (!box) return unit;

	const centerX = (box.min.x + box.max.x) / 2;
	const centerY = (box.min.y + box.max.y) / 2;
	const radiusX = (box.max.x - box.min.x) / 2 + params.thickness;
	const radiusY = (box.max.y - box.min.y) / 2 + params.thickness;

	const shell = tagPath(
		{
			shapes: [
				{
					kind: "ellipse",
					center: { x: centerX, y: centerY },
					radiusX,
					radiusY,
				},
			],
		},
		params.part,
		0,
	);

	return concatPaths(unit, shell);
}
