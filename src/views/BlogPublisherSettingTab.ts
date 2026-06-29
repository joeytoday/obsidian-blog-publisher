import { PluginSettingTab, App } from "obsidian";
import BlogPublisher from "../../main";
import SettingView from "./SettingsView/SettingView";

export class BlogPublisherSettingTab extends PluginSettingTab {
	plugin: BlogPublisher;

	constructor(app: App, plugin: BlogPublisher) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const { containerEl } = this;

		const settingView = new SettingView(
			this.app,
			containerEl,
			this.plugin.settings,
			async () => await this.plugin.saveData(this.plugin.settings),
		);
		await settingView.initialize();
	}
}
