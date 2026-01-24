import _ from "lodash"
import moment from "moment"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"

export class DailyNote extends AmsPlugin {
  constructor() {
    super({
      name: "ams-体力",
      dsc: "鸣潮体力查询",
      event: "message",
      priority: _.get(config.getConfig("priority"), "daily", 100),
      rule: [
        {
          reg: config.fixCommond("体力"),
          fnc: "dailyNote",
        },
      ],
    })
  }

  async dailyNote() {
    // 1. 获取用户信息
    const user = await this.getWavesUser()
    if (!user) {
      this.e.reply("请先绑定鸣潮账号，发送【#鸣潮登录】")
      return false
    }

    // 2. 初始化 API
    const api = await this.getWavesApi()
    if (!api) return false // getWavesApi 内部已处理错误回复

    // 3. 获取数据
    const res = await api.getWidgetRefresh()

    if (!res.status) {
      if (res.msg.includes("登录")) {
        this.e.reply("Token已过期，请重新登录")
      } else {
        this.e.reply(`查询失败: ${res.msg}`)
      }
      return false
    }

    const data = res.data

    // 4. 数据处理
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

    // 渲染数据
    const renderData = {
      ...data,
      currTime: now.format("YYYY-MM-DD HH:mm:ss"),
      roleId: user.gameUid,
      roleName: data.roleName || user.roleName || "漂泊者",
    }

    // 5. 截图
    await this.reply(await this.render("dailyNote/dailyNote.html", renderData))
  }
}
