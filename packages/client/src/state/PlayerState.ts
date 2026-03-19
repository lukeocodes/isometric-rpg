export interface PlayerData {
  characterId: string;
  name: string;
  race: string;
  gender: string;
  level: number;
  str: number;
  dex: number;
  int: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
}

export class PlayerState {
  private data: PlayerData | null = null;

  setPlayerData(data: PlayerData) {
    this.data = data;
  }

  getPlayerData(): PlayerData | null {
    return this.data;
  }

  clear() {
    this.data = null;
  }
}
