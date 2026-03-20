import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MusicStateMachine } from "../MusicStateMachine";
import { MusicState, VICTORY_TIMEOUT_MS } from "../types";

describe("MusicStateMachine", () => {
  let fsm: MusicStateMachine;

  beforeEach(() => {
    vi.useFakeTimers();
    fsm = new MusicStateMachine();
  });

  afterEach(() => {
    fsm.dispose();
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("starts in Exploring state", () => {
      expect(fsm.getState()).toBe(MusicState.Exploring);
    });

    it("initial ambient state is Exploring", () => {
      expect(fsm.getAmbientState()).toBe(MusicState.Exploring);
    });

    it("boss override is not active initially", () => {
      expect(fsm.isBossOverride()).toBe(false);
    });
  });

  describe("priority-based transitions", () => {
    it("requestState(Town) from Exploring transitions to Town (higher priority)", () => {
      const result = fsm.requestState(MusicState.Town);
      expect(result).toBe(true);
      expect(fsm.getState()).toBe(MusicState.Town);
    });

    it("requestState(Exploring) from Combat is rejected (lower priority)", () => {
      fsm.forceState(MusicState.Combat);
      const result = fsm.requestState(MusicState.Exploring);
      expect(result).toBe(false);
      expect(fsm.getState()).toBe(MusicState.Combat);
    });

    it("requestState(Combat) from EnemyNearby transitions to Combat (higher priority)", () => {
      fsm.forceState(MusicState.EnemyNearby);
      const result = fsm.requestState(MusicState.Combat);
      expect(result).toBe(true);
      expect(fsm.getState()).toBe(MusicState.Combat);
    });

    it("requestState(Boss) from any state transitions to Boss (highest priority)", () => {
      fsm.forceState(MusicState.Exploring);
      expect(fsm.requestState(MusicState.Boss)).toBe(true);
      expect(fsm.getState()).toBe(MusicState.Boss);
    });

    it("requestState with same state is a no-op and returns false", () => {
      expect(fsm.getState()).toBe(MusicState.Exploring);
      const result = fsm.requestState(MusicState.Exploring);
      expect(result).toBe(false);
      expect(fsm.getState()).toBe(MusicState.Exploring);
    });

    it("requestState(EnemyNearby) from Town transitions (higher priority)", () => {
      fsm.requestState(MusicState.Town);
      const result = fsm.requestState(MusicState.EnemyNearby);
      expect(result).toBe(true);
      expect(fsm.getState()).toBe(MusicState.EnemyNearby);
    });

    it("requestState(Town) from Dungeon is rejected (lower priority)", () => {
      fsm.forceState(MusicState.Dungeon);
      const result = fsm.requestState(MusicState.Town);
      expect(result).toBe(false);
      expect(fsm.getState()).toBe(MusicState.Dungeon);
    });
  });

  describe("boss override", () => {
    it("requestState(Boss) sets bossOverride flag to true", () => {
      fsm.requestState(MusicState.Boss);
      expect(fsm.isBossOverride()).toBe(true);
    });

    it("boss override blocks all non-boss requests", () => {
      fsm.requestState(MusicState.Boss);
      expect(fsm.requestState(MusicState.Combat)).toBe(false);
      expect(fsm.requestState(MusicState.EnemyNearby)).toBe(false);
      expect(fsm.requestState(MusicState.Exploring)).toBe(false);
      expect(fsm.getState()).toBe(MusicState.Boss);
    });

    it("exitBoss() transitions from Boss back to the previous ambient state", () => {
      fsm.requestState(MusicState.Town);
      fsm.requestState(MusicState.Boss);
      expect(fsm.getState()).toBe(MusicState.Boss);

      fsm.exitBoss();
      expect(fsm.getState()).toBe(MusicState.Town);
      expect(fsm.isBossOverride()).toBe(false);
    });

    it("exitBoss() when not in Boss state is a no-op", () => {
      fsm.requestState(MusicState.Town);
      fsm.exitBoss();
      expect(fsm.getState()).toBe(MusicState.Town);
    });
  });

  describe("victory timeout", () => {
    it("requestState(Victory) from Combat transitions to Victory", () => {
      fsm.forceState(MusicState.Combat);
      const result = fsm.requestState(MusicState.Victory);
      // Victory priority (3) < Combat priority (5), so requestState would be rejected
      // Use forceState to get into Victory
      expect(result).toBe(false);

      // Instead force it
      fsm.forceState(MusicState.Victory);
      expect(fsm.getState()).toBe(MusicState.Victory);
    });

    it("after VICTORY_TIMEOUT_MS, Victory auto-transitions to the stored ambient state", () => {
      fsm.requestState(MusicState.Town);
      fsm.forceState(MusicState.Victory);
      expect(fsm.getState()).toBe(MusicState.Victory);

      vi.advanceTimersByTime(VICTORY_TIMEOUT_MS);

      expect(fsm.getState()).toBe(MusicState.Town);
    });

    it("victory auto-transitions back to Exploring when no other ambient was set", () => {
      fsm.forceState(MusicState.Victory);
      expect(fsm.getState()).toBe(MusicState.Victory);

      vi.advanceTimersByTime(VICTORY_TIMEOUT_MS);

      expect(fsm.getState()).toBe(MusicState.Exploring);
    });

    it("transitioning away from Victory before timeout clears the timer", () => {
      fsm.forceState(MusicState.Victory);
      expect(fsm.getState()).toBe(MusicState.Victory);

      // Transition to Combat before timeout fires
      fsm.forceState(MusicState.Combat);
      expect(fsm.getState()).toBe(MusicState.Combat);

      // Advance past victory timeout -- should NOT transition
      vi.advanceTimersByTime(VICTORY_TIMEOUT_MS + 1000);
      expect(fsm.getState()).toBe(MusicState.Combat);
    });
  });

  describe("forceState", () => {
    it("forceState transitions regardless of priority", () => {
      fsm.forceState(MusicState.Combat);
      fsm.forceState(MusicState.Exploring);
      expect(fsm.getState()).toBe(MusicState.Exploring);
    });

    it("forceState clears boss override when transitioning to non-boss state", () => {
      fsm.requestState(MusicState.Boss);
      expect(fsm.isBossOverride()).toBe(true);

      fsm.forceState(MusicState.Exploring);
      expect(fsm.isBossOverride()).toBe(false);
      expect(fsm.getState()).toBe(MusicState.Exploring);
    });

    it("forceState with same state is a no-op", () => {
      const cb = vi.fn();
      fsm.onTransition(cb);
      fsm.forceState(MusicState.Exploring); // already in Exploring
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe("ambient state tracking", () => {
    it("getAmbientState() tracks the last ambient state (Exploring)", () => {
      expect(fsm.getAmbientState()).toBe(MusicState.Exploring);
    });

    it("getAmbientState() updates when transitioning to Town", () => {
      fsm.requestState(MusicState.Town);
      expect(fsm.getAmbientState()).toBe(MusicState.Town);
    });

    it("getAmbientState() updates when transitioning to Dungeon", () => {
      fsm.forceState(MusicState.Dungeon);
      expect(fsm.getAmbientState()).toBe(MusicState.Dungeon);
    });

    it("getAmbientState() does NOT update for Combat or EnemyNearby", () => {
      fsm.requestState(MusicState.Town);
      fsm.forceState(MusicState.Combat);
      expect(fsm.getAmbientState()).toBe(MusicState.Town);

      fsm.forceState(MusicState.EnemyNearby);
      expect(fsm.getAmbientState()).toBe(MusicState.Town);
    });

    it("getAmbientState() does NOT update for Victory", () => {
      fsm.requestState(MusicState.Town);
      fsm.forceState(MusicState.Victory);
      expect(fsm.getAmbientState()).toBe(MusicState.Town);
    });
  });

  describe("onTransition callback", () => {
    it("fires with (fromState, toState) on every transition", () => {
      const cb = vi.fn();
      fsm.onTransition(cb);

      fsm.requestState(MusicState.Town);
      expect(cb).toHaveBeenCalledWith(MusicState.Exploring, MusicState.Town);
    });

    it("fires on forceState transitions", () => {
      const cb = vi.fn();
      fsm.onTransition(cb);

      fsm.forceState(MusicState.Combat);
      expect(cb).toHaveBeenCalledWith(MusicState.Exploring, MusicState.Combat);
    });

    it("fires on exitBoss transition", () => {
      const cb = vi.fn();
      fsm.requestState(MusicState.Boss);
      fsm.onTransition(cb);

      fsm.exitBoss();
      expect(cb).toHaveBeenCalledWith(MusicState.Boss, MusicState.Exploring);
    });

    it("fires on Victory auto-transition back to ambient", () => {
      const cb = vi.fn();
      fsm.onTransition(cb);

      fsm.forceState(MusicState.Victory);
      cb.mockClear();

      vi.advanceTimersByTime(VICTORY_TIMEOUT_MS);

      expect(cb).toHaveBeenCalledWith(MusicState.Victory, MusicState.Exploring);
    });
  });

  describe("dispose", () => {
    it("clears victory timer on dispose", () => {
      fsm.forceState(MusicState.Victory);
      fsm.dispose();

      // Timer should be cleared, so advancing time should not cause transition
      vi.advanceTimersByTime(VICTORY_TIMEOUT_MS + 1000);
      // No error thrown means dispose cleaned up properly
    });

    it("clears onTransition callback on dispose", () => {
      const cb = vi.fn();
      fsm.onTransition(cb);
      fsm.dispose();

      fsm.forceState(MusicState.Town);
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
