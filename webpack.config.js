const fs = require('fs'),
	path = require('path'),
	webpack = require('webpack'),
	{ CleanWebpackPlugin } = require('clean-webpack-plugin'),
	TerserPlugin = require('terser-webpack-plugin'),
	MiniCssExtractPlugin = require('mini-css-extract-plugin'),
	CssMinimizerPlugin = require('css-minimizer-webpack-plugin'),
	HtmlWebpackPlugin = require('html-webpack-plugin'),
	HTMLInlineCSSWebpackPlugin = require('html-inline-css-webpack-plugin').default,
	ImageMinimizerPlugin = require('image-minimizer-webpack-plugin');

module.exports = (env = {}, argv) => {
	const devMode = argv.mode !== 'production',
		debugMode = env.debug,
		entry = {
			main: ['whatwg-fetch', './src/main.js'],
			mytickets: ['whatwg-fetch', './src/mytickets.js'],
			gallery: ['whatwg-fetch', './src/gallery.js'],
			privacyPolicy: './src/privacy-policy.less',
			sanDiego: './src/san-diego.js',
			sanFrancisco: './src/san-francisco.js'
		},
		htmlMinifyOptions = {
			collapseWhitespace: true,
			keepClosingSlash: true,
			removeComments: true,
			removeRedundantAttributes: false,
			removeScriptTypeAttributes: true,
			removeStyleLinkTypeAttributes: true,
			useShortDoctype: true
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
			filename: '[name].[contenthash].js',
			publicPath: '/',
			assetModuleFilename: 'img/[name].[hash][ext][query]'
		},
		devServer: {
			watchFiles: ['src/*.html'],
			port: 8081,
			https: env.https
				? {
					key: fs.readFileSync('../server.key'),
					cert: fs.readFileSync('../server.crt'),
					ca: fs.readFileSync('../rootCA.pem')
				}
				: false,
			historyApiFallback: {
				rewrites: [
					{from: /^\/$/, to: '/index.html'},
					{from: /^\/privacy-policy\/?$/, to: '/privacy-policy.html'},
					{from: /^\/mytickets\/?$/, to: '/mytickets.html'},
					{from: /^\/gallery\/?$/, to: '/gallery.html'},
					{from: /^\/san-diego\/?$/, to: '/san-diego.html'},
					{from: /^\/san-francisco\/?$/, to: '/san-francisco.html'}
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
					exclude: [/node_modules/],
					use: [
						{
							loader: 'babel-loader',
							options: {
								presets: [['@babel/env', {useBuiltIns: 'usage', corejs: 3}]]
							}
						}
					]
				},
				{
					test: /\.(png|jpg|svg)$/,
					include: [/img/],
					type: 'asset/resource'
				},
				{
					test: /\.html$/,
					use: [{
						loader: 'html-loader',
						options: {
							minimize: false
						}
					}]
				}
			]
		},
		optimization: {
			minimizer: [
				new CssMinimizerPlugin({
					minimizerOptions: { preset: ['default', { discardComments: { removeAll: true } }] }
				}),
				new TerserPlugin({extractComments: false, terserOptions: {format: {comments: false}}}),
				new ImageMinimizerPlugin({
					minimizer: {
						implementation: ImageMinimizerPlugin.imageminMinify,
						options: {
							plugins: [
								['jpegtran', { progressive: false }],
								['optipng', { optimizationLevel: 3 }],
								['svgo', {}]
							]
						}
					}
				})
			]
		},
		plugins: [
			new CleanWebpackPlugin(),
			new HtmlWebpackPlugin({
				inject: 'head',
				chunks: ['main'],
				filename: 'index.html',
				template: 'src/index.html',
				minify: htmlMinifyOptions
			}),
			new HtmlWebpackPlugin({
				inject: 'head',
				chunks: ['mytickets'],
				filename: 'mytickets.html',
				template: 'src/mytickets.html',
				minify: htmlMinifyOptions
			}),
			new HtmlWebpackPlugin({
				inject: 'head',
				chunks: ['gallery'],
				filename: 'gallery.html',
				template: 'src/gallery.html',
				minify: htmlMinifyOptions
			}),
			new HtmlWebpackPlugin({
				inject: false,
				chunks: ['privacyPolicy'],
				filename: 'privacy-policy.html',
				template: 'src/privacy-policy.html',
				minify: htmlMinifyOptions
			}),
			new HtmlWebpackPlugin({
				inject: 'head',
				chunks: ['sanDiego'],
				filename: 'san-diego.html',
				template: 'src/san-diego.html',
				minify: htmlMinifyOptions
			}),
			new HtmlWebpackPlugin({
				inject: 'head',
				chunks: ['sanFrancisco'],
				filename: 'san-francisco.html',
				template: 'src/san-francisco.html',
				minify: htmlMinifyOptions
			}),
			new MiniCssExtractPlugin({
				filename: '[name].[contenthash].css'
			}),
			new HTMLInlineCSSWebpackPlugin({
				filter(filename) {
					return /privacy|lander/.test(filename);
				}
			}),
			new webpack.DefinePlugin({
				API_HOST: JSON.stringify(devMode ? 'https://localhost:5000' : 'https://api.mustachebash.com'),
				BRAINTREE_TOKEN: JSON.stringify(devMode ? 'sandbox_qsrxjzth_ht835xhgsgwsz2hn' : 'production_z4qm4zqx_t7bcxj3vjz92bxr2')
			})
		]
	};
};
