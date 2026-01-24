import crypto from "crypto"
import EventEmitter from "events"
import express from "express"
import fs from "fs/promises"
import _ from "lodash"
import path from "path"
import KuroClient from "./api/kuro.js"
import { templatePath } from "./path.js"
import config from "./settings.js"

class LoginServer extends EventEmitter {
  constructor() {
    super()
    this.app = express()
    this.server = null
    this.data = new Map()
    this.isStarted = false

    this._initApp()
  }

  getSessionTimeout() {
    return _.get(config.getConfig("network"), "session_timeout", 5 * 60 * 1000)
  }

  _initApp() {
    this.app.use(express.json())

    this.app.get("/waves/i/:auth", async (req, res) => {
      const { auth } = req.params
      if (!this.data.has(auth)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8")
        return res.status(404).send("<h1>⚠️ 链接已失效</h1><p>请重新发起登录请求</p>")
      }

      const entry = this.data.get(auth)

      if (Date.now() - entry.timestamp > this.getSessionTimeout()) {
        this.data.delete(auth)
        res.setHeader("Content-Type", "text/html; charset=utf-8")
        return res.status(404).send("<h1>⚠️ 链接已过期</h1><p>请重新发起登录请求</p>")
      }

      try {
        const indexHtmlPath = path.join(templatePath, "index.html")
        let html = await fs.readFile(indexHtmlPath, "utf-8")

        html = html
          .replace(/{{ userId }}/g, entry.userId)
          .replace(/{{ auth }}/g, auth)
          .replace(/{{ server_url }}/g, "")

        res.setHeader("Content-Type", "text/html; charset=utf-8")
        res.send(html)
      } catch (e) {
        logger.error(`[ams] Template Error: ${e}`)
        res.status(500).send("<h1>服务器内部错误</h1>")
      }
    })

    this.app.post("/waves/login", async (req, res) => {
      const { mobile, code, auth } = req.body
      if (!auth || !this.data.has(auth)) {
        return res.json({ success: false, msg: "认证会话已过期" })
      }

      try {
        const client = new KuroClient()
        const devCode = crypto.randomUUID()
        const loginRes = await client.login(mobile, code, devCode)

        if (loginRes.status) {
          const entry = this.data.get(auth)
          entry.result = { ...loginRes.data, mobile, devCode }
          entry.status = "success"

          this.emit(auth, { status: "success", result: entry.result })
          return res.json({ success: true })
        } else {
          return res.json({ success: false, msg: loginRes.msg || "登录失败" })
        }
      } catch (e) {
        logger.error(`[ams] Login API Error: ${e}`)
        return res.status(500).json({ success: false, msg: "服务器内部错误" })
      }
    })
  }

  start() {
    if (this.isStarted) return

    const netCfg = config.getConfig("network")

    if (netCfg.allow_login === false) {
      return
    }

    const port = netCfg.server_port || 110
    this.port = port

    this.server = this.app
      .listen(port, () => {
        this.isStarted = true
        logger.mark(`[ams] Login Server running at http://127.0.0.1:${port}`)
      })

      .on("error", err => {
        if (err.code === "EADDRINUSE") {
          logger.mark(`[ams] Port ${port} is busy, reusing existing server.`)
          this.isStarted = true
        } else {
          logger.error(`[ams] Server Start Error: ${err}`)
        }
      })
  }

  getSession(auth) {
    return this.data.get(auth)
  }

  removeSession(auth) {
    this.data.delete(auth)
  }

  getPublicUrl(auth) {
    const netCfg = config.getConfig("network")
    let baseUrl = netCfg.public_link || `http://127.0.0.1:${this.port}`

    baseUrl = baseUrl.replace(/\/$/, "")
    return `${baseUrl}/waves/i/${auth}`
  }

  getLoginMessage(auth) {
    const link = this.getPublicUrl(auth)
    const mins = Math.floor(this.getSessionTimeout() / 60000)
    return `请在浏览器打开以下链接进行登录（${mins}分钟内有效）：\n${link}`
  }

  createSession(userId) {
    const auth = crypto.createHash("sha256").update(String(userId)).digest("hex").slice(0, 8)

    if (this.data.has(auth)) {
      return auth
    }

    const timer = setTimeout(() => {
      if (this.data.has(auth)) {
        this.data.delete(auth)
      }
    }, this.getSessionTimeout())

    this.data.set(auth, {
      userId,
      status: "pending",
      result: null,
      timestamp: Date.now(),
      timer,
    })

    return auth
  }

  checkWebLogin() {
    const netCfg = config.getConfig("network")
    return netCfg.allow_login
  }
}

export default new LoginServer()
