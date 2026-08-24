import { describe, expect, it } from "vitest";
import { bounds, EMPTY_PATH, groupByPart, type Path } from "../../path.js";
import { enclose } from "../../rules/enclose.js";

const body: Path = {
	shapes: [{ kind: "ellipse", center: { x: 0, y: 0 }, radiusX: 2, radiusY: 1 }],
};

describe("enclose", () => {
	it("adds one shape (the shell) to the enclosed unit", () => {
		const result = enclose(body, { thickness: 0.5, part: "elytra" });
		expect(result.shapes).toHaveLength(body.shapes.length + 1);
	});

	it("draws the enclosed body first and the shell last, so the shell is on top", () => {
		const result = enclose(body, { thickness: 0.5, part: "elytra" });
		expect(result.shapes[0]).toEqual(body.shapes[0]);
		expect(result.shapes[result.shapes.length - 1]).toMatchObject({
			tag: { part: "elytra" },
		});
	});

	it("sizes the shell to cover the enclosed bounds plus thickness exactly", () => {
		const result = enclose(body, { thickness: 0.5, part: "elytra" });
		const box = bounds(result);
		const bodyBox = bounds(body);
		expect(box).not.toBeNull();
		expect(bodyBox).not.toBeNull();
		if (!box || !bodyBox) return;
		expect(box.max.x).toBeCloseTo(bodyBox.max.x + 0.5, 6);
		expect(box.max.y).toBeCloseTo(bodyBox.max.y + 0.5, 6);
		expect(box.min.x).toBeCloseTo(bodyBox.min.x - 0.5, 6);
		expect(box.min.y).toBeCloseTo(bodyBox.min.y - 0.5, 6);
	});

	it("returns the unit unchanged when it has no bounds", () => {
		expect(enclose(EMPTY_PATH, { thickness: 1, part: "elytra" })).toEqual(EMPTY_PATH);
	});

	it("grows the shell continuously as the enclosed body grows", () => {
		const small = enclose(
			{
				shapes: [{ kind: "ellipse", center: { x: 0, y: 0 }, radiusX: 1, radiusY: 1 }],
			},
			{ thickness: 0.2, part: "shell" },
		);
		const large = enclose(
			{
				shapes: [{ kind: "ellipse", center: { x: 0, y: 0 }, radiusX: 2, radiusY: 2 }],
			},
			{ thickness: 0.2, part: "shell" },
		);
		const smallBox = bounds(small);
		const largeBox = bounds(large);
		expect(smallBox).not.toBeNull();
		expect(largeBox).not.toBeNull();
		if (!smallBox || !largeBox) return;
		expect(largeBox.max.x).toBeGreaterThan(smallBox.max.x);
	});

	it("tags the shell distinctly from whatever the enclosed unit was tagged", () => {
		const taggedBody: Path = {
			shapes: [
				{
					...body.shapes[0],
					tag: { part: "abdomen", index: 0 },
				} as Path["shapes"][number],
			],
		};
		const result = enclose(taggedBody, { thickness: 0.3, part: "elytra" });
		const groups = groupByPart(result);
		expect(groups.map((g) => g.part).sort()).toEqual(["abdomen", "elytra"]);
	});
});
