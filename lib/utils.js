import fs from "fs"
import _ from "lodash"
import path from "path"

/**
 * 计算周期性倒计时的详细信息（核心逻辑，通用）
 * @param {string|number} startTime 起始时间 (如 '2025-02-03T04:00:00')
 * @param {number} cycleDays 周期天数 (如 28)
 * @returns {Object} { ms: 剩余毫秒, start: 本期开始时间, end: 本期结束时间, index: 周期序号 }
 */
export function getPeriod(startTime, cycleDays) {
  const startAt = new Date(startTime).getTime()
  const cycleMs = cycleDays * 24 * 60 * 60 * 1000
  const now = Date.now()

  if (now < startAt) {
    return { ms: -1, start: null, end: new Date(startAt), index: -1 }
  }

  const elapsed = now - startAt
  const index = Math.floor(elapsed / cycleMs)
  const currentStart = startAt + index * cycleMs
  const currentEnd = currentStart + cycleMs

  return {
    ms: currentEnd - now,
    start: new Date(currentStart),
    end: new Date(currentEnd),
    index: index,
  }
}

/**
 * 通用时间格式化（不关心业务，逻辑通用于所有时间戳差值）
 * @param {number} ms 毫秒
 * @returns {string}
 */
export function formatTime(ms) {
  if (ms < 0) return "未开始"
  if (ms === 0) return "已结束"

  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 0) return `${days}天 ${hours}小时`
  return hours > 0 ? `${hours}小时` : "不足1小时"
}

/**
 * 逆境深塔公共周期信息（业务封装）
 */
export function getTowerPeriod() {
  return getPeriod("2025-02-03T04:00:00", 28)
}

/**
 * 冥歌海墟公共周期信息（业务封装）
 */
export function getSlashPeriod() {
  return getPeriod("2025-03-17T04:00:00", 28)
}

export function formatDataTime(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

export function randomFiles(dir) {
  if (!fs.existsSync(dir)) return null
  const files = fs.readdirSync(dir).filter(file => /\.(png|webp|jpg|jpeg)$/i.test(file))
  if (files.length > 0) {
    const randomFile = _.sample(files)
    return `file://${path.join(dir, randomFile)}`
  }
}
