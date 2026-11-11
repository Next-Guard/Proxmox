// @ts-check
// Configurazione di Expressive Code (blocchi di codice di Starlight).
import { defineEcConfig } from '@astrojs/starlight/expressive-code';
import { pluginOutputBlocks } from './src/expressive-code/output-blocks.mjs';

export default defineEcConfig({
	plugins: [pluginOutputBlocks()],
	frames: {
		// Non spostare la prima riga di commento nel titolo: i blocchi restano identici all'originale.
		extractFileNameFromCode: false,
	},
	styleOverrides: {
		borderRadius: '0.625rem',
		codeFontSize: '0.8125rem',
		codeLineHeight: '1.65',
		codePaddingBlock: '0.85rem',
		codePaddingInline: '1.1rem',
		uiFontSize: '0.8125rem',
		frames: {
			frameBoxShadowCssValue: 'none',
		},
	},
});
