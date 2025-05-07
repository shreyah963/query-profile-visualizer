const purgecss = require('@fullhuman/postcss-purgecss');

module.exports = {
  plugins: [
    purgecss({
      content: [
        './public/index.html',
        './src/**/*.js',
        './src/**/*.jsx',
        './src/**/*.ts',
        './src/**/*.tsx'
      ],
      // You can add more options here if needed
    }),
    // ...other PostCSS plugins if you use them
  ]
}; 