import axios from "axios"
import { HttpsProxyAgent } from "https-proxy-agent"
import { SocksProxyAgent } from "socks-proxy-agent"
import { inspect } from "util"
import config from "./settings.js"

class Request {
  constructor() {
    this._agentCache = { proxy: null, agent: null }
  }

  get config() {
    return config.getConfig("network")
  }

  // 按配置返回代理 agent(带缓存)；代理串非法时记录并降级为直连
  _getAgent() {
    const { proxy } = this.config
    if (!proxy) return undefined
    if (this._agentCache.proxy === proxy) return this._agentCache.agent

    let agent
    try {
      agent = proxy.startsWith("socks") ? new SocksProxyAgent(proxy) : new HttpsProxyAgent(proxy)
    } catch (error) {
      logger.error(`[ams] 代理配置非法，本次请求直连: ${error}`)
    }
    this._agentCache = { proxy, agent }
    return agent
  }

  // 域名反代映射：https://api.kurobbs.com -> https://proxy.kurobbs.com
  _processUrl(urlStr) {
    const { domain } = this.config
    if (!domain) return urlStr
    for (const [origin, target] of Object.entries(domain)) {
      if (urlStr.startsWith(origin)) return urlStr.replace(origin, target)
    }
    return urlStr
  }

  // 发起请求，返回解析后的响应体；仅在网络层错误(未收到响应)时重试
  async request(method, url, { headers, data, ...rest } = {}) {
    const { timeout, retry } = this.config
    const agent = this._getAgent()
    const targetUrl = this._processUrl(url)

    logger.debug(
      `[ams] ${method.toUpperCase()} ${targetUrl} ${agent ? "[代理]" : "[直连]"} ` +
        inspect({ headers, data }, { depth: 2, breakLength: Infinity }),
    )

    const axiosConfig = {
      ...rest,
      method,
      url: targetUrl,
      headers,
      data,
      timeout: timeout * 1000,
      proxy: false, // 关闭 axios 自带的环境变量代理，只认上面手动挂载的 agent
      ...(agent && { httpAgent: agent, httpsAgent: agent }),
    }

    for (let attempt = 0; ; attempt++) {
      try {
        const res = await axios(axiosConfig)
        return res.data
      } catch (error) {
        if (error.response || attempt >= retry) throw error
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
  }

  get(url, options) {
    return this.request("get", url, options)
  }
  post(url, options) {
    return this.request("post", url, options)
  }
}

export default new Request()
