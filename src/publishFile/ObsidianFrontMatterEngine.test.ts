import { ObsidianFrontMatterEngine } from "./ObsidianFrontMatterEngine";

type WriteCapture = {
	content: string;
};

function createEngine(
	fileContent: string,
	frontmatter: Record<string, unknown> | null = {},
) {
	const capture: WriteCapture = { content: "" };

	const fakeFile = { path: "test.md", name: "test" } as never;

	const fakeVault = {
		cachedRead: async () => fileContent,
		modify: async (_file: never, content: string) => {
			capture.content = content;
		},
	} as never;

	const fakeMetadataCache = {
		getCache: (_path: string) => (frontmatter ? { frontmatter } : {}),
	} as never;

	const engine = new ObsidianFrontMatterEngine(
		fakeVault,
		fakeMetadataCache,
		fakeFile,
	);

	return { engine, capture };
}

function extractFrontMatter(content: string): string {
	const match = content.match(/^---\n([\s\S]*?)\n---/);

	return match ? match[1] : "";
}

describe("ObsidianFrontMatterEngine", () => {
	describe("formatYamlValue (via apply)", () => {
		it("formats null as null", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("value", null);
			await engine.apply();

			expect(extractFrontMatter(capture.content)).toContain("value: null");
		});

		it("formats booleans", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("yes", true);
			engine.set("no", false);
			await engine.apply();
			const yaml = extractFrontMatter(capture.content);
			expect(yaml).toContain("yes: true");
			expect(yaml).toContain("no: false");
		});

		it("formats numbers", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("int", 42);
			engine.set("float", 3.14);
			await engine.apply();
			const yaml = extractFrontMatter(capture.content);
			expect(yaml).toContain("int: 42");
			expect(yaml).toContain("float: 3.14");
		});

		it("formats NaN as null", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("nan", NaN);
			await engine.apply();

			expect(extractFrontMatter(capture.content)).toContain("nan: null");
		});

		it("formats Date as ISO string in quotes", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			const date = new Date("2026-06-26T10:00:00.000Z");
			engine.set("date", date);
			await engine.apply();

			expect(extractFrontMatter(capture.content)).toContain(
				'date: "2026-06-26T10:00:00.000Z"',
			);
		});

		it("formats empty array as []", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("tags", []);
			await engine.apply();

			expect(extractFrontMatter(capture.content)).toContain("tags: []");
		});

		it("formats array of primitives", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("tags", ["a", "b"]);
			await engine.apply();
			const yaml = extractFrontMatter(capture.content);
			expect(yaml).toContain("- a");
			expect(yaml).toContain("- b");
		});

		it("formats empty object as {}", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("meta", {});
			await engine.apply();

			expect(extractFrontMatter(capture.content)).toContain("meta: {}");
		});

		it("formats nested object with indentation", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("meta", { key: "value" });
			await engine.apply();
			const yaml = extractFrontMatter(capture.content);
			expect(yaml).toContain("meta:");
			expect(yaml).toContain("key: value");
		});

		it("quotes strings containing colons", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("title", "hello: world");
			await engine.apply();

			expect(extractFrontMatter(capture.content)).toContain(
				'title: "hello: world"',
			);
		});

		it("quotes boolean-like strings", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("flag", "true");
			engine.set("flag2", "false");
			engine.set("flag3", "null");
			engine.set("flag4", "yes");
			engine.set("flag5", "no");
			await engine.apply();
			const yaml = extractFrontMatter(capture.content);
			expect(yaml).toContain('flag: "true"');
			expect(yaml).toContain('flag2: "false"');
			expect(yaml).toContain('flag3: "null"');
			expect(yaml).toContain('flag4: "yes"');
			expect(yaml).toContain('flag5: "no"');
		});

		it("quotes number-like strings", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("num", "42");
			engine.set("neg", "-3.14");
			await engine.apply();
			const yaml = extractFrontMatter(capture.content);
			expect(yaml).toContain('num: "42"');
			expect(yaml).toContain('neg: "-3.14"');
		});

		it("quotes date-like strings", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("date", "2026-06-26");
			await engine.apply();

			expect(extractFrontMatter(capture.content)).toContain(
				'date: "2026-06-26"',
			);
		});

		it("escapes backslashes and quotes in strings", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("path", 'hello"world\\test');
			await engine.apply();

			expect(extractFrontMatter(capture.content)).toContain(
				'path: "hello\\"world\\\\test"',
			);
		});

		it("escapes newlines in strings", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("desc", "line1\nline2");
			await engine.apply();

			expect(extractFrontMatter(capture.content)).toContain(
				'desc: "line1\\nline2"',
			);
		});

		it("does not quote simple strings", async () => {
			const { engine, capture } = createEngine("---\n---\n");
			engine.set("title", "Hello World");
			await engine.apply();

			expect(extractFrontMatter(capture.content)).toContain(
				"title: Hello World",
			);
		});

		it("preserves existing frontmatter and merges new values", async () => {
			const { engine, capture } = createEngine(
				"---\nexisting: value\n---\nbody",
				{ existing: "value" },
			);
			engine.set("pub-blog", true);
			await engine.apply();
			const yaml = extractFrontMatter(capture.content);
			expect(yaml).toContain("existing: value");
			expect(yaml).toContain("pub-blog: true");
		});

		it("formats array of objects", async () => {
			const { engine, capture } = createEngine("---\n---\n");

			engine.set("items", [
				{ name: "first", value: 1 },
				{ name: "second", value: 2 },
			]);
			await engine.apply();
			const yaml = extractFrontMatter(capture.content);
			expect(yaml).toContain("- name: first");
			expect(yaml).toContain("value: 1");
			expect(yaml).toContain("- name: second");
			expect(yaml).toContain("value: 2");
		});
	});
});
