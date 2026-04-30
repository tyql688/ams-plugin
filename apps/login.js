import crypto from "crypto"
import _ from "lodash"
import WavesApi from "../lib/api/waves.js"
import { GAMES } from "../lib/constants.js"
import db from "../lib/db/index.js"
import { AmsPlugin } from "../lib/plugin.js"
import loginServer from "../lib/server.js"
import config from "../lib/settings.js"

export class Login extends AmsPlugin {
  constructor() {
    super({
      name: "ams-登录",
      event: "message",
      priority: _.get(config.getConfig("priority"), "login", 110),
      rule: [
        {
          reg: config.fixCommond("登录(.*)"),
          fnc: "login",
        },
        {
          reg: config.fixCommond("(我的)?(token|tk|ck|cookie)$"),
          fnc: "getToken",
        },
        {
          reg: config.fixCommond("登出$"),
          fnc: "logout",
        },
        {
          reg: config.fixCommond("查看(uid|UID)?$"),
          fnc: "getUidList",
        },
        {
          reg: config.fixCommond("(?:切换|使用)(.*)"),
          fnc: "switchUid",
        },
      ],
    })
  }

  async login(e) {
    const reg = new RegExp(config.fixCommond("登录(.*)"))
    const match = e.msg.match(reg)

    const msg = match ? match[1].trim() : ""
    const args = msg.split(/\s+/).filter(Boolean)

    // 网页登录
    if (args.length === 0) {
      return await this.loginWeb(e)
    }

    // 两个参数
    if (args.length === 2) {
      const [arg1, arg2] = args

      // 情况 1: 手机号 + 验证码 (纯数字)
      if (/^\d{11}$/.test(arg1) && /^\d{4,6}$/.test(arg2)) {
        return await this.loginWithCode(e, arg1, arg2)
      }

      // 情况 2: Token + DevCode (长字符串)
      if (arg1.length >= 32 && arg2.length >= 32) {
        return await this.loginWithToken(e, arg1, arg2)
      }
    }

    if (args.length === 1) {
      const [arg1] = args
      // 检查jwt长度
      if (arg1.length >= 32) {
        return await this.loginWithToken(e, arg1)
      }
    }

    // 无法识别参数
    const cmd = config.exampleCommond("登录")

    return e.reply(
      `❌ 指令格式错误\n` +
        `💻 网页登录：发送 ${cmd}\n` +
        `📱 验证码登录：发送 ${cmd} <手机号> <验证码>\n` +
        `🔑 Token登录：发送 ${cmd} <Token>`,
    )
  }

  async loginWeb(e) {
    if (!loginServer.checkWebLogin()) {
      return await e.reply("❌ 网页登录功能已关闭")
    }

    const auth = loginServer.createSession(e.user_id)
    const msg = loginServer.getLoginMessage(auth)

    await e.reply(msg)

    let successData = null

    try {
      successData = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          loginServer.removeListener(auth, handler)
          reject(new Error("TIMEOUT"))
        }, loginServer.getSessionTimeout())

        const handler = data => {
          clearTimeout(timer)
          if (data && data.status === "success") {
            resolve(data.result)
          } else {
            reject(new Error("FAILED"))
          }
        }

        loginServer.once(auth, handler)
      })
    } catch (err) {
      loginServer.removeSession(auth)
      if (err.message === "TIMEOUT") {
        await e.reply("❌ 登录超时")
        return
      }
      await e.reply("❌ 登录中断或失效")
      return
    }

    loginServer.removeSession(auth)

    await e.reply("✅ 网页验证通过，正在同步数据...")
    const { token, devCode } = successData
    await this._processRoleBinding(e, token, devCode)
  }

  async loginWithCode(e, mobile, code) {
    const kuroApi = this.getKuroApi()
    const devCode = crypto.randomUUID()
    const loginRes = await kuroApi.login(mobile, code, devCode)

    if (!loginRes.status) {
      return e.reply(`❌ 登录失败：${loginRes.msg || "接口错误"}`)
    }

    await this._processRoleBinding(e, loginRes.data.token, devCode)
  }

  async loginWithToken(e, token, devCode = "") {
    if (!devCode) {
      devCode = crypto.randomUUID()
    }
    await this._processRoleBinding(e, token, devCode)
  }

  async _processRoleBinding(e, token, devCode) {
    const kuroApi = this.getKuroApi()

    const roleRes = await kuroApi.getKuroRoleList(token, devCode, GAMES.waves.id)
    if (!roleRes.status) {
      return e.reply(`❌ 获取角色列表失败：${roleRes.msg || "Token无效或网络错误"}`)
    }

    const allRoleList = roleRes.data
    if (!allRoleList || !allRoleList.length) {
      return e.reply("❌ 未找到鸣潮角色，请先在 APP 中登录并创建角色")
    }

    const { userId } = this.getUserIdentity()
    let msg = []

    for (const role of allRoleList) {
      const { gameId, roleId, roleName } = role
      let bat = null
      if (gameId === GAMES.waves.id) {
        const wavesApi = new WavesApi(roleId, token, { devCode })
        const batRes = await wavesApi.getRequestToken()
        if (!batRes.status) {
          continue
        }
        bat = batRes.bat
      }
      await db.User.add(userId, String(roleId), gameId, {
        token,
        devCode,
        bat,
        status: 1,
      })

      // 把接口返回的 roleName 缓存到 gameData，供 tower / slash 等模块复用
      if (roleName) {
        const existing = await db.User.getByUid(userId, String(roleId))
        const gameData = { ...(existing?.gameData || {}), roleName }
        await db.User.updateSilent(userId, String(roleId), gameId, { gameData })
      }

      msg.push(`✅ 绑定成功：${roleName} (${roleId})`)
    }

    if (msg.length === 0) {
      return e.reply("❌ 登录失败")
    }
    await e.reply(`✅ 登录成功！\n${msg.join("\n")}`)
  }

  async getToken(e) {
    if (e.isGroup) {
      return e.reply("❌ 为了您的账号安全，请私聊查看 Token")
    }

    const { userId } = this.getUserIdentity()
    const users = await db.User.getAllValid(userId)

    if (!users || users.length === 0) {
      const cmd = config.exampleCommond("登录")
      return e.reply(`❌ 您还未绑定鸣潮账号\n请先使用：${cmd}`)
    }

    const gameMap = {}
    Object.values(GAMES).forEach(g => {
      gameMap[g.id] = g.displayName
    })

    let msg = ["🔑 你持有的有效 Token 如下："]

    users.forEach((user, index) => {
      const gameName = gameMap[user.gameId] || `未知游戏(${user.gameId})`
      msg.push(`\n${index + 1}. 【${gameName}】`)
      msg.push(` UID: ${user.gameUid}`)
      msg.push(` Token: ${user.token}`)
    })

    return e.reply(msg.join("\n"))
  }

  async logout(e) {
    const user = await this.getWavesUser()

    if (!user) {
      return e.reply("❌ 您当前还未绑定任何角色，无需登出")
    }

    const success = await db.User.del(user.userId, user.gameUid, user.gameId)
    if (success) {
      return e.reply(`✅ UID: ${user.gameUid} 已登出并删除数据`)
    } else {
      return e.reply("❌ 登出失败，请稍后重试")
    }
  }

  async getUidList(e) {
    const { userId } = this.getUserIdentity()
    const users = await db.User.getAll(userId)

    if (!users || users.length === 0) {
      const cmd = config.exampleCommond("登录")
      return e.reply(`❌ 您还未绑定账号\n请先使用：${cmd}`)
    }

    const gameMap = {}
    Object.values(GAMES).forEach(g => {
      gameMap[g.id] = g.displayName
    })

    const activeUsers = {}
    for (const g of Object.values(GAMES)) {
      activeUsers[g.id] = await db.User.getUseUser(userId, g.id)
    }

    let msg = ["🆔 您绑定的 UID 如下："]
    users.forEach((user, index) => {
      const gameName = gameMap[user.gameId] || `未知游戏(${user.gameId})`
      let line = `${index + 1}. 【${gameName}】 ${user.gameUid}`
      const activeUser = activeUsers[user.gameId]
      if (activeUser && activeUser.gameUid === user.gameUid) {
        line += " (当前)"
      }
      msg.push(line)
    })

    msg.push(`\n💡 发送 ${config.exampleCommond("切换uid")} 进行切换`)
    return e.reply(msg.join("\n"))
  }

  async switchUid(e) {
    // 兼容更多格式：切换uid123、切换 123、切换UID 123
    const reg = new RegExp(config.fixCommond("(?:切换|使用)(.*)"))
    const match = e.msg.match(reg)

    // 提取核心参数并清洗
    let input = match ? match[1] : ""
    // 去除开头的 uid/id/UID 以及空格
    const uid = input.replace(/^(uid|id|UID|ID)?\s*/i, "").trim()

    if (!uid) {
      return await this.getUidList(e)
    }

    const { userId } = this.getUserIdentity()
    const user = await db.User.getByUid(userId, uid)

    if (!user) {
      return e.reply(`❌ 切换失败：UID ${uid} 未绑定或无效`)
    }

    // 更新最后使用时间
    await db.User.use(userId, user.gameUid, user.gameId)

    const gameMap = {}
    Object.values(GAMES).forEach(g => {
      gameMap[g.id] = g.displayName
    })
    const gameName = gameMap[user.gameId] || "鸣潮"
    return e.reply(`✅ 已成功切换【${gameName}】UID 为：${uid}`)
  }
}
