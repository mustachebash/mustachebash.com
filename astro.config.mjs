import { defineConfig, envField } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://mustachebash.com',
	trailingSlash: 'never',
	experimental: {
		responsiveImages: true
	},
	build: {
		assets: 'assets'
	},
	env: {
		schema: {
			API_HOST: envField.string({context: 'client', access: 'public'})
		}
	},
	vite: {
		server: {
			https: {
				key: fs.readFileSync('./secrets/localhost-key.pem'),
				cert: fs.readFileSync('./secrets/localhost-cert.pem')
			}
		}
	}
});
