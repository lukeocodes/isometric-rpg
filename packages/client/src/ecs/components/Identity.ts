export interface IdentityComponent {
  type: "identity";
  entityId: string;
  name: string;
  entityType: "player" | "npc" | "object";
  isLocal: boolean; // true for the player's own character
}

export function createIdentity(
  entityId: string,
  name: string,
  entityType: "player" | "npc" | "object" = "player",
  isLocal = false,
): IdentityComponent {
  return { type: "identity", entityId, name, entityType, isLocal };
}
