import { Octokit } from "@octokit/core";
import Logger from "js-logger";
import { CompiledPublishFile } from "../publishFile/PublishFile";
import { IPublishPlatformConnection } from "../models/IPublishPlatformConnection";
import {
	getRewrittenPath,
	normalizeGitPath,
	stripVaultImagePrefix,
	shouldSkipUnchangedImage,
	PathRewriteRules,
} from "../utils/utils";

import { GITHUB_FILE_MODE, GITHUB_TREE_TYPE_BLOB } from "../constants";

const logger = Logger.get("repository-connection");

interface IPutPayload {
	path: string;
	sha?: string;
	content: string;
	branch?: string;
	message?: string;
}

export class RepositoryConnection {
	private userName: string;
	private pageName: string;
	private imagePath: string;
	private imageUrlPrefix: string;
	octokit: Octokit;

	constructor({
		octoKit,
		userName,
		pageName,
		imagePath,
		imageUrlPrefix,
	}: IPublishPlatformConnection) {
		this.pageName = pageName;
		this.userName = userName;
		this.octokit = octoKit;
		this.imagePath = imagePath;
		this.imageUrlPrefix = imageUrlPrefix;
	}

	getRepositoryName() {
		return this.userName + "/" + this.pageName;
	}

	getBasePayload() {
		return {
			owner: this.userName,
			repo: this.pageName,
		};
	}

	/** Get filetree with path and sha of each file from repository */
	async getContent(branch: string) {
		try {
			const response = await this.octokit.request(
				`GET /repos/{owner}/{repo}/git/trees/{tree_sha}`,
				{
					...this.getBasePayload(),
					tree_sha: branch,
					recursive: "true",
					// invalidate cache
					headers: {
						"If-None-Match": "",
					},
				},
			);

			if (response.status === 200) {
				if (response.data.truncated) {
					logger.warn(
						"Git tree response is truncated — some files may be missed",
					);
				}

				return response.data;
			}
		} catch (error) {
			throw new Error(
				`Could not get content tree from repository ${this.getRepositoryName()}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	async getFile(path: string, branch?: string) {
		logger.info(
			`Getting file ${path} from repository ${this.getRepositoryName()}`,
		);

		try {
			const response = await this.octokit.request(
				"GET /repos/{owner}/{repo}/contents/{path}",
				{
					...this.getBasePayload(),
					path,
					ref: branch,
				},
			);

			if (
				response.status === 200 &&
				!Array.isArray(response.data) &&
				response.data.type === "file"
			) {
				return response.data;
			}
		} catch {
			throw new Error(
				`Could not get file ${path} from repository ${this.getRepositoryName()}`,
			);
		}
	}

	async deleteFile(
		path: string,
		{ branch, sha }: { branch?: string; sha?: string },
	) {
		try {
			sha ??= await this.getFile(path, branch).then((file) => file?.sha);

			if (!sha) {
				logger.error(`cannot find file ${path} on github, not removing`);

				return false;
			}

			const payload = {
				...this.getBasePayload(),
				path,
				message: `Delete content ${path}`,
				sha,
				branch,
			};

			const result = await this.octokit.request(
				"DELETE /repos/{owner}/{repo}/contents/{path}",
				payload,
			);

			Logger.info(
				`Deleted file ${path} from repository ${this.getRepositoryName()}`,
			);

			return result;
		} catch (error) {
			logger.error(error instanceof Error ? error.message : String(error));

			return false;
		}
	}

	async getLatestRelease() {
		try {
			const release = await this.octokit.request(
				"GET /repos/{owner}/{repo}/releases/latest",
				this.getBasePayload(),
			);

			if (!release || !release.data) {
				logger.error("Could not get latest release");
			}

			return release.data;
		} catch (error) {
			logger.error(
				"Could not get latest release",
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	async getLatestCommit(): Promise<
		{ sha: string; commit: { tree: { sha: string } } } | undefined
	> {
		try {
			const latestCommit = await this.octokit.request(
				`GET /repos/{owner}/{repo}/commits/HEAD?cacheBust=${Date.now()}`,
				this.getBasePayload(),
			);

			if (!latestCommit || !latestCommit.data) {
				logger.error("Could not get latest commit");
			}

			return latestCommit.data;
		} catch (error) {
			logger.error(
				"Could not get latest commit",
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	async updateFile({ path, sha, content, branch, message }: IPutPayload) {
		const payload = {
			...this.getBasePayload(),
			path,
			message: message ?? `Update file ${path}`,
			content,
			sha,
			branch,
		};

		try {
			return await this.octokit.request(
				"PUT /repos/{owner}/{repo}/contents/{path}",
				payload,
			);
		} catch (error) {
			logger.error(error instanceof Error ? error.message : String(error));
			throw error;
		}
	}

	/**
	 * Delete multiple files in a single commit using base_tree + sha=null.
	 * @param filePaths - Array of file paths to delete
	 * @param notePathBase - The base path for notes (e.g., "src/content/")
	 */
	async deleteFiles(filePaths: string[], notePathBase: string) {
		const latestCommit = await this.getLatestCommit();

		if (!latestCommit) {
			throw new Error("Could not get latest commit for batch delete");
		}

		const filesToDelete = filePaths.map((path) => {
			if (path.endsWith(".md")) {
				return `${notePathBase}${normalizeGitPath(path)}`;
			}

			return `${this.imagePath}${normalizeGitPath(path)}`;
		});

		// Use base_tree + sha: null to mark files for deletion.
		// This only touches the specified files, avoiding data loss
		// from truncated tree responses on large repos.
		const treeEntries = filesToDelete.map((path) => ({
			path,
			mode: GITHUB_FILE_MODE,
			type: GITHUB_TREE_TYPE_BLOB,
			sha: null,
		}));

		await this.commitTreeToDefaultBranch(
			latestCommit.commit.tree.sha,
			treeEntries,
			"Deleted multiple files",
			latestCommit.sha,
		);
	}

	/**
	 * Update multiple files in a single commit
	 * @param files - Array of files to update
	 * @param remoteImageHashes - Map of image hashes to check for changes
	 * @param notePathBase - The base path for notes (e.g., "src/content/")
	 * @param rewriteRules - Path rewrite rules to apply to file paths
	 */
	async updateFiles(
		files: CompiledPublishFile[],
		remoteImageHashes: Record<string, string> = {},
		notePathBase: string,
		rewriteRules?: PathRewriteRules,
	) {
		const latestCommit = await this.getLatestCommit();

		if (!latestCommit) {
			throw new Error("Could not get latest commit for batch update");
		}

		const treePromises = files.map(async (file) => {
			const [text, _] = file.compiledFile;
			const sha = await this.createBlob(text, "utf-8");

			const filePath = file.getPath();

			const rewrittenPath = rewriteRules
				? getRewrittenPath(filePath, rewriteRules)
				: filePath;

			return {
				path: `${notePathBase}${normalizeGitPath(rewrittenPath)}`,
				mode: GITHUB_FILE_MODE,
				type: GITHUB_TREE_TYPE_BLOB,
				sha,
			};
		});

		// Filter out unchanged images before creating blobs
		const allImages = files.flatMap((x) => x.compiledFile[1].images);

		// Deduplicate images by path within the batch
		const uniqueImages = new Map<string, (typeof allImages)[number]>();

		for (const asset of allImages) {
			if (!uniqueImages.has(asset.path)) {
				uniqueImages.set(asset.path, asset);
			}
		}

		const imagesToUpload = Array.from(uniqueImages.values()).filter((asset) => {
			if (
				shouldSkipUnchangedImage(
					asset.path,
					asset.localHash,
					remoteImageHashes,
					this.imageUrlPrefix,
				)
			) {
				logger.debug(`Skipping unchanged image: ${asset.path}`);

				return false;
			}

			return true;
		});

		const treeAssetPromises = imagesToUpload.map(async (asset) => {
			const sha = await this.createBlob(asset.content, "base64");

			return {
				path: `${this.imagePath}${normalizeGitPath(
					stripVaultImagePrefix(asset.path, this.imageUrlPrefix),
				)}`,
				mode: GITHUB_FILE_MODE,
				type: GITHUB_TREE_TYPE_BLOB,
				sha,
			};
		});
		treePromises.push(...treeAssetPromises);

		// Limit concurrency to avoid triggering GitHub secondary rate limits
		const CONCURRENCY_LIMIT = 10;

		const tree: Array<{
			path: string;
			mode: typeof GITHUB_FILE_MODE;
			type: typeof GITHUB_TREE_TYPE_BLOB;
			sha: string;
		}> = [];

		for (let i = 0; i < treePromises.length; i += CONCURRENCY_LIMIT) {
			const batch = treePromises.slice(i, i + CONCURRENCY_LIMIT);
			tree.push(...(await Promise.all(batch)));
		}

		await this.commitTreeToDefaultBranch(
			latestCommit.commit.tree.sha,
			tree,
			"Published multiple files",
			latestCommit.sha,
		);
	}

	private async createBlob(
		content: string,
		encoding: "utf-8" | "base64",
	): Promise<string> {
		const blob = await this.octokit.request(
			"POST /repos/{owner}/{repo}/git/blobs",
			{
				...this.getBasePayload(),
				content,
				encoding,
			},
		);

		return blob.data.sha;
	}

	private async commitTreeToDefaultBranch(
		baseTreeSha: string,
		tree: Array<{
			path: string;
			mode: typeof GITHUB_FILE_MODE;
			type: typeof GITHUB_TREE_TYPE_BLOB;
			sha: string | null;
		}>,
		commitMessage: string,
		latestCommitSha: string,
	): Promise<void> {
		const repoDataPromise = this.octokit.request("GET /repos/{owner}/{repo}", {
			...this.getBasePayload(),
		});

		const newTree = await this.octokit.request(
			"POST /repos/{owner}/{repo}/git/trees",
			{
				...this.getBasePayload(),
				base_tree: baseTreeSha,
				tree,
			},
		);

		const newCommit = await this.octokit.request(
			"POST /repos/{owner}/{repo}/git/commits",
			{
				...this.getBasePayload(),
				message: commitMessage,
				tree: newTree.data.sha,
				parents: [latestCommitSha],
			},
		);

		const defaultBranch = (await repoDataPromise).data.default_branch;

		await this.octokit.request(
			"PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}",
			{
				...this.getBasePayload(),
				branch: defaultBranch,
				sha: newCommit.data.sha,
			},
		);
	}

	async getRepositoryInfo() {
		const repoInfo = await this.octokit
			.request("GET /repos/{owner}/{repo}", {
				...this.getBasePayload(),
			})
			.catch((error) => {
				logger.error(error instanceof Error ? error.message : String(error));

				logger.warn(
					`Could not get repository info for ${this.getRepositoryName()}`,
				);

				return undefined;
			});

		return repoInfo?.data;
	}

	async createBranch(branchName: string, sha: string) {
		await this.octokit.request("POST /repos/{owner}/{repo}/git/refs", {
			...this.getBasePayload(),
			ref: `refs/heads/${branchName}`,
			sha,
		});
	}
}

export type TRepositoryContent = Awaited<
	ReturnType<typeof RepositoryConnection.prototype.getContent>
>;
