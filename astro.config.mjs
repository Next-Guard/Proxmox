// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import starlightLinksValidator from 'starlight-links-validator';
import { sidebar } from './src/sidebar.mjs';

/**
 * GitHub Pages pubblica senza .nojekyll: Jekyll scarterebbe ogni percorso che inizia con "_" o ".".
 * Gli asset vanno quindi in `assets/` (non `_astro/`) e i nomi dei chunk non devono iniziare con "_"
 * (Mermaid usa moduli lodash-es come `_baseUniq`).
 */
const safeName = (/** @type {string} */ name) =>
	name
		.replace(/[^\w.\-/]/g, '_')
		.split('/')
		.map((part) => part.replace(/^[_.]+/, '') || 'chunk')
		.join('/');

export default defineConfig({
	site: 'https://proxmox.community',
	trailingSlash: 'always',
	build: {
		assets: 'assets',
	},
	vite: {
		environments: {
			client: {
				build: {
					rolldownOptions: {
						output: {
							entryFileNames: (chunk) => `assets/${safeName(chunk.name)}.[hash].js`,
							chunkFileNames: (chunk) => `assets/${safeName(chunk.name)}.[hash].js`,
							assetFileNames: (asset) =>
								`assets/${safeName((asset.names?.[0] ?? 'asset').replace(/\.[^.]+$/, ''))}.[hash][extname]`,
						},
					},
				},
			},
		},
	},
	integrations: [
		// Prima di Starlight: trasforma i blocchi ```mermaid prima di Expressive Code.
		mermaid({
			theme: 'default',
			autoTheme: true,
			enableLog: false,
			mermaidConfig: {
				fontFamily: 'Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif',
				flowchart: { curve: 'basis', htmlLabels: true, padding: 10, wrappingWidth: 150, nodeSpacing: 22, rankSpacing: 48 },
			},
		}),
		starlight({
			title: 'Proxmox Community',
			description: 'Practical, step-by-step Proxmox VE 9 labs on a real lab, from zero to hero.',
			logo: {
				dark: './src/assets/logo-dark.svg',
				light: './src/assets/logo-light.svg',
			},
			favicon: '/favicon.svg',
			defaultLocale: 'root',
			locales: {
				root: { label: 'English', lang: 'en' },
				it: { label: 'Italiano', lang: 'it' },
			},
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Next-Guard/Proxmox' }],
			editLink: { baseUrl: 'https://github.com/Next-Guard/Proxmox/edit/main/' },
			sidebar,
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
			customCss: [
				'@fontsource-variable/inter',
				'@fontsource-variable/jetbrains-mono',
				'./src/styles/custom.css',
			],
			components: {
				Hero: './src/components/Hero.astro',
				PageTitle: './src/components/PageTitle.astro',
				Footer: './src/components/Footer.astro',
				Header: './src/components/Header.astro',
			},
			head: [
				{ tag: 'meta', attrs: { name: 'author', content: 'NextGuard' } },
				{ tag: 'meta', attrs: { property: 'og:image', content: 'https://proxmox.community/og-image.png' } },
				{ tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
				{ tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
				{ tag: 'meta', attrs: { property: 'og:image:alt', content: 'Proxmox Community: from zero to hero, one lab at a time. 53 connected hands-on Proxmox VE 9 labs.' } },
				{ tag: 'meta', attrs: { name: 'twitter:image', content: 'https://proxmox.community/og-image.png' } },
				{ tag: 'meta', attrs: { name: 'theme-color', content: '#0b1222' } },
				{
					tag: 'script',
					content: `(function(){try{var k='pc-lang',p=location.pathname,it=p==='/it'||p.indexOf('/it/')===0,s=localStorage.getItem(k);if(s){return}var l=(navigator.languages&&navigator.languages[0])||navigator.language||'';if(/^it\\b/i.test(l)&&!it){localStorage.setItem(k,'it');location.replace('/it'+(p==='/'?'/':p)+location.search+location.hash)}else{localStorage.setItem(k,it?'it':'en')}}catch(e){}})();`,
				},
			],
			plugins: [starlightLinksValidator()],
		}),
	],
});
