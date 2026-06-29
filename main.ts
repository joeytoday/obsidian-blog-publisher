import { Notice, Plugin, Workspace, addIcon } from "obsidian";
import Publisher from "./src/publisher/Publisher";
import BlogPublisherSettings from "./src/models/settings";
import { PublishStatusBar } from "./src/views/PublishStatusBar";
import { publisherIcon } from "./src/ui/suggest/constants";
import { PublicationCenter } from "./src/views/PublicationCenter/PublicationCenter";
import PublishStatusManager from "./src/publisher/PublishStatusManager";
import SiteManager from "./src/repositoryConnection/SiteManager";
import { BlogPublisherSettingTab } from "./src/views/BlogPublisherSettingTab";
import Logger from "js-logger";
import { PublishFile } from "./src/publishFile/PublishFile";
import { ObsidianFrontMatterEngine } from "./src/publishFile/ObsidianFrontMatterEngine";
import {
	DEFAULT_NOTE_PATH_BASE,
	DEFAULT_IMAGE_PATH,
	DEFAULT_IMAGE_URL_PREFIX,
} from "./src/constants";
import {
	extractBaseUrl,
	generateUrlPath,
	getErrorMessage,
	getRewrittenPath,
	getRewriteRules,
} from "./src/utils/utils";

const DEFAULT_SETTINGS: BlogPublisherSettings = {
	githubRepo: "",
	githubToken: "",
	githubUserName: "",
	contentBasePath: DEFAULT_NOTE_PATH_BASE,
	imagePath: DEFAULT_IMAGE_PATH,
	imageUrlPrefix: DEFAULT_IMAGE_URL_PREFIX,
	siteUrl: "",
	prHistory: [],
	siteName: "Blog Publisher",
	pathRewriteRules: "",
	publishPlatform:
		"SelfHosted" as unknown as BlogPublisherSettings["publishPlatform"],
	workflowFileName: "",
	logLevel: undefined,
};

Logger.useDefaults({
	defaultLevel: Logger.WARN,
	formatter: function (messages, _context) {
		messages.unshift(new Date().toUTCString());
		messages.unshift("BP: ");
	},
});

export default class BlogPublisher extends Plugin {
	settings!: BlogPublisherSettings;
	appVersion!: string;
	publishModal!: PublicationCenter;
	isPublishing: boolean = false;

	async onload() {
		this.appVersion = this.manifest.version;
		console.log("Initializing BlogPublisher plugin v" + this.appVersion);
		await this.loadSettings();

		if (this.settings.logLevel) {
			Logger.setLevel(this.settings.logLevel);
		}

		const levelName =
			(Logger.getLevel() as { name?: string })?.name ?? "unknown";
		Logger.info("Blog publisher log level set to " + levelName);

		this.addSettingTab(new BlogPublisherSettingTab(this.app, this));
		await this.addCommands();

		addIcon("blog-publisher-icon", publisherIcon);

		this.addRibbonIcon("blog-publisher-icon", "打开发布中心", async () => {
			void this.openPublishModal();
		});
	}

	onunload() {}

	async loadSettings() {
		const loaded = await this.loadData();

		if (loaded === null || typeof loaded !== "object") {
			this.settings = { ...DEFAULT_SETTINGS };

			return;
		}
		const loadedRecord = loaded as Record<string, unknown>;

		const merged = Object.assign(
			{},
			DEFAULT_SETTINGS,
			loadedRecord,
		) as BlogPublisherSettings;

		// 迁移：旧配置可能有 publishBasePath，如果没有 contentBasePath 则沿用
		if (loadedRecord.publishBasePath && !loadedRecord.contentBasePath) {
			const path = loadedRecord.publishBasePath as string;
			merged.contentBasePath = path.endsWith("/") ? path : path + "/";
		}

		// 迁移：gardenBaseUrl → siteUrl
		if (loadedRecord.gardenBaseUrl && !merged.siteUrl) {
			merged.siteUrl = loadedRecord.gardenBaseUrl as string;
		}

		this.settings = merged;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async addCommands() {
		// 快速发布并分享笔记
		this.addCommand({
			id: "quick-publish-and-share-note",
			name: "快速发布并分享笔记",
			callback: async () => {
				if (this.isPublishing) {
					new Notice("发布操作正在进行中，请等待完成。");

					return;
				}

				new Notice("正在为笔记添加发布标记并发布...");
				const activeFile = this.app.workspace.getActiveFile();

				if (activeFile) {
					await new Promise<void>((resolve) => {
						let resolved = false;

						const handler = (file: { path: string }) => {
							if (file.path === activeFile.path && !resolved) {
								resolved = true;
								this.app.metadataCache.offref(handler);
								resolve();
							}
						};
						this.app.metadataCache.on("changed", handler);

						window.setTimeout(() => {
							if (!resolved) {
								resolved = true;
								this.app.metadataCache.offref(handler);
								resolve();
							}
						}, 5000);

						this.setPublishFlagValue(true);
					});
				} else {
					await this.setPublishFlagValue(true);
				}

				const successfullyPublished = await this.publishSingleNote();

				if (successfullyPublished) {
					await this.copyNoteUrlToClipboard();
				}
			},
		});

		// 发布当前笔记
		this.addCommand({
			id: "publish-note",
			name: "发布当前笔记",
			callback: async () => {
				await this.publishSingleNote();
			},
		});

		// 批量发布所有标记的笔记
		this.addCommand({
			id: "publish-multiple-notes",
			name: "发布所有标记的笔记",
			callback: async () => {
				await this.publishMultipleNotes();
			},
		});

		// 复制笔记URL
		this.addCommand({
			id: "copy-note-url",
			name: "复制笔记URL",
			callback: async () => {
				await this.copyNoteUrlToClipboard();
			},
		});

		// 打开发布中心
		this.addCommand({
			id: "bp-open-publish-modal",
			name: "打开发布中心",
			callback: async () => {
				void this.openPublishModal();
			},
		});

		// 添加发布标记
		this.addCommand({
			id: "bp-mark-note-for-publish",
			name: "添加发布标记",
			callback: async () => {
				void this.setPublishFlagValue(true);
			},
		});

		// 移除发布标记
		this.addCommand({
			id: "bp-unmark-note-for-publish",
			name: "移除发布标记",
			callback: async () => {
				void this.setPublishFlagValue(false);
			},
		});

		// 切换发布状态
		this.addCommand({
			id: "bp-mark-toggle-publish-status",
			name: "切换发布状态",
			callback: async () => {
				void this.togglePublishFlag();
			},
		});
	}

	private getActiveFile(workspace: Workspace) {
		const activeFile = workspace.getActiveFile();

		if (!activeFile) {
			new Notice("没有打开的文件，请先打开一个文件。");

			return null;
		}

		return activeFile;
	}

	async copyNoteUrlToClipboard() {
		try {
			const { metadataCache, workspace } = this.app;
			const activeFile = this.getActiveFile(workspace);

			if (!activeFile) {
				return;
			}

			const baseUrl = extractBaseUrl(this.settings.siteUrl);
			const rewriteRules = getRewriteRules(this.settings.pathRewriteRules);

			const rewrittenPath = getRewrittenPath(activeFile.path, rewriteRules);

			const frontmatter = metadataCache.getCache(activeFile.path)?.frontmatter;
			const permalink = frontmatter?.permalink as string | undefined;

			const noteUrlPath = permalink
				? permalink.startsWith("/")
					? permalink.slice(1)
					: permalink
				: generateUrlPath(rewrittenPath, true);

			const fullUrl = `https://${baseUrl}/${noteUrlPath}`;
			await navigator.clipboard.writeText(fullUrl);
			new Notice(`笔记URL已复制到剪贴板`);
		} catch (e) {
			console.error(e instanceof Error ? e.message : String(e));
			new Notice("无法复制笔记URL到剪贴板，出现错误。");
		}
	}

	// 发布单篇笔记
	async publishSingleNote(): Promise<boolean> {
		if (this.isPublishing) {
			new Notice("发布操作正在进行中，请等待完成。");

			return false;
		}

		this.isPublishing = true;

		try {
			const { vault, workspace, metadataCache } = this.app;
			const activeFile = this.getActiveFile(workspace);

			if (!activeFile) {
				return false;
			}

			if (activeFile.extension !== "md") {
				new Notice("当前文件不是 Markdown 文件，请先打开 Markdown 文件。");

				return false;
			}

			new Notice("正在发布笔记...");

			const publisher = new Publisher(vault, metadataCache, this.settings);
			publisher.validateSettings();

			const publishFile = await new PublishFile({
				file: activeFile,
				vault: vault,
				compiler: publisher.compiler,
				metadataCache: metadataCache,
				settings: this.settings,
			}).compile();

			const publishSuccessful = await publisher.publish(publishFile);

			if (publishSuccessful) {
				new Notice("笔记发布成功！");

				if (this.settings.workflowFileName) {
					try {
						const siteManager = new SiteManager(metadataCache, this.settings);
						await siteManager.triggerWorkflow();
						new Notice("已触发部署工作流。");
					} catch (e) {
						console.error(getErrorMessage(e));
						new Notice("触发部署工作流失败。");
					}
				}
			}

			return publishSuccessful;
		} catch (e) {
			console.error(getErrorMessage(e));
			new Notice("发布失败，出现错误。");

			return false;
		} finally {
			this.isPublishing = false;
		}
	}

	// 批量发布笔记
	async publishMultipleNotes() {
		if (this.isPublishing) {
			new Notice("发布操作正在进行中，请等待完成。");

			return;
		}

		this.isPublishing = true;
		const statusBarItem = this.addStatusBarItem();

		try {
			new Notice("正在处理要发布的文件...");
			const { vault, metadataCache } = this.app;

			const publisher = new Publisher(vault, metadataCache, this.settings);
			publisher.validateSettings();

			const siteManager = new SiteManager(metadataCache, this.settings);

			const publishStatusManager = new PublishStatusManager(
				siteManager,
				publisher,
			);

			const publishStatus = await publishStatusManager.getPublishStatus();

			const filesToPublish = publishStatus.changedNotes.concat(
				publishStatus.unpublishedNotes,
			);
			const filesToDelete = publishStatus.deletedNotePaths;
			const imagesToDelete = publishStatus.deletedImagePaths;

			const totalItems =
				filesToPublish.length + filesToDelete.length + imagesToDelete.length;

			if (totalItems === 0) {
				new Notice("所有内容已是最新状态！");

				return;
			}

			const statusBar = new PublishStatusBar(
				statusBarItem,
				filesToPublish.length + filesToDelete.length + imagesToDelete.length,
			);

			new Notice(
				`正在发布 ${filesToPublish.length} 篇笔记，删除 ${filesToDelete.length} 篇笔记和 ${imagesToDelete.length} 张图片...`,
				8000,
			);

			// 批量发布
			await publisher.publishBatch(filesToPublish);

			statusBar.incrementMultiple(filesToPublish.length);

			// 批量删除笔记和图片（合并删除，只在最后触发一次部署）
			const notePathsToDelete = filesToDelete.map((f) => f.path);
			const imagePathsToDelete = imagesToDelete.map((i) => i.path);

			const allPathsToDelete = [...notePathsToDelete, ...imagePathsToDelete];

			if (allPathsToDelete.length > 0) {
				await publisher.deleteBatch(allPathsToDelete);

				statusBar.incrementMultiple(
					filesToDelete.length + imagesToDelete.length,
				);
			}

			statusBar.finish(8000);

			new Notice(`成功发布 ${filesToPublish.length} 篇笔记！`);

			if (filesToDelete.length > 0) {
				new Notice(`成功删除 ${filesToDelete.length} 篇笔记！`);
			}

			if (imagesToDelete.length > 0) {
				new Notice(`成功删除 ${imagesToDelete.length} 张图片！`);
			}

			if (this.settings.workflowFileName) {
				try {
					await siteManager.triggerWorkflow();
					new Notice("已触发部署工作流。");
				} catch (e) {
					console.error(getErrorMessage(e));
					new Notice("触发部署工作流失败。");
				}
			}
		} catch (e) {
			const msg = getErrorMessage(e);
			console.error(msg);
			new Notice(`发布失败：${msg}`);
		} finally {
			statusBarItem.remove();
			this.isPublishing = false;
		}
	}

	// 设置发布标记
	async setPublishFlagValue(value: boolean) {
		const activeFile = this.getActiveFile(this.app.workspace);

		if (!activeFile) {
			return;
		}

		const engine = new ObsidianFrontMatterEngine(
			this.app.vault,
			this.app.metadataCache,
			activeFile,
		);
		engine.set("pub-blog", value);
		await engine.apply();
	}

	// 切换发布标记
	async togglePublishFlag() {
		const activeFile = this.getActiveFile(this.app.workspace);

		if (!activeFile) {
			return;
		}

		const engine = new ObsidianFrontMatterEngine(
			this.app.vault,
			this.app.metadataCache,
			activeFile,
		);
		engine.set("pub-blog", !engine.get("pub-blog"));
		await engine.apply();
	}

	// 打开发布中心
	openPublishModal() {
		if (!this.publishModal) {
			const siteManager = new SiteManager(
				this.app.metadataCache,
				this.settings,
			);

			const publisher = new Publisher(
				this.app.vault,
				this.app.metadataCache,
				this.settings,
			);

			const publishStatusManager = new PublishStatusManager(
				siteManager,
				publisher,
			);

			this.publishModal = new PublicationCenter(
				this.app,
				publishStatusManager,
				publisher,
				siteManager,
				this.settings,
			);
		}
		this.publishModal.open();
	}
}
