import { defineConfig, envField } from 'astro/config';

let key, cert;
try {
	key = fs.readFileSync('./secrets/localhost-key.pem');
	cert = fs.readFileSync('./secrets/localhost-cert.pem');
} catch(e) {
	console.log('[WARN] HTTPS is not configured');
	// https not configured
}

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
			API_HOST: envField.string({context: 'client', access: 'public'}),
			BRAINTREE_TOKEN: envField.string({context: 'client', access: 'public'})
		}
	},
	vite: {
		build: {
			sourcemap: true
		},
	...(key && cert && {
			server: {
				https: {
					key,
					cert
				}
			}
		})
	}
});
