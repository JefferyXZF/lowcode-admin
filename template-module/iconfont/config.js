module.exports = {
  account: '',
  password: '',
  iconfont: [
    {
      name: '',
      pid:  ''
    },
    {
      name: '',
      pid: ''
    }
  ],
  chooseList: [{
    type: 'list',
    message: '',
    name: 'cover',
    choices: [
      {
        name: '否'
      },
      {
        name: '是'
      }
    ]
  }],
  dev: {
    path: 'fonts' // static/fonts
  },
  prod: {
    path: 'resource/fonts' // dist/resource/fonts
  }
}
