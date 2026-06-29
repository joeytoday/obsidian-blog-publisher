import type BlogPublisherSettings from "../models/settings";
import { type MetadataCache } from "obsidian";
import { getRewriteRules, PathRewriteRules } from "../utils/utils";
import {
	RepositoryConnection,
	TRepositoryContent,
} from "./RepositoryConnection";
import { Base64 } from "js-base64";
import { DEFAULT_NOTE_PATH_BASE, GITHUB_TREE_TYPE_BLOB } from "../constants";
import PublishPlatformConnectionFactory from "./PublishPlatformConnectionFactory";

export function getNotePathBase(settings: BlogPublisherSettings): string {
	return settings.contentBasePath || DEFAULT_NOTE_PATH_BASE;
}

type ContentTreeItem = {
	path: string;
	sha: string;
	type: string;
};

export default class SiteManager {
	settings: BlogPublisherSettings;
	metadataCache: MetadataCache;
	rewriteRules: PathRewriteRules;

	private userConnection: RepositoryConnection | null;

	constructor(metadataCache: MetadataCache, settings: BlogPublisherSettings) {
		this.settings = settings;
		this.metadataCache = metadataCache;
		this.rewriteRules = getRewriteRules(settings.pathRewriteRules);
		this.userConnection = null;
	}

	async getUserConnection() {
		if (!this.userConnection) {
			this.userConnection = new RepositoryConnection(
				await PublishPlatformConnectionFactory.createPublishPlatformConnection(
					this.settings,
				),
			);
		}

		return this.userConnection;
	}

	async getNoteContent(path: string): Promise<string> {
		if (path.startsWith("/")) {
			path = path.substring(1);
		}

		const notePathBase = getNotePathBase(this.settings);

		const response = await (
			await this.getUserConnection()
		).getFile(notePathBase + path);

		if (!response) {
			return "";
		}

		const content = Base64.decode(response.content);

		return content;
	}

	async getNoteHashes(
		contentTree: NonNullable<TRepositoryContent>,
	): Promise<Record<string, string>> {
		const files = contentTree.tree ?? [];

		const basePath = getNotePathBase(this.settings);

		const notes = files.filter(
			(x): x is ContentTreeItem =>
				typeof x.path === "string" &&
				x.path.startsWith(basePath) &&
				x.type === GITHUB_TREE_TYPE_BLOB &&
				x.path !== `${basePath}notes.json`,
		);
		const hashes: Record<string, string> = {};

		for (const note of notes) {
			const vaultPath = note.path.replace(basePath, "");
			hashes[vaultPath] = note.sha;
		}

		return hashes;
	}

	async getImageHashes(
		contentTree: NonNullable<TRepositoryContent>,
	): Promise<Record<string, string>> {
		const files = contentTree.tree ?? [];
		const imagePath = this.settings.imagePath;

		const images = files.filter(
			(x): x is ContentTreeItem =>
				typeof x.path === "string" &&
				x.path.startsWith(imagePath) &&
				x.type === GITHUB_TREE_TYPE_BLOB,
		);
		const hashes: Record<string, string> = {};

		for (const img of images) {
			const vaultPath = img.path.replace(imagePath, "");
			hashes[vaultPath] = img.sha;
		}

		return hashes;
	}

	async triggerWorkflow(): Promise<void> {
		if (!this.settings.workflowFileName) {
			return;
		}

		const connection = await this.getUserConnection();
		const repoInfo = await connection.getRepositoryInfo();

		if (!repoInfo?.default_branch) {
			return;
		}

		await connection.triggerWorkflow(
			this.settings.workflowFileName,
			repoInfo.default_branch,
		);
	}
}
