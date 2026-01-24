import { HttpsProxyAgent } from "https-proxy-agent"
import ky from "ky"
import fetch from "node-fetch"
import { SocksProxyAgent } from "socks-proxy-agent"
import { inspect } from "util"
import config from "./settings.js"

class Request {
  constructor() {
    this._agentCache = {
      proxy: null,
      agent: null,
    }
  }

  get config() {
    return config.getConfig("network")
  }

  _getAgent() {
    const { proxy } = this.config
    if (!proxy) return undefined

    if (this._agentCache.proxy === proxy && this._agentCache.agent) {
      return this._agentCache.agent
    }

    try {
      let agent
      if (proxy.startsWith("socks")) {
        agent = new SocksProxyAgent(proxy)
      } else {
        agent = new HttpsProxyAgent(proxy)
      }

      this._agentCache = { proxy, agent }
      return agent
    } catch (error) {
      logger.error(`[ams] 代理配置错误: ${error}`)
      return undefined
    }
  }

  _processUrl(urlStr) {
    const { domain } = this.config
    if (!domain) return urlStr

    // 例如: "https://api.kurobbs.com" -> "https://proxy.kurobbs.com"
    for (const [origin, target] of Object.entries(domain)) {
      if (urlStr.startsWith(origin)) {
        return urlStr.replace(origin, target)
      }
    }
    return urlStr
  }

  request(method, url, options = {}) {
    const processedUrl = this._processUrl(url)
    const agent = this._getAgent()
    const { timeout, retry } = this.config

    const kyOptions = {
      method: method,
      timeout: options.timeout ?? timeout * 1000 ?? 10000,
      retry: options.retry ?? retry ?? 2,
      ...options,
    }

    logger.debug(
      `[ams] url: ${processedUrl}, options: ${inspect(kyOptions, { depth: 2, breakLength: Infinity })}`,
    )

    if (agent) {
      kyOptions.agent = agent
      kyOptions.fetch = fetch
    }

    return ky(processedUrl, kyOptions)
  }

  get(url, options) {
    return this.request("get", url, options)
  }
  post(url, options) {
    return this.request("post", url, options)
  }
  put(url, options) {
    return this.request("put", url, options)
  }
  delete(url, options) {
    return this.request("delete", url, options)
  }
  patch(url, options) {
    return this.request("patch", url, options)
  }
  head(url, options) {
    return this.request("head", url, options)
  }
}

export default new Request()
