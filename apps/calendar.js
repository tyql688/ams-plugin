import moment from "moment"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"
import { getSlashPeriod, getTowerPeriod } from "../lib/utils.js"

export class Calendar extends AmsPlugin {
  constructor() {
    super({
      name: "ams-日历",
      event: "message",
      priority: 100,
      rule: [{ reg: config.fixCommond("日历"), fnc: "calendar" }],
    })
  }

  async calendar(e) {
    const wavesApi = await this.getWavesApi(false)
    if (!wavesApi) return false

    const res = await wavesApi.getWikiHome()
    // 简化判空
    const { banner = [], sideModules = [] } = res.data?.contentJson || {}
    if (!banner.length && !sideModules.length) return e.reply("❌ 获取数据失败")

    const now = moment()
    // 简化 Banner 获取
    const bannerUrl = (banner.find(b => b.describe?.includes("版本")) || banner[0])?.url || ""

    // 辅助函数查找模块
    const findMod = key => sideModules.find(m => m.title.includes(key))

    const modules = {
      activity: this.getActivityList(findMod("版本活动")),
      role: this.getGachaList(findMod("角色活动")),
      weapon: this.getGachaList(findMod("武器活动")),
    }

    // 移除空模块键 (如果 getGachaList 返回 null)
    if (!modules.role) delete modules.role
    if (!modules.weapon) delete modules.weapon

    // 常驻活动
    const fixedEvents = [
      this.getFixedEvent("逆境深塔", "tower.webp", getTowerPeriod()),
      this.getFixedEvent("冥歌海墟", "shenhai.webp", getSlashPeriod()),
    ]
    modules.activity.data.unshift(...fixedEvents)

    return e.reply(
      await this.render("calendar/calendar", {
        bannerUrl,
        modules,
        now: now.format("YYYY.MM.DD HH:mm"),
        commonImgPath: `../../common/imgs/`,
      }),
    )
  }

  getTimeState(dateRange) {
    if (!Array.isArray(dateRange) || dateRange.length < 2) return null

    const start = moment(dateRange[0])
    const end = moment(dateRange[1])
    const now = moment()

    const total = end.diff(start)
    const left = end.diff(now)
    const isFuture = start.diff(now) > 0
    const isEnd = left <= 0

    // 简化百分比计算
    const percent = isFuture ? 0 : isEnd ? 100 : ((total - left) / total) * 100

    let duration = ""
    if (!isFuture && !isEnd) {
      const d = moment.duration(left)
      duration = `${Math.floor(d.asDays())}天${d.hours()}小时`
    }

    // 4. 计算剩余天数用于颜色警告
    const daysLeft = Math.floor(moment.duration(left).asDays())

    // 紧急程度：2=红(<=1天), 1=黄(<=3天), 0=正常
    let urgentLevel = 0
    if (!isFuture && !isEnd) {
      if (daysLeft <= 1) urgentLevel = 2
      else if (daysLeft <= 3) urgentLevel = 1
    }

    return {
      start: start.format("MM.DD HH:mm"),
      end: end.format("MM.DD HH:mm"),
      status: isEnd ? "已结束" : isFuture ? "未开始" : "进行中",
      cssClass: isEnd ? "ended" : isFuture ? "future" : "ongoing",
      duration,
      percent: Math.min(100, Math.max(0, percent)),
      urgentLevel, // 传给前端
    }
  }

  getGachaList(data) {
    if (!data?.content?.tabs) return null
    const { title, content } = data

    const uniqueMap = new Map()
    const titles = []

    content.tabs.forEach(tab => {
      titles.push(tab.name)
      const imgs = tab.imgs || []

      imgs.forEach((img, index) => {
        // 统一提取属性
        const isObj = typeof img === "object" && img !== null
        const url = isObj ? img.img || img.image || img.url || img.icon : img
        if (!url) return

        const name = isObj ? img.title || "" : ""
        // 优先用 entryId 作为 key
        const key = isObj && img?.linkConfig?.entryId ? img.linkConfig.entryId : url
        // 原始逻辑中的 5星判定 Hack
        const is5Star = index < imgs.length - 3

        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, { name, icon: url, is5Star })
        } else if (is5Star) {
          // 仅更新 5 星状态
          uniqueMap.get(key).is5Star = true
        }
      })
    })

    const list = Array.from(uniqueMap.values()).sort(
      (a, b) => (b.is5Star ? 1 : 0) - (a.is5Star ? 1 : 0),
    )

    return {
      title,
      subTitle: titles.join(" / "),
      list,
      time: this.getTimeState(content.tabs[0]?.countDown?.dateRange),
    }
  }

  getActivityList(data) {
    if (!data?.content) return { title: "版本活动", data: [] }

    const statusOrder = { 进行中: 0, 未开始: 1, 已结束: 2 }

    const list = data.content
      .map(item => ({
        title: item.title,
        icon: item.contentUrl,
        time: this.getTimeState(item.countDown?.dateRange),
        isUrl: item.contentUrl?.startsWith("http"),
      }))
      .filter(i => i.time)
      .sort((a, b) => (statusOrder[a.time.status] ?? 9) - (statusOrder[b.time.status] ?? 9))

    return { title: data.title, data: list }
  }

  getFixedEvent(title, icon, period) {
    return {
      title,
      icon,
      time: this.getTimeState([period.start, period.end]),
      isUrl: false,
      isLocal: true,
    }
  }
}
