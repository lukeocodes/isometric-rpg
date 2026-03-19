import { describe, it, expect } from "vitest";
import { accounts, characters, worldMaps, chunkData } from "./schema.js";

/**
 * Schema definition tests — verify the Drizzle table shapes
 * are correct. Importing the module also gives us coverage on
 * the pgTable() declarations.
 */

describe("database schema", () => {
  describe("accounts table", () => {
    it("is defined", () => {
      expect(accounts).toBeDefined();
    });

    it("has expected columns", () => {
      const cols = Object.keys(accounts);
      expect(cols).toContain("id");
      expect(cols).toContain("oauthSub");
      expect(cols).toContain("email");
      expect(cols).toContain("displayName");
      expect(cols).toContain("isOnboarded");
    });
  });

  describe("characters table", () => {
    it("is defined", () => {
      expect(characters).toBeDefined();
    });

    it("has stat columns", () => {
      const cols = Object.keys(characters);
      expect(cols).toContain("str");
      expect(cols).toContain("dex");
      expect(cols).toContain("intStat");
    });

    it("has position columns", () => {
      const cols = Object.keys(characters);
      expect(cols).toContain("posX");
      expect(cols).toContain("posY");
      expect(cols).toContain("posZ");
      expect(cols).toContain("mapId");
    });

    it("has appearance columns", () => {
      const cols = Object.keys(characters);
      expect(cols).toContain("hairStyle");
      expect(cols).toContain("hairColor");
      expect(cols).toContain("skinTone");
      expect(cols).toContain("outfit");
    });
  });

  describe("worldMaps table", () => {
    it("is defined with dimension columns", () => {
      expect(worldMaps).toBeDefined();
      const cols = Object.keys(worldMaps);
      expect(cols).toContain("widthChunks");
      expect(cols).toContain("heightChunks");
    });
  });

  describe("chunkData table", () => {
    it("is defined with coordinate columns", () => {
      expect(chunkData).toBeDefined();
      const cols = Object.keys(chunkData);
      expect(cols).toContain("mapId");
      expect(cols).toContain("chunkX");
      expect(cols).toContain("chunkY");
      expect(cols).toContain("tileData");
    });
  });
});
