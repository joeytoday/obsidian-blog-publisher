import { ILogLevel } from "js-logger";
import { PublishPlatform } from "./PublishPlatform";

/** Saved to data.json, changing requires a migration */
export default interface BlogPublisherSettings {
	githubToken: string;
	githubRepo: string;
	githubUserName: string;

	/**
	 * The base path where notes will be published in the repository.
	 * Default is "src/content/".
	 */
	contentBasePath: string;

	/**
	 * The base path where images will be uploaded in the repository.
	 * Default is "src/site/img/user/".
	 */
	imagePath: string;

	/**
	 * The URL prefix used in published markdown for image references.
	 * Default is "/img/user/".
	 */
	imageUrlPrefix: string;

	siteUrl: string;
	prHistory: string[];

	siteName: string;

	pathRewriteRules: string;

	publishPlatform: PublishPlatform;

	/**
	 * 启用基于状态字段的状态跟踪。
	 * 启用后，在 pub-blog: true 的基础上，用可配置的状态字段值控制发布中心的状态分类。
	 */
	statusTrackingEnabled: boolean;

	/**
	 * 用于状态跟踪的 frontmatter 属性名。默认 "status"。
	 */
	statusFieldName: string;

	/**
	 * 表示"进行中 / 待发布"的状态值。
	 * 处于此状态的笔记，发布中心会检查远程内容判断是未发布还是有改动。
	 */
	trackStatusValue: string;

	/**
	 * 表示"已完成 / 已发布"的状态值。
	 * 处于此状态的笔记在发布中心直接显示为已发布，不会重复推送。
	 */
	publishedStatusValue: string;

	ENABLE_DEVELOPER_TOOLS?: boolean;
	devPluginPath?: string;
	logLevel?: ILogLevel;
}
