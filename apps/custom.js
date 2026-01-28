import crypto from "crypto"
import fs from "fs"
import _ from "lodash"
import fetch from "node-fetch"
import path from "path"
import sharp from "sharp"
import DataLoader from "../lib/core/data_loader.js"
import { customBgPath, customPilePath } from "../lib/path.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"

export class Custom extends AmsPlugin {
  constructor() {
    super({
      name: "ams-自定义素材",
      event: "message",
      priority: _.get(config.getConfig("priority"), "custom", 110),
      rule: [
        {
          reg: config.fixCommond("上传背景图"),
          fnc: "uploadBg",
          permission: "master",
        },
        {
          reg: config.fixCommond("背景图列表"),
          fnc: "listBg",
          permission: "master",
        },
        {
          reg: config.fixCommond("删除背景图(.+)"),
          fnc: "deleteBg",
          permission: "master",
        },
        {
          reg: config.fixCommond("上传(.*)立绘"),
          fnc: "uploadPile",
          permission: "master",
        },
        {
          reg: config.fixCommond("(.*)立绘列表"),
          fnc: "listPile",
          permission: "master",
        },
        {
          reg: config.fixCommond("删除(.*)立绘(.+)"),
          fnc: "deletePile",
          permission: "master",
        },
        {
          reg: config.fixCommond("(背景)?原图$"),
          fnc: "getOriginalPicture",
        },
      ],
    })

    this.initDir()
  }

  initDir() {
    ;[customBgPath, customPilePath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    })
  }

  /**
   * 获取目录下支持的图片文件
   */
  getSupportedFiles(dir) {
    if (!fs.existsSync(dir)) return []
    return fs
      .readdirSync(dir)
      .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort()
  }

  async saveImages(imageUrls, saveDir) {
    if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true })
    let count = 0
    for (let url of imageUrls) {
      try {
        const response = await fetch(url)
        if (!response.ok) continue
        const buffer = Buffer.from(await response.arrayBuffer())

        // 生成 MD5 哈希并取前 8 位转为纯数字 ID
        const hash = crypto.createHash("md5").update(buffer).digest("hex")
        const numericId = parseInt(hash.slice(0, 8), 16)
        const fileName = `${numericId}.webp`
        const targetPath = path.join(saveDir, fileName)

        if (fs.existsSync(targetPath)) continue

        await sharp(buffer).webp({ quality: 90 }).toFile(targetPath)
        count++
      } catch (err) {
        logger.error(`[ams] 下载或转换图片失败: ${err.message}`)
      }
    }
    return count
  }

  /** 背景图管理 **/
  async uploadBg(e) {
    const urls = await this.getImageUrl()
    if (urls.length === 0) return e.reply("请发送图片或引用图片回复")
    const count = await this.saveImages(urls, customBgPath)
    return e.reply(count > 0 ? `✅ 成功上传 ${count} 张自定义背景图` : "❌ 图片已存在或上传失败")
  }

  async listBg(e) {
    const files = this.getSupportedFiles(customBgPath)
    if (files.length === 0) return e.reply("暂无自定义背景图")

    let forwardMsg = files.map(f => {
      const fileName = path.parse(f).name
      return {
        user_id: Bot.uin,
        nickname: Bot.nickname,
        message: [`ID: ${fileName}`, segment.image(`file://${path.join(customBgPath, f)}`)],
      }
    })
    return e.reply(await Bot.makeForwardMsg(forwardMsg))
  }

  async deleteBg(e) {
    let input = e.msg.match(/删除背景图(.+)/)?.[1]?.trim()
    if (!input) return e.reply("请输入要删除的图片 ID")

    const files = this.getSupportedFiles(customBgPath)
    // 匹配完整文件名 或 不带后缀的哈希 ID
    const targetFile = files.find(f => f === input || path.parse(f).name === input)

    if (!targetFile) return e.reply(`❌ 未找到 ID 为 ${input} 的图片`)

    fs.unlinkSync(path.join(customBgPath, targetFile))
    return e.reply(`✅ 已成功删除背景图: ${input}`)
  }

  /** 立绘管理 **/
  async uploadPile(e) {
    const name = e.msg.match(this.rule[3].reg)[1].trim()
    const id = DataLoader.getRoleId(name)
    if (!id) return e.reply(`❌ 未找到角色: ${name}`)
    const urls = await this.getImageUrl()
    if (urls.length === 0) return e.reply("请发送图片或引用图片回复")
    const count = await this.saveImages(urls, path.join(customPilePath, String(id)))
    return e.reply(
      count > 0 ? `✅ 成功上传 ${count} 张 ${name} 自定义立绘` : "❌ 图片已存在或上传失败",
    )
  }

  async listPile(e) {
    const name = e.msg.match(this.rule[4].reg)[1].trim()
    const roleId = DataLoader.getRoleId(name)
    if (!roleId) return e.reply(`❌ 未找到角色: ${name}`)
    const charDir = path.join(customPilePath, String(roleId))
    const files = this.getSupportedFiles(charDir)
    if (files.length === 0) return e.reply(`暂无 ${name} 的自定义立绘`)

    let forwardMsg = files.map(f => {
      const fileName = path.parse(f).name
      return {
        user_id: Bot.uin,
        nickname: Bot.nickname,
        message: [`ID: ${fileName}`, segment.image(`file://${path.join(charDir, f)}`)],
      }
    })
    return e.reply(await Bot.makeForwardMsg(forwardMsg))
  }

  async deletePile(e) {
    const match = e.msg.match(/删除(.*)立绘(.+)/)
    const name = match[1].trim(),
      input = match[2].trim()
    const roleId = DataLoader.getRoleId(name)
    if (!roleId) return e.reply(`❌ 未找到角色: ${name}`)

    const charDir = path.join(customPilePath, String(roleId))
    const files = this.getSupportedFiles(charDir)
    const targetFile = files.find(f => f === input || path.parse(f).name === input)

    if (!targetFile) return e.reply(`❌ 未找到 ${name} 的图片: ${input}`)

    fs.unlinkSync(path.join(charDir, targetFile))
    return e.reply(`✅ 已成功删除 ${name} 立绘: ${input}`)
  }

  /** 获取面板原图 **/
  async getOriginalPicture(e) {
    let source
    if (e.reply_id) {
      source = { message_id: e.reply_id }
    } else {
      if (!e.hasReply && !e.source) return false
      if (e.source.user_id !== e.self_id) return false
      try {
        source = e.group?.getChatHistory
          ? (await e.group.getChatHistory(e.source.seq, 1)).pop()
          : e.friend?.getChatHistory
            ? (await e.friend.getChatHistory(e.source.time, 1)).pop()
            : null
      } catch (err) {}

      if (!source) source = { message_id: e.source.message_id, message: e.source.message }

      if (
        source?.message?.[0]?.type === "image" &&
        source.message[1]?.type === "text" &&
        !source.message[1].data?.text
      ) {
        source.message = [source.message[0]]
      }

      if (
        !(source?.message?.length === 1 && source.message[0]?.type === "image") &&
        !source.message_id
      )
        return false
    }

    const msgId = source.message_id
    if (!msgId) return false

    const isBg = e.msg.includes("背景")
    const cfg = config.getConfig("config")
    if (isBg && !cfg.yuantu_bg) return e.reply("已禁止获取背景原图")
    if (!isBg && !cfg.yuantu_pile) return e.reply("已禁止获取立绘原图")

    const key = isBg ? `ams:original-background:${msgId}` : `ams:original-picture:${msgId}`
    const imgPath = await redis.get(key)
    if (!imgPath) return e.reply("❌ 未找到对应的原图，该消息可能已过期")

    const realPath = imgPath.replace("file://", "")
    if (!fs.existsSync(realPath)) return e.reply("❌ 原图文件已被删除或不存在")

    let text = ""
    if (imgPath.includes("/custom/")) {
      const id = imgPath.split("/").pop().split(".")[0]
      text = `\nID: ${id}`
      if (!isBg) {
        const charId = imgPath.split("/").slice(-2, -1)[0]
        const charName = DataLoader.getCharacterById(charId)?.name
        if (charName) text += ` (${charName})`
      }
    }

    try {
      return e.reply([segment.image(imgPath), text])
    } catch (err) {
      return e.reply("❌ 原图发送失败")
    }
  }
}
