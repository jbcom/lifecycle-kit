import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const temporary = mkdtempSync(join(tmpdir(), "lifecycle-kit-consumer-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (args, cwd) =>
	execFileSync(npm, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
try {
	const manifest = JSON.parse(readFileSync("package.json", "utf8"));
	const packed = JSON.parse(
		run(["pack", "--json", "--pack-destination", temporary], process.cwd()),
	);
	writeFileSync(join(temporary, "package.json"), JSON.stringify({ private: true, type: "module" }));
	run(
		[
			"install",
			resolve(temporary, packed[0].filename),
			"--userconfig=/dev/null",
			"--registry=https://registry.npmjs.org/",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
		],
		temporary,
	);
	const entryPoints = Object.keys(manifest.exports).filter((entry) => entry !== "./package.json");
	assert.equal(entryPoints.length, 6);
	const smoke = `import assert from 'node:assert/strict';
for (const entry of ${JSON.stringify(entryPoints)}) {
  const name = entry === '.' ? 'lifecycle-kit' : 'lifecycle-kit' + entry.slice(1);
  const exports = await import(name);
  assert.ok(Object.keys(exports).length > 0, name);
}
const { chem } = await import('lifecycle-kit');
assert.ok(Number.isFinite(chem.deriveBiochemistry({ Si: 30 }, 500).margin));
`;
	writeFileSync(join(temporary, "smoke.mjs"), smoke);
	execFileSync(process.execPath, [join(temporary, "smoke.mjs")], { stdio: "inherit" });
	console.log(`Packed consumer passed: ${entryPoints.length} ESM entry points`);
} finally {
	rmSync(temporary, { recursive: true, force: true });
}
