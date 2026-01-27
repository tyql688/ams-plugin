const HOST = "https://api.kurobbs.com"
const source = "ios"
const version = "2.9.0"

const KURO_URLS = {
  LOGIN_URL: `${HOST}/user/sdkLogin`,
  ROLE_LIST_URL: `${HOST}/gamer/role/list`,
}

const KURO_BBS_URLS = {
  POST_DETAIL: `${HOST}/forum/getPostDetail`, // 帖子详情
  SIGN_IN: `${HOST}/user/signIn`, // 签到
  TASK_PROGRESS: `${HOST}/encourage/level/getTaskProcess`, // 任务进度
  FORUM_LIST: `${HOST}/forum/list`, // 论坛列表
  LIKE: `${HOST}/forum/like`, // 点赞
  SHARE: `${HOST}/encourage/level/shareTask`, // 分享
  EVENT_LIST: `${HOST}/forum/companyEvent/findEventList`, // 活动列表
}

const WAVES_URLS = {
  REQUEST_TOKEN: `${HOST}/aki/roleBox/requestToken`, // 请求token
  ROLE_DETAIL: `${HOST}/aki/roleBox/akiBox/getRoleDetail`, // 获取角色详情
  LOGIN_LOG: `${HOST}/user/login/log`, // 刷新登录状态
  REFRESH_DATA: `${HOST}/aki/roleBox/akiBox/refreshData`, // 刷新数据
  ROLE_DATA: `${HOST}/aki/roleBox/akiBox/roleData`, // 角色列表数据

  TOWER_DATA_DETAIL: `${HOST}/aki/roleBox/akiBox/towerDataDetail`, // 逆境深塔详情
  TOWER_INDEX: `${HOST}/aki/roleBox/akiBox/towerIndex`, // 逆境深塔索引
  SLASH_DETAIL: `${HOST}/aki/roleBox/akiBox/slashDetail`, // 冥歌海墟详情
  SLASH_INDEX: `${HOST}/aki/roleBox/akiBox/slashIndex`, // 冥歌海墟索引
  CHALLENGE_DETAIL: `${HOST}/aki/roleBox/akiBox/challengeDetails`, // 战术全息详情

  // 签到
  SIGN_IN: `${HOST}/encourage/signIn/v2`, // 签到
  SIGN_IN_TASK_LIST: `${HOST}/encourage/signIn/initSignInV2`, // 签到任务列表
  WIDGET_REFRESH: `${HOST}/gamer/widget/game3/getData`, // 小组件刷新

  // wiki
  WIKI_HOME_URL: `${HOST}/wiki/core/homepage/getPage`,

  // 抽卡
  GACHA_LOG_URL: "https://gmserver-api.aki-game2.com/gacha/record/query",
  GACHA_NET_LOG_URL: "https://gmserver-api.aki-game2.net/gacha/record/query",
}

const BASE_HEADERS = {
  source,
  devCode: "",
}

const API_CONSTS = {
  version,
}

// 每日任务目标次数
const DAILY_TASK_LIMIT = {
  gameSign: 1, // 游戏签到
  bbsSign: 1, // 社区签到
  bbsLike: 5, // 社区点赞
  bbsShare: 1, // 社区分享
  bbsView: 3, // 社区浏览
}

export { API_CONSTS, BASE_HEADERS, DAILY_TASK_LIMIT, KURO_BBS_URLS, KURO_URLS, WAVES_URLS }
