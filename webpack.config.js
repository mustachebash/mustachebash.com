const fs = require('fs'),
	path = require('path'),
	webpack = require('webpack'),
	{ CleanWebpackPlugin } = require('clean-webpack-plugin'),
	TerserPlugin = require('terser-webpack-plugin'),
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
			mytickets: ['whatwg-fetch', './src/mytickets.js'],
			privacyPolicy: './src/privacy-policy.less',
			videoLander: './src/video-lander.js',
			lineupLander: './src/lineup-lander.js',
			presellLander: './src/presell-lander.js'
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
			filename: '[name].[hash].js',
			publicPath: '/'
		},
		devServer: {
			publicPath: '/',
			https: env.https
				? {
					key: fs.readFileSync('../server.key'),
					cert: fs.readFileSync('../server.crt'),
					ca: fs.readFileSync('../rootCA.pem')
				}
				: false,
			contentBase: './dist',
			historyApiFallback: {
				rewrites: [
					{from: /^\/$/, to: '/index.html'},
					{from: /^\/privacy-policy\/?$/, to: '/privacy-policy.html'},
					{from: /^\/mytickets\/?$/, to: '/mytickets.html'},
					{from: /^\/v\/?$/, to: '/video-lander.html'}
				]
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
					exclude: [/node_modules\/(?!(dom7|swiper)\/).*/],
					use: [
						{
							loader: 'babel-loader',
							options: {
								presets: [['@babel/env', {modules: false, useBuiltIns: 'usage', corejs: 3}]],
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
				new TerserPlugin()
			]
		},
		plugins: [
			new CleanWebpackPlugin(),
			new HtmlWebpackPlugin({
				inject: 'head',
				chunks: ['main'],
				filename: 'index.html',
				template: 'src/index.html'
			}),
			new HtmlWebpackPlugin({
				inject: 'head',
				chunks: ['mytickets'],
				filename: 'mytickets.html',
				template: 'src/mytickets.html'
			}),
			new HtmlWebpackPlugin({
				inject: false,
				chunks: ['privacyPolicy'],
				filename: 'privacy-policy.html',
				template: 'src/privacy-policy.html'
			}),
			new HtmlWebpackPlugin({
				inject: 'head',
				chunks: ['videoLander'],
				filename: 'video-lander.html',
				template: 'src/video-lander.html'
			}),
			new HtmlWebpackPlugin({
				inject: 'head',
				chunks: ['lineupLander'],
				filename: 'lineup-lander.html',
				template: 'src/lineup-lander.html'
			}),
			new HtmlWebpackPlugin({
				inject: 'head',
				chunks: ['presellLander'],
				filename: 'presell-lander.html',
				template: 'src/presell-lander.html'
			}),
			new ScriptExtHtmlWebpackPlugin({
				defaultAttribute: 'defer'
			}),
			new MiniCssExtractPlugin({
				filename: '[name].[contenthash].css'
			}),
			new HTMLInlineCSSWebpackPlugin({
				filter(filename) {
					return /privacy|lander/.test(filename);
				}
			}),
			new CopyPlugin([{from: 'src/img', to: 'img'}]),
			new ImageminPlugin({
				disable: devMode,
				test: /\.(jpe?g|png|gif|svg)$/i
			}),
			new webpack.DefinePlugin({
				API_HOST: JSON.stringify(devMode ? 'https://localhost:5000' : 'https://api.mustachebash.com'),
				BRAINTREE_TOKEN: JSON.stringify(devMode ? 'sandbox_qsrxjzth_ht835xhgsgwsz2hn' : 'production_z4qm4zqx_t7bcxj3vjz92bxr2')
			})
		]
	};
};
