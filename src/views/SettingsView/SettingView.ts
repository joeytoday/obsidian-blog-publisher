import { App, getIcon, Setting } from "obsidian";
import BlogPublisherSettings from "../../models/settings";
import { GithubSettings } from "./GithubSettings";
import Logger from "js-logger";
import { PublishPlatform } from "../../models/PublishPlatform";
import Publisher from "../../publisher/Publisher";

export default class SettingView {
	private app: App;
	settings: BlogPublisherSettings;
	saveSettings: () => Promise<void>;
	private settingsRootElement: HTMLElement;
	private publisher: Publisher;

	constructor(
		app: App,
		settingsRootElement: HTMLElement,
		settings: BlogPublisherSettings,
		saveSettings: () => Promise<void>,
	) {
		this.app = app;
		this.settingsRootElement = settingsRootElement;
		this.settingsRootElement.classList.add("bp-settings");
		this.settings = settings;
		this.saveSettings = saveSettings;
		this.publisher = new Publisher(app.vault, app.metadataCache, settings);
	}

	getIcon(name: string): Node {
		return getIcon(name) ?? activeDocument.createElement("span");
	}

	async initialize() {
		this.settingsRootElement.empty();

		this.settingsRootElement.createEl("h1", {
			text: "博客发布设置",
		});

		const linkDiv = this.settingsRootElement.createEl("div", {
			attr: { style: "margin-bottom: 10px;" },
		});

		linkDiv.createEl("span", {
			text: "通过发布中心管理您的笔记发布状态，支持批量发布和路径改写。",
		});

		// 发布平台选择（固定为 GitHub 仓库）
		this.settings.publishPlatform = PublishPlatform.SelfHosted;

		const publishPlatformSettings = this.settingsRootElement.createEl("div", {
			cls: "connection-status",
		});

		this.initializePublishPlatformSettings(publishPlatformSettings);

		// 路径改写设置
		this.settingsRootElement
			.createEl("h3", { text: "路径改写" })
			.prepend(this.getIcon("git-compare"));

		// 路径改写规则输入框
		new Setting(this.settingsRootElement)
			.setName("路径改写规则")
			.setDesc(
				"每行一条规则，格式：原始路径:目标路径。用于将本地文件夹结构映射到发布后的结构",
			)
			.addTextArea((text) => {
				text
					.setPlaceholder(
						"例如：1-projects/:blog/\nPath Rewriting/Subfolder2:fun-folder",
					)
					.setValue(this.settings.pathRewriteRules)
					.onChange(async (value) => {
						this.settings.pathRewriteRules = value;
						await this.saveSettings();
					});
				text.inputEl.rows = 5;
				text.inputEl.addClass("bp-path-rewrite-textarea");
			});

		// 路径改写示例说明
		const exampleContainer = this.settingsRootElement.createEl("div", {
			cls: "setting-item-description",
		});
		exampleContainer.addClass("bp-path-rewrite-example");

		exampleContainer.createEl("div", {
			text: "📋 路径改写示例（基于当前规则）：",
			cls: "setting-item-name",
		});

		const exampleList = exampleContainer.createEl("ul", {
			cls: "setting-item-description",
		});
		exampleList.addClass("bp-path-rewrite-list");

		const examples = [
			{
				from: "1-projects/blog/2023/weekly-01.md",
				to: "blog/2023/weekly-01.md",
			},
			{
				from: "1-projects/worknotes/2026/note.md",
				to: "worknotes/2026/note.md",
			},
			{
				from: "notes/PARA系统.md",
				to: "notes/PARA系统.md",
			},
		];

		for (const example of examples) {
			const li = exampleList.createEl("li");
			li.createEl("code", { text: example.from });
			li.createEl("span", { text: " → " });
			li.createEl("code", { text: example.to });
		}

		exampleContainer.createEl("div", {
			text: "💡 提示：使用冒号分隔原始路径和目标路径，留空目标路径表示映射到根目录",
			cls: "setting-item-description bp-path-rewrite-tip",
		});

		// 状态跟踪设置
		this.settingsRootElement
			.createEl("h3", { text: "状态跟踪" })
			.prepend(this.getIcon("toggle-left"));

		new Setting(this.settingsRootElement)
			.setName("启用状态跟踪")
			.setDesc(
				"启用后，在 pub-blog: true 的基础上，用 status 字段控制发布中心的状态分类。status 为「待发布值」时检查是否有改动，为「已发布值」时跳过检查直接显示为已发布。适合小修改后不想重复推送的场景。",
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.settings.statusTrackingEnabled)
					.onChange(async (value) => {
						this.settings.statusTrackingEnabled = value;
						await this.saveSettings();
						this.initialize();
					});
			});

		if (this.settings.statusTrackingEnabled) {
			new Setting(this.settingsRootElement)
				.setName("状态属性名")
				.setDesc("用于状态跟踪的 frontmatter 属性名。")
				.addText((text) => {
					text
						.setPlaceholder("status")
						.setValue(this.settings.statusFieldName)
						.onChange(async (value) => {
							this.settings.statusFieldName = value || "status";
							await this.saveSettings();
						});
				});

			new Setting(this.settingsRootElement)
				.setName("待发布状态值")
				.setDesc(
					"status 为此值时，发布中心检查远程内容判断是未发布还是有改动。",
				)
				.addText((text) => {
					text
						.setPlaceholder("ongoing")
						.setValue(this.settings.trackStatusValue)
						.onChange(async (value) => {
							this.settings.trackStatusValue = value;
							await this.saveSettings();
						});
				});

			new Setting(this.settingsRootElement)
				.setName("已发布状态值")
				.setDesc(
					"status 为此值时，跳过远程内容检查，直接显示为已发布。适合小修改后不想重复推送的情况。",
				)
				.addText((text) => {
					text
						.setPlaceholder("done")
						.setValue(this.settings.publishedStatusValue)
						.onChange(async (value) => {
							this.settings.publishedStatusValue = value;
							await this.saveSettings();
						});
				});

			const statusExample = this.settingsRootElement.createEl("div", {
				cls: "setting-item-description",
			});
			statusExample.addClass("bp-status-example");

			statusExample.createEl("div", {
				text: "📋 示例 frontmatter：",
				cls: "setting-item-name",
			});

			const codeBlock = statusExample.createEl("pre");

			codeBlock.createEl("code", {
				text: `---\npub-blog: true\n${this.settings.statusFieldName}: ${this.settings.trackStatusValue}  # 检查改动，需要时重新发布\n---\n\n---\npub-blog: true\n${this.settings.statusFieldName}: ${this.settings.publishedStatusValue}  # 跳过检查，显示为已发布\n---`,
			});
		}

		// 调试日志
		this.settingsRootElement
			.createEl("h3", { text: "高级" })
			.prepend(this.getIcon("cog"));

		new Setting(this.settingsRootElement)
			.setName("启用调试日志")
			.setDesc("在开发者控制台显示详细日志，用于排查问题")
			.addToggle((toggle) => {
				toggle
					.setValue(this.settings.logLevel === Logger.DEBUG)
					.onChange(async (value) => {
						this.settings.logLevel = value ? Logger.DEBUG : undefined;
						Logger.setLevel(value ? Logger.DEBUG : Logger.WARN);
						await this.saveSettings();
					});
			});
	}

	private initializePublishPlatformSettings(target: HTMLElement) {
		target.empty();

		if (this.settings.publishPlatform === PublishPlatform.SelfHosted) {
			new GithubSettings(this, target);
		} else {
			//  Forestry.md 设置简化版
			target.createEl("div", {
				text: "Forestry.md 设置",
				cls: "setting-item-name",
			});
		}
	}
}
