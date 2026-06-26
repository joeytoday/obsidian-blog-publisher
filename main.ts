import { Notice, Plugin, Workspace, addIcon } from "obsidian";
import Publisher from "./src/publisher/Publisher";
import DigitalGardenSettings from "./src/models/settings";
import { PublishStatusBar } from "./src/views/PublishStatusBar";
import { seedling } from "src/ui/suggest/constants";
import { PublicationCenter } from "src/views/PublicationCenter/PublicationCenter";
import PublishStatusManager from "src/publisher/PublishStatusManager";
import DigitalGardenSiteManager from "src/repositoryConnection/DigitalGardenSiteManager";
import { DigitalGardenSettingTab } from "./src/views/DigitalGardenSettingTab";
import Logger from "js-logger";
import { PublishFile } from "./src/publishFile/PublishFile";
import { ObsidianFrontMatterEngine } from "./src/publishFile/ObsidianFrontMatterEngine";
import { DEFAULT_NOTE_PATH_BASE } from "./src/constants";
import { getErrorMessage } from "./src/utils/utils";

const DEFAULT_SETTINGS: DigitalGardenSettings = {
	githubRepo: "",
	githubToken: "",
	githubUserName: "",
	contentBasePath: DEFAULT_NOTE_PATH_BASE,
	gardenBaseUrl: "",
	prHistory: [],
	siteName: "Digital Garden",
	pathRewriteRules: "",
	publishPlatform:
		"SelfHosted" as unknown as DigitalGardenSettings["publishPlatform"],
	logLevel: undefined,
};

Logger.useDefaults({
	defaultLevel: Logger.WARN,
	formatter: function (messages, _context) {
		messages.unshift(new Date().toUTCString());
		messages.unshift("DG: ");
	},
});

export default class DigitalGarden extends Plugin {
	settings!: DigitalGardenSettings;
	appVersion!: string;
	publishModal!: PublicationCenter;
	isPublishing: boolean = false;

	async onload() {
		this.appVersion = this.manifest.version;
		console.log("Initializing DigitalGarden plugin v" + this.appVersion);
		await this.loadSettings();

		this.settings.logLevel && Logger.setLevel(this.settings.logLevel);

		Logger.info(
			"Digital garden log level set to " + Logger.getLevel().name,
		);

		this.addSettingTab(new DigitalGardenSettingTab(this.app, this));
		await this.addCommands();

		addIcon("digital-garden-icon", seedling);

		this.addRibbonIcon("digital-garden-icon", "打开发布中心", async () => {
			this.openPublishModal();
		});
	}

	onunload() {}

	async loadSettings() {
		const loaded = await this.loadData();
		const merged = Object.assign({}, DEFAULT_SETTINGS, loaded);

		// 迁移：旧配置可能有 publishBasePath，如果没有 contentBasePath 则沿用
		if (
			loaded &&
			(loaded as Record<string, unknown>).publishBasePath &&
			!loaded?.contentBasePath
		) {
			const path = (loaded as Record<string, unknown>)
				.publishBasePath as string;
			merged.contentBasePath = path.endsWith("/") ? path : path + "/";
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

						setTimeout(() => {
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
					await this.copyGardenUrlToClipboard();
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

		// 复制花园URL
		this.addCommand({
			id: "copy-garden-url",
			name: "复制花园URL",
			callback: async () => {
				await this.copyGardenUrlToClipboard();
			},
		});

		// 打开发布中心
		this.addCommand({
			id: "dg-open-publish-modal",
			name: "打开发布中心",
			callback: async () => {
				this.openPublishModal();
			},
		});

		// 添加发布标记
		this.addCommand({
			id: "dg-mark-note-for-publish",
			name: "添加发布标记",
			callback: async () => {
				this.setPublishFlagValue(true);
			},
		});

		// 移除发布标记
		this.addCommand({
			id: "dg-unmark-note-for-publish",
			name: "移除发布标记",
			callback: async () => {
				this.setPublishFlagValue(false);
			},
		});

		// 切换发布状态
		this.addCommand({
			id: "dg-mark-toggle-publish-status",
			name: "切换发布状态",
			callback: async () => {
				this.togglePublishFlag();
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

	async copyGardenUrlToClipboard() {
		try {
			const { metadataCache, workspace } = this.app;
			const activeFile = this.getActiveFile(workspace);

			if (!activeFile) {
				return;
			}

			const siteManager = new DigitalGardenSiteManager(
				metadataCache,
				this.settings,
			);
			const fullUrl = siteManager.getNoteUrl(activeFile);
			await navigator.clipboard.writeText(fullUrl);
			new Notice(`笔记URL已复制到剪贴板`);
		} catch (e) {
			console.log(e);
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
				new Notice(
					"当前文件不是 Markdown 文件，请先打开 Markdown 文件。",
				);

				return false;
			}

			new Notice("正在发布笔记...");

			const publisher = new Publisher(
				vault,
				metadataCache,
				this.settings,
			);
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

			const publisher = new Publisher(
				vault,
				metadataCache,
				this.settings,
			);
			publisher.validateSettings();

			const siteManager = new DigitalGardenSiteManager(
				metadataCache,
				this.settings,
			);

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
				filesToPublish.length +
				filesToDelete.length +
				imagesToDelete.length;

			if (totalItems === 0) {
				new Notice("所有内容已是最新状态！");

				return;
			}

			const statusBar = new PublishStatusBar(
				statusBarItem,
				filesToPublish.length +
					filesToDelete.length +
					imagesToDelete.length,
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

			const allPathsToDelete = [
				...notePathsToDelete,
				...imagePathsToDelete,
			];

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
			const siteManager = new DigitalGardenSiteManager(
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
