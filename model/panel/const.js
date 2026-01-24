import {
  ELE_ID_MAP,
  ELE_NAME_MAP,
  PHANTOM_SUB_VALUE,
  SKILL_ID_MAP,
  WEAPON_TYPE_ID_MAP,
} from "../../resources/waves-res/core/constants.js"

export { ELE_ID_MAP, ELE_NAME_MAP, PHANTOM_SUB_VALUE, SKILL_ID_MAP, WEAPON_TYPE_ID_MAP }

export const SKILL_ORDER = ["常态攻击", "共鸣技能", "共鸣回路", "共鸣解放", "变奏技能"]

export const ROLE_ATTRIBUTE_LIST_ORDER = [
  "生命",
  "攻击",
  "防御",
  "谐度破坏增幅",
  "共鸣效率",
  "暴击",
  "暴击伤害",
  "偏谐值累积效率",
  "{element}伤害加成",
  "治疗效果加成",
  "普攻伤害加成",
  "重击伤害加成",
  "共鸣技能伤害加成",
  "共鸣解放伤害加成",
]

export const PHANTOM_SUB_VALUE_MAP = Object.fromEntries(
  PHANTOM_SUB_VALUE.map(item => [item.name, item.values]),
)

// 获取声骸副词条最大值
/**
 * 获取声骸副词条可选数值列表
 * @private
 */
function _getPhantomSubValueList(name, value = "") {
  let listName = name
  if (["攻击", "防御", "生命"].includes(name) && value.endsWith("%")) {
    listName = name + "%"
  }
  return PHANTOM_SUB_VALUE_MAP[listName] || null
}

// 获取声骸副词条最大值
export function getPhantomSubMaxValue(name, value) {
  const valueList = _getPhantomSubValueList(name, value)
  return valueList ? valueList[valueList.length - 1] : null
}

// 判断声骸副词条是否为最大值
export function isSubPropMax(name, value) {
  const valueList = _getPhantomSubValueList(name, value)
  return valueList ? value === valueList[valueList.length - 1] : false
}
