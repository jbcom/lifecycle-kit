import { describe, expect, it } from "vitest";
import * as assemblage from "../index.js";

/**
 * `./assemblage` is a real `package.json` "exports" subpath — the actual
 * surface a consumer of `@jbcom/lifecycle-kit/assemblage` imports from. Every
 * other test in this package imports the concrete modules (`../assemble.js`,
 * `../light.js`, `../shadow.js`) directly, which means the barrel itself —
 * whether the re-exports it promises are actually reachable through it — had
 * never been exercised. A broken or stale `export *` line here would still
 * pass every other test in this suite while silently breaking the public
 * import path.
 */
describe("the ./assemblage public entry point", () => {
	it("re-exports assemble and the AssembledPart shape it produces", () => {
		expect(typeof assemblage.assemble).toBe("function");
		const [part] = assemblage.assemble([
			{ kind: "ellipse", center: { x: 0, y: 0 }, radiusX: 0.2, radiusY: 0.2 },
		]);
		expect(Number.isFinite(part?.depth)).toBe(true);
		expect(Number.isFinite(part?.light)).toBe(true);
	});

	it("re-exports the light functions and DEFAULT_LIGHT", () => {
		expect(typeof assemblage.litness).toBe("function");
		expect(typeof assemblage.shade).toBe("function");
		expect(typeof assemblage.normalise).toBe("function");
		expect(assemblage.DEFAULT_LIGHT).toBeDefined();
		expect(assemblage.shade("#8899aa", 0.5)).toMatch(/^#[0-9a-f]{6}$/i);
	});

	it("re-exports the shadow/box functions", () => {
		expect(typeof assemblage.shapeBox).toBe("function");
		expect(typeof assemblage.occlusion).toBe("function");
		expect(typeof assemblage.shadowed).toBe("function");
		expect(typeof assemblage.boxArea).toBe("function");
		expect(typeof assemblage.overlapArea).toBe("function");
		expect(typeof assemblage.offsetBox).toBe("function");

		const box = assemblage.shapeBox({
			kind: "ellipse",
			center: { x: 0, y: 0 },
			radiusX: 1,
			radiusY: 1,
		});
		expect(assemblage.boxArea(box)).toBeCloseTo(4, 6);
	});
});
