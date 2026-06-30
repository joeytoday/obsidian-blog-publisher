import { FrontMatterCache } from "obsidian";
import {
	generateUrlPath,
	getRewrittenPath,
	getRewriteRules,
	PathRewriteRules,
} from "../utils/utils";
import { frontMatterToYaml } from "../utils/yaml";
import BlogPublisherSettings from "../models/settings";
import { PublishFile } from "../publishFile/PublishFile";

export type TFrontmatter = Record<string, unknown> & {
	tags?: string;
};

type TPublishedFrontMatter = Record<string, unknown> & {
	tags?: string[];
	permalink?: string;
};

export class FrontmatterCompiler {
	private readonly settings: BlogPublisherSettings;
	private readonly rewriteRules: PathRewriteRules;

	constructor(settings: BlogPublisherSettings) {
		this.settings = settings;
		this.rewriteRules = getRewriteRules(settings.pathRewriteRules);
	}

	compile(file: PublishFile, frontmatter: FrontMatterCache): string {
		const fileFrontMatter = { ...frontmatter };
		delete fileFrontMatter["position"];

		let publishedFrontMatter: TPublishedFrontMatter = {
			...fileFrontMatter,
			"pub-blog": true,
		};

		publishedFrontMatter = this.addPermalink(
			fileFrontMatter,
			publishedFrontMatter,
			file.getPath(),
		);

		publishedFrontMatter = this.addBlogPath(
			publishedFrontMatter,
			file.getPath(),
		);

		publishedFrontMatter = this.addPageTags(
			fileFrontMatter,
			publishedFrontMatter,
		);

		const frontMatterString = frontMatterToYaml(
			publishedFrontMatter as Record<string, unknown>,
		);

		return `${frontMatterString}\n`;
	}

	private addPermalink(
		baseFrontMatter: TFrontmatter,
		newFrontMatter: TPublishedFrontMatter,
		filePath: string,
	) {
		const publishedFrontMatter = { ...newFrontMatter };

		const rewrittenPath = getRewrittenPath(filePath, this.rewriteRules);

		if (baseFrontMatter?.permalink) {
			publishedFrontMatter["permalink"] = baseFrontMatter.permalink as string;
		} else {
			publishedFrontMatter["permalink"] =
				"/" + generateUrlPath(rewrittenPath, true);
		}

		return publishedFrontMatter;
	}

	private addBlogPath(newFrontMatter: TPublishedFrontMatter, filePath: string) {
		const publishedFrontMatter = { ...newFrontMatter };
		const rewrittenPath = getRewrittenPath(filePath, this.rewriteRules);
		publishedFrontMatter["blog-path"] = rewrittenPath;

		return publishedFrontMatter;
	}

	private addPageTags(
		fileFrontMatter: TFrontmatter,
		publishedFrontMatterWithoutTags: TPublishedFrontMatter,
	) {
		const publishedFrontMatter = { ...publishedFrontMatterWithoutTags };

		if (fileFrontMatter) {
			const tags =
				(typeof fileFrontMatter["tags"] === "string"
					? fileFrontMatter["tags"].split(/,\s*/)
					: fileFrontMatter["tags"]) || [];

			if (tags.length > 0) {
				publishedFrontMatter["tags"] = tags;
			}
		}

		return publishedFrontMatter;
	}
}
