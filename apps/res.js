import { BaseData } from "#waves.data"
import { EchoScorer } from "#waves.score"
import _ from "lodash"
import { AmsPlugin } from "../lib/plugin.js"
import { updateResources } from "../lib/res.js"
import config from "../lib/settings.js"

export class admin extends AmsPlugin {
  constructor() {
    super({
      name: "ams-资源管理",
      event: "message",
      priority: _.get(config.getConfig("priority"), "res", 110),
      rule: [
        {
          reg: config.fixCommond("(强制)?更新资源"),
          fnc: "updateRes",
          permission: "master",
        },
      ],
    })
  }

  async updateRes(e) {
    await e.reply("开始更新资源...")

    const result = await updateResources(false)

    if (result.success) {
      BaseData.clearCache()
      EchoScorer.clearCache?.()
      await e.reply(`✅ ${result.message}`)
    } else {
      await e.reply(`❌ ${result.message}`)
    }

    return true
  }
}
