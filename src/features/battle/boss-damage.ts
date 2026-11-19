export interface BossDamageResult {
  damage: number;
  is_crit: boolean;
}

export function rollBossDamage(playerLevel: number): BossDamageResult {
  const dmgDist = Math.floor(Math.random() * (35 - 15 + 1)) + 15;
  let baseDmg = playerLevel * dmgDist;

  const isCrit = Math.random() * 100 <= 15;
  if (isCrit) {
    baseDmg *= 3;
  }

  return { damage: baseDmg, is_crit: isCrit };
}
