import _ from "lodash"
import { RolePanel } from "../lib/db/index.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"
import { buildProfileStats } from "../model/profileStats.js"

export class ProfileStats extends AmsPlugin {
  constructor() {
    super({
      name: "ams-练度统计",
      event: "message",
      priority: _.get(config.getConfig("priority"), "card", 110),
      rule: [
        {
          reg: config.fixCommond("(练度统计|练度)$"),
          fnc: "stat",
        },
      ],
    })
  }

  async stat(e) {
    const wavesApi = await this.getWavesApi()
    if (!wavesApi) return

    const rows = await RolePanel.getAllByUid(wavesApi.wavesId)
    if (!rows || rows.length === 0) {
      return e.reply(
        `❌ 暂无练度数据\n请先发送 "${config.exampleCommond("角色名面板")}" 查看角色面板，数据入库后即可统计`,
      )
    }

    const avatars = buildProfileStats(rows)
    if (avatars.length === 0) return e.reply("❌ 练度数据解析失败")

    // 取最近一次面板更新时间
    const latest = rows.map(r => r.updatedAt).sort((a, b) => b - a)[0]
    const updateTime = latest ? latest.toLocaleString("zh-CN") : ""

    await this.getAvatarUrl()

    const img = await this.render("character/profile-stat", {
      avatars,
      uid: wavesApi.wavesId,
      roleName: wavesApi.dbUser?.gameData?.roleName,
      updateTime,
      command: config.exampleCommond("角色名面板"),
    })
    return img ? e.reply(img) : e.reply("❌ 绘图失败")
  }
}
