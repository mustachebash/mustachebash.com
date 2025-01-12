import { defineConfig, envField } from 'astro/config';

const key = fs.readFileSync('./secrets/localhost-key.pem'),
	cert = fs.readFileSync('./secrets/localhost-cert.pem');
// const key = false,
// 	cert = false;

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
	...(key && cert && {
		vite: {
			server: {
				https: {
					key,
					cert
				}
			}
		}
	})
});
