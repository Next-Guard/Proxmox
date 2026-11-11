import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				/** Livello del lab (es. "advanced", "avanzato"): diventa un badge sotto il titolo. */
				level: z.string().optional(),
				/** Durata indicativa del lab. */
				duration: z.string().optional(),
			}),
		}),
	}),
	i18n: defineCollection({
		loader: i18nLoader(),
		schema: i18nSchema({
			extend: z
				.object({
					'pc.level': z.string(),
					'pc.duration': z.string(),
					'pc.hero.eyebrow': z.string(),
					'pc.hero.terminal': z.string(),
					'pc.hero.stats.labs': z.string(),
					'pc.hero.stats.screenshots': z.string(),
					'pc.hero.stats.outputs': z.string(),
					'pc.hero.stats.languages': z.string(),
					'pc.footer.copyright': z.string(),
					'pc.footer.content': z.string(),
					'pc.footer.content.cc': z.string(),
					'pc.footer.content.code': z.string(),
					'pc.footer.createdBy': z.string(),
					'pc.footer.trademark': z.string(),
					'pc.footer.repo': z.string(),
				})
				.partial(),
		}),
	}),
};
