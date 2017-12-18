const path = require('path'),
	CleanWebpackPlugin = require('clean-webpack-plugin'),
	HtmlWebpackPlugin = require('html-webpack-plugin'),
	ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin'),
	ExtractTextPlugin = require('extract-text-webpack-plugin'),
	CopyPlugin = require('copy-webpack-plugin');

const extractLess = new ExtractTextPlugin({
	filename: 'main.[contenthash].css',
	disable: process.env.NODE_ENV !== 'production'
});

const config = {
	resolve: {
		modules: [path.resolve(__dirname, 'src'), 'node_modules']
	},
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'app.[hash].js',
		publicPath: '/'
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
			inject: 'head',
			filename: 'privacy-policy.html',
			template: 'src/privacy-policy.html'
		}),
		new ScriptExtHtmlWebpackPlugin({
			defaultAttribute: 'defer'
		}),
		new CopyPlugin([{from: 'src/img', to: 'img'}], {debug: 'debug'}),
		extractLess
	]
};

module.exports = config;
