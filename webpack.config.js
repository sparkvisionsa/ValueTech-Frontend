const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/ui/App.jsx',
    target: 'electron-renderer',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                type: 'javascript/auto',
                use: {
                    loader: 'babel-loader',
                    options: {
                        sourceType: 'unambiguous',
                        presets: ['@babel/preset-react']
                    }
                }
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'postcss-loader' // Add this line
                ]
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/ui/index.html'
        })
    ],
    resolve: {
        extensions: ['.js', '.jsx']
    }
};
