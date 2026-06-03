import { ROVER_ID } from "#waves.core"
import { DataTypes, Model, Op } from "sequelize"
import sequelize from "../connect.js"

// 主角(漂泊者)可在游戏内切换属性形态(对应 ROVER_ID 中的多个 roleId)，但只占一个角色位。
// 落库同样只保留一行：写入前先清掉该用户全部主角形态行，再写入当前形态。
// charId 即当前实际形态id，可直接区分用户用的是哪个属性的主角。
const isRover = roleId => ROVER_ID.includes(Number(roleId))

// 主角按"任一形态"匹配，普通角色按精确 id 匹配
const buildWhere = (wavesUid, roleId) => {
  const uid = String(wavesUid)
  const id = Number(roleId)
  return isRover(id)
    ? { wavesUid: uid, charId: { [Op.in]: ROVER_ID } }
    : { wavesUid: uid, charId: id }
}

export class RolePanel extends Model {
  /**
   * 保存/更新单个角色面板原始数据。
   * 主角：先清理全部形态行，再写入当前形态，始终只有一行。
   * @param {string|number} wavesUid 鸣潮UID
   * @param {string|number} roleId 角色ID(主角为当前属性形态id)
   * @param {Object} detail getRoleDetail 返回的原始数据
   */
  static async save(wavesUid, roleId, detail) {
    const uid = String(wavesUid)
    const id = Number(roleId)
    if (isRover(id)) {
      await RolePanel.destroy({ where: { wavesUid: uid, charId: { [Op.in]: ROVER_ID } } })
    }
    const [row] = await RolePanel.upsert({ wavesUid: uid, charId: id, detail })
    return row
  }

  /**
   * 获取单个角色面板(主角不区分形态，返回当前那一行)
   */
  static async get(wavesUid, roleId) {
    return await RolePanel.findOne({ where: buildWhere(wavesUid, roleId) })
  }

  /**
   * 获取某 UID 下全部已落地的角色面板
   */
  static async getAllByUid(wavesUid) {
    return await RolePanel.findAll({
      where: { wavesUid: String(wavesUid) },
      order: [["updatedAt", "DESC"]],
    })
  }

  /**
   * 删除角色面板(主角删除全部形态行)
   */
  static async del(wavesUid, roleId) {
    const count = await RolePanel.destroy({ where: buildWhere(wavesUid, roleId) })
    return count > 0
  }
}

RolePanel.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    wavesUid: { type: DataTypes.STRING, allowNull: false, comment: "鸣潮UID" },
    charId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "角色ID(主角为当前属性形态id)",
    },
    detail: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: () => ({}),
      comment: "角色面板原始数据(getRoleDetail)",
    },
  },
  {
    sequelize,
    modelName: "RolePanel",
    tableName: "role_panel",
    indexes: [
      {
        unique: true,
        fields: ["wavesUid", "charId"],
      },
    ],
    comment: "角色面板数据表",
  },
)
