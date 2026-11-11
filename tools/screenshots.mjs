#!/usr/bin/env node
/**
 * Screenshot del sito generato con Playwright (viewport 1440×900, deviceScaleFactor 1).
 *
 * Uso: node tools/screenshots.mjs [cartella-del-sito] [cartella-degli-screenshot]
 *      (predefiniti: ../nextguard-starlight-site, ../starlight-preview)
 *
 *   home-en.png       home inglese, tema chiaro, pagina intera
 *   home-it-dark.png  home italiana, tema scuro, pagina intera
 *   lab17-en.png      Lab 17, tema chiaro: dall'inizio della pagina (menu laterale, titolo, indice) fino
 *                     ai primi comandi con output; in mezzo lo schema in un blocco di codice, la tabella e
 *                     l'aside (l'unico aside del lab è circa 1200 px sopra i primi comandi, quindi non stanno
 *                     nella stessa schermata da 900 px)
 *   lab06-it.png      Lab 06 in italiano, tema scuro: comandi e output della diagnostica del cluster
 *   search-en.png     ricerca "ceph" in inglese, tema chiaro
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(process.argv[2] ?? path.join(here, '../../nextguard-starlight-site'));
const OUT = path.resolve(process.argv[3] ?? path.join(here, '../../starlight-preview'));
fs.mkdirSync(OUT, { recursive: true });

const { server, url } = await startServer(SITE);
const browser = await chromium.launch();

async function page(theme) {
	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 1,
		colorScheme: theme,
		reducedMotion: 'reduce',
	});
	return context.newPage();
}

/** Attende font, immagini visibili e diagrammi Mermaid. */
async function settle(p) {
	await p.evaluate(() => document.fonts.ready);
	await p
		.waitForFunction(
			() => [...document.querySelectorAll('pre.mermaid')].every((d) => d.hasAttribute('data-processed')),
			null,
			{ timeout: 20000 }
		)
		.catch(() => {});
	await p.waitForTimeout(300);
}

async function fullPage(p) {
	// Carica tutte le immagini "lazy" scorrendo la pagina, poi torna in cima.
	await p.evaluate(async () => {
		for (let y = 0; y < document.body.scrollHeight; y += 700) {
			window.scrollTo(0, y);
			await new Promise((r) => setTimeout(r, 40));
		}
		window.scrollTo(0, 0);
	});
	await settle(p);
}

const shots = [];

{
	const p = await page('light');
	await p.goto(`${url}/`);
	await fullPage(p);
	await p.screenshot({ path: path.join(OUT, 'home-en.png'), fullPage: true });
	shots.push('home-en.png');
	await p.context().close();
}
{
	const p = await page('dark');
	await p.goto(`${url}/it/`);
	await fullPage(p);
	await p.screenshot({ path: path.join(OUT, 'home-it-dark.png'), fullPage: true });
	shots.push('home-it-dark.png');
	await p.context().close();
}
{
	const p = await page('light');
	await p.goto(`${url}/17-ceph-installation/`);
	await fullPage(p);
	// Fino al secondo blocco di output della procedura (comando, output, comando, output).
	const bottom = await p.evaluate(() => {
		const outputs = document.querySelectorAll('.sl-markdown-content .expressive-code:has(.is-output)');
		return Math.ceil(outputs[1].getBoundingClientRect().bottom + window.scrollY + 48);
	});
	await p.screenshot({ path: path.join(OUT, 'lab17-en.png'), fullPage: true, clip: { x: 0, y: 0, width: 1440, height: bottom } });
	shots.push('lab17-en.png');
	await p.context().close();
}
{
	const p = await page('dark');
	await p.goto(`${url}/it/06-cluster-corosync/`);
	await settle(p);
	await p.evaluate(() => {
		const h = document.getElementById('6-diagnostica-da-riga-di-comando');
		window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 96);
	});
	await p.waitForTimeout(400);
	await p.screenshot({ path: path.join(OUT, 'lab06-it.png') });
	shots.push('lab06-it.png');
	await p.context().close();
}
{
	const p = await page('light');
	await p.goto(`${url}/10-zfs/`);
	await settle(p);
	await p.click('site-search button[data-open-modal]');
	await p.fill('#starlight__search input', 'ceph');
	await p.waitForSelector('#starlight__search .pagefind-ui__result', { timeout: 15000 });
	await p.waitForTimeout(800);
	await p.screenshot({ path: path.join(OUT, 'search-en.png') });
	shots.push('search-en.png');
	await p.context().close();
}

await browser.close();
server.close();
console.log(`Screenshot in ${OUT}: ${shots.join(', ')}`);
