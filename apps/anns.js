import _ from "lodash"
import puppeteer from "../../../lib/puppeteer/puppeteer.js"
import WavesApi from "../lib/api/waves.js"
import { pluginPath, resourcePath } from "../lib/path.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"

export class Anns extends AmsPlugin {
  constructor() {
    super({
      name: "ams-公告",
      event: "message",
      priority: _.get(config.getConfig("priority"), "anns", 110),
      rule: [
        {
          reg: config.fixCommond("(活动|新闻|公告|资讯)(详情)?\\s*(\\d+)?$"),
          fnc: "queryAnns",
        },
        {
          reg: config.fixCommond("(开启|关闭)公告推送$"),
          fnc: "toggleAnnsPush",
          permission: "master",
        },
      ],
    })

    const cron = _.get(config.getConfig("config"), "anns_push_time", "0 0/30 * * * ?")
    this.task = {
      name: "[ams] 公告推送",
      fnc: () => this.autoAnns(),
      cron: cron,
      log: false,
    }
  }

  async queryAnns(e) {
    const wavesApi = new WavesApi()

    // 解析基础类型
    let type = 3
    let typeName = "公告"
    let typeKey = "ann"
    if (e.msg.includes("资讯")) {
      type = 2
      typeName = "资讯"
      typeKey = "info"
    } else if (e.msg.includes("活动")) {
      type = 1
      typeName = "活动"
      typeKey = "activity"
    }

    // 正则匹配参数
    const match = e.msg.match(/(\d+)$/)
    const annsId = match ? parseInt(match[1]) : null

    // 如果没有参数，显示并排三栏列表
    if (annsId === null) {
      return this.renderCombinedList(e, wavesApi)
    }

    // 处理有参数的情况
    // 统一并发拉取三个分类的所有列表数据以供搜寻
    const allTypeIds = [1, 2, 3]
    let allLists = {}
    try {
      const results = await Promise.all(allTypeIds.map(id => wavesApi.getEventList(id)))
      allTypeIds.forEach((id, idx) => {
        allLists[id] = results[idx].data?.list || []
      })
    } catch (err) {
      logger.error(`[ams] fetch all lists error: ${err}`)
      return e.reply("获取公告列表失败")
    }

    let targetPostId = null

    // 在所有分类中全局搜寻 ID (短 ID 或长 PostID)
    for (const id in allLists) {
      const found = allLists[id].find(
        i => String(i.id) === String(annsId) || String(i.postId) === String(annsId),
      )
      if (found) {
        targetPostId = found.postId
        break
      }
    }

    // 如果全局列表都没找到，通过长度校验判断是否为长 ID 并尝试兜底
    if (!targetPostId) {
      if (String(annsId).length < 10) {
        return e.reply(`未在最近的列表匹配到 ID: ${annsId}`)
      }
      targetPostId = String(annsId)
    }

    if (!targetPostId) return false

    return this.queryAnnsDetail(e, targetPostId)
  }

  async renderCombinedList(e, wavesApi) {
    const types = [
      { id: 1, label: "活动", key: "activity" },
      { id: 3, label: "公告", key: "ann" },
      { id: 2, label: "资讯", key: "info" },
    ]
    let groupedData = {
      activity: [],
      ann: [],
      info: [],
    }

    try {
      const results = await Promise.all(types.map(t => wavesApi.getEventList(t.id)))
      for (let i = 0; i < results.length; i++) {
        const res = results[i]
        const typeInfo = types[i]
        if (res.status && res.data?.list) {
          // 每个分类取前 5 条显示
          groupedData[typeInfo.key] = res.data.list.slice(0, 5).map(item => ({
            ...item,
            shortId: item.id,
            time: new Date(item.publishTime).toLocaleDateString(),
          }))
        }
      }
    } catch (err) {
      logger.error(`[ams] renderCombinedList error: ${err}`)
      return e.reply("获取公告数据失败")
    }

    logger.debug(
      `[ams] News groups: activity=${groupedData.activity.length}, ann=${groupedData.ann.length}, info=${groupedData.info.length}`,
    )

    const renderData = {
      groupedData,
      title: "库街区·鸣潮·简讯",
      brand: "AMS NEWS FEED",
      reportDate: new Date().toLocaleDateString(),
    }

    const img = await this.render("anns/anns-list", renderData)
    if (img) await e.reply(img)
    return true
  }

  async queryAnnsDetail(e, postId, isTask = false) {
    if (!postId || postId.length < 5) return false // 简单的 ID 校验

    const wavesApi = new WavesApi()
    const detailData = await wavesApi.getPostDetail(postId)

    if (!detailData.status) {
      if (!isTask) await e.reply(detailData.msg)
      return false
    }

    const post = detailData.data.postDetail
    // 直接使用 H5 内容以保留样式
    let htmlContent = post.postNewH5Content || ""

    // 检查 htmlContent 是否包含图片，如果没有则尝试使用 coverImages
    const hasImage = /<img\s+[^>]*src=/.test(htmlContent)
    if (!hasImage && post.coverImages && post.coverImages.length > 0 && post.coverImages[0].url) {
      const coverUrl = post.coverImages[0].url
      // 将封面图拼接到内容最前面
      htmlContent =
        `<div class="image-block"><img src="${coverUrl}" alt="Cover" /></div>` + htmlContent
    }

    const renderData = {
      data: {
        id: post.id,
        userName: post.userName || "鸣潮官方",
        identifyNames: post.identifyNames || "官方",
        postTitle: post.postTitle,
        postTime: post.postTime,
        ipRegion: post.ipRegion || "未知",
        content: htmlContent,
      },
      _res_path: resourcePath,
      tplFile: `${pluginPath}/resources/anns/anns-detail.html`,
    }

    const img = await puppeteer.screenshots("annsDetail", renderData)
    // const img = await this.render("anns/anns-detail", renderData)
    if (isTask) return img
    if (img) await e.reply(img)
    return true
  }

  async toggleAnnsPush(e) {
    const annsPush = _.get(config.getConfig("config"), "anns_push", false)
    if (!annsPush) {
      logger.mark("[ams] 公告推送功能已关闭")
      return
    }

    if (!e.isGroup) {
      logger.mark("[ams] 仅支持群聊订阅公告推送")
      return
    }

    const isEnable = e.msg.includes("开启")
    const redisKey = "ams:anns:push_list"
    const target = {
      group_id: e.group_id,
      bot_id: e.self_id,
    }

    let pushList = await redis.get(redisKey)
    pushList = pushList ? JSON.parse(pushList) : []
    pushList = pushList.filter(i => i.type !== "private")

    if (isEnable) {
      if (pushList.find(i => i.group_id === target.group_id && i.bot_id === target.bot_id)) {
        return e.reply("当前群聊已开启公告推送")
      }
      pushList.push(target)
      await redis.set(redisKey, JSON.stringify(pushList))
      return e.reply("库街区公告推送已开启")
    } else {
      pushList = pushList.filter(
        i => !(i.group_id === target.group_id && i.bot_id === target.bot_id),
      )
      await redis.set(redisKey, JSON.stringify(pushList))
      return e.reply("库街区公告推送已关闭")
    }
  }

  async autoAnns() {
    logger.mark("[ams] 开始检查推送任务...")
    const wavesApi = new WavesApi()
    const redisKey = "ams:anns:push_list"
    const lastIdKey = "ams:anns:last_id"

    const pushListJson = await redis.get(redisKey)
    if (!pushListJson) return

    const pushList = JSON.parse(pushListJson).filter(item => item.group_id)
    if (!pushList.length) return

    // 获取公告列表 (取 Type 3 和 Type 1, 2)
    const types = [3, 2, 1]
    let latestAnns = []

    try {
      for (const t of types) {
        const res = await wavesApi.getEventList(t)
        if (res.status && res.data?.list?.length) {
          latestAnns.push(...res.data.list)
        }
      }
    } catch (err) {
      logger.error(`[ams] autoNews get list error: ${err}`)
      return
    }

    if (!latestAnns.length) return

    // 仅推送最近1天内的公告
    const now = Date.now()
    const interval = 24 * 60 * 60 * 1000
    const recentAnns = latestAnns.filter(item => now - item.publishTime <= interval)
    if (!recentAnns.length) return

    recentAnns.sort((a, b) => a.publishTime - b.publishTime)

    for (const item of recentAnns) {
      const postId = item.postId
      if (!postId) continue

      const img = await this.queryAnnsDetail(this.e, postId, true)
      if (!img) continue

      // 批量推送（未发送过的）
      for (const target of pushList) {
        const sentKey = `${lastIdKey}:${target.bot_id}:${target.group_id}:${postId}`
        const hasSent = await redis.get(sentKey)
        if (hasSent) continue

        try {
          const bot = Bot[target.bot_id] || Bot
          const group = bot?.pickGroup(target.group_id)
          if (!group) {
            logger.mark(`[ams] 公告推送失败，群未关联: ${target.bot_id}:${target.group_id}`)
            continue
          }
          await group.sendMsg(img)
          await redis.set(sentKey, "1", { EX: 48 * 60 * 60 })
          await new Promise(resolve => setTimeout(resolve, _.random(2000, 3000)))
        } catch (err) {
          logger.error(`[ams] 推送失败: ${target.group_id} ${err.message}`)
        }
      }
    }
  }
}
