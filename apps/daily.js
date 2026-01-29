import _ from "lodash"
import moment from "moment"
import WavesApi from "../lib/api/waves.js"
import { GAMES } from "../lib/constants.js"
import { User } from "../lib/db/index.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"

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

    // 1. 获取目标用户列表
    let userList = []
    if (multiDaily) {
      const { userId } = this.getUserIdentity()
      userList = await User.getAllValid(userId, GAMES.waves.id)
    } else {
      const user = await this.getWavesUser()
      if (user) userList.push(user)
    }

    if (_.isEmpty(userList)) {
      this.e.reply(`请先绑定鸣潮账号，发送【${config.exampleCommond("登录")}】`)
      return false
    }

    const msgList = []

    // 获取头像 (主要用于单用户场景，多用户暂复用或需进一步优化)
    await this.getAvatarUrl()

    // 2. 遍历查询
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
      const img = await this.render("dailyNote/dailyNote.html", data)
      if (img) msgList.push(img)
    }

    if (_.isEmpty(msgList)) return

    // 3. 发送消息
    if (msgList.length >= forwardLimit) {
      const forwardMsg = await this.makeMsg(msgList)
      await this.reply(forwardMsg)
    } else {
      await this.reply(msgList)
    }
  }

  processDailyData(data, user) {
    const now = moment()

    // 辅助函数：处理进度和百分比
    const processItem = item => {
      if (!item) return null
      // 确保数值存在且合法
      const cur = Number(item.cur) || 0
      const total = Number(item.total) || 1
      let pct = (cur / total) * 100
      pct = Math.min(100, Math.max(0, pct)) // 限制在 0-100

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

    return {
      ...data,
      currTime: now.format("YYYY-MM-DD HH:mm:ss"),
      roleId: user.gameUid,
      roleName: data.roleName || "漂泊者",
    }
  }
}
