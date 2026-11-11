#!/usr/bin/env node
/**
 * Server statico minimo per provare il sito generato come su GitHub Pages:
 * /pagina/ → pagina/index.html, /pagina → redirect a /pagina/, 404.html per gli indirizzi inesistenti.
 *
 * Uso: node tools/serve.mjs [cartella-del-sito] [porta]   (predefiniti: ../nextguard-starlight-site, 4321)
 * Da altri script: import { startServer } from './serve.mjs'
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.jpg': 'image/jpeg',
	'.woff2': 'font/woff2',
	'.xml': 'application/xml',
	'.txt': 'text/plain; charset=utf-8',
	'.wasm': 'application/wasm',
};

export function startServer(root, port = 0) {
	root = path.resolve(root);
	const server = http.createServer((req, res) => {
		const url = new URL(req.url ?? '/', 'http://localhost');
		let rel = decodeURIComponent(url.pathname);
		let file = path.join(root, rel);
		if (!file.startsWith(root)) {
			res.writeHead(403).end();
			return;
		}
		if (rel.endsWith('/')) file = path.join(file, 'index.html');
		else if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
			res.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end();
			return;
		}
		if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
			res.writeHead(404, { 'Content-Type': TYPES['.html'] });
			res.end(fs.readFileSync(path.join(root, '404.html')));
			return;
		}
		res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
		fs.createReadStream(file).pipe(res);
	});
	return new Promise((resolve) => {
		server.listen(port, '127.0.0.1', () => {
			const { port: p } = /** @type {import('node:net').AddressInfo} */ (server.address());
			resolve({ server, url: `http://127.0.0.1:${p}` });
		});
	});
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	const here = path.dirname(fileURLToPath(import.meta.url));
	const dir = process.argv[2] ?? path.join(here, '../../nextguard-starlight-site');
	const { url } = await startServer(dir, Number(process.argv[3] ?? 4321));
	console.log(`Sito ${path.resolve(dir)} su ${url}/`);
}
