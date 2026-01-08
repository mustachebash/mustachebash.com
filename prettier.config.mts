export default {
	printWidth: 200,
	tabWidth: 4,
	useTabs: true,
	singleQuote: true,
	trailingComma: 'none',
	arrowParens: 'avoid',
	plugins: ['prettier-plugin-astro'],
	overrides: [
		{
			files: '*.astro',
			options: {
				parser: 'astro'
			}
		}
	]
};
