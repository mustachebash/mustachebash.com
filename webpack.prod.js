const { DefinePlugin } = require('webpack'),
	HtmlWebpackPlugin = require('html-webpack-plugin'),
	ImageminPlugin = require('imagemin-webpack-plugin').default,
	merge = require('webpack-merge'),
	UglifyJSPlugin = require('uglifyjs-webpack-plugin'),
	common = require('./webpack.common');

const config = {
	entry: [
		'./src/app.js'
	],
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
			filename: 'index.hbs',
			template: 'src/index.hbs'
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
