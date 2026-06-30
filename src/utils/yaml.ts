export function formatYamlValue(value: unknown, indent = ""): string {
	if (value === null) {
		return "null";
	}

	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}

	if (typeof value === "number") {
		return Number.isFinite(value) ? String(value) : "null";
	}

	if (value instanceof Date) {
		return `"${value.toISOString()}"`;
	}

	if (Array.isArray(value)) {
		if (value.length === 0) {
			return "[]";
		}

		return (
			"\n" +
			value
				.map((item) => {
					if (
						typeof item === "object" &&
						item !== null &&
						!Array.isArray(item)
					) {
						const entries = Object.entries(item);

						if (entries.length === 0) {
							return `${indent}  - {}`;
						}
						const [firstK, firstV] = entries[0];

						let line = `${indent}  - ${firstK}: ${formatYamlValue(
							firstV,
							indent + "    ",
						)}`;

						for (let i = 1; i < entries.length; i++) {
							line += `\n${indent}    ${
								entries[i][0]
							}: ${formatYamlValue(entries[i][1], indent + "    ")}`;
						}

						return line;
					}

					return `${indent}  - ${formatYamlValue(item, indent + "  ")}`;
				})
				.join("\n")
		);
	}

	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>);

		if (entries.length === 0) {
			return "{}";
		}

		return (
			"\n" +
			entries
				.map(
					([k, v]) => `${indent}  ${k}: ${formatYamlValue(v, indent + "  ")}`,
				)
				.join("\n")
		);
	}

	const str = String(value);

	if (
		str === "" ||
		/[:#\]{}&'*!|>"%@`,[]/.test(str) ||
		/^\s|\s$/.test(str) ||
		/[\r\n]/.test(str) ||
		/^(?:true|false|null|yes|no|on|off|~)$/i.test(str) ||
		/^[-+]?\d+\.?\d*$/.test(str) ||
		/^\d{4}-\d{2}-\d{2}/.test(str)
	) {
		return `"${str
			.replace(/\\/g, "\\\\")
			.replace(/"/g, '\\"')
			.replace(/\n/g, "\\n")
			.replace(/\r/g, "\\r")
			.replace(/\t/g, "\\t")}"`;
	}

	return str;
}

export function frontMatterToYaml(
	frontMatter: Record<string, unknown>,
): string {
	for (const key of Object.keys(frontMatter)) {
		if (frontMatter[key] === undefined) {
			delete frontMatter[key];
		}
	}

	if (Object.keys(frontMatter).length === 0) {
		return "";
	}
	let yaml = "---\n";

	for (const key of Object.keys(frontMatter)) {
		yaml += `${key}: ${formatYamlValue(frontMatter[key])}\n`;
	}
	yaml += "---";

	return yaml;
}
