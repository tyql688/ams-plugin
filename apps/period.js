import _ from "lodash"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"

export class Period extends AmsPlugin {
  constructor() {
    super({
      name: "ams-简报",
      dsc: "鸣潮资源简报",
      event: "message",
      priority: _.get(config.getConfig("priority"), "period", 110),
      rule: [{ reg: config.fixCommond("(星声|简报|资源简报|星声统计).*$"), fnc: "getPeriod" }],
    })
  }

  async getPeriod() {
    const wavesApi = await this.getWavesApi()
    if (!wavesApi) return

    const periodParam = this.e.msg.replace(/^.*(星声|简报|资源简报|星声统计)/, "").trim()
    const listRes = await wavesApi.getPeriodList()
    if (!listRes.status) return this.e.reply(`❌ 获取列表失败: ${listRes.msg}`)

    const { months = [], weeks = [], versions = [] } = listRes.data
    const all = [
      ...versions.map(v => ({ ...v, _t: "version" })),
      ...months.map(m => ({ ...m, _t: "month" })),
      ...weeks.map(w => ({ ...w, _t: "week" })),
    ]

    const target = periodParam
      ? all.find(i => i.title.includes(periodParam) || String(i.index) === periodParam)
      : _.maxBy(versions, "index")
    if (!target) return this.e.reply(`❌ 未找到简报: ${periodParam || "最新"}`)

    const detailRes = await wavesApi.getPeriodDetail(target._t, target.index)
    if (!detailRes.status) return this.e.reply(`❌ 获取详情失败: ${detailRes.msg}`)

    await this.getAvatarUrl()
    return this.e.reply(
      await this.render("period/period.html", {
        periodNode: target,
        periodDetail: this._processData(detailRes.data),
        roleId: wavesApi.wavesId,
        roleName: this.e.roleName || "漂泊者",
      }),
    )
  }

  _processData(data) {
    const itemMap = _.keyBy(data.itemList || [], "type")
    const getVal = id => itemMap[id]?.total || (id === 1 ? data.totalCoin : data.totalStar) || 0

    const resources = {
      star: getVal(2),
      coin: getVal(1),
      lustrous: getVal(3),
      radiant: getVal(4),
    }

    const starList = (itemMap[2]?.detail || data.starList || []).filter(i => i.type !== "海市兑换")
    const colors = ["#FACC15", "#FB7185", "#22D3EE", "#34D399", "#818CF8", "#A78BFA"]
    let offset = 0
    const total = resources.star || 1

    return {
      ...data,
      resources,
      totalStar: resources.star,
      starList: starList.map((item, i) => {
        const percent = (item.num / total) * 100
        const res = {
          ...item,
          color: colors[i % colors.length],
          startPer: offset.toFixed(2),
          endPer: (offset + percent).toFixed(2),
        }
        offset += percent
        return res
      }),
    }
  }
}
