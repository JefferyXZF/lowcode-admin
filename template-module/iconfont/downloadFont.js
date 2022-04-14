const puppeteer = require('puppeteer')// 爬虫依赖 文档地址：https://zhaoqize.github.io/puppeteer-api-zh_CN/
const inquirer = require('inquirer')
const { zip: { uncompress: unZip } } = require('compressing')
const fs = require('fs')
const path = require('path')
const StreamZip = require('node-stream-zip')// 解压文件依赖
const { account, password, iconfont, dev, prod, chooseList } = require('./config')

// 提示错误信息，退出node终端
const redLog = (val) => {
  console.log('\x1b[41m', 'iconfont出错了，错误信息是：' + val)
  process.exit()
}

const iconfontLog = (val) => {
  console.log('iconfont提示信息：', val)
}

if (!account || !password) {
  redLog('请在build/downloadFont.js文件输入账号密码')
}
if (password.length < 8) {
  redLog('密码不能少于8位')
}

class Download {
  cssLink = []
  pathToCreate
  env

  constructor({ cssLink, env }) {
    console.log(cssLink, env)
    this.cssLink = cssLink
    this.env = env === 'prod'
    this.pathToCreate = this.env ? `dist/${prod.path}` : `static/${dev.path}`
    this.download()
  }

  async download () {
    // 生成一个浏览器实例
    const browser = await puppeteer.launch({
      headless: false, // false 打开浏览器，true不打开
      args: ['--no-sandbox'] // linux 需要的参数
    })
    this.browser = browser
    // 新建一个浏览器窗口
    const page = await browser.newPage()
    // 设置超时时间
    page.setDefaultTimeout(0)
    // 设置浏览器的窗口大小
    await page.setViewport({
      width: 1920,
      height: 1080
    })
    // 浏览器跳转到iconfont的登陆页面，等待只有2个网络连接时完成
    await page.goto('https://www.iconfont.cn/login', {
      waitUntil: 'networkidle2'
    })
    page.on('response', async(response) => {
      if (response.url() === 'https://www.iconfont.cn/api/account/login.json') {
        let responseData
        try {
          // 抓取网络返回的数据，json失败会抛异常
          responseData = await response.json()
        } catch (err) {}
        if (responseData && responseData.code === 500) {
          redLog('账号密码错误')
        }
      }
    })

    // 为打开的页面添加账号密码
    // 账号密码需要外部传入，account，password变量不共用
    await page.evaluate(({ account, password }) => {
      document.querySelector('#userid').value = account
      document.querySelector('#password').value = password
    }, {
      account,
      password
    })
    // 点击登陆，等待页面跳转完成
    await Promise.all([
      page.waitForNavigation(),
      page.click('[type=submit]', {
        delay: 200
      })
    ])
    // 完成登陆，在页面中添加若干个网络请求，请求获取iconfont文件的base64字符串方可相互交（无法使用流，blob等形式）
    const data = await page.evaluate((cssLink) => {
      return Promise.all(cssLink.map(row => {
        return new Promise(resolve => {
          fetch(`https://www.iconfont.cn/api/project/download.zip?pid=${row.pid}`).then(res => res.blob()).then(res => {
            const reader = new FileReader()
            reader.onload = function(e) {
              resolve({
                base64: e.target.result,
                name: row.name
              })
            }
            reader.readAsDataURL(res)
          })
        })
      }))
    }, this.cssLink)
    // 判断是否每一个都有权限，无权限直接跳出进程，不继续写入文件
    for (const item of data) {
      if (item.base64.includes('data:text/html;')) {
        redLog('你好像没有这个iconfont的权限====>' + item.name)
      }
    }
    console.log(data)
    this.base64ToZip(data).then(() => {
      iconfontLog('下载成功')
      browser.close()
      clearTimeout(timeOut)
    })
  }

  base64ToZip(data) {
    // 得到返回的iconfont的字符串数组，在进行写入文件
    return Promise.all(data.map(row => {
      return new Promise(resolve => {
        const _path = path.join(this.pathToCreate, row.name)
        this.mkdirSync(_path)
        const filePath = path.join(_path, 'download.zip')
        // base64写入压缩文件
        fs.writeFileSync(filePath, Buffer.from(row.base64.replace(/data:application\/zip;base64,/, ''), 'base64'))
        // 打开压缩文件
        const zip = new StreamZip({
          file: filePath,
          storeEntries: true
        })
        // 打开压缩文件完成
        zip.on('ready', () => {
          // 解压文件中的第一个文件夹（也就是iconfont里面的文件夹）
          zip.extract(Object.values(zip.entries())[0].name, _path, () => {
            // 关闭压缩文件
            zip.close()
            // 删除压缩文件
            fs.unlinkSync(filePath)
            this.writeFile(_path, row)
            resolve()
          })
        })
      })
    }))
  }

  /**
   * 修改font文件
   * @param _path {string} 需要的path
   * @param row {Object} 需要修改的变量
   */
   writeFile(_path, row) {
    const _cssPath = path.join(_path, 'iconfont.css')
    let _data = fs.readFileSync(_cssPath, 'utf8')
    // 读取已经解压的文件，将font-family: "iconfont"改成需要的font-xxx
    _data = _data.replace(/font-family: "iconfont"/g, `font-family: "${row.name}"`)
    _data = _data.replace(/.iconfont /g, `.${row.name}`)
    // 覆盖原有的iconfont.css文件
    fs.writeFileSync(_cssPath, _data)
  }

  /**
   * 生成不存在的文件夹路径
   * @param src {string} 需要生成的路径
   */
   mkdirSync(src) {
    src.split(path.sep).reduce((currentPath, folder) => {
      currentPath += folder + path.sep
      if (!fs.existsSync(currentPath)) {
        fs.mkdirSync(currentPath)
      }
      return currentPath
    }, '')
  }

}

// 开发模式
const developmentEnv = () => {
  return new Promise(async(resolve, reject) => {
    debugger
    // 是否存在fonts这个目录
    if (fs.existsSync(path.join(__dirname, '../', 'static/fonts'))) {
      // 存在为注释的font，需要提示选择是否需要覆盖
      // 是：注释覆盖文件，下载新版iconfont，否不继续操作
      resolve()
      // await inquirer.prompt(chooseList).then(({ cover }) => {
      //   if (cover === '是') {
      //   } else {
      //     // eslint-disable-next-line prefer-promise-reject-errors
      //     reject('不需要更新')
      //   }
      // })
    }
    resolve()
  })
}

const env = process.argv[2]

if (env === 'dev') {
  developmentEnv().then(() => {
    console.log('developmentEnv()')
    new Download({
      cssLink: iconfont,
      env
    })
  }).catch(() => {
    iconfontLog('取消覆盖iconfont，继续启动服务')
  })
}

if (env === 'prod') {

}