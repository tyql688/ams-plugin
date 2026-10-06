import _ from "lodash"
import { Restart } from "../../other/restart.js"
import { AmsPlugin } from "../lib/plugin.js"
import { updateResources } from "../lib/res.js"
import config from "../lib/settings.js"

let updating = false
let lastErrorNotice = 0

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
    this.task = {
      name: "ams 资源自动更新",
      cron: "0 */5 * * * *",
      fnc: () => {
        if (config.getConfig("config").resource_auto_update) return this.updateRes()
      },
      log: false,
    }
  }

  async updateRes(e) {
    if (updating) return e?.reply("资源正在更新，请稍后再试")
    updating = true
    const event = e || { reply: text => Bot.sendMasterMsg(text) }
    let updated = false
    try {
      if (e) await e.reply("开始更新资源...")
      updated = await updateResources()
      lastErrorNotice = 0
      if (!updated) {
        if (e) await e.reply("[ams] 资源已是最新")
        return true
      }

      const message = "[ams] 资源已同步，即将重启 Yunzai，机器人会短暂离线。"
      logger.mark(message)
      await event.reply(message)
      await new Restart(event).restart()
    } catch (error) {
      const action = updated ? "资源已同步，请手动发送 #重启" : "资源更新失败"
      const message = `[ams] ${action}：${error.message}`
      logger.error(message)
      const now = Date.now()
      if (e || !lastErrorNotice || now - lastErrorNotice >= 3_600_000) {
        if (!e) lastErrorNotice = now
        await event.reply(message)
      }
    } finally {
      updating = false
    }
    return true
  }
}
