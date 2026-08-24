import { access, readFile } from "node:fs/promises";
import ts from "typescript";

const docs = await readFile(new URL("../docs/API.md", import.meta.url), "utf8");
const stages = {
	assemblage: await import("../dist/esm/assemblage/index.js"),
	"bio-laws": await import("../dist/esm/bio-laws/index.js"),
	chem: await import("../dist/esm/chem/index.js"),
	forms: await import("../dist/esm/forms/index.js"),
	pigment: await import("../dist/esm/pigment/index.js"),
};

const undocumented = [];
for (const [stage, exports] of Object.entries(stages)) {
	for (const name of Object.keys(exports)) {
		if (!docs.includes(`\`${name}`)) undocumented.push(`${stage}: ${name}`);
	}
}

if (undocumented.length > 0) {
	throw new Error(`docs/API.md is missing public runtime exports:\n${undocumented.join("\n")}`);
}

console.log(
	`API reference covers ${Object.values(stages).flatMap(Object.keys).length} runtime exports.`,
);

const declarationEntries = Object.keys(stages).map(
	(stage) => new URL(`../dist/esm/${stage}/index.d.ts`, import.meta.url).pathname,
);
const program = ts.createProgram(declarationEntries, {
	module: ts.ModuleKind.NodeNext,
	moduleResolution: ts.ModuleResolutionKind.NodeNext,
});
const checker = program.getTypeChecker();
const undocumentedDeclarations = [];
let declarationCount = 0;
for (const entry of declarationEntries) {
	const source = program.getSourceFile(entry);
	const moduleSymbol = source && checker.getSymbolAtLocation(source);
	if (!moduleSymbol) throw new Error(`could not inspect declarations at ${entry}`);
	for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
		declarationCount += 1;
		if (!docs.includes(`\`${symbol.name}`)) {
			undocumentedDeclarations.push(`${entry}: ${symbol.name}`);
		}
	}
}

if (undocumentedDeclarations.length > 0) {
	throw new Error(
		`docs/API.md is missing public type or runtime exports:\n${undocumentedDeclarations.join("\n")}`,
	);
}

console.log(`API reference covers all ${declarationCount} public runtime and type exports.`);

const markdownFiles = [
	"README.md",
	"CONTRIBUTING.md",
	"SECURITY.md",
	"docs/API.md",
	"examples/README.md",
];
const brokenLinks = [];
for (const relative of markdownFiles) {
	const file = new URL(`../${relative}`, import.meta.url);
	const markdown = await readFile(file, "utf8");
	for (const match of markdown.matchAll(/\]\((\.\.?\/[^)#]+)(?:#[^)]+)?\)/g)) {
		const target = match[1];
		if (!target) continue;
		try {
			await access(new URL(target, file));
		} catch {
			brokenLinks.push(`${relative}: ${target}`);
		}
	}
}

if (brokenLinks.length > 0) {
	throw new Error(`Markdown contains broken local links:\n${brokenLinks.join("\n")}`);
}

console.log(`Local links resolve across ${markdownFiles.length} maintained Markdown files.`);
