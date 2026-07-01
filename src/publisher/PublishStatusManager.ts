import SiteManager from "../repositoryConnection/SiteManager";
import Publisher from "./Publisher";
import {
	generateBlobHash,
	getRewriteRules,
	getRewrittenPath,
	PathRewriteRules,
} from "../utils/utils";
import { CompiledPublishFile } from "../publishFile/PublishFile";

/**
 *  Manages the publishing status of notes and images for a blog publisher.
 */
export default class PublishStatusManager implements IPublishStatusManager {
	siteManager: SiteManager;
	publisher: Publisher;
	constructor(siteManager: SiteManager, publisher: Publisher) {
		this.siteManager = siteManager;
		this.publisher = publisher;
	}

	/**
	 * 生成需要删除的内容路径列表
	 * 判断逻辑：远程存在但本地未标记为发布的文件
	 */
	private generateDeletedContentPaths(
		remoteNoteHashes: { [key: string]: string },
		marked: string[],
		rewriteRules?: PathRewriteRules,
	): Array<{ path: string; sha: string }> {
		const isJsFile = (key: string) => key.endsWith(".js");

		// 应用路径重写规则，将本地路径转换为发布后的路径
		const rewrittenMarked = rewriteRules
			? marked.map((path) => getRewrittenPath(path, rewriteRules))
			: marked;

		// 检查路径是否被标记为发布
		const isMarkedForPublish = (key: string) =>
			rewrittenMarked.some((f) => f === key);

		// 过滤出需要删除的路径
		const deletedPaths = Object.keys(remoteNoteHashes).filter((key) => {
			if (isJsFile(key)) return false;

			// 如果路径被标记为发布，不是删除
			if (isMarkedForPublish(key)) return false;

			return true;
		});

		const pathsWithSha = deletedPaths.map((path) => {
			return {
				path,
				sha: remoteNoteHashes[path],
			};
		});

		return pathsWithSha;
	}

	async getPublishStatus(): Promise<PublishStatus> {
		const unpublishedNotes: Array<CompiledPublishFile> = [];
		const publishedNotes: Array<CompiledPublishFile> = [];
		const changedNotes: Array<CompiledPublishFile> = [];

		const contentTree = await (
			await this.siteManager.getUserConnection()
		).getContent("HEAD");

		if (!contentTree) {
			throw new Error("Could not get content tree from repository");
		}

		const remoteNoteHashes = await this.siteManager.getNoteHashes(contentTree);

		const remoteImageHashes =
			await this.siteManager.getImageHashes(contentTree);

		const marked = await this.publisher.getFilesMarkedForPublishing();

		// 获取路径重写规则（提前到循环前）
		const rewriteRules = getRewriteRules(
			this.publisher.settings.pathRewriteRules,
		);

		// 状态跟踪配置
		const statusTrackingEnabled = this.publisher.settings.statusTrackingEnabled;
		const statusFieldName = this.publisher.settings.statusFieldName;
		const trackValue = this.publisher.settings.trackStatusValue;
		const publishedValue = this.publisher.settings.publishedStatusValue;

		// 处理发布状态判断
		// marked.notes 已通过 pub-blog: true 筛选，这里根据状态字段细分发布状态
		for (const file of marked.notes) {
			const compiledFile = await file.compile();
			const [content] = compiledFile.getCompiledFile();
			const localHash = generateBlobHash(content);

			// 获取文件的 frontmatter 信息
			const frontmatter = file.getFrontmatter();

			// 支持字符串和数组格式的状态值
			const rawStatus = statusTrackingEnabled
				? frontmatter?.[statusFieldName]
				: frontmatter?.["status"];

			const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

			// 使用重写后的路径查找远程文件
			const rewrittenPath = getRewrittenPath(file.getPath(), rewriteRules);
			const remoteHash = remoteNoteHashes[rewrittenPath];
			const fileFound = remoteHash !== undefined;

			if (statusTrackingEnabled) {
				// 状态跟踪模式：使用可配置的状态值
				if (status === trackValue) {
					// 跟踪状态：检测远程状态
					if (fileFound) {
						compiledFile.setRemoteHash(remoteHash);
						changedNotes.push(compiledFile);
					} else {
						unpublishedNotes.push(compiledFile);
					}
				} else if (status === publishedValue) {
					// 已发布状态：始终显示在 Published 中
					publishedNotes.push(compiledFile);
				} else {
					// 其他状态：使用默认逻辑检测
					if (fileFound) {
						compiledFile.setRemoteHash(remoteHash);

						if (remoteHash === localHash) {
							publishedNotes.push(compiledFile);
						} else {
							changedNotes.push(compiledFile);
						}
					} else {
						unpublishedNotes.push(compiledFile);
					}
				}
			} else {
				// 默认模式：使用硬编码状态值（兼容旧版本）
				if (status === "🟡 Ongoing" || status === "🟡Ongoing") {
					if (fileFound) {
						compiledFile.setRemoteHash(remoteHash);
						changedNotes.push(compiledFile);
					} else {
						unpublishedNotes.push(compiledFile);
					}
				} else if (status === "🟢 Done" || status === "🟢Done") {
					publishedNotes.push(compiledFile);
				} else {
					if (fileFound) {
						compiledFile.setRemoteHash(remoteHash);

						if (remoteHash === localHash) {
							publishedNotes.push(compiledFile);
						} else {
							changedNotes.push(compiledFile);
						}
					} else {
						unpublishedNotes.push(compiledFile);
					}
				}
			}
		}

		// 使用简化的删除检测逻辑
		const deletedNotePaths = this.generateDeletedContentPaths(
			remoteNoteHashes,
			marked.notes.map((f) => f.getPath()),
			rewriteRules,
		);

		const deletedImagePaths = this.generateDeletedContentPaths(
			remoteImageHashes,
			marked.images,
			rewriteRules,
		);

		publishedNotes.sort((a, b) => a.compare(b));
		changedNotes.sort((a, b) => a.compare(b));
		deletedNotePaths.sort((a, b) => a.path.localeCompare(b.path));

		return {
			unpublishedNotes,
			publishedNotes,
			changedNotes,
			deletedNotePaths,
			deletedImagePaths,
		};
	}
}

interface PathToRemove {
	path: string;
	sha: string;
}

export interface PublishStatus {
	unpublishedNotes: Array<CompiledPublishFile>;
	publishedNotes: Array<CompiledPublishFile>;
	changedNotes: Array<CompiledPublishFile>;
	deletedNotePaths: Array<PathToRemove>;
	deletedImagePaths: Array<PathToRemove>;
}

export interface IPublishStatusManager {
	getPublishStatus(): Promise<PublishStatus>;
}
