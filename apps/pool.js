import fs from "fs"
import _ from "lodash"
import path from "path"
import { resourcePath } from "../lib/path.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"

export class Pool extends AmsPlugin {
  constructor() {
    super({
      name: "ams-卡池统计",
      event: "message",
      priority: _.get(config.getConfig("priority"), "pool", 110),
      rule: [
        {
          reg: config.fixCommond(
            "(未复刻|未复刻统计|未复刻角色|未复刻角色统计|未复刻武器|未复刻武器统计|卡池倒计时)(\\s*(角色|武器)?\\s*(4|5|四|五)?星?)?$",
          ),
          fnc: "queryPool",
        },
      ],
    })
  }

  async queryPool(e) {
    // 解析参数
    let queryType = "角色" // 默认查询角色
    let star = 5 // 默认查询5星

    const msg = e.msg || ""
    if (msg.includes("武器")) {
      queryType = "武器"
    } else if (msg.includes("角色")) {
      queryType = "角色"
    }

    if (msg.includes("4") || msg.includes("四")) {
      star = 4
    } else if (msg.includes("5") || msg.includes("五")) {
      star = 5
    }

    return this.renderPoolStats(e, queryType, star)
  }

  async renderPoolStats(e, queryType, star) {
    try {
      // 读取 pool.json
      const poolJsonPath = path.join(resourcePath, "waves-res", "data", "pool.json")
      if (!fs.existsSync(poolJsonPath)) {
        return e.reply("❌ 卡池数据文件不存在")
      }

      const poolData = JSON.parse(fs.readFileSync(poolJsonPath, "utf-8"))
      if (!Array.isArray(poolData) || poolData.length === 0) {
        return e.reply("❌ 卡池数据为空")
      }

      // 统计数据
      const stats = this.cleanPoolData(poolData, queryType, star)

      if (stats.length === 0) {
        return e.reply(`❌ 暂无${queryType}${star}星数据`)
      }

      // 格式化时间字符串
      const formattedStats = stats.map(item => ({
        ...item,
        timeText: this.secondsToHuman(item.seconds),
        isCurrentUp: item.seconds < 0,
      }))

      // 渲染页面
      const renderData = {
        title: "卡池倒计时",
        queryType: queryType,
        star: star,
        items: formattedStats,
        _res_path: resourcePath,
      }

      const img = await this.render("pool/pool", renderData)
      if (img) await e.reply(img)
      return true
    } catch (err) {
      logger.error(`[ams] 卡池统计错误: ${err.message}`)
      return e.reply(`❌ 获取卡池数据失败: ${err.message}`)
    }
  }

  cleanPoolData(poolData, queryType, star) {
    const now = new Date()
    const result = new Map() // id -> { name, upCount, seconds }

    // 用于去重同一结束时间的四星
    const fixedFourRepeat = new Set()
    let currentUpEndTime = null

    for (const pool of poolData) {
      // 过滤类型
      const poolType = pool.pool_type || ""
      const isCharacter = poolType === "角色活动唤取"
      const isWeapon = poolType === "武器活动唤取"

      if (queryType === "角色" && !isCharacter) continue
      if (queryType === "武器" && !isWeapon) continue

      // 解析结束时间
      const endTimeStr = pool.end_time || ""
      if (!endTimeStr || endTimeStr === "版本更新时间") continue

      let endTime
      try {
        endTime = new Date(endTimeStr)
      } catch (err) {
        continue
      }

      const seconds = Math.floor((now - endTime) / 1000)

      // 如果已经找到当前UP的池子，只处理相同结束时间的池子
      if (currentUpEndTime !== null && seconds !== currentUpEndTime) {
        continue
      }

      // 如果是当前UP的池子，记录结束时间
      if (seconds < 0 && currentUpEndTime === null) {
        currentUpEndTime = seconds
      }

      // 处理五星
      if (star === 5) {
        const ids = pool.five_star_ids || []
        const names = pool.five_star_names || []
        for (let i = 0; i < ids.length; i++) {
          const id = String(ids[i])
          const name = names[i] || id

          if (!result.has(id)) {
            result.set(id, {
              id: id,
              name: name,
              upCount: 0,
              seconds: seconds,
            })
          }

          const item = result.get(id)
          item.upCount++
          // 直接覆盖，不比较（与Python代码逻辑一致）
          item.seconds = seconds
        }
      } else {
        // 处理四星
        const repeatKey = `${endTimeStr}_${poolType}`
        if (fixedFourRepeat.has(repeatKey)) {
          continue
        }
        fixedFourRepeat.add(repeatKey)

        const ids = pool.four_star_ids || []
        const names = pool.four_star_names || []
        for (let i = 0; i < ids.length; i++) {
          const id = String(ids[i])
          const name = names[i] || id

          if (!result.has(id)) {
            result.set(id, {
              id: id,
              name: name,
              upCount: 0,
              seconds: seconds,
            })
          }

          const item = result.get(id)
          item.upCount++
          // 直接覆盖，不比较（与Python代码逻辑一致）
          item.seconds = seconds
        }
      }
    }

    // 转换为数组并按结束时间排序（倒序，最久未UP的在前）
    const statsArray = Array.from(result.values())
    statsArray.sort((a, b) => b.seconds - a.seconds)

    return statsArray
  }

  secondsToHuman(seconds) {
    if (seconds >= 0) {
      // 已结束，显示未UP天数
      if (seconds >= 86400) {
        const days = Math.floor(seconds / 86400)
        return `${days}天`
      } else if (seconds >= 3600) {
        const hours = Math.floor(seconds / 3600)
        return `${hours}小时`
      } else if (seconds >= 60) {
        const minutes = Math.floor(seconds / 60)
        return `${minutes}分钟`
      } else {
        return `${seconds}秒`
      }
    } else {
      // 当前UP中
      const absSeconds = Math.abs(seconds)
      if (absSeconds >= 86400) {
        const days = Math.floor(absSeconds / 86400)
        return `${days}天后关闭`
      } else if (absSeconds >= 3600) {
        const hours = Math.floor(absSeconds / 3600)
        return `${hours}小时后关闭`
      } else if (absSeconds >= 60) {
        const minutes = Math.floor(absSeconds / 60)
        return `${minutes}分钟后关闭`
      } else {
        return `${absSeconds}秒后关闭`
      }
    }
  }
}
