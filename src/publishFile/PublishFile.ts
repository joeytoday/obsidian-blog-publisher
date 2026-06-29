import { MetadataCache, TFile, Vault } from "obsidian";
import { MarkdownCompiler, TCompiledFile } from "../compiler/MarkdownCompiler";
import {
	FrontmatterCompiler,
	TFrontmatter,
} from "../compiler/FrontmatterCompiler";
import BlogPublisherSettings from "../models/settings";
import { FileMetadataManager } from "./FileMetaDataManager";

interface IPublishFileProps {
	file: TFile;
	vault: Vault;
	compiler: MarkdownCompiler;
	metadataCache: MetadataCache;
	settings: BlogPublisherSettings;
}

export class PublishFile {
	file: TFile;
	compiler: MarkdownCompiler;
	vault: Vault;
	compiledFile?: TCompiledFile;
	metadataCache: MetadataCache;
	frontmatter: TFrontmatter;
	settings: BlogPublisherSettings;
	// Access bp-props and other file metadata
	meta: FileMetadataManager;

	constructor({
		file,
		compiler,
		metadataCache,
		vault,
		settings,
	}: IPublishFileProps) {
		this.compiler = compiler;
		this.metadataCache = metadataCache;
		this.file = file;
		this.settings = settings;
		this.vault = vault;
		this.frontmatter = this.getFrontmatter();

		this.meta = new FileMetadataManager(file, this.frontmatter, settings);
	}

	async compile(): Promise<CompiledPublishFile> {
		const compiledFile = await this.compiler.generateMarkdown(this);

		return new CompiledPublishFile(
			{
				file: this.file,
				compiler: this.compiler,
				metadataCache: this.metadataCache,
				vault: this.vault,
				settings: this.settings,
			},
			compiledFile,
		);
	}

	async getImageLinks() {
		return this.compiler.extractImageLinks(this);
	}

	async cachedRead() {
		return this.vault.cachedRead(this.file);
	}

	getMetadata() {
		return this.metadataCache.getCache(this.file.path) ?? {};
	}

	getBlock(blockId: string) {
		return this.getMetadata().blocks?.[blockId];
	}

	getFrontmatter() {
		return this.metadataCache.getCache(this.file.path)?.frontmatter ?? {};
	}

	/** Add other possible sorting logic here, eg if we add bp-sortWeight
	 * We might also want to sort by meta.getPath for rewritten path
	 */
	compare(other: PublishFile) {
		return this.file.path.localeCompare(other.file.path);
	}

	getPath = () => this.file.path;
	getCompiledFrontmatter() {
		const frontmatterCompiler = new FrontmatterCompiler(this.settings);

		const metadata =
			this.metadataCache.getCache(this.file.path)?.frontmatter ?? {};

		return frontmatterCompiler.compile(this, metadata);
	}
}

export class CompiledPublishFile extends PublishFile {
	compiledFile: TCompiledFile;
	remoteHash?: string;

	constructor(props: IPublishFileProps, compiledFile: TCompiledFile) {
		super(props);

		this.compiledFile = compiledFile;
	}

	getCompiledFile() {
		return this.compiledFile;
	}

	setRemoteHash(hash: string) {
		this.remoteHash = hash;
	}
}
