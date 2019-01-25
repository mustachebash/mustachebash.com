const path = require('path'),
	webpack = require('webpack'),
	CleanWebpackPlugin = require('clean-webpack-plugin'),
	UglifyJSPlugin = require('uglifyjs-webpack-plugin'),
	MiniCssExtractPlugin = require('mini-css-extract-plugin'),
	OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin'),
	HtmlWebpackPlugin = require('html-webpack-plugin'),
	ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin'),
	HTMLInlineCSSWebpackPlugin = require('html-inline-css-webpack-plugin').default,
	CopyPlugin = require('copy-webpack-plugin'),
	ImageminPlugin = require('imagemin-webpack-plugin').default;

module.exports = (env = {}, argv) => {
	const devMode = argv.mode !== 'production',
		debugMode = env.debug,
		entry = {
			main: ['whatwg-fetch', './src/main.js'],
			privacyPolicy: './src/privacy-policy.less'
		};

	if(debugMode) entry.main.unshift('react-devtools');

	return {
		entry,
		devtool: devMode ? 'inline-source-map' : false,
		resolve: {
			modules: [path.resolve(__dirname, 'src'), 'node_modules']
		},
		output: {
			path: path.resolve(__dirname, 'dist'),
			filename: 'main.[hash].js',
			publicPath: '/'
		},
		devServer: {
			publicPath: '/',
			contentBase: './dist',
			historyApiFallback: {
				disableDotRule: true
			}
		},
		module: {
			rules: [
				{
					test: /(\.less$)|(\.css$)/,
					use: [
						devMode ? 'style-loader' : MiniCssExtractPlugin.loader,
						'css-loader',
						'less-loader'
					]
				},
				{
					test: /\.js$/,
					exclude: [/node_modules/],
					use: [
						{
							loader: 'babel-loader',
							options: {
								presets: [['@babel/env', {modules: false, useBuiltIns: 'usage'}]],
								plugins: [
									'@babel/proposal-object-rest-spread'
								]
							}
						}
					]
				}
			]
		},
		optimization: {
			minimizer: [
				new OptimizeCssAssetsPlugin({
					cssProcessorOptions: {discardComments: {removeAll: true}}
				}),
				new UglifyJSPlugin()
			]
		},
		plugins: [
			new CleanWebpackPlugin(['dist']),
			new HtmlWebpackPlugin({
				inject: 'head',
				chunks: ['main'],
				filename: devMode ? 'index.html' : '../templates/index.hbs',
				template: 'src/index.hbs'
			}),
			new HtmlWebpackPlugin({
				inject: false,
				chunks: ['privacyPolicy'],
				filename: 'privacy-policy.html',
				template: 'src/privacy-policy.html'
			}),
			new ScriptExtHtmlWebpackPlugin({
				defaultAttribute: 'defer'
			}),
			new MiniCssExtractPlugin({
				filename: '[name].[contenthash].css'
			}),
			new HTMLInlineCSSWebpackPlugin({
				filter(filename) {
					return /privacy/.test(filename);
				}
			}),
			new CopyPlugin([{from: 'src/img', to: 'img'}]),
			new ImageminPlugin({
				disable: devMode,
				test: /\.(jpe?g|png|gif|svg)$/i
			}),
			new webpack.DefinePlugin({
				API_HOST: JSON.stringify(devMode ? 'http://localhost:5000' : 'https://api.mustachebash.com'),
				BRAINTREE_TOKEN: JSON.stringify(devMode ? 'sandbox_qsrxjzth_ht835xhgsgwsz2hn' : 'production_z4qm4zqx_t7bcxj3vjz92bxr2')
			})
		]
	};
};
