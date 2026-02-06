import { GAMES } from "../constants.js"
import { API_CONSTS, KURO_BBS_URLS, WAVES_URLS } from "./consts.js"
import KuroClient from "./kuro.js"

const SERVER_ID = "76402e5b20be2c39f095a152090afddc"

const NET_SERVER_ID_MAP = {
  5: "591d6af3a3090d8ea00d8f86cf6d7501",
  6: "6eb2a235b30d05efd77bedb5cf60999e",
  7: "86d52186155b148b5c138ceb41be9650",
  8: "919752ae5ea09c1ced910dd668a63ffb",
  9: "10cd7254d57e58ae560b15d51e34b4c8",
}

export function isNetUser(wavesId) {
  return Number(wavesId) >= 200000000
}

function getServerId(wavesId, serverId) {
  if (serverId) return serverId

  const prefix = String(wavesId)[0]
  return NET_SERVER_ID_MAP[prefix] || SERVER_ID
}

export default class WavesApi extends KuroClient {
  constructor(gameUid, token = "", option = { devCode: "", bat: "" }) {
    super()
    this.gameId = GAMES.waves.id
    this.wavesId = gameUid
    this.token = token
    this.devCode = option.devCode
    this.bat = option.bat
    this.serverId = getServerId(this.wavesId)
  }

  async loginStatusCheck() {
    try {
      const res = await this._post(
        WAVES_URLS.LOGIN_LOG,
        {},
        {
          headers: { token: this.token, devCode: this.devCode },
        },
      )

      if (res?.code === 200) {
        return { status: true, code: 200, data: res.data }
      }

      logger.warn(`[ams] loginStatusCheck: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "登录状态检查失败" }
    } catch (error) {
      logger.error(`[ams] loginStatusCheck 异常: ${error}`)
      return { status: false, code: -1, msg: "检查登录状态异常" }
    }
  }

  async refreshData() {
    try {
      const res = await this._post(
        WAVES_URLS.REFRESH_DATA,
        { gameId: this.gameId, serverId: this.serverId, roleId: this.wavesId },
        { headers: { "b-at": this.bat } },
      )

      if (res?.code === 200) {
        return { status: true, code: 200, data: res.data }
      }

      logger.warn(`[ams] refreshData: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "刷新数据失败" }
    } catch (error) {
      logger.error(`[ams] refreshData 异常: ${error}`)
      return { status: false, code: -1, msg: "刷新数据异常" }
    }
  }

  async getRequestToken() {
    try {
      const res = await this._post(
        WAVES_URLS.REQUEST_TOKEN,
        { serverId: this.serverId, roleId: this.wavesId },
        { headers: { token: this.token, did: this.devCode, "b-at": "" } },
      )

      if (res?.code === 200 && res?.data?.accessToken) {
        return { status: true, code: 200, bat: res.data.accessToken, data: res.data }
      }

      logger.warn(`[ams] getRequestToken: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, bat: "", msg: res?.msg || "获取令牌失败" }
    } catch (error) {
      logger.error(`[ams] getRequestToken 异常: ${error}`)
      return { status: false, code: -1, bat: "", msg: "获取bat异常" }
    }
  }

  async getRoleDetail(charId) {
    try {
      const res = await this._post(
        WAVES_URLS.ROLE_DETAIL,
        {
          gameId: this.gameId,
          serverId: this.serverId,
          roleId: this.wavesId,
          channelId: "19",
          countryCode: "1",
          id: charId,
        },
        { headers: { "b-at": this.bat } },
      )

      if (res?.code === 200 && res?.data) {
        return { status: true, code: 200, data: res.data }
      }

      logger.warn(`[ams] getRoleDetail: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "获取角色明细失败" }
    } catch (error) {
      logger.error(`[ams] getRoleDetail 异常: ${error.message}`)
      return { status: false, code: -1, msg: "获取角色明细异常" }
    }
  }

  async getRoleData() {
    try {
      const res = await this._post(
        WAVES_URLS.ROLE_DATA,
        {
          gameId: this.gameId,
          serverId: this.serverId,
          roleId: this.wavesId,
          channelId: "19",
          countryCode: "1",
        },
        { headers: { "b-at": this.bat } },
      )

      if (res?.code === 200 && res?.data) {
        return { status: true, code: 200, data: res.data }
      }

      logger.warn(`[ams] getRoleData: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "获取角色列表失败" }
    } catch (error) {
      logger.error(`[ams] getRoleData 异常: ${error.message}`)
      return { status: false, code: -1, msg: "获取角色列表异常" }
    }
  }

  async getTowerDetail() {
    try {
      const res = await this._post(
        WAVES_URLS.TOWER_DATA_DETAIL,
        {
          gameId: this.gameId,
          serverId: this.serverId,
          roleId: this.wavesId,
        },
        { headers: { "b-at": this.bat } },
      )
      if (res?.code === 200) {
        return { status: true, code: 200, data: res.data }
      }
      logger.warn(`[ams] getTowerDetail: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "获取深塔详情失败" }
    } catch (error) {
      logger.error(`[ams] getTowerDetail 异常: ${error}`)
      return { status: false, code: -1, msg: "获取深塔详情异常" }
    }
  }

  async getTowerIndex() {
    try {
      const res = await this._post(
        WAVES_URLS.TOWER_INDEX,
        {
          gameId: this.gameId,
          serverId: this.serverId,
          roleId: this.wavesId,
        },
        { headers: { "b-at": this.bat } },
      )
      if (res?.code === 200) {
        return { status: true, code: 200, data: res.data }
      }
      logger.warn(`[ams] getTowerIndex: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "获取深塔首页失败" }
    } catch (error) {
      logger.error(`[ams] getTowerIndex 异常: ${error}`)
      return { status: false, code: -1, msg: "获取深塔首页异常" }
    }
  }

  async getSlashDetail() {
    try {
      const res = await this._post(
        WAVES_URLS.SLASH_DETAIL,
        {
          serverId: this.serverId,
          roleId: this.wavesId,
        },
        { headers: { "b-at": this.bat } },
      )
      if (res?.code === 200) {
        return { status: true, code: 200, data: res.data }
      }
      logger.warn(`[ams] getSlashDetail: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "获取冥歌海墟详情失败" }
    } catch (error) {
      logger.error(`[ams] getSlashDetail 异常: ${error}`)
      return { status: false, code: -1, msg: "获取冥歌海墟详情异常" }
    }
  }

  async getSlashIndex() {
    try {
      const res = await this._post(
        WAVES_URLS.SLASH_INDEX,
        {
          serverId: this.serverId,
          roleId: this.wavesId,
        },
        { headers: { "b-at": this.bat } },
      )
      if (res?.code === 200) {
        return { status: true, code: 200, data: res.data }
      }
      logger.warn(`[ams] getSlashIndex: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "获取冥歌海墟首页失败" }
    } catch (error) {
      logger.error(`[ams] getSlashIndex 异常: ${error}`)
      return { status: false, code: -1, msg: "获取冥歌海墟首页异常" }
    }
  }

  async getChallengeDetail() {
    try {
      const res = await this._post(
        WAVES_URLS.CHALLENGE_DETAIL,
        {
          gameId: this.gameId,
          serverId: this.serverId,
          roleId: this.wavesId,
          channelId: "19",
          countryCode: "1",
        },
        { headers: { "b-at": this.bat } },
      )
      if (res?.code === 200) {
        return { status: true, code: 200, data: res.data }
      }
      logger.warn(`[ams] getChallengeDetail: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "获取战术全息详情失败" }
    } catch (error) {
      logger.error(`[ams] getChallengeDetail 异常: ${error}`)
      return { status: false, code: -1, msg: "获取战术全息详情异常" }
    }
  }

  async getExploreIndex() {
    try {
      const res = await this._post(
        WAVES_URLS.EXPLORE_INDEX,
        {
          gameId: this.gameId,
          serverId: this.serverId,
          roleId: this.wavesId,
          channelId: "19",
          countryCode: "1",
        },
        { headers: { "b-at": this.bat } },
      )
      if (res?.code === 200 && res.data) {
        return { status: true, code: 200, data: res.data }
      }
      logger.warn(`[ams] getExploreIndex: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "获取探索度信息失败" }
    } catch (error) {
      logger.error(`[ams] getExploreIndex 异常: ${error}`)
      return { status: false, code: -1, msg: "获取探索度信息异常" }
    }
  }

  async getSlashData() {
    try {
      // 1. 尝试获取详细数据
      const detailRes = await this.getSlashDetail()

      if (detailRes.status && detailRes.data) {
        return { status: true, data: detailRes.data }
      }

      // 2. 如果详细数据为空，尝试获取首页数据
      if (detailRes.status && !detailRes.data) {
        const indexRes = await this.getSlashIndex()

        if (indexRes.status && indexRes.data) {
          return { status: true, data: indexRes.data }
        }

        return { status: false, code: indexRes.code, msg: indexRes.msg || "获取冥歌海墟数据失败" }
      }

      return { status: false, code: detailRes.code, msg: detailRes.msg || "获取冥歌海墟数据失败" }
    } catch (error) {
      logger.error(`[ams] getSlashData 异常: ${error}`)
      return { status: false, code: -1, msg: "获取冥歌海墟数据异常" }
    }
  }

  async getTowerData() {
    try {
      // 1. 尝试获取详细数据
      const detailRes = await this.getTowerDetail()

      if (detailRes.status && detailRes.data) {
        return { status: true, data: detailRes.data }
      }

      // 2. 如果详细数据为空，尝试获取首页数据
      if (detailRes.status && !detailRes.data) {
        const indexRes = await this.getTowerIndex()

        if (indexRes.status && indexRes.data) {
          return { status: true, data: indexRes.data }
        }

        return { status: false, code: indexRes.code, msg: indexRes.msg || "获取逆境深塔数据失败" }
      }

      return { status: false, code: detailRes.code, msg: detailRes.msg || "获取逆境深塔数据失败" }
    } catch (error) {
      logger.error(`[ams] getTowerData 异常: ${error}`)
      return { status: false, code: -1, msg: "获取逆境深塔数据异常" }
    }
  }

  async getSignInData() {
    try {
      const res = await this._post(
        WAVES_URLS.SIGN_IN_TASK_LIST,
        { gameId: this.gameId, serverId: this.serverId, roleId: this.wavesId },
        { headers: { token: this.token, devCode: this.devCode } },
      )

      if (res?.code === 200) {
        return { status: true, code: 200, data: res.data }
      }

      logger.warn(`[ams] getSignInData: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "获取签到信息失败" }
    } catch (error) {
      logger.error(`[ams] getSignInData 异常: ${error}`)
      return { status: false, code: -1, msg: "获取签到信息异常" }
    }
  }

  async signIn() {
    try {
      // 1. 执行签到
      const res = await this._post(
        WAVES_URLS.SIGN_IN,
        {
          gameId: this.gameId,
          serverId: this.serverId,
          roleId: this.wavesId,
          reqMonth: (new Date().getMonth() + 1).toString().padStart(2, "0"),
        },
        { headers: { token: this.token, devCode: this.devCode, "b-at": this.bat } },
      )

      if (res?.code === 200) {
        return { status: true, code: 200, msg: "签到成功", data: res.data }
      } else {
        logger.warn(`[ams] signIn: ${JSON.stringify(res)}`)
        return { status: false, code: res?.code, msg: res?.msg || "签到失败" }
      }
    } catch (error) {
      logger.error(`[ams] signIn 异常: ${error}`)
      return { status: false, code: -1, msg: "签到请求异常" }
    }
  }

  async doSignTasks(tasks) {
    const { doGameSign, doBbsSign, doBbsLike, doBbsShare, doBbsView } = tasks
    let msg = []
    let result = {}

    // 1. 游戏签到
    if (doGameSign) {
      const gameRes = await this.signIn()
      if (gameRes.status) {
        msg.push(`🎮 游戏: ${gameRes.msg}`)
        result.gameSign = true
      } else {
        msg.push(`🎮 游戏: ❌ ${gameRes.msg}`)
      }
    }

    // 2. 社区签到
    if (doBbsSign) {
      const bbsSignInRes = await this.bbsSignIn()
      if (bbsSignInRes.status) {
        msg.push(`📝 签到: ${bbsSignInRes.msg}`)
        result.bbsSign = true
      } else {
        msg.push(`📝 签到: ❌ ${bbsSignInRes.msg}`)
      }
    }

    // 3. 准备帖子列表 (如果需要点赞或浏览)
    let postList = null
    if (doBbsLike || doBbsView) {
      const listRes = await this.getForumList()
      if (listRes.status) {
        postList = listRes.data
      } else {
        msg.push(`⚠️ 无法获取帖子列表，跳过点赞和浏览: ${listRes.msg}`)
      }
    }

    // 4. 社区点赞 (复用帖子列表)
    if (doBbsLike && postList) {
      const bbsLikeRes = await this.bbsLike(postList)
      if (bbsLikeRes.status) {
        msg.push(`👍 点赞: ${bbsLikeRes.msg}`)
        result.bbsLike = bbsLikeRes.msg
      } else {
        msg.push(`👍 点赞: ❌ ${bbsLikeRes.msg}`)
      }
    }

    // 5. 社区分享
    if (doBbsShare) {
      const bbsShareRes = await this.bbsShare()
      if (bbsShareRes.status) {
        msg.push(`🔗 分享: ${bbsShareRes.msg}`)
        result.bbsShare = true
      } else {
        msg.push(`🔗 分享: ❌ ${bbsShareRes.msg}`)
      }
    }

    // 6. 社区浏览 (复用帖子列表)
    if (doBbsView && postList) {
      const bbsViewRes = await this.bbsView(postList)
      if (bbsViewRes.status) {
        msg.push(`👀 浏览: ${bbsViewRes.msg}`)
        result.bbsView = true
      } else {
        msg.push(`👀 浏览: ❌ ${bbsViewRes.msg}`)
      }
    }

    return { msg, result }
  }

  async getWidgetRefresh() {
    try {
      const res = await this._post(
        WAVES_URLS.WIDGET_REFRESH,
        {
          type: 2,
          sizeType: "1",
          gameId: this.gameId,
          serverId: this.serverId,
          roleId: this.wavesId,
        },
        { headers: { token: this.token, devCode: this.devCode, "b-at": this.bat } },
      )

      if (res?.code === 200 && res.data) {
        return { status: true, code: 200, data: res.data }
      }

      logger.warn(`[ams] getWidgetRefresh: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "获取组件数据失败" }
    } catch (error) {
      logger.error(`[ams] getWidgetRefresh 异常: ${error}`)
      return { status: false, code: -1, msg: "获取组件数据异常" }
    }
  }

  async getGachaLog(cardPoolType, recordId) {
    try {
      const url = isNetUser(this.wavesId) ? WAVES_URLS.GACHA_NET_LOG_URL : WAVES_URLS.GACHA_LOG_URL
      const data = {
        playerId: this.wavesId,
        cardPoolType,
        serverId: this.serverId,
        languageCode: "zh-Hans",
        recordId,
      }

      const res = await this._post(url, data, {
        type: "json",
        headers: { "Content-Type": "application/json;charset=UTF-8" },
      })

      if (res?.code === 0 || res?.code === 200) {
        return { status: true, code: res.code, data: res.data }
      }

      logger.warn(`[ams] getGachaLog: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || res?.message || "获取抽卡记录失败" }
    } catch (e) {
      logger.error(`[ams] getGachaLog 异常: ${e}`)
      return { status: false, code: -1, msg: "获取抽卡记录异常" }
    }
  }
  async getEventList(eventType = 0) {
    try {
      const res = await this._post(
        KURO_BBS_URLS.EVENT_LIST,
        {
          gameId: this.gameId,
          eventType,
        },
        { headers: { source: "h5" } },
      )

      if (res?.code === 200 && res.data) {
        return { status: true, code: 200, data: res.data }
      }

      logger.warn(`[ams] getEventList: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "获取公告列表失败" }
    } catch (error) {
      logger.error(`[ams] getEventList 异常: ${error}`)
      return { status: false, code: -1, msg: "获取活动列表异常" }
    }
  }

  async getPostDetail(postId) {
    try {
      const res = await this._post(
        KURO_BBS_URLS.POST_DETAIL,
        {
          postId,
          showOrderType: 2,
          isOnlyPublisher: 0,
        },
        {
          headers: {
            source: "h5",
            version: API_CONSTS.version,
          },
        },
      )

      if (res?.code === 200 && res.data) {
        return { status: true, code: 200, data: res.data }
      }
      logger.warn(`[ams] getPostDetail: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "获取公告详情失败" }
    } catch (error) {
      logger.error(`[ams] getPostDetail 异常: ${error}`)
      return { status: false, code: -1, msg: "获取公告详情异常" }
    }
  }

  async getWikiHome() {
    try {
      const res = await this._post(
        WAVES_URLS.WIKI_HOME_URL,
        {},
        {
          // wiki_type 9 is required
          headers: { wiki_type: "9" },
        },
      )
      if (res?.code === 200 && res.data) {
        return { status: true, code: 200, data: res.data }
      }
      logger.warn(`[ams] getWikiHome: ${JSON.stringify(res)}`)
      return { status: false, code: res?.code, msg: res?.msg || "获取Wiki首页失败" }
    } catch (error) {
      logger.error(`[ams] getWikiHome 异常: ${error}`)
      return { status: false, code: -1, msg: "获取Wiki首页异常" }
    }
  }

  /**
   * 刷新养成计算器数据
   */
  async calculatorRefresh() {
    try {
      const res = await this._post(
        WAVES_URLS.CALCULATOR_REFRESH,
        {
          gameId: this.gameId,
          serverId: this.serverId,
          roleId: this.wavesId,
        },
        { headers: { token: this.token, "b-at": this.bat } },
      )
      return { status: res?.code === 200, code: res?.code, data: res?.data, msg: res?.msg }
    } catch (error) {
      return { status: false, code: -1, msg: error.message }
    }
  }

  /**
   * 获取在线角色列表
   */
  async getOnlineListRole() {
    try {
      const res = await this._post(
        WAVES_URLS.ONLINE_LIST_ROLE,
        {},
        { headers: { token: this.token, "b-at": this.bat } },
      )
      return { status: res?.code === 200, code: res?.code, data: res?.data, msg: res?.msg }
    } catch (error) {
      return { status: false, code: -1, msg: error.message }
    }
  }

  /**
   * 获取在线武器列表
   */
  async getOnlineListWeapon() {
    try {
      const res = await this._post(
        WAVES_URLS.ONLINE_LIST_WEAPON,
        {},
        { headers: { token: this.token, "b-at": this.bat } },
      )
      return { status: res?.code === 200, code: res?.code, data: res?.data, msg: res?.msg }
    } catch (error) {
      return { status: false, code: -1, msg: error.message }
    }
  }

  /**
   * 获取拥有的角色信息
   */
  async getOwnedRoleInfo() {
    try {
      const res = await this._post(
        WAVES_URLS.OWNED_ROLE_INFO,
        {
          gameId: this.gameId,
          serverId: this.serverId,
          roleId: this.wavesId,
        },
        { headers: { token: this.token, "b-at": this.bat } },
      )
      return { status: res?.code === 200, code: res?.code, data: res?.data, msg: res?.msg }
    } catch (error) {
      return { status: false, code: -1, msg: error.message }
    }
  }

  /**
   * 获取角色培养状态
   */
  async getRoleCultivateStatus(owneds) {
    try {
      const res = await this._post(
        WAVES_URLS.ROLE_CULTIVATE_STATUS,
        {
          gameId: this.gameId,
          serverId: this.serverId,
          roleId: this.wavesId,
          ids: owneds.join(","),
        },
        { headers: { token: this.token, "b-at": this.bat } },
      )
      return { status: res?.code === 200, code: res?.code, data: res?.data, msg: res?.msg }
    } catch (error) {
      return { status: false, code: -1, msg: error.message }
    }
  }

  /**
   * 批量获取角色培养成本
   */
  async getBatchRoleCost(contentList) {
    try {
      const res = await this._post(
        WAVES_URLS.BATCH_ROLE_COST,
        {
          gameId: this.gameId,
          serverId: this.serverId,
          roleId: this.wavesId,
          content: JSON.stringify(contentList),
        },
        { headers: { token: this.token, "b-at": this.bat } },
      )
      return { status: res?.code === 200, code: res?.code, data: res?.data, msg: res?.msg }
    } catch (error) {
      return { status: false, code: -1, msg: error.message }
    }
  }

  /**
   * 获取简报列表
   */
  async getPeriodList() {
    try {
      const res = await this._get(WAVES_URLS.PERIOD_LIST, {
        headers: { token: this.token, "b-at": this.bat },
      })
      if (res?.code === 200) {
        return { status: true, code: 200, data: res.data }
      }
      return { status: false, code: res?.code, msg: res?.msg || "获取简报列表失败" }
    } catch (error) {
      return { status: false, code: -1, msg: error.message }
    }
  }

  /**
   * 获取简报详情
   * @param {string} periodType 统计类型: month, week, version
   * @param {number} period 统计索引 (period)
   */
  async getPeriodDetail(periodType, period) {
    try {
      let url = WAVES_URLS.PERIOD_VERSION
      if (periodType === "month") {
        url = WAVES_URLS.PERIOD_MONTH
      } else if (periodType === "week") {
        url = WAVES_URLS.PERIOD_WEEK
      }

      const res = await this._post(
        url,
        {
          serverId: this.serverId,
          roleId: this.wavesId,
          period,
        },
        { headers: { token: this.token, "b-at": this.bat } },
      )
      if (res?.code === 200) {
        return { status: true, code: 200, data: res.data }
      }
      return { status: false, code: res?.code, msg: res?.msg || "获取简报详情失败" }
    } catch (error) {
      return { status: false, code: -1, msg: error.message }
    }
  }
}
