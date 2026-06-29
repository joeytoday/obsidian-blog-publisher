import { Octokit } from "@octokit/core";
import Logger from "js-logger";
import { IPublishPlatformConnection } from "../models/IPublishPlatformConnection";
import { PublishPlatform } from "../models/PublishPlatform";
import BlogPublisherSettings from "../models/settings";
import { DEFAULT_IMAGE_PATH, DEFAULT_IMAGE_URL_PREFIX } from "../constants";

const oktokitLogger = Logger.get("octokit");

export default class PublishPlatformConnectionFactory {
	static async createPublishPlatformConnection(
		settings: BlogPublisherSettings,
	): Promise<IPublishPlatformConnection> {
		if (settings.publishPlatform === PublishPlatform.SelfHosted) {
			return {
				octoKit: new Octokit({
					auth: settings.githubToken,
					log: oktokitLogger,
				}),
				userName: settings.githubUserName,
				pageName: settings.githubRepo,
				imagePath: settings.imagePath || DEFAULT_IMAGE_PATH,
				imageUrlPrefix: settings.imageUrlPrefix || DEFAULT_IMAGE_URL_PREFIX,
			};
		} else {
			throw new Error("Publish platform not supported");
		}
	}
}
