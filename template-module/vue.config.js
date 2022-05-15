
const IconfontWebpackPlugin = require('./iconfont')
module.exports = {
  configureWebpack: (config) => {
    config.plugins.push(new IconfontWebpackPlugin())
  }
}