import fs from 'node:fs';

try {
	const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
	const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));

	if (pkg.version !== lock.version) {
		console.error(
			`Version mismatch: package.json (${pkg.version}) vs package-lock.json (${lock.version})`,
		);
		process.exit(1);
	}

	console.log(`\x1b[32m✔\x1b[0m Version check passed (v${pkg.version})`);
} catch (error) {
	console.error('Failed to read package files for version verification:', error.message);
	process.exit(1);
}
