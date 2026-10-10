import _ from "lodash"
import moment from "moment"
import WavesApi from "../lib/api/waves.js"
import { GAMES } from "../lib/constants.js"
import { User } from "../lib/db/index.js"
import { wavesResMap } from "../lib/path.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"
import { randomFiles } from "../lib/utils.js"

export class DailyNote extends AmsPlugin {
  constructor() {
    super({
      name: "ams-体力",
      dsc: "鸣潮体力查询",
      event: "message",
      priority: _.get(config.getConfig("priority"), "daily", 110),
      rule: [
        {
          reg: config.fixCommond("体力"),
          fnc: "dailyNote",
        },
      ],
    })
  }

  async dailyNote() {
    const cfg = config.getConfig("config")
    const multiDaily = _.get(cfg, "multi_daily", false)
    const forwardLimit = _.get(cfg, "multi_daily_forward", 3)
    const template = cfg.daily_simple ? "dailyNote/simple.html" : "dailyNote/dailyNote.html"

    let userList = []
    const { userId } = this.getQueryTarget(true)
    if (multiDaily) {
      userList = await User.getAllValid(userId, GAMES.waves.id)
    } else {
      const user = await User.getUseUser(userId, GAMES.waves.id)
      if (user) userList.push(user)
    }

    if (_.isEmpty(userList)) return this.replyUnbound(true)

    await this.getAvatarUrl()
    const msgList = []

    for (const user of userList) {
      const wavesApi = new WavesApi(user.gameUid, user.token, {
        devCode: user.devCode,
        bat: user.bat,
      })

      const res = await wavesApi.getWidgetRefresh()
      if (!res.status) {
        msgList.push(`账号[${user.gameUid}] 查询每日体力失败: ${res.msg}`)
        continue
      }
      const data = this.processDailyData(res.data, user)

      // roleName: 接口为主，没有再用 db 缓存；接口给了新值才回写 db
      const cached = wavesApi.dbUser?.gameData?.roleName
      data.roleName = data.roleName || cached

      if (wavesApi.dbUser && data.roleName && data.roleName !== cached) {
        const fresh = await User.getByUid(wavesApi.dbUser.userId, wavesApi.dbUser.gameUid)
        const gameData = { ...(fresh?.gameData || {}), roleName: data.roleName }
        await User.updateSilent(
          wavesApi.dbUser.userId,
          wavesApi.dbUser.gameUid,
          wavesApi.dbUser.gameId,
          { gameData },
        )
      }

      const img = await this.render(template, data)
      if (img) msgList.push(img)
    }

    if (_.isEmpty(msgList)) return

    if (msgList.length >= forwardLimit) {
      const forwardMsg = await this.makeMsg(msgList)
      await this.reply(forwardMsg)
    } else {
      await this.reply(msgList)
    }
  }

  processDailyData(data, user) {
    const now = moment()

    const processItem = item => {
      if (!item) return null
      const cur = Number(item.cur) || 0
      const total = Number(item.total) || 1
      let pct = (cur / total) * 100
      pct = Math.min(100, Math.max(0, pct))

      return {
        ...item,
        pct: pct.toFixed(1) + "%",
        isFull: cur >= total,
        cur,
        total,
      }
    }

    // 处理各个数据项
    data.energyData = processItem(data.energyData)
    data.livenessData = processItem(data.livenessData)
    data.storeEnergyData = processItem(data.storeEnergyData)
    data.weeklyData = processItem(data.weeklyData) // 战歌重奏
    data.towerData = processItem(data.towerData) // 深塔
    data.weeklyRougeData = processItem(data.weeklyRougeData) // 肉鸽
    data.slashTowerData = processItem(data.slashTowerData) // 海墟

    // 体力恢复时间
    if (data.energyData && data.energyData.refreshTimeStamp > 0) {
      const refreshTime = moment.unix(data.energyData.refreshTimeStamp)
      if (refreshTime.isAfter(now)) {
        if (refreshTime.isSame(now, "day")) {
          data.energyData.refreshTimeStr = refreshTime.format("HH:mm")
        } else if (refreshTime.isSame(now.clone().add(1, "day"), "day")) {
          data.energyData.refreshTimeStr = "明天 " + refreshTime.format("HH:mm")
        } else {
          data.energyData.refreshTimeStr = refreshTime.format("MM-DD HH:mm")
        }
      }
    }

    const getStats = items =>
      items
        .filter(([key]) => data[key])
        .map(([key, label, icon]) => ({ key, label, icon, ...data[key] }))

    return {
      ...data,
      roleId: user.gameUid,
      pileImage: randomFiles(wavesResMap.rolePile),
      resourceStats: getStats([
        ["storeEnergyData", "结晶单质", "storeEnergy"],
        ["livenessData", "活跃度", "liveness"],
      ]),
      progressStats: getStats([
        ["weeklyData", "战歌重奏", "weekly"],
        ["towerData", "逆境深塔", "tower"],
        ["weeklyRougeData", "千道门扉", "rouge"],
        ["slashTowerData", "冥歌海墟", "shenhai"],
      ]),
    }
  }
}
