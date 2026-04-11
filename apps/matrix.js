import _ from "lodash"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"
import { formatTime } from "../lib/utils.js"

export class Matrix extends AmsPlugin {
  constructor() {
    super({
      name: "ams-终焉矩阵",
      event: "message",
      priority: _.get(config.getConfig("priority"), "matrix", 110),
      rule: [
        {
          reg: config.fixCommond("(?:(终焉)?矩阵|稳态协议|奇点扩张)"),
          fnc: "matrix",
        },
      ],
    })
  }

  async matrix(e) {
    // 1. 解析命令参数（稳态协议 / 奇点扩张 筛模式；矩阵 / 终焉矩阵 看全部有记录模式）
    const raw = e.msg.trim()
    let modeFilter = null
    if (/稳态协议$/.test(raw)) modeFilter = [0]
    else if (/奇点扩张$/.test(raw)) modeFilter = [1]

    // 2. 获取用户信息
    const user = await this.getWavesUser()
    if (!user) {
      await e.reply(`❌ 您还未绑定鸣潮账号\n请先使用：${config.exampleCommond("登录")}`)
      return false
    }

    // 3. 获取 API
    const wavesApi = await this.getWavesApi()
    if (!wavesApi) return false

    // 3.1 获取头像
    await this.getAvatarUrl()

    // 4. 获取终焉矩阵数据
    const matrixRes = await wavesApi.getMatrixData()
    if (!matrixRes.status) {
      await e.reply(`❌ 获取数据失败: ${matrixRes.msg}`)
      return false
    }

    const matrixData = matrixRes.data
    if (!matrixData) {
      await e.reply("⚠️ 当前暂无终焉矩阵数据")
      return false
    }

    if (matrixData.isUnlock === false) {
      await e.reply("⚠️ 终焉矩阵暂未解锁")
      return false
    }

    // 5. 数据处理与筛选
    const Mapping = { 0: "稳态协议", 1: "奇点扩张" }
    const details = matrixData.modeDetails || []
    const filtered = details.filter(m => {
      const mid = Number(m.modeId)
      return m.hasRecord && (modeFilter === null || modeFilter.includes(mid))
    })

    if (filtered.length === 0) {
      await e.reply(`⚠️ 账号 ${user.roleId || user.gameUid} 没有终焉矩阵记录`)
      return false
    }

    const modeList = filtered.map(mode => ({
      modeName: Mapping[mode.modeId] ?? `模式 ${mode.modeId}`,
      score: mode.score ?? 0,
      rank: mode.rank,
      round: mode.round,
      hasRound: mode.round != null,
      bossCount: mode.bossCount,
      passBoss: mode.passBoss,
      hasBossProgress: mode.bossCount != null && mode.passBoss != null,
      hasTeams: Array.isArray(mode.teams) && mode.teams.length > 0,
      teams: (mode.teams || []).map(t => ({
        round: t.round,
        score: t.score,
        bossCount: t.bossCount,
        passBoss: t.passBoss,
        roleList: t.roleList || [],
        roleIcons: t.roleIcons || [],
        buffs: t.buffs || [],
      })),
    }))

    // 6. 渲染
    let seasonEndTime = ""
    let showSeason = false
    if (matrixData.endTime) {
      const endMs = matrixData.endTime > 1e12 ? matrixData.endTime : matrixData.endTime * 1000
      const remainMs = endMs - Date.now()
      if (remainMs > 0) {
        seasonEndTime = formatTime(remainMs)
        showSeason = true
      }
    }

    const renderData = {
      uid: user.gameUid,
      roleId: user.roleId,
      modeList,
      seasonEndTime,
      showSeason,
      partialNote: modeList.some(m => !m.hasTeams),
    }

    const img = await this.render("matrix/matrix", renderData)
    if (img) {
      await e.reply(img)
    } else {
      await e.reply("❌ 绘图失败")
    }
  }
}
