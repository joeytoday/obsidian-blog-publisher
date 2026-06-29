import { MetadataCache, Notice, TFile, Vault } from "obsidian";
import { Base64 } from "js-base64";
import {
	getRewriteRules,
	getRewrittenPath,
	stripVaultImagePrefix,
	shouldSkipUnchangedImage,
	PathRewriteRules,
} from "../utils/utils";
import {
	hasPublishFlag,
	isPublishFrontmatterValid,
} from "../publishFile/Validator";
import SiteManager, {
	getNotePathBase,
} from "../repositoryConnection/SiteManager";
import BlogPublisherSettings from "../models/settings";
import { CompiledPublishFile, PublishFile } from "../publishFile/PublishFile";
import { Assets, MarkdownCompiler } from "../compiler/MarkdownCompiler";
import Logger from "js-logger";
import { RepositoryConnection } from "../repositoryConnection/RepositoryConnection";
import PublishPlatformConnectionFactory from "../repositoryConnection/PublishPlatformConnectionFactory";

export interface MarkedForPublishing {
	notes: PublishFile[];
	images: string[];
}

/**
 * Prepares files to be published and publishes them to Github
 */
export default class Publisher {
	vault: Vault;
	metadataCache: MetadataCache;
	compiler: MarkdownCompiler;
	settings: BlogPublisherSettings;
	rewriteRules: PathRewriteRules;

	constructor(
		vault: Vault,
		metadataCache: MetadataCache,
		settings: BlogPublisherSettings,
	) {
		this.vault = vault;
		this.metadataCache = metadataCache;
		this.settings = settings;
		this.rewriteRules = getRewriteRules(settings.pathRewriteRules);

		this.compiler = new MarkdownCompiler(vault, settings, metadataCache, () =>
			this.getFilesMarkedForPublishing(),
		);
	}

	shouldPublish(file: TFile): boolean {
		const frontMatter = this.metadataCache.getCache(file.path)?.frontmatter;

		return hasPublishFlag(frontMatter);
	}

	async getFilesMarkedForPublishing(): Promise<MarkedForPublishing> {
		const files = this.vault.getMarkdownFiles();

		const notesToPublish: PublishFile[] = [];
		const imagesToPublish: Set<string> = new Set();

		for (const file of files) {
			try {
				if (this.shouldPublish(file)) {
					const publishFile = new PublishFile({
						file,
						vault: this.vault,
						compiler: this.compiler,
						metadataCache: this.metadataCache,
						settings: this.settings,
					});

					notesToPublish.push(publishFile);

					const images = await publishFile.getImageLinks();
					images.forEach((i) => imagesToPublish.add(i));
				}
			} catch (e) {
				Logger.error(e instanceof Error ? e.message : String(e));
			}
		}

		return {
			notes: notesToPublish.sort((a, b) => a.compare(b)),
			images: Array.from(imagesToPublish),
		};
	}

	async deleteNote(vaultFilePath: string, sha?: string) {
		const notePathBase = getNotePathBase(this.settings);
		const path = `${notePathBase}${vaultFilePath}`;

		return await this.delete(path, sha);
	}

	async deleteImage(vaultFilePath: string, sha?: string) {
		const path = `${this.settings.imagePath}${vaultFilePath}`;

		return await this.delete(path, sha);
	}

	/** If provided with sha, repository connection does not need to get it seperately! */
	public async delete(path: string, sha?: string): Promise<boolean> {
		this.validateSettings();

		const userConnection = await this.getConnection();

		const deleted = await userConnection.deleteFile(path, {
			sha,
		});

		return !!deleted;
	}

	public async publish(file: CompiledPublishFile): Promise<boolean> {
		if (!isPublishFrontmatterValid(file.frontmatter)) {
			return false;
		}

		const [text, assets] = file.compiledFile;
		const remoteImageHashes = await this.getRemoteImageHashes();

		await this.uploadText(file.getPath(), text, file?.remoteHash);
		await this.uploadAssets(assets, remoteImageHashes);

		return true;
	}

	public async deleteBatch(filePaths: string[]): Promise<boolean> {
		if (filePaths.length === 0) {
			return true;
		}

		const userConnection = await this.getConnection();

		const notePathBase = getNotePathBase(this.settings);
		await userConnection.deleteFiles(filePaths, notePathBase);

		return true;
	}

	public async publishBatch(files: CompiledPublishFile[]): Promise<boolean> {
		const filesToPublish = files.filter((f) =>
			isPublishFrontmatterValid(f.frontmatter),
		);

		if (filesToPublish.length === 0) {
			return true;
		}

		const userConnection = await this.getConnection();

		const remoteImageHashes = await this.getRemoteImageHashes();
		const notePathBase = getNotePathBase(this.settings);

		await userConnection.updateFiles(
			filesToPublish,
			remoteImageHashes,
			notePathBase,
			this.rewriteRules,
		);

		return true;
	}

	private async getRemoteImageHashes(): Promise<Record<string, string>> {
		const userConnection = await this.getConnection();

		const contentTree = await userConnection
			.getContent("HEAD")
			.catch(() => undefined);

		if (!contentTree) {
			return {};
		}

		const siteManager = new SiteManager(this.metadataCache, this.settings);

		return siteManager.getImageHashes(contentTree);
	}

	private async getConnection(): Promise<RepositoryConnection> {
		return new RepositoryConnection(
			await PublishPlatformConnectionFactory.createPublishPlatformConnection(
				this.settings,
			),
		);
	}

	private async uploadToGithub(
		path: string,
		content: string,
		remoteFileHash?: string,
	) {
		this.validateSettings();
		let message = `Update content ${path}`;

		const userConnection = await this.getConnection();

		if (!remoteFileHash) {
			const file = await userConnection.getFile(path).catch(() => {
				Logger.info(`File ${path} does not exist, adding`);
			});
			remoteFileHash = file?.sha;

			if (!remoteFileHash) {
				message = `Add content ${path}`;
			}
		}

		return await userConnection.updateFile({
			content,
			path,
			message,
			sha: remoteFileHash,
		});
	}

	private async uploadText(filePath: string, content: string, sha?: string) {
		content = Base64.encode(content);

		const basePath = getNotePathBase(this.settings);
		const rewrittenPath = getRewrittenPath(filePath, this.rewriteRules);
		const publishPath = `${basePath}${rewrittenPath}`;

		await this.uploadToGithub(publishPath, content, sha);
	}

	private async uploadImage(filePath: string, content: string, sha?: string) {
		const relativePath = stripVaultImagePrefix(
			filePath,
			this.settings.imageUrlPrefix,
		);
		const path = `${this.settings.imagePath}${relativePath}`;
		await this.uploadToGithub(path, content, sha);
	}

	private async uploadAssets(
		assets: Assets,
		remoteImageHashes: Record<string, string> = {},
	) {
		for (const image of assets.images) {
			if (
				shouldSkipUnchangedImage(
					image.path,
					image.localHash,
					remoteImageHashes,
					this.settings.imageUrlPrefix,
				)
			) {
				Logger.debug(`Skipping unchanged image: ${image.path}`);
				continue;
			}

			await this.uploadImage(
				image.path,
				image.content,
				remoteImageHashes[
					stripVaultImagePrefix(image.path, this.settings.imageUrlPrefix)
				],
			);
		}
	}

	validateSettings() {
		if (!this.settings.githubRepo) {
			new Notice(
				"Config error: You need to define a GitHub repo in the plugin settings",
			);
			throw new Error("GitHub repo is not configured");
		}

		if (!this.settings.githubUserName) {
			new Notice(
				"Config error: You need to define a GitHub Username in the plugin settings",
			);
			throw new Error("GitHub username is not configured");
		}

		if (!this.settings.githubToken) {
			new Notice(
				"Config error: You need to define a GitHub Token in the plugin settings",
			);
			throw new Error("GitHub token is not configured");
		}
	}
}
