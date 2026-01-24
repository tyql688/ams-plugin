import moment from "moment"
import { DAILY_TASK_LIMIT } from "./api/consts.js"
import { User } from "./db/index.js"

const TASK_MAP = {
  用户签到: "bbsSign",
  点赞: "bbsLike",
  分享: "bbsShare",
  浏览: "bbsView",
}

export class SignService {
  constructor(wavesApi) {
    this.api = wavesApi
  }

  /**
   * 检查用户今日任务是否已全部完成（本地检查）
   * @param {Object} user
   * @returns {boolean}
   */
  static checkLocalDone(user) {
    const today = moment().format("YYYY-MM-DD")
    const signData = user.sign || {}

    if (signData.date !== today) return false
    return SignService.checkIsAllDoneStatic(signData)
  }

  /**
   * 静态辅助方法：检查所有任务状态
   */
  static checkIsAllDoneStatic(data) {
    return (
      (data.gameSign || 0) >= DAILY_TASK_LIMIT.gameSign &&
      (data.bbsSign || 0) >= DAILY_TASK_LIMIT.bbsSign &&
      (data.bbsLike || 0) >= DAILY_TASK_LIMIT.bbsLike &&
      (data.bbsShare || 0) >= DAILY_TASK_LIMIT.bbsShare &&
      (data.bbsView || 0) >= DAILY_TASK_LIMIT.bbsView
    )
  }

  /**
   * 实例方法兼容（可选）
   */
  checkLocalDone(user) {
    return SignService.checkLocalDone(user)
  }

  /**
   * 执行签到流程
   * @param {Object} user 数据库用户对象
   * @returns {Promise<{success: boolean, msg: string[], summary: string}>}
   */
  async doSign(user) {
    const today = moment().format("YYYY-MM-DD")
    let signData = this.initSignData(user.sign, today)
    const msgs = []

    // 1. 本地检查
    if (this.checkIsAllDone(signData)) {
      return SignService.buildResult(true, ["📅 今日任务已全部完成，无需重复执行"], signData)
    }

    // 2. 并行同步远端状态 (如果需要)
    const promises = []

    // 2.1 游戏签到同步
    if (!SignService.isTaskDone(signData.gameSign, DAILY_TASK_LIMIT.gameSign)) {
      promises.push(this.syncGameSign(signData))
    }

    // 2.2 社区任务同步
    if (!this.checkIsBbsAllDone(signData)) {
      promises.push(this.syncBbsTasks(signData))
    }

    if (promises.length > 0) {
      await Promise.all(promises)
      // 同步后保存一次
      await this.saveUserSign(user, signData)
    }

    // 3. 再次检查
    if (this.checkIsAllDone(signData)) {
      return SignService.buildResult(true, ["📅 任务状态同步完成，今日任务已全部完成"], signData)
    }

    // 4. 执行未完成的任务
    msgs.push("🔄 开始执行未完成的任务...")
    const tasks = {
      doGameSign: !SignService.isTaskDone(signData.gameSign, DAILY_TASK_LIMIT.gameSign),
      doBbsSign: !SignService.isTaskDone(signData.bbsSign, DAILY_TASK_LIMIT.bbsSign),
      doBbsLike: !SignService.isTaskDone(signData.bbsLike, DAILY_TASK_LIMIT.bbsLike),
      doBbsShare: !SignService.isTaskDone(signData.bbsShare, DAILY_TASK_LIMIT.bbsShare),
      doBbsView: !SignService.isTaskDone(signData.bbsView, DAILY_TASK_LIMIT.bbsView),
    }

    const taskRes = await this.api.doSignTasks(tasks)
    msgs.push(...taskRes.msg)

    // 5. 更新执行结果
    this.updateSignDataFromExecution(signData, taskRes.result)
    await this.saveUserSign(user, signData)

    return SignService.buildResult(true, msgs, signData)
  }

  // --- Helpers ---

  initSignData(currentData, today) {
    if (currentData && currentData.date === today) {
      return { ...currentData } // Copy to avoid mutating original ref immediately
    }
    return {
      date: today,
      gameSign: 0,
      bbsSign: 0,
      bbsLike: 0,
      bbsShare: 0,
      bbsView: 0,
    }
  }

  async syncGameSign(signData) {
    try {
      const gameStatus = await this.api.getSignInData()
      if (gameStatus.status && gameStatus.data?.isSigIn) {
        signData.gameSign = DAILY_TASK_LIMIT.gameSign
      }
    } catch (e) {
      // Ignore sync error
    }
  }

  async syncBbsTasks(signData) {
    try {
      const progressRes = await this.api.getTaskProgress()
      if (progressRes.status && progressRes.data?.dailyTask) {
        this.updateSignDataFromTask(signData, progressRes.data.dailyTask)
      }
    } catch (e) {
      // Ignore sync error
    }
  }

  static isTaskDone(current, limit) {
    return (current || 0) >= limit
  }

  checkIsAllDone(data) {
    return (
      SignService.isTaskDone(data.gameSign, DAILY_TASK_LIMIT.gameSign) &&
      this.checkIsBbsAllDone(data)
    )
  }

  checkIsBbsAllDone(data) {
    return (
      SignService.isTaskDone(data.bbsSign, DAILY_TASK_LIMIT.bbsSign) &&
      SignService.isTaskDone(data.bbsLike, DAILY_TASK_LIMIT.bbsLike) &&
      SignService.isTaskDone(data.bbsShare, DAILY_TASK_LIMIT.bbsShare) &&
      SignService.isTaskDone(data.bbsView, DAILY_TASK_LIMIT.bbsView)
    )
  }

  updateSignDataFromTask(signData, dailyTasks) {
    dailyTasks.forEach(task => {
      const key = Object.keys(TASK_MAP).find(k => task.remark.includes(k))
      if (key) {
        signData[TASK_MAP[key]] = task.completeTimes
      }
    })
  }

  updateSignDataFromExecution(signData, result) {
    if (result.gameSign) signData.gameSign = DAILY_TASK_LIMIT.gameSign
    if (result.bbsSign) signData.bbsSign = DAILY_TASK_LIMIT.bbsSign
    if (result.bbsShare) signData.bbsShare = DAILY_TASK_LIMIT.bbsShare
    if (result.bbsView) signData.bbsView = DAILY_TASK_LIMIT.bbsView

    if (result.bbsLike) {
      const match = result.bbsLike.match(/已点赞 (\d+) 帖/)
      if (match) {
        signData.bbsLike += parseInt(match[1])
      } else {
        // Fallback: assume full if success message but no count
        signData.bbsLike = DAILY_TASK_LIMIT.bbsLike
      }
    }
  }

  async saveUserSign(user, signData) {
    await User.updateSilent(user.userId, user.gameUid, this.api.gameId, { sign: signData })
    // 更新内存中的 user 对象，以便后续使用
    user.sign = signData
  }

  static buildResult(success, msg, signData) {
    return {
      success,
      msg,
      summary: SignService.getSummary(signData),
    }
  }

  static formatStatus(current, limit) {
    return SignService.isTaskDone(current, limit) ? "✅" : "⏳"
  }

  static getSummary(data) {
    return [
      "\n📊 今日任务统计:",
      `${SignService.formatStatus(data.gameSign, DAILY_TASK_LIMIT.gameSign)} 游戏签到 (${data.gameSign || 0}/${DAILY_TASK_LIMIT.gameSign})`,
      `${SignService.formatStatus(data.bbsSign, DAILY_TASK_LIMIT.bbsSign)} 社区签到 (${data.bbsSign || 0}/${DAILY_TASK_LIMIT.bbsSign})`,
      `${SignService.formatStatus(data.bbsLike, DAILY_TASK_LIMIT.bbsLike)} 社区点赞 (${data.bbsLike || 0}/${DAILY_TASK_LIMIT.bbsLike})`,
      `${SignService.formatStatus(data.bbsShare, DAILY_TASK_LIMIT.bbsShare)} 社区分享 (${data.bbsShare || 0}/${DAILY_TASK_LIMIT.bbsShare})`,
      `${SignService.formatStatus(data.bbsView, DAILY_TASK_LIMIT.bbsView)} 社区浏览 (${data.bbsView || 0}/${DAILY_TASK_LIMIT.bbsView})`,
    ].join("\n")
  }
}
