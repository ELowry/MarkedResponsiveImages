import fs from 'node:fs';

try {
	const srcPath = 'src/index.d.ts';
	const destPath = 'dist/index.d.ts';

	if (!fs.existsSync('dist')) {
		fs.mkdirSync('dist', { recursive: true });
	}
	fs.copyFileSync(srcPath, destPath);
	console.log(`\x1b[32m✔\x1b[0m Copied ${srcPath} to ${destPath}`);
} catch (error) {
	console.error('Failed to copy type definitions:', error.message);
	process.exit(1);
}
