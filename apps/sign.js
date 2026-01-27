import _ from "lodash"
import WavesApi from "../lib/api/waves.js"
import { GAMES } from "../lib/constants.js"
import { User } from "../lib/db/index.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"
import { SignService } from "../lib/sign_service.js"

export class Sign extends AmsPlugin {
  constructor() {
    super({
      name: "ams-签到",
      event: "message",
      priority: _.get(config.getConfig("priority"), "sign", 110),
      rule: [
        {
          reg: config.fixCommond("签到"),
          fnc: "sign",
        },
        {
          reg: config.fixCommond("(开启|关闭)自动签到"),
          fnc: "toggleAutoSign",
        },
        {
          reg: config.fixCommond("(全部)?(自动)?签到$"),
          fnc: "autoSignIn",
          permission: "master",
        },
      ],
    })

    const cron = _.get(config.getConfig("config"), "signin_time", "0 10 0 * * ?")
    this.task = {
      name: "[ams] 自动签到",
      fnc: () => this.autoSignIn(),
      cron: cron,
    }
  }

  async sign(e) {
    const autoSign = _.get(config.getConfig("config"), "auto_signin", false)
    if (!autoSign) {
      logger.mark("[ams] 自动签到功能未开启")
      return false
    }

    // 1. 获取所有有效账号
    const { userId } = this.getUserIdentity()
    const users = await User.getAllValid(userId, GAMES.waves.id)

    if (!users || users.length === 0) {
      await e.reply(`❌ 您还未绑定鸣潮账号\n请先使用：${config.exampleCommond("登录")}`)
      return false
    }

    const messages = []
    let successCount = 0

    for (const user of users) {
      const prefix = `UID ${user.gameUid}`

      // 2. 检查本地状态
      if (SignService.checkLocalDone(user)) {
        messages.push(`${prefix}: ✅ 今日已完成`)
        successCount++
        continue
      }

      // 3. 初始化 API 并检查 Token
      const wavesApi = new WavesApi(user.gameUid, user.token, {
        devCode: user.devCode,
        bat: user.bat,
        did: user.did,
      })
      wavesApi.dbUser = user

      const check = await wavesApi.loginStatusCheck()
      if (!check.status) {
        messages.push(`${prefix}: ❌ 登录失效，请重新登录`)
        continue
      }

      // 4. 执行签到
      const service = new SignService(wavesApi)
      const result = await service.doSign(user)
      messages.push(`${prefix}: ${result.summary}`)
      successCount++

      // 避免并发过快，稍微 sleep 一下？
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // 汇总回复
    const summary = `📊 签到完成: ${successCount}/${users.length} 账号`
    await e.reply([summary, ...messages].join("\n"))
  }

  async toggleAutoSign(e) {
    const autoSign = _.get(config.getConfig("config"), "auto_signin", false)
    if (!autoSign) {
      logger.mark("[ams] 自动签到功能未开启")
      return false
    }

    // 1. 解析命令参数
    const isEnable = e.msg.includes("开启")

    // 2. 获取用户数据（不需要验证Token，只需要操作数据库）
    const wavesApi = await this.getWavesApi(false)
    if (!wavesApi) return false

    const user = wavesApi.dbUser
    await User.updateSilent(user.userId, user.gameUid, wavesApi.gameId, { isAutoSign: isEnable })

    await e.reply(`✅ 已${isEnable ? "开启" : "关闭"}自动签到`)
  }

  async autoSignIn() {
    logger.mark("[ams] 开始执行自动签到任务...")

    const users = await User.findAll({
      where: {
        isAutoSign: true,
        gameId: GAMES.waves.id,
        status: 1,
      },
    })

    if (!users || users.length === 0) {
      logger.mark("[ams] 没有开启自动签到的用户")
      return
    }

    logger.mark(`[ams] 发现 ${users.length} 个待签到用户`)

    let successCount = 0
    let failCount = 0
    const CONCURRENCY = 3 // 并发数限制
    const queue = [...users]
    const workers = []

    const processUser = async user => {
      // 检查 token 是否存在
      if (!user.token) {
        logger.warn(`[ams] 用户 ${user.userId} (UID:${user.gameUid}) 无Token，跳过`)
        failCount++
        return
      }

      const wavesApi = new WavesApi(user.gameUid, user.token, {
        devCode: user.devCode,
        bat: user.bat,
        did: user.did,
      })
      wavesApi.dbUser = user

      const service = new SignService(wavesApi)

      // 1. 优先检查本地状态
      if (service.checkLocalDone(user)) {
        logger.mark(`[ams] 用户 ${user.userId} (UID:${user.gameUid}) 今日已完成，跳过`)
        successCount++
        return
      }

      // 随机延迟 (仅在确实需要请求时)
      // 并发模式下，每个worker独立延迟，避免瞬间并发请求
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 5000))

      // 2. 检查token有效性
      const loginStatus = await wavesApi.loginStatusCheck()
      if (!loginStatus?.status) {
        logger.warn(`[ams] 用户 ${user.userId} (UID:${user.gameUid}) Token已失效，跳过`)
        failCount++
        return
      }

      const result = await service.doSign(user)

      if (result.success) {
        logger.mark(`[ams] 用户 ${user.userId} (UID:${user.gameUid}) 签到成功`)
        successCount++
      } else {
        logger.warn(`[ams] 用户 ${user.userId} (UID:${user.gameUid}) 签到失败: ${result.msg}`)
        failCount++
      }
    }

    // 启动 Workers
    const workerCount = Math.min(CONCURRENCY, users.length)
    for (let i = 0; i < workerCount; i++) {
      workers.push(
        (async () => {
          while (queue.length > 0) {
            const user = queue.shift()
            if (user) await processUser(user)
          }
        })(),
      )
    }

    await Promise.all(workers)

    logger.mark(`[ams] 自动签到任务完成: 成功 ${successCount}, 失败 ${failCount}`)
  }
}
