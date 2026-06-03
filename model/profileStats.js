import { EchoScorer } from "#waves.score"
import DataLoader from "../lib/core/data_loader.js"
import { SKILL_ORDER } from "./panel/const.js"
import { Waves2RoleCard } from "./roleCard.js"

// 技能等级(1-10) → 配色档位(0-5)
const SKILL_LV_TIER = [0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 5]

/**
 * 把一条 role_panel.detail 转成练度统计表所需的一行数据
 * @returns {Object|null}
 */
function buildAvatarStat(detail) {
  if (!detail) return null

  let roleCard
  try {
    roleCard = new Waves2RoleCard(detail).toRoleCard()
  } catch {
    return null
  }

  const charId = roleCard.role.id
  const charInfo = DataLoader.getCharacterById(charId)
  if (!charInfo) return null

  // 技能：按固定顺序取 5 个主技能等级
  const skillByType = {}
  for (const s of roleCard.skills) skillByType[s.type] = s.level
  const skills = SKILL_ORDER.map(type => {
    const level = skillByType[type] ?? 0
    return { level, tier: SKILL_LV_TIER[level] ?? 0 }
  })

  // 武器
  const weaponInfo = DataLoader.getWeaponById(roleCard.weapon.id)

  // 共鸣链解锁数
  const cons = roleCard.chains.filter(c => c.unlock).length

  // 声骸评分 + 主套装图标（按 groupId 出现次数取最多的 1-2 个）
  let echo = null
  try {
    const scored = EchoScorer.scoreCharacter(charId, roleCard.phantoms)
    const groupCount = {}
    for (const p of roleCard.phantoms) {
      if (p.groupId) groupCount[p.groupId] = (groupCount[p.groupId] || 0) + 1
    }
    const sets = Object.entries(groupCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([gid]) => Number(gid))
    echo = {
      score: scored?.setScore ?? null,
      grade: scored?.setGrade || "-",
      sets,
    }
  } catch {
    echo = null
  }

  return {
    id: charId,
    name: charInfo.name,
    star: Number(charInfo.rarity) || 4,
    element: charInfo.element,
    level: roleCard.role.level,
    cons,
    skills,
    weapon: weaponInfo
      ? {
          id: roleCard.weapon.id,
          name: weaponInfo.name,
          star: Number(weaponInfo.rarity) || 3,
          level: roleCard.weapon.level,
          reson: roleCard.weapon.reson, // 谐振阶级 1-5（≈ 精炼）
        }
      : null,
    echo,
  }
}

/**
 * 从 RolePanel 行数组构建练度统计表数据并排序
 * @param {Array} rows RolePanel.getAllByUid 返回的行
 * @returns {Array}
 */
export function buildProfileStats(rows) {
  const avatars = rows.map(r => buildAvatarStat(r.detail)).filter(Boolean)

  // 排序：星级 → 等级 → 共鸣链 → 声骸分
  avatars.sort((a, b) => {
    if (b.star !== a.star) return b.star - a.star
    if (b.level !== a.level) return b.level - a.level
    if (b.cons !== a.cons) return b.cons - a.cons
    return (b.echo?.score || 0) - (a.echo?.score || 0)
  })

  return avatars
}
