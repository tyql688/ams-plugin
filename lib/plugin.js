import _ from "lodash"
import path from "path"
import KuroClient from "./api/kuro.js"
import WavesApi from "./api/waves.js"
import { GAMES } from "./constants.js"
import { User } from "./db/index.js"
import { pluginName, resourcePath, wavesResMap } from "./path.js"
import config from "./settings.js"
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
    const e = this.e
    const imgList = e.img || []

    // 强制将msgText转为字符串，避免substring报错
    const addImagesFromMessage = async (messages, source = "未知来源") => {
      const imgFileExt = [".jpg", ".jpeg", ".png", ".gif", ".webp"]

      for (let msg of messages) {
        if (!msg) continue

        // 强制转为字符串，优先JSON.stringify处理非字符串内容
        const rawContent = msg.text || msg.data || msg.content || ""
        const msgText =
          typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent, null, 2) // 非字符串转为JSON字符串

        let forwardId = null

        // 处理multimsg 类型转发消息
        if (msg.type === "multimsg") {
          forwardId = msg.resid
        }
        // 处理text/json中的CQ转发码
        else if (["text", "json"].includes(msg.type)) {
          const cqForwardMatch = msgText.match(/\[CQ:forward,id=(\d+)\]/)
          const residMatch = msgText.match(/"resid":"(.*?)"/)
          forwardId = cqForwardMatch?.[1] || residMatch?.[1]
        }
        // 处理yunzai封装的forward类型
        else if (msg.type === "forward") {
          if (Array.isArray(msg.content)) {
            for (const itm of msg.content) {
              // 递归解析yunzai转发内的消息段，确保传入数组
              const subMessages = Array.isArray(itm.message) ? itm.message : []
              await addImagesFromMessage(subMessages, "Trss转发")
            }
          }
        }
        // 处理普通图片消息
        else if (msg.type === "image") {
          const imgUrl = msg.url || msg.data?.url || msg.data?.file
          if (imgUrl) {
            imgList.push(imgUrl)
          }
        }
        // 处理图片文件消息
        else if (msg.type === "file") {
          const fileData = msg.data || msg
          if (fileData.name && imgFileExt.includes(path.extname(fileData.name).toLowerCase())) {
            const fileUrl = fileData.url || fileData.path
            if (fileUrl) {
              imgList.push(fileUrl)
            }
          }
        }

        // 统一处理所有类型的forwardId
        if (forwardId && e.bot?.getForwardMsg) {
          try {
            const forwardMsgs = await e.bot.getForwardMsg(forwardId)
            for (const forwardMsg of forwardMsgs) {
              const msgSegments = Array.isArray(forwardMsg.message) ? forwardMsg.message : []
              if (msgSegments.length) {
                await addImagesFromMessage(msgSegments, `转发-${forwardId}`)
              }
            }
          } catch (err) {
            logger.error(`[ams] 获取转发消息失败: ${err.message}`)
          }
        }
      }
    }

    let sourceMsg = null
    // 有reply_id
    if (e.reply_id) {
      try {
        sourceMsg = await e.getReply(e.reply_id, { message_type: e.message_type })
      } catch (err) {
        logger.error(`[ams] 通过reply_id获取引用消息失败: ${err.message}`)
      }
    }
    // 有source.seq
    else if (e.source && e.source.seq) {
      try {
        const chatHistory = e.isGroup
          ? await e.group.getChatHistory(e.source.seq, 1)
          : await e.friend.getChatHistory(e.source.seq, 1)
        sourceMsg = chatHistory?.pop()
      } catch (err) {
        logger.error(`[ams] ${e.isGroup ? "群聊" : "私聊"}获取历史消息失败: ${err.message}`)
      }
    }

    // 解析引用消息
    if (sourceMsg) {
      const msgSegments = Array.isArray(sourceMsg.message)
        ? sourceMsg.message
        : JSON.parse(sourceMsg.content || "[]")
      if (msgSegments.length) {
        await addImagesFromMessage(msgSegments, "引用消息")
      }
    }

    // 解析当前消息
    if (e.message && Array.isArray(e.message)) {
      await addImagesFromMessage(e.message, "当前消息")
    }

    // 去重 过滤有效URL
    return [...new Set(imgList)]
      .filter(
        url =>
          url &&
          (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")),
      )
      .map(url => url.replace(/&amp;/g, "&"))
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
          wavesResMap: _.mapValues(wavesResMap, p => p.replace(/\\/g, "/")),
        }
      },
    })
  }
}
