import { ILogLevel } from "js-logger";
import { PublishPlatform } from "./PublishPlatform";

/** Saved to data.json, changing requires a migration */
export default interface DigitalGardenSettings {
	githubToken: string;
	githubRepo: string;
	githubUserName: string;

	/**
	 * The base path where notes will be published in the repository.
	 * Default is "src/content/".
	 */
	contentBasePath: string;

	gardenBaseUrl: string;
	prHistory: string[];

	siteName: string;

	pathRewriteRules: string;

	publishPlatform: PublishPlatform;

	ENABLE_DEVELOPER_TOOLS?: boolean;
	devPluginPath?: string;
	logLevel?: ILogLevel;
}
