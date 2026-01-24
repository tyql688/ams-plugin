import fs from "fs"
import path from "path"
import WavesApi from "../lib/api/waves.js"
import { gachaPath } from "../lib/path.js"
import { formatDataTime } from "../lib/utils.js"

export const GACHA_TYPES = {
  1: "角色精准调谐",
  2: "武器精准调谐",
  3: "角色调谐（常驻池）",
  4: "武器调谐（常驻池）",
  5: "新手调谐",
  6: "新手自选唤取",
  7: "新手自选唤取（感恩定向唤取）",
  8: "角色新旅唤取",
  9: "武器新旅唤取",
}

export const GACHA_TYPES_REVERSE = Object.fromEntries(
  Object.entries(GACHA_TYPES).map(([k, v]) => [v, k]),
)

export default class GachaRecord {
  constructor(uid) {
    this.uid = String(uid)
    this.filePath = path.join(gachaPath, `${this.uid}.json`)
    this.exportPath = path.join(gachaPath, `${this.uid}_exp.json`)
    this.data = this.load()
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      try {
        return JSON.parse(fs.readFileSync(this.filePath, "utf-8"))
      } catch (e) {
        logger.error(`[GachaRecord] load error: ${e}`)
      }
    }

    // 为每种类型初始化空数组
    const initData = {
      uid: this.uid,
      data_time: null,
      data: {},
    }
    for (const name of Object.values(GACHA_TYPES)) {
      initData.data[name] = []
    }
    return initData
  }

  save() {
    this.data.data_time = formatDataTime(new Date())
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
  }

  export(exportData) {
    fs.writeFileSync(this.exportPath, JSON.stringify(exportData, null, 2))
  }

  async fetchAndMerge(recordId, isForce = false) {
    const api = new WavesApi(this.uid)
    // 如果使用 recordId，抽卡记录不需要 token/bat，所以手动传递空值
    // 但 WavesApi 中的 getGachaLog 实现使用了 this.server, this.wavesId 等。

    let totalNew = 0
    const newCounts = {}

    for (const [typeId, typeName] of Object.entries(GACHA_TYPES)) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // 避免速率限制

      const res = await api.getGachaLog(typeId, recordId)
      if (res.code !== 0) {
        logger.warn(`[GachaRecord] Fetch failed for ${typeName}: ${res.msg || res.message}`)
        if (res.code === -1) return { code: -1, msg: "抽卡链接已失效" }
        continue
      }

      const logs = res.data || []
      // 标准化日志
      const standardizedLogs = logs.map(log => ({
        ...log,
        cardPoolType: typeName, // 使用名称覆盖类型代码以保持一致性
      }))

      const { merged, addedCount } = this.mergeLogs(
        this.data.data[typeName] || [],
        standardizedLogs,
      )

      if (addedCount > 0 || isForce) {
        this.data.data[typeName] = merged
        totalNew += addedCount
        newCounts[typeName] = addedCount
      }
    }

    this.save()
    return { code: 0, totalNew, newCounts }
  }

  mergeLogs(localData, newData) {
    if (!newData || newData.length === 0) return { merged: localData, addedCount: 0 }
    if (!localData || localData.length === 0) return { merged: newData, addedCount: newData.length }

    const normalizedLocal = localData.map(log => this.normalizeLog(log))
    const normalizedNew = newData.map(log => this.normalizeLog(log))

    // 同一时间可能出现多条完全相同记录，无法依赖唯一 id 或 LCS
    // 采用“按时间分组 + 多重计数”的方式：同一时间内只补齐本地缺失的条目
    const groupByTime = logs => {
      const grouped = new Map()
      for (const log of logs) {
        if (!grouped.has(log.time)) grouped.set(log.time, [])
        grouped.get(log.time).push(log)
      }
      return grouped
    }

    const localGroups = groupByTime(normalizedLocal)
    const newGroups = groupByTime(normalizedNew)
    const allTimes = new Set([...localGroups.keys(), ...newGroups.keys()])
    const sortedTimes = [...allTimes].sort((a, b) => new Date(b) - new Date(a))

    const merged = []
    for (const time of sortedTimes) {
      const localItems = localGroups.get(time) || []
      const newItems = newGroups.get(time) || []
      if (localItems.length === 0) {
        merged.push(...newItems)
        continue
      }
      if (newItems.length === 0) {
        merged.push(...localItems)
        continue
      }

      const localCounts = new Map()
      for (const item of localItems) {
        const key = this.getLogKey(item)
        localCounts.set(key, (localCounts.get(key) || 0) + 1)
      }
      const extras = []
      for (const item of newItems) {
        const key = this.getLogKey(item)
        const remain = localCounts.get(key) || 0
        if (remain > 0) {
          localCounts.set(key, remain - 1)
        } else {
          extras.push(item)
        }
      }

      merged.push(...localItems, ...extras)
    }

    return { merged, addedCount: merged.length - localData.length }
  }

  getLogKey(log) {
    // Python 中忽略了 resourceType，所以我们也忽略它。
    return `${log.cardPoolType}|${log.resourceId}|${log.qualityLevel}|${log.name}|${log.count}|${log.time}`
  }

  normalizeLog(log) {
    const normalized = { ...log }
    if (GACHA_TYPES[normalized.cardPoolType]) {
      normalized.cardPoolType = GACHA_TYPES[normalized.cardPoolType]
    }
    return normalized
  }

  getStatData(typeName) {
    const logs = this.data.data[typeName] || []
    if (logs.length === 0) return null

    // 确保按倒序（最新优先）排序
    // 注意：如果不复制，这会修改原数组？logs 是引用。
    // 最好在排序前进行复制。
    const sortedLogs = [...logs].sort((a, b) => new Date(b.time) - new Date(a.time))

    // 统计数量
    const total = sortedLogs.length
    const fiveStarLogs = sortedLogs.filter(i => i.qualityLevel === 5)
    // 常驻角色（常驻五星角色）
    // 暂时硬编码，或者移到常量中
    const resident = ["鉴心", "卡卡罗", "安可", "维里奈", "凌阳"]

    const fiveStarCount = fiveStarLogs.length
    const fourStarCount = sortedLogs.filter(i => i.qualityLevel === 4).length
    const std5StarCount = fiveStarLogs.filter(i => resident.includes(i.name)).length

    const no5Star = (idx => (idx === -1 ? total : idx))(
      sortedLogs.findIndex(item => item.qualityLevel === 5),
    )
    const no4Star = (idx => (idx === -1 ? total : idx))(
      sortedLogs.findIndex(item => item.qualityLevel === 4),
    )

    const avg5Star = fiveStarCount !== 0 ? Math.round((total - no5Star) / fiveStarCount) : 0
    const avg4Star = fourStarCount !== 0 ? Math.round((total - no4Star) / fourStarCount) : 0
    const avgUP =
      fiveStarCount - std5StarCount !== 0
        ? Math.round((total - no5Star) / (fiveStarCount - std5StarCount))
        : 0
    const minPit = ((fiveStar, std5Star) =>
      fiveStar === std5Star
        ? 0.0
        : (((fiveStar - std5Star * 2) / (fiveStar - std5Star)) * 100).toFixed(1))(
      (resident.includes(fiveStarLogs[0]?.name) ? 1 : 0) + fiveStarCount,
      std5StarCount,
    )
    const upCost = ((avgUP * 160) / 10000).toFixed(2)

    const fiveStarIndices = sortedLogs
      .map((item, index) => (item.qualityLevel === 5 ? index : -1))
      .filter(index => index !== -1)
    const fiveStarGaps = fiveStarIndices.reduce(
      (gaps, curr, i, arr) => (i > 0 ? [...gaps, curr - arr[i - 1]] : gaps),
      [],
    )
    const lastGap = fiveStarIndices.length > 0 ? total - (fiveStarIndices.slice(-1)[0] + 1) : total
    const worstLuck = Math.max(...fiveStarGaps, lastGap) || 0
    const bestLuck = Math.min(...fiveStarGaps, lastGap) || 0

    // Pool List for Display
    const poolList = []
    // newest first matching sortedLogs logic
    // displayPulls corresponds to fiveStarLogs
    const displayPulls = []
    let pullCounter = 0
    for (const log of [...sortedLogs].reverse()) {
      pullCounter++
      if (log.qualityLevel === 5) {
        displayPulls.push(pullCounter)
        pullCounter = 0
      }
    }
    displayPulls.reverse()

    fiveStarLogs.forEach((item, index) => {
      const cost = displayPulls[index]

      const id = item.resourceId
      // 确保将 resourceType "角色" 映射为 "role"，"武器" 映射为 "weapon"
      // 数据样本显示 "resourceType": "武器" 或 "角色"（假设）
      const itemType = item.resourceType === "角色" ? "role" : "weapon"

      let color = "#feeb73"
      if (cost >= 60) color = "#9f3235"
      else if (cost >= 40) color = "#6b39b6"
      else if (cost >= 10) color = "#138d2a"

      poolList.push({
        name: item.name,
        times: cost,
        isUp: typeName.includes("角色") && !resident.includes(item.name),
        id,
        type: itemType,
        color,
      })
    })

    return {
      info: {
        total,
        no5Star,
        fiveStar: fiveStarCount,
        fourStar: fourStarCount,
        std5Star: std5StarCount,
        avg5Star,
        avg4Star,
        minPit,
        worstLuck,
        bestLuck,
        avgUP,
        upCost,
        no4Star,
        time:
          sortedLogs.length > 0
            ? [
                sortedLogs[sortedLogs.length - 1].time.split(" ")[0],
                sortedLogs[0].time.split(" ")[0],
              ]
            : [],
      },
      pool: poolList,
    }
  }

  async importFromJson(jsonData, forceOverwrite = false) {
    // 验证基本结构
    if (!jsonData || !jsonData.list) return { success: false, msg: "Invalid JSON" }

    // 是否严格检查 UID？Python 脚本会检查。
    const importUid = jsonData.info?.uid
    if (importUid && String(importUid) !== this.uid) {
      return { success: false, msg: "Import UID matches not current UID" }
    }

    // 按池类型分组列表
    const grouped = {}
    for (const log of jsonData.list) {
      let type = log.cardPoolType
      // 如果类型是 ID，则转换为名称
      if (GACHA_TYPES[type]) type = GACHA_TYPES[type]
      // 如果未映射，跳过还是保留？Python 跳过。
      if (!Object.values(GACHA_TYPES).includes(type)) continue

      if (!grouped[type]) grouped[type] = []
      grouped[type].push({ ...log, cardPoolType: type })
    }

    let totalNew = 0
    const newCounts = {}

    for (const [typeName, logs] of Object.entries(grouped)) {
      const { merged, addedCount } = this.mergeLogs(this.data.data[typeName] || [], logs)
      if (addedCount > 0 || forceOverwrite) {
        this.data.data[typeName] = merged
        totalNew += addedCount
        newCounts[typeName] = addedCount
      }
    }

    this.save()
    return { success: true, totalNew, newCounts }
  }
}
