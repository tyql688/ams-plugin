import fs from "fs"
import _ from "lodash"
import path from "path"
import { helpPath } from "../lib/path.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"

export class Help extends AmsPlugin {
  constructor() {
    super({
      name: "ams-帮助",
      event: "message",
      priority: _.get(config.getConfig("priority"), "help", 110),
      rule: [
        {
          reg: config.fixCommond("(帮助|菜单|help|功能)"),
          fnc: "help",
        },
      ],
    })
  }

  async help(e) {
    let helpConfig = {}
    try {
      const configPath = path.join(helpPath, "help.json")
      const configContent = fs.readFileSync(configPath, "utf-8")
      helpConfig = JSON.parse(configContent)
    } catch (error) {
      logger.error(`[ams] 帮助配置加载失败: ${error}`)
      await e.reply("❌ 帮助配置加载失败")
      return false
    }

    try {
      // 根据权限筛选分组
      const filteredGroups = helpConfig.groups.filter(group => {
        if (group.permission === "master") {
          return e.isMaster
        }
        return true // user权限的所有人都能看
      })

      // 为每个命令添加前缀
      filteredGroups.forEach(group => {
        group.commands.forEach(command => {
          command.displayCmd = config.exampleCommond(command.cmd)
          if (command.example) {
            command.displayExample = config.exampleCommond(command.example)
          }
          // 转换图标为绝对路径
          command.iconPath = `file://${path.join(helpPath, "imgs", command.icon).replace(/\\/g, "/")}`
        })
      })

      // 构建渲染数据
      const renderData = {
        title: helpConfig.title,
        desc: helpConfig.desc,
        groups: filteredGroups,
        // 所有图片使用绝对路径
        titleImage: `file://${path.join(helpPath, "imgs", helpConfig.images.title).replace(/\\/g, "/")}`,
        customBg: `file://${path.join(helpPath, "imgs", helpConfig.images.bg).replace(/\\/g, "/")}`,
        defaultIcon: `file://${path.join(helpPath, "imgs", "default.png").replace(/\\/g, "/")}`,
      }

      // 渲染帮助页面
      const img = await this.render("help/help-stable", renderData)

      if (img) {
        await e.reply(img)
      } else {
        await e.reply("❌ 帮助信息生成失败")
      }
    } catch (error) {
      logger.error(`[ams] 帮助页面生成失败: ${error}`)
      await e.reply("❌ 帮助信息加载失败")
    }
  }
}
