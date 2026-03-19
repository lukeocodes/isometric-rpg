export interface StatsComponent {
  type: "stats";
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  str: number;
  dex: number;
  int: number;
}

export function createStats(str = 10, dex = 10, int_stat = 10): StatsComponent {
  return {
    type: "stats",
    hp: 50, maxHp: 50,
    mana: 50, maxMana: 50,
    stamina: 50, maxStamina: 50,
    str, dex, int: int_stat,
  };
}
