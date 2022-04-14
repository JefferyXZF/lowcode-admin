
const HtmlWebpackPlugin = require('html-webpack-plugin')
const path = require('path')
const config = require('./config')

class IconfontWebpackPlugin {
  option={
    cssLink: [],
    jsLink: []
  }

  prod = false

  constructor(env) {
    if (this.prod) {
      // 打包的时候
      this.option.cssLink = config.iconfont.map(row => {
        return path.join('../', config.prod.path, row.name, 'iconfont.css')
      })
      this.option.jsLink = config.iconfont.map(row => {
        return path.join('../', config.prod.path, row.name, 'iconfont.js')
      })
    } else {
      // 开发的时候
      this.option.cssLink = config.iconfont.map(row => {
        return path.join('/resource', config.dev.path, row.name, 'iconfont.css')
      })
      this.option.jsLink = config.iconfont.map(row => {
        return path.join('/resource', config.dev.path, row.name, 'iconfont.js')
      })
    }
  }

  apply(compiler) {
    // 编译时注入
    // tap(触及) 到 compilation hook，而在 callback 回调时，会将 compilation 对象作为参数，
    compiler.hooks.compilation.tap('IconfontWebpackPlugin', (compilation) => {
      compilation.hooks.htmlWebpackPluginAfterHtmlProcessing.tap(
        'htmlWebpackPluginAfterHtmlProcessing',
        htmlPluginData => {
          let link = ''
          this.option.cssLink.forEach(row => {
            link += `<link rel="stylesheet" href="${row}">`
          })
          let script = ''
          this.option.jsLink.forEach(row => {
            script += `<script src="${row}"></script>`
          })
          let htmlStr = htmlPluginData.html.toString()
        // 字符串替换，在<body>字符串后追加script
        htmlStr = htmlStr.replace('</head>', `${link}</head>`)
        htmlPluginData.html = htmlStr.replace('</body>', `${script}</body>`)
        })
    })
  }
}

module.exports = IconfontWebpackPlugin