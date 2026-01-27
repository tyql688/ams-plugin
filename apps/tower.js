import _ from "lodash"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"
import { formatTime, getTowerPeriod } from "../lib/utils.js"

export class Tower extends AmsPlugin {
  constructor() {
    super({
      name: "ams-逆境深塔",
      event: "message",
      priority: _.get(config.getConfig("priority"), "tower", 110),
      rule: [
        {
          reg: config.fixCommond("(?:逆境)?(?:深(?:塔|渊)|(稳定|实验|超载|深境)(?:区)?)"),
          fnc: "tower",
        },
      ],
    })
  }

  async tower(e) {
    // 1. 解析命令参数
    const match = e.msg.match(this.rule[0].reg)
    let key = match && match[1] ? match[1].replace("区", "") : "深境"

    // 2. 获取用户信息
    const user = await this.getWavesUser()
    if (!user) {
      await e.reply(`❌ 您还未绑定鸣潮账号\n请先使用：${config.exampleCommond("登录")}`)
      return false
    }

    // 3. 获取 API
    const wavesApi = await this.getWavesApi()
    if (!wavesApi) return false

    // 3. 获取深塔数据
    const towerRes = await wavesApi.getTowerData()
    if (!towerRes.status) {
      await e.reply(`❌ 获取数据失败: ${towerRes.msg}`)
      return false
    }

    const towerData = towerRes.data

    // 4. 数据处理与筛选
    const Mapping = { 稳定: 1, 实验: 2, 深境: 3, 超载: 4 }
    const difficultyId = Mapping[key] || 3

    // 检查是否有对应难度的数据
    // 预先筛选出对应难度的数据对象
    const diffData = towerData.difficultyList
      ? towerData.difficultyList.find(item => item.difficulty === difficultyId)
      : null

    const hasData = diffData && diffData.towerAreaList && diffData.towerAreaList.length > 0

    if (!hasData) {
      await e.reply(`⚠️ 账号 ${user.roleId || user.gameUid} 没有${key}区数据`)
      return false
    }

    // 5. 数据增强：计算总星数
    let totalStar = 0
    let totalMaxStar = 0
    if (diffData.towerAreaList) {
      diffData.towerAreaList.forEach(area => {
        totalStar += area.star || 0
        totalMaxStar += area.maxStar || 0
      })
    }
    diffData.totalStar = totalStar
    diffData.totalMaxStar = totalMaxStar

    // 6. 渲染
    const period = getTowerPeriod()
    const seasonTime = key.includes("深境") ? formatTime(period.ms) : ""

    const renderData = {
      uid: user.gameUid,
      diffData: diffData,
      diffiname: `${key}区`,
      roleId: user.roleId,
      seasonEndTime: seasonTime,
      showSeason: !!seasonTime,
    }

    const img = await this.render("tower/tower", renderData)
    if (img) {
      await e.reply(img)
    } else {
      await e.reply("❌ 绘图失败")
    }
  }
}
