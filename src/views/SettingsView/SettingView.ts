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
		return getIcon(name) ?? document.createElement("span");
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
				text.inputEl.style.width = "100%";
			});

		// 路径改写示例说明
		const exampleContainer = this.settingsRootElement.createEl("div", {
			cls: "setting-item-description",
		});
		exampleContainer.style.marginTop = "10px";
		exampleContainer.style.marginBottom = "15px";
		exampleContainer.style.padding = "10px";
		exampleContainer.style.backgroundColor = "var(--background-secondary)";
		exampleContainer.style.borderRadius = "5px";

		exampleContainer.createEl("div", {
			text: "📋 路径改写示例（基于当前规则）：",
			cls: "setting-item-name",
		});

		const exampleList = exampleContainer.createEl("ul", {
			cls: "setting-item-description",
		});
		exampleList.style.marginTop = "8px";
		exampleList.style.marginLeft = "20px";

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
			cls: "setting-item-description",
		}).style.marginTop = "8px";

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
