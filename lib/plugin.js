import _ from "lodash"
import path from "path"
import KuroClient from "./api/kuro.js"
import WavesApi from "./api/waves.js"
import { GAMES } from "./constants.js"
import { User } from "./db/index.js"
import { framePath, pluginName, resourcePath, wavesResMap } from "./path.js"
import config from "./settings.js"
import { randomFiles } from "./utils.js"
import version from "./version.js"

export class AmsPlugin extends plugin {
  getUserIdentity() {
    let e = this.e
    return {
      userId: String(e.user_id || ""),
      botId: String(e.self_id || e.bot?.uin || ""),
    }
  }

  getKuroApi() {
    return new KuroClient()
  }

  async getWavesUser() {
    // 优先使用缓存
    if (this._wavesUser) return this._wavesUser

    const { userId } = this.getUserIdentity()
    this._wavesUser = await User.getUseUser(userId, GAMES.waves.id)
    return this._wavesUser
  }

  /**
   * 获取鸣潮 API 实例
   * @param {boolean} isCheckToken 是否检查Token有效性，默认 true
   */
  async getWavesApi(isCheckToken = true) {
    const user = await this.getWavesUser()

    if (!user) {
      await this.e.reply(`❌ 您还未绑定鸣潮账号\n请先使用：${config.exampleCommond("登录")}`)
      return null
    }

    // 尝试复用缓存的 API 实例
    if (
      this._wavesApi &&
      this._wavesApi.wavesId === user.gameUid &&
      (!isCheckToken || this._wavesApi._checked)
    ) {
      return this._wavesApi
    }

    // 实例化新对象
    const wavesApi = new WavesApi(user.gameUid, user.token, {
      devCode: user.devCode,
      bat: user.bat,
    })
    wavesApi.dbUser = user

    // Token 检查
    if (isCheckToken) {
      const loginStatus = await wavesApi.loginStatusCheck()
      if (!loginStatus?.status) {
        await this.e.reply(`❌ 您的鸣潮账号已过期，请重新登录`)
        return null
      }
      let refresh = await wavesApi.refreshData()
      // 如果 bat 过期 (10903)，尝试通过 token 重新获取 bat
      if (refresh?.code === 10903) {
        const tokenRes = await wavesApi.getRequestToken()
        if (tokenRes.status) {
          user.bat = wavesApi.bat = tokenRes.bat
          await user.save()
          refresh = await wavesApi.refreshData()
        }
      }

      if (!refresh?.status) {
        await this.e.reply(`❌ 您的鸣潮账号已过期，请重新登录`)
        return null
      }

      wavesApi._checked = true
    }

    this._wavesApi = wavesApi
    return wavesApi
  }

  async getPgrUser() {
    const identity = this.getUserIdentity()
    if (!identity) return null
    return await User.getUseUser(identity.userId, GAMES.pgr.id)
  }

  async getPgrApi() {
    const user = await this.getPgrUser()
    if (!user) return null
    return new PgrApi()
  }

  async makeMsg(msgList) {
    // 兼容：如果传入的是非数组，包装成数组
    if (!Array.isArray(msgList)) msgList = [msgList]

    const nickname = Bot.nickname
    const id = this.e.self_id || Bot.uin
    const userInfo = {
      user_id: id,
      nickname: nickname,
    }

    const forwardMsg = msgList.map(v => {
      // 兼容：已有message字段的对象不重复包装
      if (_.isPlainObject(v) && v.message) return v

      return {
        ...userInfo,
        message: v,
      }
    })

    if (this.e.isGroup) {
      return await this.e.group.makeForwardMsg(forwardMsg)
    } else {
      return await this.e.friend.makeForwardMsg(forwardMsg)
    }
  }

  /**
   * 获取消息中的图片URL列表
   * @returns {Promise<string[]>} 图片URL数组
   */
  async getImageUrl() {
    const { e } = this
    const imgList = new Set(e.img || [])
    const imgExts = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"])

    // 递归提取图片
    const crawl = async msgs => {
      if (!Array.isArray(msgs)) return

      for (const msg of msgs) {
        if (!msg) continue
        const { type } = msg

        // 1. 直取图片
        if (type === "image" || type === "img") {
          const url = msg.url || msg.data?.url || msg.data?.file || msg.file || msg.path
          if (url) imgList.add(url)
          continue
        }

        // 2. 文件图片
        if (type === "file") {
          const data = msg.data || msg
          if (data.name && imgExts.has(path.extname(data.name).toLowerCase())) {
            const url = data.url || data.path || data.file
            if (url) imgList.add(url)
          }
          continue
        }

        // 3. 转发/嵌套结构
        let forwardId = null

        // 处理复杂转发结构 (Trss/ICQQ/Yunzai)
        if (type === "forward") {
          // 核心修复：适配msg.data.content等多种结构
          const content =
            msg.data?.content ||
            msg.content ||
            msg.messages ||
            (msg.content?.message ? [msg.content] : [])

          if (Array.isArray(content)) {
            for (const itm of content) {
              // 提取子消息
              const subMsgs = Array.isArray(itm.message)
                ? itm.message
                : Array.isArray(itm.msg)
                  ? itm.msg
                  : itm.content
                    ? [itm.content]
                    : []

              if (subMsgs.length) await crawl(subMsgs)

              // 检查内层未展开引用
              const raw = JSON.stringify(itm)
              const fid =
                raw.match(/\[CQ:forward,id=(\d+)\]/)?.[1] || raw.match(/"resid":"(.*?)"/)?.[1]
              if (fid) await fetch(fid)
            }
          }
        }

        // 提取forwardId
        if (type === "multimsg") {
          forwardId = msg.resid || msg.id
        } else if (["text", "json", "plain"].includes(type)) {
          const raw = msg.text || JSON.stringify(msg)
          forwardId =
            raw.match(/\[CQ:forward,id=(\d+)\]/)?.[1] ||
            raw.match(/"resid":"(.*?)"/)?.[1] ||
            raw.match(/"id":"?(\d+)"?/)?.[1]
        }

        if (forwardId) await fetch(forwardId)
      }
    }

    // 辅助: 拉取转发
    const fetch = async id => {
      if (!id || !e.bot?.getForwardMsg) return
      try {
        const res = await e.bot.getForwardMsg(id)
        for (const i of res || []) await crawl(i.message)
      } catch (err) {
        logger.error(`[ams] 拉取转发失败 ${id}: ${err.message}`)
      }
    }

    // 入口处理：Reply / Source / Current
    let sourceMsg = null
    if (e.reply_id) {
      try {
        sourceMsg = await e.getReply(e.reply_id)
      } catch {}
    } else if (e.source?.seq) {
      try {
        const h = await (e.isGroup ? e.group : e.friend).getChatHistory(e.source.seq, 1)
        sourceMsg = h?.pop()
      } catch {}
    }

    if (sourceMsg) {
      const msgs = sourceMsg.message || (sourceMsg.content ? [sourceMsg.content] : [])
      await crawl(msgs)
    }

    await crawl(e.message)

    return [...imgList]
      .filter(u => u && /^(http|file|\/)/.test(u))
      .map(u => u.replace(/&amp;/g, "&"))
  }

  async getAvatarUrl(userId) {
    const targetId = userId || this.e.user_id

    const strategies = [
      () => this.e.group?.pickMember?.(targetId).getAvatarUrl(), // 群成员
      () => (this.e.user_id === targetId ? this.e.member?.getAvatarUrl?.() : null), // 当前群员
      () => this.e.friend?.getAvatarUrl?.(), // 好友
      () => `file://${path.join(wavesResMap.roleAvatar, "1210.webp")}`, // 默认头像
    ]

    let avatar = null
    for (const strategy of strategies) {
      try {
        avatar = await strategy()
        if (avatar) break
      } catch {
        // ignore errors
      }
    }

    this.e.userAvatar = avatar
    this.e.userAvatarFrame = randomFiles(framePath)

    return {
      userAvatar: this.e.userAvatar,
      userAvatarFrame: this.e.userAvatarFrame,
    }
  }

  render(renderPath, renderData = {}, cfg = {}) {
    const e = this.e

    if (!e?.runtime) {
      logger.error("未找到e.runtime，请升级至最新版Yunzai")
    }

    const renderCfg = _.get(config.getConfig("config"), "render", {})
    const scaleCfg = _.get(renderCfg, "scale", 100)
    const scale = Math.min(2, Math.max(0.5, scaleCfg / 100)) * 2
    const pct = `style='transform:scale(${scale})'`
    const layoutPathFull = path.join(resourcePath, "common", "layout")

    return e?.runtime?.render(pluginName, renderPath, renderData, {
      ...cfg,
      retType: "base64",
      beforeRender({ data }) {
        const resPath = data.pluResPath
        return {
          ...data,
          sys: {
            scale: pct,
            resourcesPath: resPath,
            copyright: `Created By <div class="highlight"><span>${pluginName}</span><div class="version">${version.version}</div></div> & Powered By <div class="highlight"><span>${version.name}</span><div class="version">${version.yunzai}</div></div>`,
          },
          _res_path: resPath,
          defaultLayout: path.join(layoutPathFull, "index.html"),
          quality: 100,

          // 插件数据
          version,
          userAvatar: data.userAvatar || e?.userAvatar,
          userAvatarFrame: data.userAvatarFrame || e?.userAvatarFrame,
          roleName: data.roleName || e?.roleName,
          wavesResMap: _.mapValues(wavesResMap, p => p.replace(/\\/g, "/")),
        }
      },
    })
  }
}
