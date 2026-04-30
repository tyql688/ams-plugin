import _ from "lodash"
import fs from "node:fs"
import { gachaPath } from "../lib/path.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"
import { formatDataTime } from "../lib/utils.js"
import version from "../lib/version.js"
import GachaRecord, { GACHA_TYPES } from "../model/gachaRecord.js"
export class Gacha extends AmsPlugin {
  constructor() {
    super({
      name: "ams-抽卡记录",
      event: "message",
      priority: _.get(config.getConfig("priority"), "gacha", 100),
      rule: [
        {
          reg: config.fixCommond("(?:抽卡|唤取)(?:记录|历史|分析)"),
          fnc: "gachaLog",
        },
        {
          reg: config.fixCommond("(?:更新|导入)(?:抽卡|唤取)(?:记录|历史|分析|链接)[\\s\\S]*"),
          fnc: "updateGachaLog",
        },
        {
          reg: config.fixCommond("(?:导出)(?:抽卡|唤取)(?:记录|历史|分析)"),
          fnc: "exportGachaLog",
        },
        {
          reg: config.fixCommond("(?:抽卡|唤取)(?:帮助|说明|教程)"),
          fnc: "gachaHelp",
        },
      ],
    })
  }

  async gachaLog(e) {
    const user = await this.getWavesUser()
    if (!user) {
      return e.reply(`❌ 请先绑定鸣潮账号\n请先使用：${config.exampleCommond("登录")}`)
    }

    const record = new GachaRecord(user.gameUid)
    const data = record.data

    if (!data.data_time) {
      return e.reply(
        `❌ 暂无抽卡记录，请先使用【${config.exampleCommond("更新抽卡记录 链接")}】导入数据。`,
      )
    }

    await e.reply("🎨 正在生成抽卡分析图...")

    const showAll = !!config.getConfig("config").gacha_show_all

    // 准备渲染数据
    // 聚合所有池子的五星记录，并格式化为 V2 需要的结构
    const pools = {}
    for (const [typeId, typeName] of Object.entries(GACHA_TYPES)) {
      if (!showAll && Number(typeId) > 4) continue
      const stat = record.getStatData(typeName)
      if (stat && stat.pool && stat.pool.length > 0) {
        pools[typeName] = {
          info: {
            ...stat.info,
            name: typeName,
          },
          logs: stat.pool,
        }
      }
    }

    // 获取头像
    await this.getAvatarUrl()

    const renderData = {
      playerId: user.gameUid,
      pools: pools,
    }

    const img = await this.render("gacha/gacha-v2", {
      data: renderData,
      roleName: user?.gameData?.roleName,
    })
    if (img) {
      await e.reply(img)
    } else {
      await e.reply("❌ 绘图失败")
    }
  }

  async updateGachaLog(e) {
    const user = await this.getWavesUser()
    if (!user) {
      return e.reply(`❌ 请先绑定鸣潮账号\n请先使用：${config.exampleCommond("登录")}`)
    }

    const uid = user.gameUid
    const record = new GachaRecord(uid)

    // 解析文本内容的容器
    let text = (e.msg || "").replace(/["\n\t ]+/g, "")

    // === 场景1：处理引用消息中的文本链接 ===
    if (e.source) {
      const sourceMsg = await this.getSourceMessage(e)
      if (sourceMsg && Array.isArray(sourceMsg.message)) {
        let sourceText = ""
        for (const msg of sourceMsg.message) {
          if (msg.type === "text") sourceText += msg.text
        }
        if (sourceText) {
          text += " " + sourceText.replace(/["\n\t ]+/g, "")
        }
      }
    }

    // === 场景2：URL或文本导入 (此时 text 可能来自当前消息，也可能来自引用消息) ===
    let matchRecordId = null
    let matchPlayerId = null

    if (text.includes("https://")) {
      matchRecordId = text.match(/record_id=([a-zA-Z0-9]+)/)
      matchPlayerId = text.match(/player_id=(\d+)/)
    } else if (text.includes("{")) {
      matchRecordId = text.match(/"?recordId"?\s*[:=]\s*"?([a-zA-Z0-9]+)"?/)
      matchPlayerId = text.match(/"?playerId"?\s*[:=]\s*"?(\d+)"?/)
    } else if (text.includes("recordId=")) {
      matchRecordId = text.match(/recordId=([a-zA-Z0-9]+)/)
      matchPlayerId = text.match(/playerId=(\d+)/)
    } else {
      // 尝试直接匹配 recordId
      matchRecordId = ("recordId=" + text).match(/recordId=([a-zA-Z0-9]+)/)
      matchPlayerId = null
    }

    const recordId = matchRecordId && matchRecordId[1].length === 32 ? matchRecordId[1] : null

    // 如果没有提取到 recordId，说明用户可能想进行文件导入，但没有在命令中附带文件/链接
    if (!recordId) {
      // 当没发送任何东西时，也要支持链接也就是 `URL或文本导入`; 暂时去掉文件导入
      this.setContext("handleLinkImport")
      return e.reply("💡 请发送您的抽卡记录链接或文本")
    }

    const urlUid = matchPlayerId ? matchPlayerId[1] : null
    if (urlUid && urlUid !== uid) {
      return e.reply(`❌ 链接中的UID (${urlUid}) 与当前绑定UID (${uid}) 不一致！`)
    }

    await this.doFetch(e, record, recordId)
  }

  // 辅助：获取引用消息对象
  async getSourceMessage(e) {
    try {
      if (e.group?.getChatHistory) {
        const history = await e.group.getChatHistory(e.source.seq, 1)
        if (history && history[0]) return history[0]
      } else if (e.friend?.getChatHistory) {
        const history = await e.friend.getChatHistory(e.source.seq, 1)
        if (history && history[0]) return history[0]
      }
    } catch (err) {
      logger.error(`[ams] getSourceMessage: ${err}`)
    }
    return null
  }

  async handleLinkImport() {
    this.finish("handleLinkImport")
    return this.updateGachaLog(this.e)
  }

  async gachaHelp(e) {
    const text = [
      "如何导入抽卡记录",
      "",
      `使用命令【${config.exampleCommond("导入抽卡记录")} + 你复制的内容】即可开始进行抽卡分析`,
      "",
      "抽卡链接具有有效期，请在有效期内尽快导入",
    ].join("\n")

    const yun = [
      "云鸣潮获取方式",
      "1.复制以下链接到浏览器打开",
      "https://gacha.253525.xyz",
      "2.登录后,依次点击\`刷新记录\`,\`复制记录\`按钮",
    ].join("\n")

    const pc = [
      "PC获取方式",
      "1.打开游戏抽卡界面，点开换取记录",
      "2.在鸣潮安装的目录下进入目录：`Wuthering Waves\\Wuthering Waves Game\\Client\\Saved\\Logs`",
      "3.找到文件`Client.log`并用记事本打开",
      "4.搜索关键字：aki-gm-resources.aki-game",
      "5.复制一整行链接",
    ].join("\n")

    const android = [
      "安卓手机获取链接方式",
      "1.打开游戏抽卡界面",
      "2.关闭网络或打开飞行模式",
      "3.点开换取记录",
      "4.长按左上角区域，全选，复制",
    ].join("\n")

    const ios = [
      "苹果手机获取方式",
      "1.使用Stream抓包（详细教程网上搜索）",
      "2.关键字搜索:[game2]的请求",
      "3.点击`请求`",
      "4.点击最下方的`查看JSON`，全选，复制",
      "国服域名：[gmserver-api.aki-game2.com]",
      "国际服域名：[gmserver-api.aki-game2.net]",
    ].join("\n")

    const msg = [text, yun, pc, android, ios]
    // 制作转发消息
    const forwardMsg = await this.makeMsg(msg)
    return e.reply(forwardMsg)
  }

  async doFetch(e, record, recordId) {
    await e.reply("⏳ 正在获取抽卡记录，可能需要几十秒，请稍候...")

    const { code, totalNew, newCounts } = await record.fetchAndMerge(recordId)

    if (code !== 0) {
      return e.reply("❌ 获取失败，链接可能已失效。")
    }

    if (totalNew === 0) {
      return e.reply("✅ 抽卡记录已是最新，无新增数据。")
    }

    const msg = [`✅ 更新成功！新增 ${totalNew} 条记录：`]
    for (const [name, count] of Object.entries(newCounts)) {
      if (count > 0) msg.push(`- ${name}: +${count}`)
    }
    await e.reply(msg.join("\n"))
  }

  async handleJsonImport() {
    if (!this.e.file) return false

    // 结束上下文
    this.finish("handleJsonImport")

    // 检查是否绑定
    const user = await this.getWavesUser()
    if (!user) {
      return this.e.reply(`❌ 请先绑定鸣潮账号\n请先使用：${config.exampleCommond("登录")}`)
    }

    // 构造本地临时文件路径
    const fileName = this.e.file.name || `${this.e.user_id}_${Date.now()}.json`
    const savePath = `${gachaPath}/${fileName}`
    let fileUrl
    if (this.e.file.url) fileUrl = this.e.file.url
    else if (this.e.group?.getFileUrl) fileUrl = await this.e.group.getFileUrl(this.e.file.fid)
    else if (this.e.friend?.getFileUrl) fileUrl = await this.e.friend.getFileUrl(this.e.file.fid)

    logger.info(`[ams] Gacha Import: ${fileUrl}`)
    try {
      const ret = await Bot.download(fileUrl, savePath)
      if (!ret) {
        return this.e.reply("❌ 下载JSON文件失败。")
      }
    } catch (err) {
      logger.error(`[ams] Gacha Import error: ${err}`)
      return this.e.reply("❌ 导入文件过程中发生错误，请查看日志。")
    }

    // 读取并解析
    let jsonData = {}
    try {
      const content = fs.readFileSync(savePath, "utf8")
      jsonData = JSON.parse(content)
    } catch (err) {
      // 尝试删除错误文件
      await fs.unlink(savePath)
      return this.e.reply(`❌ 解析JSON文件失败: ${err.message}`)
    }

    // 删除临时文件
    await fs.unlink(savePath)

    // 导入数据
    const record = new GachaRecord(user.gameUid)
    const result = await record.importFromJson(jsonData)
    if (!result.success) {
      return this.e.reply(`❌ 导入失败: ${result.msg}`)
    }

    await this.e.reply(`✅ 导入成功！新增 ${result.totalNew} 条记录。`)
  }

  async exportGachaLog(e) {
    const user = await this.getWavesUser()
    if (!user) {
      return e.reply(`❌ 请先绑定鸣潮账号\n请先使用：${config.exampleCommond("登录")}`)
    }

    const record = new GachaRecord(user.gameUid)
    if (!record.data.data_time) {
      return e.reply("❌ 暂无抽卡记录可导出。")
    }

    const exportData = {
      info: {
        uid: record.data.uid,
        lang: "zh-cn",
        export_app: "ams-plugin",
        export_app_version: version.version,
        version: "v2.0",
        export_time: formatDataTime(new Date()),
      },
      list: [],
    }

    for (const [poolName, logs] of Object.entries(record.data.data)) {
      exportData.list.push(...logs)
    }

    record.export(exportData)

    // 发送文件
    const filePayload = segment.file(record.exportPath)
    await e.reply([filePayload])
  }
}
