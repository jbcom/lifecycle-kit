import { describe, expect, it } from "vitest";
import * as forms from "../index.js";

/**
 * `./forms` is a real `package.json` "exports" subpath — the largest barrel
 * in the package, re-exporting `path.js`, both renderers, and all seven
 * rules. Every other test in this package imports the concrete modules
 * directly (`../path.js`, `../rules/taper.js`, ...), so this barrel itself
 * had never been proven to actually re-export what its own header promises.
 */
describe("the ./forms public entry point", () => {
	it("re-exports every compositional rule", () => {
		expect(typeof forms.taper).toBe("function");
		expect(typeof forms.repeat).toBe("function");
		expect(typeof forms.branch).toBe("function");
		expect(typeof forms.pair).toBe("function");
		expect(typeof forms.radiate).toBe("function");
		expect(typeof forms.enclose).toBe("function");
		expect(typeof forms.translate).toBe("function");
		expect(typeof forms.scale).toBe("function");
		expect(typeof forms.rotateTurns).toBe("function");
		expect(typeof forms.mirrorX).toBe("function");
	});

	it("re-exports path utilities", () => {
		expect(typeof forms.bounds).toBe("function");
		expect(typeof forms.groupByPart).toBe("function");
		expect(typeof forms.tagPath).toBe("function");
		expect(typeof forms.concatPaths).toBe("function");
	});

	it("re-exports both renderers", () => {
		expect(typeof forms.toSvgDocument).toBe("function");
		expect(typeof forms.toPathData).toBe("function");
		expect(typeof forms.drawShape).toBe("function");
		expect(typeof forms.drawPath).toBe("function");
	});

	// A real compositional chain, through the barrel end to end: build a unit
	// with `taper`, repeat it, and confirm the result is real bounded
	// geometry — proof the re-exported rules interoperate, not just exist.
	it("composes rules through the barrel into real bounded geometry", () => {
		const unit = forms.taper({
			from: 0.2,
			to: 0.1,
			bulgeAt: 0.5,
			length: 0.4,
			part: "seg",
		});
		const body = forms.repeat(unit, {
			axis: { x: 1, y: 0 },
			count: 3,
			spacing: 0.5,
			part: "seg",
		});
		const box = forms.bounds(body);
		expect(box).not.toBeNull();
		expect(forms.toSvgDocument(body, { minX: 0, minY: 0, width: 10, height: 10 })).toContain(
			"<svg",
		);
	});
});
