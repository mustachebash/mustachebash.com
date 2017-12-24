const path = require('path'),
	CleanWebpackPlugin = require('clean-webpack-plugin'),
	HtmlWebpackPlugin = require('html-webpack-plugin'),
	ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin'),
	SuppressChunksPlugin = require('suppress-chunks-webpack-plugin').default,
	ExtractTextPlugin = require('extract-text-webpack-plugin'),
	CopyPlugin = require('copy-webpack-plugin');

const extractLess = new ExtractTextPlugin({
	filename: 'main.[contenthash].css',
	disable: process.env.NODE_ENV !== 'production'
});

const config = {
	entry: {
		privacyPolicy: './src/privacy-policy.less'
	},
	resolve: {
		modules: [path.resolve(__dirname, 'src'), 'node_modules']
	},
	module: {
		rules: [
			{
				test: /(\.less$)|(\.css$)/,
				use: extractLess.extract({
					use: ['css-loader', 'postcss-loader', 'less-loader'],
					fallback: 'style-loader'
				})
			}
		]
	},
	plugins: [
		new CleanWebpackPlugin(['dist']),
		new HtmlWebpackPlugin({
			inject: false,
			chunks: ['privacyPolicy'],
			filename: 'privacy-policy.html',
			template: 'src/privacy-policy.html'
		}),
		new ScriptExtHtmlWebpackPlugin({
			defaultAttribute: 'defer'
		}),
		new SuppressChunksPlugin(['privacyPolicy']),
		new CopyPlugin([{from: 'src/img', to: 'img'}], {debug: 'debug'}),
		extractLess
	]
};

module.exports = config;
