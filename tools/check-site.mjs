#!/usr/bin/env node
/**
 * Verifiche sul sito generato.
 *
 * Uso: node tools/check-site.mjs <cartella-del-sito> [cartella-del-repository]
 *
 *  1. nessun file o cartella il cui nome inizia con "_" o "." (GitHub Pages senza .nojekyll);
 *  2. CNAME nella radice;
 *  3. entrambe le lingue presenti, con le stesse pagine (inglese in /, italiano in /it/);
 *  4. link interni: ogni href/src/srcset delle pagine HTML punta a un file esistente e ogni #ancora
 *     esiste nella pagina di destinazione (anche i link assoluti verso https://proxmox.community);
 *  5. indice di ricerca Pagefind con entrambe le lingue;
 *  6. (con il repository) nessuna sintassi MkDocs residua nei contenuti: `!!!`, `???`, `{ .`.
 *
 * Esce con codice 1 se una verifica fallisce.
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? '');
const REPO = process.argv[3] ? path.resolve(process.argv[3]) : null;
const SITE = 'https://proxmox.community';
const LANG_PREFIXES = { en: '/', it: '/it/' };

const errors = [];
const fail = (msg) => errors.push(msg);

function walk(dir, rel = '') {
	const out = [];
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const r = rel ? `${rel}/${e.name}` : e.name;
		if (e.isDirectory()) {
			out.push({ rel: r, dir: true });
			out.push(...walk(path.join(dir, e.name), r));
		} else out.push({ rel: r, dir: false });
	}
	return out;
}

if (!fs.existsSync(path.join(OUT, 'index.html'))) {
	console.error(`Sito non trovato in ${OUT}`);
	process.exit(1);
}
const entries = walk(OUT);
const files = entries.filter((e) => !e.dir).map((e) => e.rel);
const fileSet = new Set(files);

// 1. Percorsi che Jekyll ignorerebbe
const hidden = entries.filter((e) => e.rel.split('/').some((p) => p.startsWith('_') || p.startsWith('.')));
for (const h of hidden.slice(0, 20)) fail(`percorso che inizia con "_" o ".": ${h.rel}`);
if (hidden.length > 20) fail(`… e altri ${hidden.length - 20} percorsi con "_" o "."`);

// 2. CNAME
const cname = fs.existsSync(path.join(OUT, 'CNAME')) ? fs.readFileSync(path.join(OUT, 'CNAME'), 'utf8').trim() : '';
if (cname !== 'proxmox.community') fail(`CNAME mancante o errato: "${cname}"`);

// 3. Lingue
const html = files.filter((f) => f.endsWith('.html'));
const pages = html.filter((f) => f.endsWith('index.html'));
const itPages = pages.filter((f) => f.startsWith('it/'));
const enPages = pages.filter((f) => !f.startsWith('it/'));
const slug = (f, prefix) => f.slice(prefix.length);
const enSlugs = new Set(enPages.map((f) => slug(f, '')));
const itSlugs = new Set(itPages.map((f) => slug(f, 'it/')));
for (const s of enSlugs) if (!itSlugs.has(s)) fail(`pagina senza traduzione italiana: /${s}`);
for (const s of itSlugs) if (!enSlugs.has(s)) fail(`pagina italiana senza originale inglese: /it/${s}`);
const langOf = (f) => fs.readFileSync(path.join(OUT, f), 'utf8').match(/<html[^>]*\blang="([^"]+)"/)?.[1];
for (const f of enPages) if (langOf(f) !== 'en') fail(`lang diverso da "en": ${f}`);
for (const f of itPages) if (langOf(f) !== 'it') fail(`lang diverso da "it": ${f}`);

// 4. Link interni
const idCache = new Map();
function idsOf(file) {
	if (!idCache.has(file)) {
		const text = fs.readFileSync(path.join(OUT, file), 'utf8');
		const ids = new Set();
		for (const m of text.matchAll(/\s(?:id|name)="([^"]*)"/g)) ids.add(decode(m[1]));
		idCache.set(file, ids);
	}
	return idCache.get(file);
}
function decode(s) {
	return s
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}
function targetFile(pathname) {
	let p = decodeURIComponent(pathname).replace(/^\/+/, '');
	if (p === '' || p.endsWith('/')) p += 'index.html';
	if (fileSet.has(p)) return p;
	return null;
}
let linkCount = 0;
let anchorCount = 0;
const broken = [];
for (const file of html) {
	const text = fs.readFileSync(path.join(OUT, file), 'utf8');
	const base = new URL(`${SITE}/${file.replace(/index\.html$/, '')}`);
	const urls = [];
	for (const m of text.matchAll(/\s(?:href|src)="([^"]*)"/g)) urls.push(decode(m[1]));
	for (const m of text.matchAll(/\ssrcset="([^"]*)"/g)) {
		for (const part of decode(m[1]).split(',')) urls.push(part.trim().split(/\s+/)[0]);
	}
	for (const raw of urls) {
		if (!raw || /^(mailto:|tel:|javascript:|data:|blob:)/i.test(raw)) continue;
		let url;
		try {
			url = new URL(raw, base);
		} catch {
			broken.push(`${file}: URL non valido ${raw}`);
			continue;
		}
		if (url.origin !== SITE) continue;
		// La pagina 404 dichiara come canonico /404/ (e /it/404/): GitHub Pages la serve per ogni
		// indirizzo inesistente, quindi quei <link> non sono pagine da raggiungere.
		if (file === '404.html' && /^\/(it\/)?404\/$/.test(url.pathname)) continue;
		linkCount++;
		const target = url.pathname === base.pathname && raw.startsWith('#') ? file : targetFile(url.pathname);
		if (!target) {
			broken.push(`${file}: ${raw}`);
			continue;
		}
		if (url.hash && target.endsWith('.html')) {
			anchorCount++;
			const id = decodeURIComponent(url.hash.slice(1));
			if (!idsOf(target).has(id)) broken.push(`${file}: ancora mancante ${raw}`);
		}
	}
}
for (const b of broken.slice(0, 30)) fail(`link interno non valido: ${b}`);
if (broken.length > 30) fail(`… e altri ${broken.length - 30} link non validi`);

// 5. Pagefind
const entryFile = path.join(OUT, 'pagefind/pagefind-entry.json');
let searchLangs = {};
if (fs.existsSync(entryFile)) {
	searchLangs = JSON.parse(fs.readFileSync(entryFile, 'utf8')).languages ?? {};
	for (const l of ['en', 'it']) if (!searchLangs[l]) fail(`indice di ricerca senza la lingua "${l}"`);
} else fail('indice di ricerca Pagefind mancante');

// 6. Sintassi MkDocs residua
let leftovers = null;
if (REPO) {
	leftovers = { '!!!': 0, '???': 0, '{ .': 0 };
	const docs = path.join(REPO, 'src/content/docs');
	for (const f of walk(docs).filter((e) => !e.dir && /\.mdx?$/.test(e.rel))) {
		const text = fs.readFileSync(path.join(docs, f.rel), 'utf8');
		for (const k of Object.keys(leftovers)) {
			const n = text.split(k).length - 1;
			if (n) {
				leftovers[k] += n;
				fail(`sintassi MkDocs residua "${k}" in src/content/docs/${f.rel} (${n})`);
			}
		}
	}
}

// Riepilogo
const pf = (l) => (searchLangs[l] ? `${searchLangs[l].page_count} pagine indicizzate` : 'assente');
console.log('Verifiche sul sito generato');
console.log(`  pagine HTML: ${enPages.length} in inglese, ${itPages.length} in italiano (${html.length} file .html in totale)`);
console.log(`  percorsi con "_" o ".": ${hidden.length}`);
console.log(`  CNAME: ${cname || 'mancante'}`);
console.log(`  link interni controllati: ${linkCount} (ancore: ${anchorCount}), non validi: ${broken.length}`);
console.log(`  ricerca Pagefind: en ${pf('en')}, it ${pf('it')}`);
if (leftovers) console.log(`  sintassi MkDocs residua: ${Object.entries(leftovers).map(([k, v]) => `"${k}" ${v}`).join(', ')}`);
if (errors.length) {
	console.error(`\n${errors.length} problemi:`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}
console.log('  esito: OK');
