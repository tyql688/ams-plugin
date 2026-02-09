import _ from "lodash"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"

export class Settings extends AmsPlugin {
  constructor() {
    super({
      name: "ams-设置",
      event: "message",
      priority: _.get(config.getConfig("priority"), "settings", 110),
      rule: [
        {
          reg: config.fixCommond("设置.*"),
          fnc: "settings",
          permission: "master",
        },
      ],
    })
  }

  async settings(e) {
    if (!e.isMaster) {
      return false
    }

    let reg = config.fixCommond("设置")
    let msg = e.msg.replace(/#|＃/, "").trim()

    if (new RegExp(reg).test(msg)) {
      // 没有任何参数，显示配置列表
      return await this.showSettings(e)
    }

    // 处理配置变更
    return await this.handleSettingChange(e)
  }

  async showSettings(e) {
    const cfg = config.getConfig("config")
    const netCfg = config.getConfig("network")
    const preCfg = config.getConfig("prefix")

    const settingsList = [
      {
        key: "auto_signin",
        app: "config",
        name: "自动签到",
        value: cfg.auto_signin,
        type: "switch",
        desc: "自动签到开关",
        example: config.exampleCommond("设置自动签到开启/关闭"),
      },
      {
        key: "anns_push",
        app: "config",
        name: "公告推送",
        value: cfg.anns_push,
        type: "switch",
        desc: "公告推送开关",
        example: config.exampleCommond("设置公告推送开启/关闭"),
      },
      {
        key: "signin_switch",
        app: "config",
        name: "签到功能",
        value: cfg.signin_switch,
        type: "switch",
        desc: "手动签到功能开关",
        example: config.exampleCommond("设置签到开关开启/关闭"),
      },
      {
        key: "panel_version",
        app: "config",
        name: "面板版本",
        value: cfg.panel_version,
        type: "select",
        options: [1, 2],
        desc: "选择角色属性面板的渲染版本，V1为窄版，V2为宽版",
        example: config.exampleCommond("设置面板版本1/2"),
      },
      {
        key: "allow_login",
        app: "network",
        name: "网页登录",
        value: netCfg.allow_login,
        type: "switch",
        desc: "是否允许通过可视化网页进行账号登录（开启后，重启服务生效）",
        example: config.exampleCommond("设置网页登录开启/关闭"),
      },
      {
        key: "server_port",
        app: "network",
        name: "网页端口",
        value: netCfg.server_port,
        type: "input",
        desc: "网页登录服务器运行的端口号，默认36110（修改默认端口，重启服务生效）",
        example: config.exampleCommond("设置网页端口36110"),
      },
      {
        key: "public_link",
        app: "network",
        name: "网页链接",
        value: netCfg.public_link || "未配置",
        type: "input",
        desc: "网页登录的外部访问链接（开启后，需重启服务生效）",
        example: config.exampleCommond("设置网页链接http://127.0.0.1:36110"),
      },
      {
        key: "proxy",
        app: "network",
        name: "网络代理",
        value: netCfg.proxy || "未配置",
        type: "input",
        desc: "插件请求API时使用的代理地址，支持http/socks5",
        example: config.exampleCommond("设置网络代理http://127.0.0.1:7890"),
      },
    ]

    const renderData = {
      settings: settingsList,
      pluginName: "ams-plugin",
    }

    const img = await this.render("settings/settings", renderData)
    if (img) {
      await e.reply(img)
    } else {
      await e.reply("❌ 设置页面生成失败")
    }
    return true
  }

  async handleSettingChange(e) {
    let msg = e.msg.replace(/#|＃/, "").trim()

    // 动态获取匹配到的指令头并去掉
    // fixCommond 返回的是 ^prefix设置$，我们需要去掉 $ 来进行部分匹配
    const reg = new RegExp(config.fixCommond("设置").replace(/\$$/, ""))
    const match = msg.match(reg)
    if (match) {
      msg = msg.replace(match[0], "").trim()
    } else {
      msg = msg.replace(/^设置/, "").trim()
    }

    // 映射表: [名字, 字段名, 配置文件名, 类型]
    const map = [
      ["自动签到", "auto_signin", "config", "switch"],
      ["公告推送", "anns_push", "config", "switch"],
      ["签到开关", "signin_switch", "config", "switch"],
      ["立绘原图", "yuantu_pile", "config", "switch"],
      ["背景原图", "yuantu_bg", "config", "switch"],
      ["面板版本", "panel_version", "config", "select"],
      ["网页登录", "allow_login", "network", "switch"],
      ["网页端口", "server_port", "network", "input"],
      ["网页链接", "public_link", "network", "input"],
      ["网络代理", "proxy", "network", "input"],
    ]

    for (let item of map) {
      let [name, key, app, type] = item
      if (msg.startsWith(name)) {
        let value = msg.replace(name, "").trim()
        let isChanged = false

        if (type === "select" || key === "panel_version") {
          if (["1", "2"].includes(value)) {
            config.setSingleConfig(app, key, parseInt(value))
            isChanged = true
          }
        } else if (type === "input") {
          if (!value) {
            await e.reply(`❌ 请输入 [${name}] 的值`)
            return true
          }
          if (/^\d+$/.test(value)) {
            config.setSingleConfig(app, key, parseInt(value))
          } else {
            config.setSingleConfig(app, key, value)
          }
          isChanged = true
        } else if (type === "switch") {
          if (["开启", "打开", "on", "true", "1"].includes(value)) {
            config.setSingleConfig(app, key, true)
            isChanged = true
          } else if (["关闭", "断开", "off", "false", "0"].includes(value)) {
            config.setSingleConfig(app, key, false)
            isChanged = true
          }
        }

        if (isChanged) {
          return await this.showSettings(e)
        }
      }
    }

    await e.reply(
      `❌ 未知的设置项或命令格式错误\n示例：${config.exampleCommond("设置自动签到开启")}`,
    )
    return true
  }
}
