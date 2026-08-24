import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			reporter: ["text", "json-summary"],
			thresholds: {
				statements: 99,
				branches: 95,
				functions: 100,
				lines: 99,
			},
		},
	},
});
