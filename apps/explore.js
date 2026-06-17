import _ from "lodash"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"

export class Explore extends AmsPlugin {
  constructor() {
    super({
      name: "ams-探索度",
      event: "message",
      priority: _.get(config.getConfig("priority"), "explore", 110),
      rule: [
        {
          reg: config.fixCommond("探索(度|进度)?"),
          fnc: "explore",
        },
      ],
    })
  }

  async explore(e) {
    // 1. 获取用户信息
    const user = await this.getWavesUser({ allowAt: true })
    if (!user) return this.replyUnbound(true)

    // 2. 获取 API
    const wavesApi = await this.getWavesApi({ allowAt: true })
    if (!wavesApi) return false

    // 3. 获取探索度数据
    const exploreRes = await wavesApi.getExploreIndex()
    if (!exploreRes.status) {
      await e.reply(`❌ 获取数据失败: ${exploreRes.msg}`)
      return false
    }

    const exploreData = exploreRes.data

    if (!exploreData || !exploreData.exploreList || exploreData.exploreList.length === 0) {
      await e.reply("⚠️ 未获取到探索数据")
      return false
    }

    // 4. 渲染
    const renderData = {
      uid: user.gameUid,
      exploreList: exploreData.exploreList,
      roleId: user.roleId,
      roleName: wavesApi.dbUser?.gameData?.roleName,
    }

    // 获取头像
    await this.getAvatarUrl()

    return this.renderReply("explore/explore", renderData)
  }
}
