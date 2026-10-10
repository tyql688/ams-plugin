import crypto from "crypto"
import fs from "fs"
import _ from "lodash"
import fetch from "node-fetch"
import path from "path"
import sharp from "sharp"
import { fileURLToPath } from "url"
import DataLoader from "../lib/core/data_loader.js"
import { PANEL_BG_TYPES } from "../lib/custom_bg.js"
import {
  findCustomPileFile,
  getCustomPileAliasRoleId,
  getCustomPileRoleIds,
  listCustomPileFiles,
} from "../lib/custom_pile.js"
import { customBgPath, customPilePath } from "../lib/path.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"
import { listImageFiles } from "../lib/utils.js"

const BG_SCOPE = `(${Object.keys(PANEL_BG_TYPES).join("|")})?`

export class Custom extends AmsPlugin {
  constructor() {
    super({
      name: "ams-自定义素材",
      event: "message",
      priority: _.get(config.getConfig("priority"), "custom", 110),
      rule: [
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
        {
          reg: config.fixCommond(`上传${BG_SCOPE}背景图`),
          fnc: "uploadBg",
          permission: "master",
        },
        {
          reg: config.fixCommond(`${BG_SCOPE}背景图列表`),
          fnc: "listBg",
          permission: "master",
        },
        {
          reg: config.fixCommond(`删除${BG_SCOPE}背景图(.+)`),
          fnc: "deleteBg",
          permission: "master",
        },
      ],
    })

    fs.mkdirSync(customPilePath, { recursive: true })
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

  getPanelBgTarget(e, fnc) {
    const [, type = "通用", input] = e.msg.match(this.rule.find(rule => rule.fnc === fnc).reg)
    return { type, dir: path.join(customBgPath, "panel", PANEL_BG_TYPES[type]), input: input?.trim() }
  }

  async uploadBg(e) {
    const { type, dir } = this.getPanelBgTarget(e, "uploadBg")
    const urls = await this.getImageUrls()
    if (urls.length === 0) return e.reply("请发送图片或引用图片回复")
    const count = await this.saveImages(urls, dir)
    return e.reply(count > 0 ? `✅ 成功上传 ${count} 张${type}面板背景图` : "❌ 图片已存在或上传失败")
  }

  async listBg(e) {
    const { type, dir } = this.getPanelBgTarget(e, "listBg")
    const files = listImageFiles(dir).sort()
    if (files.length === 0) return e.reply(`暂无${type}面板背景图`)
    const forwardMsg = files.map(file => ({
      user_id: Bot.uin,
      nickname: Bot.nickname,
      message: [`${type}面板背景\nID: ${path.parse(file).name}`, segment.image(path.join(dir, file))],
    }))
    return e.reply(await Bot.makeForwardMsg(forwardMsg))
  }

  async deleteBg(e) {
    const { type, dir, input } = this.getPanelBgTarget(e, "deleteBg")
    if (!input) return e.reply("请输入要删除的图片 ID")
    const file = listImageFiles(dir).find(file => file === input || path.parse(file).name === input)
    if (!file) return e.reply(`❌ 未找到${type}面板背景图: ${input}`)
    fs.unlinkSync(path.join(dir, file))
    return e.reply(`✅ 已删除${type}面板背景图: ${input}`)
  }

  /** 立绘管理 **/
  getPileRoleId(name) {
    return getCustomPileAliasRoleId(name) || DataLoader.getRoleId(name)
  }

  async uploadPile(e) {
    const name = e.msg.match(this.rule[0].reg)[1].trim()
    const id = this.getPileRoleId(name)
    if (!id) return e.reply(`❌ 未找到角色: ${name}`)
    const urls = await this.getImageUrls()
    if (urls.length === 0) return e.reply("请发送图片或引用图片回复")
    // 新图片统一存入共享组首个目录；读取仍聚合全部成员目录，兼容已有文件。
    const storageId = getCustomPileRoleIds(id)[0]
    const count = await this.saveImages(urls, path.join(customPilePath, String(storageId)))
    return e.reply(
      count > 0 ? `✅ 成功上传 ${count} 张 ${name} 自定义立绘` : "❌ 图片已存在或上传失败",
    )
  }

  async listPile(e) {
    const name = e.msg.match(this.rule[1].reg)[1].trim()
    const roleId = this.getPileRoleId(name)
    if (!roleId) return e.reply(`❌ 未找到角色: ${name}`)
    const files = listCustomPileFiles(customPilePath, roleId)
    if (files.length === 0) return e.reply(`暂无 ${name} 的自定义立绘`)

    const forwardMsg = files.map(f => {
      return {
        user_id: Bot.uin,
        nickname: Bot.nickname,
        message: [`ID: ${f.id}`, segment.image(f.url)],
      }
    })
    return e.reply(await Bot.makeForwardMsg(forwardMsg))
  }

  async deletePile(e) {
    const match = e.msg.match(/删除(.*)立绘(.+)/)
    const name = match[1].trim(),
      input = match[2].trim()
    const roleId = this.getPileRoleId(name)
    if (!roleId) return e.reply(`❌ 未找到角色: ${name}`)

    const targetFile = findCustomPileFile(customPilePath, roleId, input)

    if (!targetFile) return e.reply(`❌ 未找到 ${name} 的图片: ${input}`)

    for (const filePath of targetFile.paths) fs.unlinkSync(filePath)
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

    const realPath = fileURLToPath(imgPath)
    if (!fs.existsSync(realPath)) return e.reply("❌ 原图文件已被删除或不存在")

    let text = ""
    if (imgPath.includes("/custom/")) {
      const id = path.parse(realPath).name
      text = `\nID: ${id}`
      if (isBg) {
        const folder = path.basename(path.dirname(realPath))
        const type = Object.keys(PANEL_BG_TYPES).find(type => PANEL_BG_TYPES[type] === folder)
        if (type) text += ` (${type}面板背景)`
      } else {
        const charId = imgPath.split("/").slice(-2, -1)[0]
        const charNames = [
          ...new Set(
            getCustomPileRoleIds(charId)
              .map(id => DataLoader.getCharacterById(id)?.name)
              .filter(Boolean),
          ),
        ]
        if (charNames.length > 0) text += ` (${charNames.join(" / ")})`
      }
    }

    try {
      return e.reply([segment.image(realPath), text])
    } catch (err) {
      return e.reply("❌ 原图发送失败")
    }
  }
}
