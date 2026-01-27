import _ from "lodash"
import { AmsPlugin } from "../lib/plugin.js"
import request from "../lib/request.js"
import config from "../lib/settings.js"

export class Exchange extends AmsPlugin {
  constructor() {
    super({
      name: "ams-兑换码",
      event: "message",
      priority: _.get(config.getConfig("priority"), "exchange", 100),
      rule: [
        {
          reg: config.fixCommond("(?:鸣潮)?(?:兑换码|礼包码)"),
          fnc: "getExchangeCodes",
        },
      ],
    })
  }

  async getExchangeCodes(e) {
    const codeList = await this.getCodeList()

    if (!codeList || _.isEmpty(codeList)) {
      return e.reply("[ams] 获取兑换码失败，请稍后再试")
    }

    const msgList = []
    const invalidCodes = ["MINGCHAO"]

    for (const item of codeList) {
      const isFail = String(item.is_fail || "0")
      if (isFail === "1") continue

      const order = item.order || ""
      if (!order || invalidCodes.includes(order)) continue

      const label = item.label || ""
      if (this.isCodeExpired(label)) continue

      const reward = item.reward || "无"

      msgList.push(`兑换码: ${order}\n奖励: ${reward}\n有效期: ${label}`)
    }

    if (_.isEmpty(msgList)) {
      return e.reply("暂无可用兑换码")
    }

    if (msgList.length > 3) {
      const forwardMsg = await this.makeMsg(msgList)
      return e.reply(forwardMsg)
    } else {
      return e.reply(msgList.join("\n\n"))
    }
  }

  async getCodeList() {
    try {
      const now = new Date()
      const yearStr = now.getYear()
      const monthStr = now.getMonth()
      const dayStr = now.getDate()
      const hourStr = now.getHours()
      const minuteStr = now.getMinutes()

      const timeString = `${yearStr}${monthStr}${dayStr}${hourStr}${minuteStr}`
      const nowTime = Date.now()

      const baseUrl = "https://newsimg.5054399.com/comm/mlcxqcommon/static/wap/js/data_102.js"
      const url = `${baseUrl}?${timeString}&callback=?&_=${nowTime}`

      logger.debug(`[ams] fetching codes: ${url}`)

      const res = await request.get(url)
      const text = await res.text()

      if (!text.includes("=")) return []

      let jsonPart = text.split("=").slice(1).join("=")
      jsonPart = jsonPart.trim().replace(/;+$/, "")

      logger.debug(`[ams] codeList data: ${jsonPart.substring(0, 100)}...`)

      return JSON.parse(jsonPart)
    } catch (err) {
      logger.error(`[ams] getCodeList error: ${err}`)
      return null
    }
  }

  isCodeExpired(label) {
    if (!label) return false

    const regex = /(\d{1,2})月(\d{1,2})日(\d{1,2})点/
    const match = label.match(regex)

    if (!match) return false

    let [, mon, day, hour] = match.map(Number)
    if (hour === 24) {
      hour = 23
    }

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    let year = currentYear
    if (mon < currentMonth && currentMonth - mon > 6) {
      year += 1
    } else if (mon > currentMonth && mon - currentMonth > 6) {
      year -= 1
    }

    const expireDate = new Date(year, mon - 1, day, hour, hour === 23 && match[3] == 24 ? 59 : 0, 0)

    if (match[3] == 24) {
      expireDate.setMinutes(59)
      expireDate.setSeconds(59)
    }

    return now > expireDate
  }
}
