const merge = require('webpack-merge'),
	HtmlWebpackPlugin = require('html-webpack-plugin'),
	webpack = require('webpack'),
	common = require('./webpack.common');

const config = {
	entry: [
		'react-hot-loader/patch',
		'react-devtools',
		'./src/app.js'
	],
	devtool: 'inline-source-map',
	devServer: {
		contentBase: './dist',
		historyApiFallback: {
			disableDotRule: true
		}
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
							plugins: ['react-hot-loader/babel', 'transform-object-rest-spread', 'transform-decorators-legacy']
						}
					}
				]
			},
			{
				test: /\.hbs$/,
				loader: 'handlebars-loader'
			}
		]
	},
	plugins: [
		new HtmlWebpackPlugin({
			inject: 'head',
			template: 'src/index.hbs'
		}),
		new webpack.NamedModulesPlugin(),
		new webpack.NoEmitOnErrorsPlugin(),
		new webpack.DefinePlugin({
			'API_HOST': JSON.stringify('http://localhost:4000')
		})
	]
};

module.exports = merge(common, config);
