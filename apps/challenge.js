import _ from "lodash"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"

export class Challenge extends AmsPlugin {
  constructor() {
    super({
      name: "ams-战术全息",
      event: "message",
      priority: _.get(config.getConfig("priority"), "challenge", 110),
      rule: [
        {
          reg: config.fixCommond("(战术)?全息(挑战)?.*"),
          fnc: "challenge",
        },
      ],
    })
  }

  async challenge(e) {
    try {
      // 1. 获取用户信息
      const user = await this.getWavesUser()
      if (!user) {
        await e.reply(`❌ 您还未绑定鸣潮账号\n请先使用：${config.exampleCommond("登录")}`)
        return false
      }

      // 2. 获取 API
      const wavesApi = await this.getWavesApi()
      if (!wavesApi) return false

      // 2.1 获取头像
      await this.getAvatarUrl()

      // 3. 获取数据
      const res = await wavesApi.getChallengeDetail()
      if (!res || res.code !== 200) {
        await e.reply(`❌ 获取数据失败: ${res.msg || "未知错误"}`)
        return false
      }

      // 检查是否解锁
      if (res.data.isUnlock === false) {
        await e.reply(`⚠️ 您尚未解锁战术全息挑战`)
        return false
      }

      const challengeInfo = res.data.challengeInfo || {}

      // 4. 数据处理: 转换为便于渲染的结构
      let bossList = []
      let totalPassed = 0

      // 遍历所有 Boss (key 为 10010, 11010 等 ID)
      Object.entries(challengeInfo).forEach(([groupId, challenges]) => {
        if (!challenges || challenges.length === 0) return

        // 基础信息取第一个难度的数据 (通常 bossName 和 icon 是一样的)
        const baseInfo = challenges[0]

        // 统计该 Boss 的挑战进度
        let passedCount = 0
        let maxDifficulty = 0
        let maxDifficultyTime = 0

        // 处理每个难度的数据
        const processedChallenges = challenges.map(c => {
          const isPassed = c.passTime > 0
          if (isPassed) {
            passedCount++
            if (c.difficulty > maxDifficulty) {
              maxDifficulty = c.difficulty
              maxDifficultyTime = c.passTime
            }
          }

          return {
            difficulty: c.difficulty,
            challengeId: c.challengeId,
            bossLevel: c.bossLevel,
            passTime: c.passTime,
            isPassed: isPassed,
            roles: c.roles || [],
          }
        })

        // 按难度排序
        processedChallenges.sort((a, b) => a.difficulty - b.difficulty)

        if (passedCount > 0) {
          totalPassed += passedCount
        }

        bossList.push({
          groupId,
          bossName: baseInfo.bossName,
          bossHeadIcon: baseInfo.bossHeadIcon,
          bossIconUrl: baseInfo.bossIconUrl,
          maxDifficulty: maxDifficulty, // 当前通过的最高难度
          passedCount: passedCount, // 通过的难度数量
          totalCount: challenges.length, // 总难度数量
          challenges: processedChallenges,
          isFullyCleared: passedCount === challenges.length,
        })
      })

      // 排序:
      // 1. 优先显示未完全通关的? 或者按 ID 排序?
      // 通常按 ID 排序即可，或者按 Boss 等级/发布顺序
      // 一般新出的 Boss ID 比较大，所以倒序排列可以让最新的 Boss 显示在前面
      bossList.sort((a, b) => parseInt(b.groupId) - parseInt(a.groupId))

      const renderData = {
        uid: user.gameUid,
        roleId: user.roleId,
        bossList: bossList,
        totalBosses: bossList.length,
        totalPassed: totalPassed,
        // 可以添加一些汇总信息，比如多少个 Boss 满通
        fullClearCount: bossList.filter(b => b.isFullyCleared).length,
      }

      // 5. 渲染
      const img = await this.render("challenge/challenge", renderData)
      if (img) {
        await e.reply(img)
      } else {
        await e.reply("❌ 绘图失败")
      }
    } catch (error) {
      logger.error(`[ams] 战术全息查询失败: ${error}`)
      await e.reply("❌ 战术全息查询失败，请稍后重试")
    }
  }
}
