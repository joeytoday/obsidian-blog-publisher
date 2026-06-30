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

	ENABLE_DEVELOPER_TOOLS?: boolean;
	devPluginPath?: string;
	logLevel?: ILogLevel;
}
