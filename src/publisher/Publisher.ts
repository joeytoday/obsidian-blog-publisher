import { MetadataCache, Notice, TFile, Vault } from "obsidian";
import { Base64 } from "js-base64";
import {
	getRewriteRules,
	getGardenPathForNote,
	stripVaultImagePrefix,
	shouldSkipUnchangedImage,
	PathRewriteRules,
} from "../utils/utils";
import {
	hasPublishFlag,
	isPublishFrontmatterValid,
} from "../publishFile/Validator";
import DigitalGardenSiteManager, {
	getNotePathBase,
} from "../repositoryConnection/DigitalGardenSiteManager";
import DigitalGardenSettings from "../models/settings";
import { CompiledPublishFile, PublishFile } from "../publishFile/PublishFile";
import { Assets, GardenPageCompiler } from "../compiler/GardenPageCompiler";
import Logger from "js-logger";
import { RepositoryConnection } from "../repositoryConnection/RepositoryConnection";
import PublishPlatformConnectionFactory from "../repositoryConnection/PublishPlatformConnectionFactory";
import { IMAGE_PATH_BASE } from "../constants";

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
	compiler: GardenPageCompiler;
	settings: DigitalGardenSettings;
	rewriteRules: PathRewriteRules;

	constructor(
		vault: Vault,
		metadataCache: MetadataCache,
		settings: DigitalGardenSettings,
	) {
		this.vault = vault;
		this.metadataCache = metadataCache;
		this.settings = settings;
		this.rewriteRules = getRewriteRules(settings.pathRewriteRules);

		this.compiler = new GardenPageCompiler(vault, settings, metadataCache, () =>
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
				Logger.error(e);
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
		const path = `${IMAGE_PATH_BASE}${vaultFilePath}`;

		return await this.delete(path, sha);
	}

	/** If provided with sha, garden connection does not need to get it seperately! */
	public async delete(path: string, sha?: string): Promise<boolean> {
		this.validateSettings();

		const userGardenConnection = await this.getConnection();

		const deleted = await userGardenConnection.deleteFile(path, {
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

		const userGardenConnection = await this.getConnection();

		const notePathBase = getNotePathBase(this.settings);
		await userGardenConnection.deleteFiles(filePaths, notePathBase);

		return true;
	}

	public async publishBatch(files: CompiledPublishFile[]): Promise<boolean> {
		const filesToPublish = files.filter((f) =>
			isPublishFrontmatterValid(f.frontmatter),
		);

		if (filesToPublish.length === 0) {
			return true;
		}

		const userGardenConnection = await this.getConnection();

		const remoteImageHashes = await this.getRemoteImageHashes();
		const notePathBase = getNotePathBase(this.settings);

		await userGardenConnection.updateFiles(
			filesToPublish,
			remoteImageHashes,
			notePathBase,
			this.rewriteRules,
		);

		return true;
	}

	private async getRemoteImageHashes(): Promise<Record<string, string>> {
		const userGardenConnection = await this.getConnection();

		const contentTree = await userGardenConnection
			.getContent("HEAD")
			.catch(() => undefined);

		if (!contentTree) {
			return {};
		}

		const siteManager = new DigitalGardenSiteManager(
			this.metadataCache,
			this.settings,
		);

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

		const userGardenConnection = await this.getConnection();

		if (!remoteFileHash) {
			const file = await userGardenConnection.getFile(path).catch(() => {
				Logger.info(`File ${path} does not exist, adding`);
			});
			remoteFileHash = file?.sha;

			if (!remoteFileHash) {
				message = `Add content ${path}`;
			}
		}

		return await userGardenConnection.updateFile({
			content,
			path,
			message,
			sha: remoteFileHash,
		});
	}

	private async uploadText(filePath: string, content: string, sha?: string) {
		content = Base64.encode(content);

		const basePath = getNotePathBase(this.settings);
		const gardenPath = getGardenPathForNote(filePath, this.rewriteRules);
		const publishPath = `${basePath}${gardenPath}`;

		await this.uploadToGithub(publishPath, content, sha);
	}

	private async uploadImage(filePath: string, content: string, sha?: string) {
		const relativePath = stripVaultImagePrefix(filePath);
		const path = `${IMAGE_PATH_BASE}${relativePath}`;
		await this.uploadToGithub(path, content, sha);
	}

	private async uploadAssets(
		assets: Assets,
		remoteImageHashes: Record<string, string> = {},
	) {
		for (const image of assets.images) {
			if (
				shouldSkipUnchangedImage(image.path, image.localHash, remoteImageHashes)
			) {
				Logger.debug(`Skipping unchanged image: ${image.path}`);
				continue;
			}

			await this.uploadImage(
				image.path,
				image.content,
				remoteImageHashes[stripVaultImagePrefix(image.path)],
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
