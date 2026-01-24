import request from "../request.js"
import { API_CONSTS, BASE_HEADERS, KURO_BBS_URLS, KURO_URLS } from "./consts.js"

export default class KuroClient {
  constructor() {}

  async _post(url, data, options = {}) {
    const { headers = {}, type = "form", ...otherOptions } = options
    const reqOptions = {
      headers: { ...BASE_HEADERS, ...headers },
      ...otherOptions,
    }

    if (type === "json") {
      reqOptions.json = data
      reqOptions.headers["Content-Type"] = "application/json"
    } else {
      reqOptions.body = new URLSearchParams(data)
      reqOptions.headers["Content-Type"] = "application/x-www-form-urlencoded"
    }

    const res = await request.post(url, reqOptions).json()

    if (res && typeof res.data === "string") {
      try {
        res.data = JSON.parse(res.data)
      } catch (e) {}
    }

    logger.debug(`[ams] POST path: ${url}, response: ${JSON.stringify(res)}`)

    return res
  }

  async _get(url, options = {}) {
    const { headers = {}, ...otherOptions } = options
    const reqOptions = {
      headers: { ...BASE_HEADERS, ...headers },
      ...otherOptions,
    }
    const res = await request.get(url, reqOptions).json()

    if (res && typeof res.data === "string") {
      try {
        res.data = JSON.parse(res.data)
      } catch (e) {}
    }

    logger.debug(`[ams] GET path: ${url}, response: ${JSON.stringify(res)}`)

    return res
  }

  async login(mobile, code, devCode) {
    try {
      const res = await this._post(KURO_URLS.LOGIN_URL, { mobile, code, devCode })

      if (res.code === 200) {
        return { status: true, data: res.data }
      } else {
        logger.warn(`[ams] 验证码登录失败: ${res.msg}`)
        return { status: false, msg: res.msg }
      }
    } catch (error) {
      logger.error(`[ams] 验证码登录异常: ${error}`)
      return { status: false, msg: "登录失败，疑似网络问题" }
    }
  }

  async getKuroRoleList(token, devCode, gameId) {
    try {
      const res = await this._post(
        KURO_URLS.ROLE_LIST_URL,
        { gameId },
        { headers: { token, devCode } },
      )

      if (res.code === 200) {
        return { status: true, data: res.data }
      } else {
        logger.warn(`[ams] 获取库洛角色列表失败: ${res.msg}`)
        return { status: false, msg: res.msg }
      }
    } catch (error) {
      logger.error(`[ams] 获取库洛角色列表异常: ${error}`)
      return { status: false, msg: "获取库洛角色列表失败" }
    }
  }

  async getForumList(
    gameId = this.gameId,
    token = this.token,
    devCode = this.devCode,
    bat = this.bat,
  ) {
    try {
      const res = await this._post(
        KURO_BBS_URLS.FORUM_LIST,
        {
          forumId: 10, // 鸣潮官方公告区
          gameId: gameId,
          page: 1,
          pageSize: 10, // 获取更多一点以确保够用
          searchType: 1, // 热门，既适合点赞也适合浏览
        },
        { headers: { token, devCode, "b-at": bat, version: API_CONSTS.version } },
      )

      if (res.code === 200 && res.data?.postList) {
        return { status: true, data: res.data.postList }
      }
      return { status: false, msg: "获取帖子列表失败" }
    } catch (error) {
      logger.error(`[ams] getForumList: ${error}`)
      return { status: false, msg: "获取帖子列表异常" }
    }
  }

  async bbsSignIn(token = this.token, devCode = this.devCode, bat = this.bat) {
    try {
      const res = await this._post(
        KURO_BBS_URLS.SIGN_IN,
        { gameId: 2 },
        {
          headers: { token, devCode, "b-at": bat, version: API_CONSTS.version },
        },
      )

      if (res.code === 200) {
        return { status: true, msg: "社区签到成功" }
      }
      if (res.code === 1511) {
        return { status: true, msg: "社区今日已签到" }
      }

      logger.warn(`[ams] bbsSignIn: ${JSON.stringify(res)}`)
      return { status: false, msg: res.msg || "社区签到失败" }
    } catch (error) {
      logger.error(`[ams] bbsSignIn: ${error}`)
      return { status: false, msg: "社区签到异常" }
    }
  }

  async bbsLike(
    postList = null,
    gameId = this.gameId,
    token = this.token,
    devCode = this.devCode,
    bat = this.bat,
  ) {
    try {
      // 1. 如果没有传入帖子列表，则自行获取
      let posts = postList
      if (!posts || posts.length === 0) {
        const listRes = await this.getForumList(gameId, token, devCode, bat)
        if (!listRes.status) {
          return listRes
        }
        posts = listRes.data
      }

      // 2. 随机选取 5 个帖子进行点赞
      let successCount = 0

      for (const post of posts) {
        if (successCount >= 5) break
        if (post.isLike) continue

        const likeRes = await this._post(
          KURO_BBS_URLS.LIKE,
          {
            gameId,
            likeType: 1, // 1: 点赞, 2: 取消点赞
            operateType: 1, // 1: 帖子, 2: 评论
            postId: post.postId,
            toUserId: post.userId,
          },
          { headers: { token, devCode, "b-at": bat, version: API_CONSTS.version } },
        )

        if (likeRes.code === 200) {
          successCount++
        }
        // 稍微延时一下，避免频繁请求
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      return { status: true, msg: `社区点赞成功 (已点赞 ${successCount} 帖)` }
    } catch (error) {
      logger.error(`[ams] bbsLike: ${error}`)
      return { status: false, msg: "社区点赞异常" }
    }
  }

  async bbsShare(gameId = this.gameId, token = this.token, devCode = this.devCode, bat = this.bat) {
    try {
      const res = await this._post(
        KURO_BBS_URLS.SHARE,
        { gameId },
        { headers: { token, devCode, "b-at": bat, version: API_CONSTS.version } },
      )

      if (res.code === 200) {
        return { status: true, msg: "社区分享成功" }
      }

      logger.warn(`[ams] bbsShare: ${JSON.stringify(res)}`)
      return { status: false, msg: res.msg || "社区分享失败" }
    } catch (error) {
      logger.error(`[ams] bbsShare: ${error}`)
      return { status: false, msg: "社区分享异常" }
    }
  }

  async bbsView(
    postList = null,
    gameId = this.gameId,
    token = this.token,
    devCode = this.devCode,
    bat = this.bat,
  ) {
    try {
      // 1. 如果没有传入帖子列表，则自行获取
      let posts = postList
      if (!posts || posts.length === 0) {
        const listRes = await this.getForumList(gameId, token, devCode, bat)
        if (!listRes.status) {
          return listRes
        }
        posts = listRes.data
      }

      // 2. 浏览 3 个帖子
      let successCount = 0

      for (const post of posts) {
        if (successCount >= 3) break

        const detailRes = await this._post(
          KURO_BBS_URLS.POST_DETAIL,
          {
            postId: post.postId,
            showOrderType: 2,
            isOnlyPublisher: 0,
          },
          { headers: { token, devCode, "b-at": bat, version: API_CONSTS.version } },
        )

        if (detailRes.code === 200) {
          successCount++
        }
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      return { status: true, msg: `社区浏览成功 (已浏览 ${successCount} 帖)` }
    } catch (error) {
      logger.error(`[ams] bbsView: ${error}`)
      return { status: false, msg: "社区浏览异常" }
    }
  }

  async getTaskProgress(
    gameId = this.gameId,
    token = this.token,
    devCode = this.devCode,
    bat = this.bat,
  ) {
    try {
      const res = await this._post(
        KURO_BBS_URLS.TASK_PROGRESS,
        { gameId },
        { headers: { token, devCode, "b-at": bat, version: API_CONSTS.version } },
      )

      if (res.code === 200) {
        return { status: true, data: res.data }
      }

      logger.warn(`[ams] getTaskProgress: ${JSON.stringify(res)}`)
      return { status: false, msg: res.msg || "获取任务进度失败" }
    } catch (error) {
      logger.error(`[ams] getTaskProgress: ${error}`)
      return { status: false, msg: "获取任务进度异常" }
    }
  }
}
