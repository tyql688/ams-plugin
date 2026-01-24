import _ from "lodash"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"
import { formatTime, getSlashPeriod } from "../lib/utils.js"

export class Slash extends AmsPlugin {
  constructor() {
    super({
      name: "ams-冥歌海墟",
      event: "message",
      priority: _.get(config.getConfig("priority"), "slash", 110),
      rule: [
        {
          reg: config.fixCommond(
            "(冥歌海墟|冥海|海墟)?(禁忌|海隙|湍渊|无尽)?(?:海域|区)?([0-9]+)?层?",
          ),
          fnc: "slash",
        },
      ],
    })
  }

  async slash(e) {
    try {
      // 1. 获取用户信息
      const user = await this.getWavesUser()
      if (!user) {
        await e.reply(`❌ 您还未绑定鸣潮账号\n请先使用：${config.exampleCommond("登录")}`)
        return false
      }

      // 智能解析指令
      const match = e.msg.match(this.rule[0].reg)
      let targetFloors = []
      let diffiName = ""

      // 提取关键字和层数
      const cmd = match[1]
      const keyword = match[2]
      const floorNum = match[3] ? parseInt(match[3]) : null

      // 至少要有主命令、关键字或层数之一，否则不处理
      if (!cmd && !keyword && !floorNum) {
        return false
      }

      if (floorNum) {
        if (floorNum < 1 || floorNum > 12) {
          await e.reply("⚠️ 冥歌海墟层数只支持 1-12 层哦")
          return false
        }
        targetFloors = [floorNum]
        diffiName = `第 ${floorNum} 层`
      } else if (keyword === "禁忌") {
        targetFloors = [1, 2, 3, 4, 5, 6]
        diffiName = "禁忌海域"
      } else if (keyword === "海隙") {
        targetFloors = [7, 8, 9, 10, 11]
        diffiName = "海隙海域"
      } else if (keyword === "湍渊" || keyword === "无尽") {
        targetFloors = [12]
        diffiName = "无尽湍渊"
      } else {
        // 默认显示 7-12 层
        targetFloors = [7, 8, 9, 10, 11, 12]
        diffiName = "再生海域"
      }

      // 2. 获取 API
      const wavesApi = await this.getWavesApi()
      if (!wavesApi) return false

      // 3. 获取数据
      const slashRes = await wavesApi.getSlashData()
      if (!slashRes.status) {
        await e.reply(`❌ 获取数据失败: ${slashRes.msg}`)
        return false
      }

      const slashData = slashRes.data

      // 检查是否解锁
      if (slashData.isUnlock === false) {
        await e.reply(`⚠️ 您尚未解锁冥歌海墟挑战`)
        return false
      }

      // 4. 数据处理与筛选
      const allChallenges = []
      let latestDiff = null
      let totalAllScore = 0

      // 遍历所有难度，收集符合条件的挑战
      const seenDiffs = new Set()
      if (slashData.difficultyList) {
        slashData.difficultyList.map(diff => {
          let hasMatch = false
          diff.challengeList.forEach(challenge => {
            if (targetFloors.includes(challenge.challengeId)) {
              // 将该难度的资产附件到挑战对象上，解决跨难度显示资源不同步问题
              challenge.teamIcon = diff.teamIcon
              challenge.detailPageBG = diff.detailPageBG
              allChallenges.push(challenge)
              hasMatch = true
              // 记录资产信息 (以最高难度为准，用于首页大背景)
              if (!latestDiff || diff.difficulty > latestDiff.difficulty) {
                latestDiff = diff
              }
            }
          })
          if (hasMatch) {
            seenDiffs.add(diff)
          }
        })
      }

      if (allChallenges.length === 0) {
        await e.reply(`⚠️ 账号 ${user.roleId || user.gameUid} 没有对应的${diffiName}数据`)
        return false
      }

      // 排序：层数从大到小
      allChallenges.sort((a, b) => b.challengeId - a.challengeId)

      // 计算筛选后的总分与总上限
      totalAllScore = allChallenges.reduce((sum, c) => sum + (c.score || 0), 0)
      const totalMaxScore = Array.from(seenDiffs).reduce((sum, d) => sum + (d.maxScore || 0), 0)

      // 构造渲染用的数据结构
      const diffData = {
        challengeList: allChallenges,
        allScore: totalAllScore,
        maxScore: totalMaxScore,
        homePageBG: latestDiff?.homePageBG,
        detailPageBG: latestDiff?.detailPageBG,
        teamIcon: latestDiff?.teamIcon,
      }

      // 5. 渲染
      const period = getSlashPeriod()
      const seasonTime = formatTime(period.ms)
      // 前6层（禁忌海域）不需要显示结束时间
      let showSeason = !!seasonTime
      if (diffiName === "禁忌海域" || (match[2] && parseInt(match[2]) <= 6)) {
        showSeason = false
      }

      const renderData = {
        uid: user.gameUid,
        diffData: diffData,
        diffiname: diffiName,
        roleId: user.roleId || user.gameUid,
        seasonEndTime: seasonTime,
        showSeason: showSeason,
        homePageBG: diffData.homePageBG,
        detailPageBG: diffData.detailPageBG,
        teamIcon: diffData.teamIcon,
      }

      const img = await this.render("slash/slash", renderData)
      if (img) {
        await e.reply(img)
      } else {
        await e.reply("❌ 绘图失败")
      }
    } catch (error) {
      logger.error(`[ams] 冥歌海墟查询失败: ${error}`)
      await e.reply("❌ 冥歌海墟查询失败，请稍后重试")
    }
  }
}
