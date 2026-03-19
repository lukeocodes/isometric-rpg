export class GameState {
  private state = new Map<string, any>();

  set<T>(key: string, value: T) {
    this.state.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  delete(key: string) {
    this.state.delete(key);
  }

  has(key: string): boolean {
    return this.state.has(key);
  }

  clear() {
    this.state.clear();
  }
}
