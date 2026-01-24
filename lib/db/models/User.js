import { DataTypes, Model, Op } from "sequelize"
import sequelize from "../connect.js"

export class User extends Model {
  static async get(userId, gameUid, gameId) {
    return await User.findOne({
      where: { userId, gameId, gameUid },
    })
  }

  static async getAllValid(userId, gameId) {
    const where = {
      userId,
      status: 1,
      token: { [Op.ne]: null },
    }
    if (gameId !== null && gameId !== undefined) {
      where.gameId = gameId
    }
    return await User.findAll({
      where,
      order: [["updatedAt", "DESC"]],
    })
  }

  static async getAll(userId, gameId) {
    const where = {
      userId,
    }
    if (gameId !== null && gameId !== undefined) {
      where.gameId = gameId
    }
    return await User.findAll({
      where,
      order: [["updatedAt", "DESC"]],
    })
  }

  static async getByUid(userId, gameUid) {
    return await User.findOne({
      where: { userId, gameUid },
    })
  }

  static async getBindUids(userId, gameId) {
    const users = await User.findAll({
      attributes: ["gameUid"],
      where: { userId, gameId },
      order: [["updatedAt", "DESC"]],
    })

    if (!users || users.length === 0) {
      return { uid: null, uids: [] }
    }

    const uid = users[0].gameUid
    const uids = users.map(u => u.gameUid)
    return { uid, uids }
  }

  static async getUseUser(userId, gameId) {
    return await User.findOne({
      where: { userId, gameId },
      order: [["updatedAt", "DESC"]],
    })
  }

  static async use(userId, gameUid, gameId) {
    const user = await User.findOne({
      where: { userId, gameId, gameUid },
    })

    if (user) {
      user.changed("updatedAt", true)
      user.updatedAt = new Date()
      await user.save()
      return true
    }
    return false
  }

  static async add(userId, gameUid, gameId, data) {
    const { userId: _, gameId: __, gameUid: ___, ...cleanData } = data

    const [user] = await User.upsert({
      userId,
      gameId,
      gameUid,
      ...cleanData,
    })

    return user
  }

  static async updateSilent(userId, gameUid, gameId, data) {
    const [count] = await User.update(data, {
      where: { userId, gameId, gameUid },
      silent: true,
    })
    return count > 0
  }

  static async del(userId, gameUid, gameId) {
    const count = await User.destroy({
      where: { userId, gameId, gameUid },
    })
    return count > 0
  }

  static async getAutoSignUsers() {
    return await User.findAll({
      where: {
        isAutoSign: true,
        status: 1,
        token: { [Op.ne]: null },
      },
    })
  }
}

User.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false, unique: false, comment: "账号" },
    gameId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: false,
      comment: "游戏ID",
    },
    gameUid: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: false,
      comment: "游戏内的UID",
    },
    token: { type: DataTypes.TEXT, allowNull: true, comment: "用户token" },
    devCode: { type: DataTypes.STRING, allowNull: true, comment: "用户设备码" },
    bat: { type: DataTypes.STRING, allowNull: true, comment: "用户bat" },
    isAutoSign: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "是否开启自动签到",
    },
    status: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1, comment: "状态" },
    config: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: () => ({}),
      comment: "配置",
    },
    gameData: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: () => ({}),
      comment: "游戏数据",
    },
    sign: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: () => ({}),
      comment: "签到记录",
    },
  },
  {
    sequelize,
    modelName: "User",
    tableName: "user",
    indexes: [
      {
        unique: true,
        fields: ["userId", "gameId", "gameUid"],
      },
    ],
    comment: "用户游戏表",
  },
)
