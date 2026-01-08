import js from '@eslint/js';
import eslintPluginAstro from 'eslint-plugin-astro';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
	// add more generic rule sets here, such as:
	js.configs.recommended,
	tseslint.configs.recommended,
	...eslintPluginAstro.configs.recommended,
	{
		ignores: ['.astro/**']
	},
	{
		rules: {
			// override/add rules settings here, such as:
			// "astro/no-set-html-directive": "error"
			'@typescript-eslint/no-explicit-any': 'warn'
		}
	}
]);
