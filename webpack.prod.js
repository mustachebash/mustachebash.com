const path = require('path'),
	{ DefinePlugin } = require('webpack'),
	HtmlWebpackPlugin = require('html-webpack-plugin'),
	StyleExtHtmlWebpackPlugin = require('style-ext-html-webpack-plugin'),
	ImageminPlugin = require('imagemin-webpack-plugin').default,
	merge = require('webpack-merge'),
	UglifyJSPlugin = require('uglifyjs-webpack-plugin'),
	common = require('./webpack.common');

const config = {
	entry: {
		main: './src/main.js'
	},
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'main.[chunkhash].js',
		publicPath: '/'
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: [/node_modules/],
				use: [
					{
						loader: 'babel-loader',
						options: {
							presets: ['react', ['env', {modules: false}]],
							plugins: ['transform-object-rest-spread', 'transform-decorators-legacy']
						}
					}
				]
			}
		]
	},
	plugins: [
		new HtmlWebpackPlugin({
			inject: 'head',
			chunks: ['main'],
			filename: 'index.hbs',
			template: 'src/index.hbs'
		}),
		new StyleExtHtmlWebpackPlugin({
			chunks: ['privacyPolicy'],
			position: 'head-bottom'
		}),
		new UglifyJSPlugin(),
		new DefinePlugin({
			'API_HOST': JSON.stringify('https://api.mustachebash.com'),
			'process.env': {
				'NODE_ENV': JSON.stringify('production')
			}
		}),
		new ImageminPlugin({
			test: /\.(jpe?g|png|gif|svg)$/i
		})
	]
};

module.exports = merge(common, config);
