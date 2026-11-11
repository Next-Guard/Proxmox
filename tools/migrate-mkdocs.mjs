#!/usr/bin/env node
/**
 * Migrazione dei contenuti dal sito MkDocs Material al progetto Astro Starlight.
 *
 * Uso: node tools/migrate-mkdocs.mjs <cartella-del-repository-mkdocs>
 *
 * Legge mkdocs.yml, docs/en, docs/it, docs/images, docs/files e docs/assets e scrive:
 *   - src/content/docs/*.md (inglese, lingua predefinita) e src/content/docs/it/*.md (italiano);
 *   - src/sidebar.mjs (menu laterale ricavato da `nav` e `nav_translations`);
 *   - src/assets/images/** (screenshot, ottimizzati da Astro), public/files/**, public/CNAME,
 *     public/favicon.svg, src/assets/logo-dark.svg e src/assets/logo-light.svg.
 *
 * Le pagine scritte a mano nel nuovo progetto (home e "Contribuisci") non vengono toccate.
 *
 * Conversioni principali:
 *   - `# Titolo` iniziale → frontmatter `title`; riga "Livello/Durata" → frontmatter `level`/`duration`;
 *   - `!!! tipo "Titolo"` / `??? tipo` con corpo indentato → aside Starlight `:::tipo[Titolo]`;
 *   - citazioni `> **Titolo.** testo` (usate come riquadri) → aside `:::note|tip|caution[Titolo]`;
 *   - ``` { .text .no-copy title="Output" } → ```text output (blocco di output, senza copia);
 *   - ```text title="console" → ```text title="console" frame="terminal";
 *   - link `pagina.md#ancora` → `/pagina/#ancora` (o `/it/pagina/#ancora`), con le ancore ricalcolate
 *     sullo slug di Starlight; immagini `../images/…` → percorso relativo verso src/assets/images.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import GithubSlugger from 'github-slugger';
import YAML from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) {
	console.error('Uso: node tools/migrate-mkdocs.mjs <cartella-del-repository-mkdocs>');
	process.exit(1);
}
const SRC = path.resolve(process.argv[2]);
const DOCS = path.join(SRC, 'docs');
const OUT_DOCS = path.join(ROOT, 'src/content/docs');

/** Lingue: cartella sorgente → sottocartella di src/content/docs e prefisso degli URL. */
const LANGS = {
	en: { dir: '', prefix: '/' },
	it: { dir: 'it', prefix: '/it/' },
};
/** Pagine riscritte a mano nel progetto Starlight. */
const HANDWRITTEN = new Set(['index.md', 'contributing.md']);

const stats = {
	pages: 0,
	asidesFromAdmonitions: 0,
	asidesFromQuotes: 0,
	outputBlocks: 0,
	terminalBlocks: 0,
	links: 0,
	anchorsRemapped: 0,
	images: 0,
	files: 0,
	warnings: [],
};

// ---------------------------------------------------------------------------------------------
// Utilità per il Markdown
// ---------------------------------------------------------------------------------------------

const FENCE_OPEN = /^(\s*)(`{3,}|~{3,})\s*(.*)$/;

function isFenceClose(line, fence) {
	const m = line.match(/^(\s*)(`{3,}|~{3,})\s*$/);
	return Boolean(m && m[2][0] === fence.marker[0] && m[2].length >= fence.marker.length);
}

/** Divide una riga in segmenti di testo e di codice inline (`…`), per non toccare il codice. */
function splitInlineCode(line) {
	const parts = [];
	let i = 0;
	let text = '';
	while (i < line.length) {
		if (line[i] === '`') {
			let n = 0;
			while (line[i + n] === '`') n++;
			const ticks = '`'.repeat(n);
			let j = i + n;
			let close = -1;
			while (j < line.length) {
				const k = line.indexOf(ticks, j);
				if (k === -1) break;
				if (line[k + n] !== '`' && line[k - 1] !== '`') {
					close = k;
					break;
				}
				j = k + 1;
			}
			if (close !== -1) {
				if (text) parts.push({ code: false, value: text });
				text = '';
				parts.push({ code: true, value: line.slice(i, close + n) });
				i = close + n;
				continue;
			}
			text += ticks;
			i += n;
			continue;
		}
		text += line[i];
		i++;
	}
	if (text) parts.push({ code: false, value: text });
	return parts;
}

/** Testo "visibile" di un titolo Markdown, come lo vedono gli slugger. */
function headingText(md) {
	return splitInlineCode(md)
		.map((p) =>
			p.code
				? p.value.replace(/^`+ ?| ?`+$/g, '')
				: p.value
						.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
						.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
						.replace(/<[^>]+>/g, '')
						.replace(/\*\*|__|\*/g, '')
						.replace(/&amp;/g, '&')
		)
		.join('')
		.trim();
}

/** Slug di MkDocs (pymdownx.slugs.slugify, case=lower) con i duplicati `_1`, `_2`… */
function mkdocsSlugger() {
	const seen = new Map();
	return (text) => {
		let slug = text
			.normalize('NFC')
			.replace(/<\/?[^>]*>/g, '')
			.trim()
			.toLowerCase()
			.replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, '')
			.replace(/ /g, '-');
		const base = slug;
		let n = seen.get(base) ?? 0;
		if (n > 0) slug = `${base}_${n}`;
		seen.set(base, n + 1);
		return slug;
	};
}

/** Slug di Starlight: github-slugger sul testo con punteggiatura tipografica (smart punctuation). */
function smartText(text) {
	return text
		.replace(/\.\.\./g, '…')
		.replace(/---/g, '—')
		.replace(/--/g, '–')
		.replace(/'/g, '’')
		.replace(/"/g, '”');
}

// ---------------------------------------------------------------------------------------------
// Indice dei titoli di ogni pagina (per ricalcolare le ancore dei link)
// ---------------------------------------------------------------------------------------------

function collectHeadings(text) {
	const lines = text.split('\n');
	const oldSlug = mkdocsSlugger();
	const newSlugger = new GithubSlugger();
	const map = new Map();
	let fence = null;
	let first = true;
	for (const line of lines) {
		if (fence) {
			if (isFenceClose(line, fence)) fence = null;
			continue;
		}
		const fo = line.match(FENCE_OPEN);
		if (fo) {
			fence = { marker: fo[2] };
			continue;
		}
		const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
		if (!h) continue;
		const txt = headingText(h[2]);
		const o = oldSlug(txt);
		// Il primo H1 diventa il titolo della pagina (id `_top`): non è nel corpo.
		if (first && h[1] === '#') {
			first = false;
			continue;
		}
		first = false;
		map.set(o, newSlugger.slug(smartText(txt)));
	}
	return map;
}

// ---------------------------------------------------------------------------------------------
// Conversioni
// ---------------------------------------------------------------------------------------------

const GENERIC_LABELS = {
	note: 'note',
	nota: 'note',
	tip: 'tip',
	consiglio: 'tip',
	suggerimento: 'tip',
	warning: 'caution',
	attenzione: 'caution',
};

function classifyLabel(label) {
	if (/^(watch|careful|mind|warning|attenzione|occhio)\b/i.test(label)) return 'caution';
	if (/\b(advice|tip|consiglio|suggerimento)\b/i.test(label)) return 'tip';
	return 'note';
}

function capitalize(s) {
	return s.replace(/^(\s*)(\p{Ll})/u, (_, sp, c) => sp + c.toUpperCase());
}

/** Corpo di una citazione-riquadro → righe di un aside Starlight. */
function asideFromQuote(block, indent) {
	const body = [...block];
	let type = 'note';
	let title = null;
	const m = body[0].match(/^\*\*(.+?)\*\*(.*)$/);
	if (m) {
		const lead = m[1].trim();
		const rest = m[2];
		if (/[.:?]$/.test(lead) || /^[.:]/.test(rest)) {
			const label = lead.replace(/[.:]$/, '').trim();
			const generic = GENERIC_LABELS[label.toLowerCase()];
			if (generic) {
				type = generic;
				body[0] = capitalize(rest.replace(/^[.:]?\s*/, ''));
			} else {
				type = classifyLabel(label);
				title = label;
				body[0] = rest.replace(/^[.:]?\s*/, '');
			}
			if (!body[0].trim()) body.shift();
		}
	}
	stats.asidesFromQuotes++;
	return [
		`${indent}:::${type}${title ? `[${title}]` : ''}`,
		...body.map((l) => (l.trim() ? indent + l : '')),
		`${indent}:::`,
	];
}

/** Passo 1: le citazioni `>` fuori dai blocchi di codice diventano aside. */
function convertQuotes(lines) {
	const out = [];
	let fence = null;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (fence) {
			out.push(line);
			if (isFenceClose(line, fence)) fence = null;
			continue;
		}
		const fo = line.match(FENCE_OPEN);
		if (fo) {
			fence = { marker: fo[2] };
			out.push(line);
			continue;
		}
		const q = line.match(/^( *)>(?: |$)/);
		if (!q) {
			out.push(line);
			continue;
		}
		const indent = q[1];
		const re = new RegExp(`^${indent}>(?: |$)`);
		const block = [];
		while (i < lines.length && re.test(lines[i])) {
			block.push(lines[i].slice(indent.length + 1).replace(/^ /, ''));
			i++;
		}
		i--;
		if (out.length && out[out.length - 1].trim()) out.push('');
		out.push(...asideFromQuote(block, indent));
		if (i + 1 < lines.length && lines[i + 1].trim()) out.push('');
	}
	return out;
}

/** Info string dei blocchi di codice. */
function convertFenceInfo(info) {
	const trimmed = info.trim();
	if (trimmed.startsWith('{')) {
		const inner = trimmed.replace(/^\{|\}$/g, '');
		const classes = [...inner.matchAll(/(?:^|\s)\.([\w-]+)/g)].map((m) => m[1]);
		const title = inner.match(/title="([^"]*)"/)?.[1];
		const noCopy = classes.includes('no-copy');
		const lang = classes.find((c) => c !== 'no-copy') ?? 'text';
		if (noCopy || title === 'Output') {
			stats.outputBlocks++;
			return `${lang} output${title && title !== 'Output' ? ` title="${title}"` : ''}`;
		}
		return `${lang}${title ? ` title="${title}"` : ''}`;
	}
	const m = trimmed.match(/^(text|plain|txt)\s+(title="[^"]*")\s*$/);
	if (m) {
		stats.terminalBlocks++;
		return `${m[1]} ${m[2]} frame="terminal"`;
	}
	return trimmed;
}

function rewriteUrl(url, ctx) {
	const { lang, headings, file } = ctx;
	const prefix = LANGS[lang].prefix;
	const img = url.match(/^\.\.\/images\/(.+)$/);
	if (img) {
		stats.images++;
		const up = LANGS[lang].dir ? '../../../' : '../../';
		return `${up}assets/images/${img[1]}`;
	}
	const file_ = url.match(/^\.\.\/files\/(.+)$/);
	if (file_) {
		stats.files++;
		return `/files/${file_[1]}`;
	}
	const page = url.match(/^([\w.-]+)\.md(?:#([^\s)]*))?$/);
	const self = url.match(/^#(.+)$/);
	if (!page && !self) return url;
	stats.links++;
	const target = page ? page[1] : file.replace(/\.md$/, '');
	const anchor = page ? page[2] : self[1];
	let out = page ? (target === 'index' ? prefix : `${prefix}${target}/`) : '';
	if (anchor) {
		const map = headings.get(`${lang}/${target}.md`);
		const mapped = map?.get(anchor);
		if (mapped && mapped !== anchor) stats.anchorsRemapped++;
		if (!mapped) stats.warnings.push(`${lang}/${file}: ancora non trovata tra i titoli: ${url}`);
		out += `#${mapped ?? anchor}`;
	}
	return out;
}

/** Link e immagini nel testo, senza toccare il codice inline. */
function convertInline(line, ctx) {
	return splitInlineCode(line)
		.map((p) =>
			p.code ? p.value : p.value.replace(/\]\(([^()\s]+)\)/g, (_, url) => `](${rewriteUrl(url, ctx)})`)
		)
		.join('');
}

const ADMONITION_TYPES = {
	note: 'note',
	abstract: 'note',
	summary: 'note',
	info: 'note',
	todo: 'note',
	question: 'note',
	example: 'note',
	quote: 'note',
	tip: 'tip',
	hint: 'tip',
	important: 'tip',
	success: 'tip',
	check: 'tip',
	done: 'tip',
	warning: 'caution',
	caution: 'caution',
	attention: 'caution',
	failure: 'danger',
	fail: 'danger',
	missing: 'danger',
	danger: 'danger',
	error: 'danger',
	bug: 'danger',
};

/** Passo 2: blocchi di codice, admonition MkDocs, link e immagini. */
function convertBody(lines, ctx) {
	const out = [];
	let fence = null;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (fence) {
			out.push(line);
			if (isFenceClose(line, fence)) fence = null;
			continue;
		}
		const fo = line.match(FENCE_OPEN);
		if (fo) {
			fence = { marker: fo[2] };
			out.push(`${fo[1]}${fo[2]}${convertFenceInfo(fo[3])}`);
			continue;
		}
		const ad = line.match(/^( *)(!!!|\?\?\?\+?)\s+([\w-]+)(?:\s+"([^"]*)")?\s*$/);
		if (ad) {
			const [, indent, , kind, title] = ad;
			const body = [];
			const bodyIndent = `${indent}    `;
			while (i + 1 < lines.length && (lines[i + 1].startsWith(bodyIndent) || !lines[i + 1].trim())) {
				body.push(lines[++i]);
			}
			while (body.length && !body[body.length - 1].trim()) {
				body.pop();
				i--;
			}
			const type = ADMONITION_TYPES[kind.toLowerCase()] ?? 'note';
			stats.asidesFromAdmonitions++;
			out.push(`${indent}:::${type}${title ? `[${title}]` : ''}`);
			out.push(
				...convertBody(
					body.map((l) => (l.trim() ? indent + l.slice(bodyIndent.length) : '')),
					ctx
				)
			);
			out.push(`${indent}:::`);
			continue;
		}
		out.push(convertInline(line, ctx));
	}
	return out;
}

function convertPage(text, ctx) {
	let lines = text.replace(/\r\n/g, '\n').split('\n');
	if (lines[0] === '---') {
		const end = lines.indexOf('---', 1);
		lines = lines.slice(end + 1);
	}
	// Titolo: il primo `# …` della pagina.
	const h1 = lines.findIndex((l) => /^#\s+/.test(l));
	if (h1 === -1) throw new Error(`${ctx.lang}/${ctx.file}: manca il titolo "# …"`);
	const title = lines[h1].replace(/^#\s+/, '').trim();
	lines.splice(h1, 1);
	while (lines.length && !lines[0].trim()) lines.shift();

	const front = { title };
	const meta = lines[0]?.match(/^\*\*(?:Level|Livello):\*\*\s*(.+?)\s*·\s*\*\*(?:Duration|Durata):\*\*\s*(.+?)\s*$/);
	if (meta) {
		front.level = meta[1];
		front.duration = meta[2];
		lines.shift();
		while (lines.length && !lines[0].trim()) lines.shift();
	}

	lines = convertQuotes(lines);
	lines = convertBody(lines, ctx);
	while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
	return `---\n${YAML.stringify(front, { lineWidth: 0 })}---\n\n${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------------------------
// Menu laterale da mkdocs.yml
// ---------------------------------------------------------------------------------------------

function buildSidebar(mkdocs) {
	const i18n = mkdocs.plugins.find((p) => p && p.i18n)?.i18n;
	const tr = i18n?.languages.find((l) => l.locale === 'it')?.nav_translations ?? {};
	const translations = (label) => (tr[label] && tr[label] !== label ? { it: tr[label] } : undefined);
	const item = (entry, depth) => {
		const [label, value] = Object.entries(entry)[0];
		if (typeof value === 'string') {
			if (value === 'index.md') return null;
			return { label, translations: translations(label), slug: value.replace(/\.md$/, '') };
		}
		const items = value.map((e) => item(e, depth + 1)).filter(Boolean);
		const group = { label, translations: translations(label), items };
		// I gruppi lunghi (le parti del percorso) partono chiusi: Starlight apre quello della pagina corrente.
		if (items.length > 2) group.collapsed = true;
		return group;
	};
	return mkdocs.nav.map((e) => item(e, 0)).filter(Boolean);
}

function writeSidebar(sidebar) {
	const clean = JSON.parse(JSON.stringify(sidebar));
	const body = JSON.stringify(clean, null, '\t').replace(/"(\w+)":/g, '$1:');
	const file = `// Menu laterale del sito, ricavato da \`nav\` e \`nav_translations\` di mkdocs.yml
// (tools/migrate-mkdocs.mjs). Le etichette tengono il numero del lab; \`translations.it\` è l'italiano.
export const sidebar = ${body};
`;
	fs.writeFileSync(path.join(ROOT, 'src/sidebar.mjs'), file);
}

// ---------------------------------------------------------------------------------------------
// File statici
// ---------------------------------------------------------------------------------------------

function copyDir(from, to) {
	fs.rmSync(to, { recursive: true, force: true });
	fs.cpSync(from, to, { recursive: true });
	let n = 0;
	const walk = (d) => {
		for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			if (e.name.startsWith('.') || e.name.startsWith('_')) {
				throw new Error(`Nome non ammesso (inizia con "." o "_"): ${path.join(d, e.name)}`);
			}
			if (e.isDirectory()) walk(path.join(d, e.name));
			else n++;
		}
	};
	walk(to);
	return n;
}

function lightLogo(svg) {
	// Il logo originale è bianco su fondo scuro: per il tema chiaro usa il blu del marchio.
	return svg
		.replace('fill="#ffffff" fill-opacity="0.12"', 'fill="#1b3a5c" fill-opacity="0.08"')
		.replace('stroke="#ffffff"', 'stroke="#1b3a5c"')
		.replaceAll('fill="#ffffff"', 'fill="#1b3a5c"')
		.replaceAll('fill="#2dd4bf"', 'fill="#0d9488"');
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

const mkdocs = YAML.parse(fs.readFileSync(path.join(SRC, 'mkdocs.yml'), 'utf8'), { logLevel: 'error' });

const headings = new Map();
const sources = [];
for (const lang of Object.keys(LANGS)) {
	for (const file of fs.readdirSync(path.join(DOCS, lang)).filter((f) => f.endsWith('.md')).sort()) {
		const text = fs.readFileSync(path.join(DOCS, lang, file), 'utf8');
		headings.set(`${lang}/${file}`, collectHeadings(text));
		if (!HANDWRITTEN.has(file)) sources.push({ lang, file, text });
	}
}

for (const lang of Object.keys(LANGS)) {
	const dir = path.join(OUT_DOCS, LANGS[lang].dir);
	fs.mkdirSync(dir, { recursive: true });
	for (const f of fs.readdirSync(dir)) {
		if (f.endsWith('.md') && !HANDWRITTEN.has(f)) fs.rmSync(path.join(dir, f));
	}
}

for (const { lang, file, text } of sources) {
	const out = convertPage(text, { lang, file, headings });
	fs.writeFileSync(path.join(OUT_DOCS, LANGS[lang].dir, file), out);
	stats.pages++;
}

writeSidebar(buildSidebar(mkdocs));

const images = copyDir(path.join(DOCS, 'images'), path.join(ROOT, 'src/assets/images'));
const files = copyDir(path.join(DOCS, 'files'), path.join(ROOT, 'public/files'));
fs.copyFileSync(path.join(DOCS, 'CNAME'), path.join(ROOT, 'public/CNAME'));
fs.copyFileSync(path.join(DOCS, 'assets/favicon.svg'), path.join(ROOT, 'public/favicon.svg'));
const logo = fs.readFileSync(path.join(DOCS, 'assets/logo.svg'), 'utf8');
fs.writeFileSync(path.join(ROOT, 'src/assets/logo-dark.svg'), logo);
fs.writeFileSync(path.join(ROOT, 'src/assets/logo-light.svg'), lightLogo(logo));

console.log(`Pagine convertite: ${stats.pages}`);
console.log(`Aside da admonition: ${stats.asidesFromAdmonitions}, da citazioni: ${stats.asidesFromQuotes}`);
console.log(`Blocchi di output: ${stats.outputBlocks}, console con frame terminal: ${stats.terminalBlocks}`);
console.log(`Link a pagine: ${stats.links} (ancore ricalcolate: ${stats.anchorsRemapped}), immagini: ${stats.images}, file: ${stats.files}`);
console.log(`Copiati: ${images} immagini in src/assets/images, ${files} file in public/files`);
for (const w of stats.warnings) console.warn(`ATTENZIONE: ${w}`);
