import { MetadataCache, TFile, Vault } from "obsidian";

const FRONTMATTER_REGEX = /^\s*?---[\r\n]([\s\S]*?)[\r\n]---/g;

export class ObsidianFrontMatterEngine {
	private generatedFrontMatter: Record<string, unknown> = {};
	private metadataCache: MetadataCache;
	private vault: Vault;
	private file: TFile;

	constructor(vault: Vault, metadataCache: MetadataCache, file: TFile) {
		this.metadataCache = metadataCache;
		this.vault = vault;
		this.file = file;
	}

	set(key: string, value: unknown): this {
		this.generatedFrontMatter[key] = value;

		return this;
	}

	remove(key: string): this {
		this.generatedFrontMatter[key] = undefined;

		return this;
	}

	get(key: string): unknown {
		return this.getFrontMatterSnapshot()[key];
	}

	async apply(): Promise<void> {
		const newFrontMatter = this.getFrontMatterSnapshot();
		const content = await this.vault.cachedRead(this.file);
		const yaml = this.frontMatterToYaml(newFrontMatter);
		let newContent = "";

		if (content.match(FRONTMATTER_REGEX)) {
			newContent = content.replace(FRONTMATTER_REGEX, () => {
				return yaml;
			});
		} else {
			newContent = `${yaml}\n${content}`;
		}
		await this.vault.modify(this.file, newContent);
	}

	private formatYamlValue(value: unknown, indent = ""): string {
		if (value === null) {
			return "null";
		}

		if (typeof value === "boolean") {
			return value ? "true" : "false";
		}

		if (typeof value === "number") {
			return Number.isFinite(value) ? String(value) : "null";
		}

		if (value instanceof Date) {
			return `"${value.toISOString()}"`;
		}

		if (Array.isArray(value)) {
			if (value.length === 0) {
				return "[]";
			}

			return (
				"\n" +
				value
					.map((item) => {
						if (
							typeof item === "object" &&
							item !== null &&
							!Array.isArray(item)
						) {
							const entries = Object.entries(item);

							if (entries.length === 0) {
								return `${indent}  - {}`;
							}
							const [firstK, firstV] = entries[0];

							let line = `${indent}  - ${firstK}: ${this.formatYamlValue(
								firstV,
								indent + "    ",
							)}`;

							for (let i = 1; i < entries.length; i++) {
								line += `\n${indent}    ${
									entries[i][0]
								}: ${this.formatYamlValue(entries[i][1], indent + "    ")}`;
							}

							return line;
						}

						return `${indent}  - ${this.formatYamlValue(item, indent + "  ")}`;
					})
					.join("\n")
			);
		}

		if (typeof value === "object") {
			const entries = Object.entries(value as Record<string, unknown>);

			if (entries.length === 0) {
				return "{}";
			}

			return (
				"\n" +
				entries
					.map(
						([k, v]) =>
							`${indent}  ${k}: ${this.formatYamlValue(v, indent + "  ")}`,
					)
					.join("\n")
			);
		}

		const str = String(value);

		if (
			str === "" ||
			/[:#\]{}&'*!|>"%@`,[]/.test(str) ||
			/^\s|\s$/.test(str) ||
			/[\r\n]/.test(str) ||
			/^(?:true|false|null|yes|no|on|off|~)$/i.test(str) ||
			/^[-+]?\d+\.?\d*$/.test(str) ||
			/^\d{4}-\d{2}-\d{2}/.test(str)
		) {
			return `"${str
				.replace(/\\/g, "\\\\")
				.replace(/"/g, '\\"')
				.replace(/\n/g, "\\n")
				.replace(/\r/g, "\\r")
				.replace(/\t/g, "\\t")}"`;
		}

		return str;
	}

	private frontMatterToYaml(frontMatter: Record<string, unknown>): string {
		for (const key of Object.keys(frontMatter)) {
			if (frontMatter[key] === undefined) {
				delete frontMatter[key];
			}
		}

		if (Object.keys(frontMatter).length === 0) {
			return "";
		}
		let yaml = "---\n";

		for (const key of Object.keys(frontMatter)) {
			yaml += `${key}: ${this.formatYamlValue(frontMatter[key])}\n`;
		}
		yaml += "---";

		return yaml;
	}

	private getFrontMatterSnapshot(): Record<string, unknown> {
		const cachedFrontMatter = {
			...(this.metadataCache.getCache(this.file?.path)?.frontmatter || {}),
		};
		delete cachedFrontMatter["position"];

		return { ...cachedFrontMatter, ...this.generatedFrontMatter };
	}
}
