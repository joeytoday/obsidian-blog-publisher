import { MetadataCache, TFile, Vault } from "obsidian";
import { frontMatterToYaml } from "../utils/yaml";

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
		const yaml = frontMatterToYaml(newFrontMatter);
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

	private getFrontMatterSnapshot(): Record<string, unknown> {
		const cachedFrontMatter = {
			...(this.metadataCache.getCache(this.file?.path)?.frontmatter || {}),
		};
		delete cachedFrontMatter["position"];

		return { ...cachedFrontMatter, ...this.generatedFrontMatter };
	}
}
