const path = require('path'),
	merge = require('webpack-merge'),
	HtmlWebpackPlugin = require('html-webpack-plugin'),
	webpack = require('webpack'),
	common = require('./webpack.common');

const config = {
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: '[name].[hash].js',
		publicPath: '/'
	},
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
				test: /\.hbs$/,
				loader: 'handlebars-loader'
			}
		]
	},
	plugins: [
		new HtmlWebpackPlugin({
			inject: 'head',
			salesOn: false,
			chunks: ['main'],
			template: 'src/index.hbs'
		}),
		new webpack.NamedModulesPlugin(),
		new webpack.NoEmitOnErrorsPlugin(),
		new webpack.DefinePlugin({
			'API_HOST': JSON.stringify('http://localhost:5000'),
			'BRAINTREE_TOKEN': JSON.stringify('sandbox_qsrxjzth_ht835xhgsgwsz2hn')
		})
	]
};

module.exports = merge(common, config);
