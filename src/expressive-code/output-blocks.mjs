// @ts-check
/**
 * Plugin Expressive Code: blocchi di OUTPUT.
 *
 * Un blocco con l'opzione `output` nel meta (```text output) mostra il risultato del comando
 * precedente: niente pulsante di copia, cornice "code" anche per i linguaggi di shell, titolo
 * predefinito "Output" e classe `is-output` sulla <figure> per lo stile attenuato (src/styles/custom.css).
 *
 * Il pulsante di copia viene creato dal plugin Frames di Expressive Code, che gira prima dei plugin
 * dell'utente: qui lo si toglie dall'albero HTML del blocco già renderizzato, quindi non arriva
 * nella pagina (non è solo nascosto con il CSS).
 */
import { definePlugin } from '@astrojs/starlight/expressive-code';

/** @type {Record<string, string>} */
const LABELS = { en: 'Output', it: 'Output' };

/** @param {import('@astrojs/starlight/expressive-code').ExpressiveCodeBlock} codeBlock */
const isOutput = (codeBlock) => codeBlock.metaOptions.getBoolean('output') === true;

/** @param {any} node */
const classList = (node) => {
	const value = node?.properties?.className;
	return Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value.split(/\s+/) : [];
};

export function pluginOutputBlocks() {
	return definePlugin({
		name: 'Output blocks',
		hooks: {
			preprocessMetadata: ({ codeBlock }) => {
				if (!isOutput(codeBlock)) return;
				const lang = (codeBlock.locale ?? 'en').split('-')[0];
				codeBlock.props.title ??= LABELS[lang] ?? LABELS.en;
				codeBlock.props.frame = 'code';
			},
			postprocessRenderedBlock: ({ codeBlock, renderData }) => {
				const figure = renderData.blockAst;
				// Il titolo del blocco (macchina o "Output") non serve nei risultati della ricerca.
				for (const child of figure.children) {
					if (child.type === 'element' && child.tagName === 'figcaption') {
						child.properties = { ...child.properties, dataPagefindIgnore: '' };
					}
				}
				if (!isOutput(codeBlock)) return;
				figure.properties = figure.properties ?? {};
				figure.properties.className = [...classList(figure), 'is-output'];
				figure.properties.dataOutput = '';
				figure.children = figure.children.filter(
					(child) => !(child.type === 'element' && classList(child).includes('copy'))
				);
			},
		},
	});
}
