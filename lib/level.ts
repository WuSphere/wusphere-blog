const LEVEL_EXP_TABLE = [0, 100, 260, 520, 900, 1400, 2100, 3000];

export function getLevelFromExp(exp: number) {
  let level = 1;
  for (let i = 1; i < LEVEL_EXP_TABLE.length; i += 1) {
    if (exp >= LEVEL_EXP_TABLE[i]) {
      level = i + 1;
    }
  }
  return level;
}

export function getCurrentLevelExp(level: number) {
  const index = Math.max(0, Math.min(level - 1, LEVEL_EXP_TABLE.length - 1));
  return LEVEL_EXP_TABLE[index];
}

export function getNextLevelExp(level: number) {
  const index = Math.max(0, Math.min(level, LEVEL_EXP_TABLE.length - 1));
  return LEVEL_EXP_TABLE[index];
}

export function getProgressPercent(exp: number, level: number) {
  const current = getCurrentLevelExp(level);
  const next = getNextLevelExp(level);
  if (next <= current) {
    return 100;
  }
  const ratio = ((exp - current) / (next - current)) * 100;
  return Math.max(0, Math.min(100, ratio));
}
