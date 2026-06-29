import { FrontMatterCache, TFile } from "obsidian";
import BlogPublisherSettings from "../models/settings";
import { DateTime } from "luxon";

export class FileMetadataManager {
	file: TFile;
	frontmatter: FrontMatterCache;
	settings: BlogPublisherSettings;

	constructor(
		file: TFile,
		frontmatter: FrontMatterCache,
		settings: BlogPublisherSettings,
	) {
		this.file = file;
		this.frontmatter = frontmatter;
		this.settings = settings;
	}

	getCreatedAt(): string {
		return DateTime.fromMillis(this.file.stat.ctime).toISO() as string;
	}

	getUpdatedAt(): string {
		return DateTime.fromMillis(this.file.stat.mtime).toISO() as string;
	}
}
