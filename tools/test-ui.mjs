#!/usr/bin/env node
/**
 * Prove nel browser (Playwright, Chromium) sul sito generato.
 *
 * Uso: node tools/test-ui.mjs [cartella-del-sito]   (predefinita: ../nextguard-starlight-site)
 *
 *  1. pulsante di copia: presente su ogni blocco di comandi, assente su ogni blocco di output
 *     (controllo statico su tutte le pagine e controllo nel browser sul Lab 17, con copia reale
 *     negli appunti e verifica dello stile attenuato dell'output);
 *  2. Mermaid: ogni diagramma di ogni pagina (EN e IT) diventa un SVG, senza errori, anche dopo
 *     il cambio di tema;
 *  3. ricerca Pagefind: risultati solo nella lingua della pagina;
 *  4. selettore di lingua: dal Lab 17 inglese alla stessa pagina in italiano.
 *
 * Esce con codice 1 se una prova fallisce.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(process.argv[2] ?? path.join(here, '../../nextguard-starlight-site'));

const failures = [];
const check = (ok, msg) => {
	console.log(`  ${ok ? 'OK ' : 'NO '} ${msg}`);
	if (!ok) failures.push(msg);
};

// ------------------------------------------------------------------ 1a. Controllo statico
const htmlFiles = [];
(function walk(d) {
	for (const e of fs.readdirSync(d, { withFileTypes: true })) {
		const p = path.join(d, e.name);
		if (e.isDirectory()) walk(p);
		else if (e.name.endsWith('.html')) htmlFiles.push(p);
	}
})(SITE);
let commands = 0;
let commandsWithCopy = 0;
let outputs = 0;
let outputsWithCopy = 0;
const mermaidPages = [];
for (const file of htmlFiles) {
	const html = fs.readFileSync(file, 'utf8');
	for (const m of html.matchAll(/<figure class="([^"]*)"[^>]*>([\s\S]*?)<\/figure>/g)) {
		if (!/\bframe\b/.test(m[1])) continue;
		const hasCopy = m[2].includes('<div class="copy">');
		if (/\bis-output\b/.test(m[1])) {
			outputs++;
			if (hasCopy) outputsWithCopy++;
		} else {
			commands++;
			if (hasCopy) commandsWithCopy++;
		}
	}
	const diagrams = (html.match(/<pre class="mermaid"/g) ?? []).length;
	if (diagrams) {
		const rel = path.relative(SITE, file).replace(/index\.html$/, '');
		mermaidPages.push({ url: `/${rel}`, diagrams });
	}
}
console.log('Blocchi di codice (tutte le pagine)');
check(commands > 0 && commandsWithCopy === commands, `blocchi di comandi/codice con pulsante di copia: ${commandsWithCopy}/${commands}`);
check(outputs > 0 && outputsWithCopy === 0, `blocchi di output con pulsante di copia: ${outputsWithCopy}/${outputs}`);

// ------------------------------------------------------------------ Browser
const { server, url } = await startServer(SITE);
const browser = await chromium.launch();
const newPage = async (options = {}) => {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
	const page = await context.newPage();
	page.errors = [];
	page.on('pageerror', (e) => page.errors.push(e.message));
	return page;
};

// ------------------------------------------------------------------ 1b. Pulsante di copia nel browser
console.log('Pulsante di copia nel browser (/17-ceph-installation/)');
{
	const page = await newPage({ permissions: ['clipboard-read', 'clipboard-write'] });
	await page.goto(`${url}/17-ceph-installation/`);
	const command = page.locator('.expressive-code figure.frame.is-terminal:not(.is-output)').first();
	const output = page.locator('.expressive-code figure.frame.is-output').first();
	const commandButtons = await command.locator('.copy button').count();
	const outputButtons = await output.locator('.copy button').count();
	check(commandButtons === 1, `primo blocco di comandi ("${await command.locator('.title').innerText()}"): pulsante di copia presente (${commandButtons})`);
	check(outputButtons === 0, `blocco di output che lo segue: pulsante di copia assente (${outputButtons})`);
	const expected = (await command.locator('pre').innerText()).trim();
	await command.hover();
	await command.locator('.copy button').click();
	const copied = (await page.evaluate(() => navigator.clipboard.readText())).trim();
	check(copied === expected, `il clic copia esattamente il comando (${copied.split('\n').length} righe)`);
	const styles = await page.evaluate(() => {
		const o = document.querySelector('.expressive-code .frame.is-output');
		const c = document.querySelector('.expressive-code .frame.is-terminal:not(.is-output) pre');
		return {
			outputBorder: getComputedStyle(o).borderTopStyle,
			outputLabel: o.querySelector('.title')?.textContent,
			outputBg: getComputedStyle(o).backgroundColor,
			commandBg: getComputedStyle(c).backgroundColor,
		};
	});
	check(
		styles.outputBorder === 'dashed' && styles.outputBg !== styles.commandBg && styles.outputLabel === 'Output',
		`output distinto dal comando: bordo ${styles.outputBorder}, sfondo ${styles.outputBg} contro ${styles.commandBg}, etichetta "${styles.outputLabel}"`
	);
	check(page.errors.length === 0, `nessun errore JavaScript (${page.errors.length})`);
	await page.context().close();
}

// ------------------------------------------------------------------ 2. Mermaid
console.log('Diagrammi Mermaid');
{
	let total = 0;
	let rendered = 0;
	const page = await newPage({ colorScheme: 'light' });
	for (const { url: pageUrl, diagrams } of mermaidPages) {
		await page.goto(`${url}${pageUrl}`);
		await page
			.waitForFunction(
				(n) => document.querySelectorAll('pre.mermaid[data-processed] svg').length >= n,
				diagrams,
				{ timeout: 20000 }
			)
			.catch(() => {});
		const ok = await page.evaluate(
			() =>
				[...document.querySelectorAll('pre.mermaid')].filter(
					(d) => d.querySelector('svg .node') && !d.textContent.includes('Error rendering diagram')
				).length
		);
		total += diagrams;
		rendered += ok;
		if (ok !== diagrams) console.log(`      ${pageUrl}: ${ok}/${diagrams}`);
	}
	check(total > 0 && rendered === total, `diagrammi resi come SVG: ${rendered}/${total} su ${mermaidPages.length} pagine`);
	// Cambio di tema: astro-mermaid ridisegna con il tema scuro.
	await page.goto(`${url}/the-lab/`);
	await page.waitForSelector('pre.mermaid[data-processed] svg');
	await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
	const redrawn = await page
		.waitForFunction(() => document.querySelector('pre.mermaid[data-processed] svg .node'), null, { timeout: 15000 })
		.then(() => true)
		.catch(() => false);
	check(redrawn, 'diagramma ridisegnato dopo il passaggio al tema scuro');
	check(page.errors.length === 0, `nessun errore JavaScript (${page.errors.length})`);
	await page.context().close();
}

// ------------------------------------------------------------------ 3. Ricerca per lingua
console.log('Ricerca Pagefind');
for (const [lang, start] of [
	['en', '/10-zfs/'],
	['it', '/it/10-zfs/'],
]) {
	const page = await newPage();
	await page.goto(`${url}${start}`);
	await page.click('site-search button[data-open-modal]');
	await page.fill('#starlight__search input', 'ceph');
	await page.waitForSelector('#starlight__search .pagefind-ui__result-link', { timeout: 15000 });
	await page.waitForTimeout(500);
	const links = await page.$$eval('#starlight__search .pagefind-ui__result-link', (as) => as.map((a) => a.getAttribute('href')));
	const inLang = links.filter((h) => (lang === 'it' ? h.startsWith('/it/') : !h.startsWith('/it/')));
	check(links.length > 0 && inLang.length === links.length, `"${lang}": ${links.length} risultati per "ceph", tutti in ${lang}`);
	await page.context().close();
}

// ------------------------------------------------------------------ 4. Selettore di lingua
console.log('Selettore di lingua');
{
	const page = await newPage();
	await page.goto(`${url}/17-ceph-installation/`);
	await Promise.all([
		page.waitForURL('**/it/17-ceph-installation/'),
		page.locator('starlight-lang-select select').first().selectOption({ label: 'Italiano' }),
	]);
	const title = await page.locator('h1').first().innerText();
	check(page.url().endsWith('/it/17-ceph-installation/'), `Italiano → ${new URL(page.url()).pathname} ("${title.replace(/\s+/g, ' ')}")`);
	await page.context().close();
}

await browser.close();
server.close();
if (failures.length) {
	console.error(`\n${failures.length} prove fallite`);
	process.exit(1);
}
console.log('\nTutte le prove superate.');
