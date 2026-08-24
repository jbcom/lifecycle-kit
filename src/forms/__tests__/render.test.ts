import { describe, expect, it } from "vitest";
import { type Path, tagPath } from "../path.js";
import { drawPath, type GraphicsLike } from "../render/pixi";
import { toPathData, toSvgDocument } from "../render/svg";

/**
 * Two back ends over one type. This file is the assay for the claim that the
 * path description is genuinely renderer-agnostic rather than a Pixi API with
 * extra steps — if a shape can only be expressed by one of them, it fails here
 * rather than on the day someone needs a dex entry.
 */

/** Records the call sequence a real `Graphics` would receive. */
function recorder(): GraphicsLike & { calls: string[] } {
	const calls: string[] = [];
	const rec =
		(name: string) =>
		(...args: number[]) => {
			calls.push(`${name}(${args.join(",")})`);
		};
	return {
		calls,
		moveTo: rec("moveTo"),
		lineTo: rec("lineTo"),
		quadraticCurveTo: rec("quadraticCurveTo"),
		bezierCurveTo: rec("bezierCurveTo"),
		ellipse: rec("ellipse"),
		closePath: rec("closePath"),
	};
}

/** Every segment kind and both shape kinds, so nothing is left unexercised. */
const EVERY_FEATURE: Path = {
	shapes: [
		{
			kind: "subpath",
			start: { x: 0, y: 0 },
			segments: [
				{ kind: "line", to: { x: 1, y: 0 } },
				{
					kind: "quadratic",
					control: { x: 2, y: 1 },
					to: { x: 3, y: 0 },
				},
				{
					kind: "cubic",
					control1: { x: 4, y: -1 },
					control2: { x: 5, y: -1 },
					to: { x: 6, y: 0 },
				},
			],
			closed: true,
		},
		{
			kind: "ellipse",
			center: { x: 2, y: 2 },
			radiusX: 1,
			radiusY: 0.5,
		},
	],
};

describe("pixi renderer", () => {
	it("issues the exact call sequence for every segment kind", () => {
		const g = recorder();
		drawPath(g, EVERY_FEATURE);
		expect(g.calls).toEqual([
			"moveTo(0,0)",
			"lineTo(1,0)",
			"quadraticCurveTo(2,1,3,0)",
			"bezierCurveTo(4,-1,5,-1,6,0)",
			"closePath()",
			"ellipse(2,2,1,0.5)",
		]);
	});

	/** Explicit closure again, at the renderer boundary this time. */
	it("omits closePath for an open run", () => {
		const g = recorder();
		drawPath(g, {
			shapes: [
				{
					kind: "subpath",
					start: { x: 0, y: 0 },
					segments: [{ kind: "line", to: { x: 1, y: 1 } }],
					closed: false,
				},
			],
		});
		expect(g.calls).toEqual(["moveTo(0,0)", "lineTo(1,1)"]);
	});

	/**
	 * Draw order is shape order, because a directional light treats later
	 * shapes as nearer. A renderer that reordered would break lighting.
	 */
	it("draws shapes in order", () => {
		const g = recorder();
		drawPath(g, {
			shapes: [
				{ kind: "ellipse", center: { x: 1, y: 0 }, radiusX: 1, radiusY: 1 },
				{ kind: "ellipse", center: { x: 2, y: 0 }, radiusX: 1, radiusY: 1 },
			],
		});
		expect(g.calls).toEqual(["ellipse(1,0,1,1)", "ellipse(2,0,1,1)"]);
	});

	it("emits nothing for an empty path", () => {
		const g = recorder();
		drawPath(g, { shapes: [] });
		expect(g.calls).toEqual([]);
	});
});

describe("svg renderer", () => {
	it("emits the exact path data for every segment kind", () => {
		expect(toPathData(EVERY_FEATURE)).toBe(
			"M 0 0 L 1 0 Q 2 1 3 0 C 4 -1 5 -1 6 0 Z " + "M 1 2 A 1 0.5 0 1 0 3 2 A 1 0.5 0 1 0 1 2 Z",
		);
	});

	it("omits the close command for an open run", () => {
		expect(
			toPathData({
				shapes: [
					{
						kind: "subpath",
						start: { x: 0, y: 0 },
						segments: [{ kind: "line", to: { x: 1, y: 1 } }],
						closed: false,
					},
				],
			}),
		).toBe("M 0 0 L 1 1");
	});

	/**
	 * A full circle drawn as one 360-degree arc is degenerate in SVG and
	 * renders as nothing. Two half arcs is the fix, and this pins it.
	 */
	it("draws an ellipse as two arcs so it does not vanish", () => {
		const data = toPathData({
			shapes: [{ kind: "ellipse", center: { x: 0, y: 0 }, radiusX: 2, radiusY: 2 }],
		});
		expect(data.match(/A /g)).toHaveLength(2);
		expect(data).toBe("M -2 0 A 2 2 0 1 0 2 0 A 2 2 0 1 0 -2 0 Z");
	});

	/**
	 * Mirroring about an axis legitimately produces -0, which is geometrically
	 * identical to 0 and must not show up as a fixture diff.
	 */
	it("normalises negative zero", () => {
		expect(
			toPathData({
				shapes: [
					{
						kind: "subpath",
						start: { x: -0, y: -0 },
						segments: [{ kind: "line", to: { x: 1, y: -0 } }],
						closed: false,
					},
				],
			}),
		).toBe("M 0 0 L 1 0");
	});

	/** Float formatting noise is a false positive in review, so it is trimmed. */
	it("does not emit trailing-zero noise", () => {
		expect(toPathData(line(0.1 + 0.2, 0, 1, 0))).toBe("M 0.3 0 L 1 0");
	});

	it("wraps a path in a document with the given viewBox", () => {
		expect(
			toSvgDocument(line(0, 0, 1, 1), {
				minX: 0,
				minY: 0,
				width: 2,
				height: 2,
			}),
		).toBe(
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2">' +
				'<path d="M 0 0 L 1 1"/></svg>',
		);
	});
});

describe("part tags are invisible to renderers", () => {
	/**
	 * A tag is metadata for `lifecycle-assemblage`, not geometry. Both back ends
	 * must draw a tagged path byte-identically to an untagged one, or the tag
	 * has leaked out of the layer that owns it.
	 */
	it("draws a tagged path exactly like an untagged one", () => {
		const plain = recorder();
		const tagged = recorder();
		drawPath(plain, EVERY_FEATURE);
		drawPath(tagged, tagPath(EVERY_FEATURE, "thorax", 1));
		expect(tagged.calls).toEqual(plain.calls);
		expect(toPathData(tagPath(EVERY_FEATURE, "thorax", 1))).toBe(toPathData(EVERY_FEATURE));
	});
});

describe("the two renderers agree", () => {
	/**
	 * The actual agnosticism assay: both back ends must consume every shape the
	 * type can express, and neither may need a feature the other lacks. Counting
	 * emitted commands is the honest cross-check available without a rasteriser.
	 */
	it("both consume every shape in the vocabulary", () => {
		const g = recorder();
		drawPath(g, EVERY_FEATURE);
		const svg = toPathData(EVERY_FEATURE);

		// One moveTo per subpath, one ellipse call per ellipse.
		expect(g.calls.filter((c) => c.startsWith("moveTo"))).toHaveLength(1);
		expect(g.calls.filter((c) => c.startsWith("ellipse"))).toHaveLength(1);
		// SVG: one M per subpath plus one opening the ellipse.
		expect(svg.match(/M /g)).toHaveLength(2);

		expect(g.calls.filter((c) => c.startsWith("lineTo"))).toHaveLength(1);
		expect(svg.match(/L /g)).toHaveLength(1);
		expect(g.calls.filter((c) => c.startsWith("quadraticCurveTo"))).toHaveLength(1);
		expect(svg.match(/Q /g)).toHaveLength(1);
		expect(g.calls.filter((c) => c.startsWith("bezierCurveTo"))).toHaveLength(1);
		expect(svg.match(/C /g)).toHaveLength(1);
	});
});

function line(x0: number, y0: number, x1: number, y1: number): Path {
	return {
		shapes: [
			{
				kind: "subpath",
				start: { x: x0, y: y0 },
				segments: [{ kind: "line", to: { x: x1, y: y1 } }],
				closed: false,
			},
		],
	};
}
