import { defineConfig, envField } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
	site: 'https://mustachebash.com',
	trailingSlash: 'never',

	experimental: {
			responsiveImages: true
	},

	server: {
			host: true
	},

	build: {
			assets: 'assets'
	},

	env: {
			schema: {
					API_HOST: envField.string({context: 'client', access: 'public'}),
					BRAINTREE_TOKEN: envField.string({context: 'client', access: 'public'})
			}
	},

	vite: {
			build: {
					sourcemap: true,
					rollupOptions: {
							output: {
									sourcemapBaseUrl: 'https://mustachebash.com/assets/'
							}
					}
			},
			server: {
				allowedHosts: true
			}
	},

	integrations: [react()]
});
