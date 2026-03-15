import { describe, it, expect } from "vitest";
import { clusterPlayersByAvailability, computeOverlapScore, type PlayerAvailability } from "../clustering.js";
import type { SimpleAvailabilitySlot } from "../bulkScheduler.js";

function avail(...slots: Array<[string, number, number]>): SimpleAvailabilitySlot[] {
  return slots.map(([day, startHour, endHour]) => ({ day, startHour, endHour }));
}

function player(id: string, slots: SimpleAvailabilitySlot[]): PlayerAvailability {
  return { playerId: id, playerName: `Player ${id}`, slots };
}

describe("computeOverlapScore", () => {
  it("returns 0 for no overlap", () => {
    const a = avail(["monday", 8, 12]);
    const b = avail(["friday", 18, 21]);
    expect(computeOverlapScore(a, b)).toBe(0);
  });

  it("returns 0 for same day but no time overlap", () => {
    const a = avail(["monday", 8, 10]);
    const b = avail(["monday", 14, 18]);
    expect(computeOverlapScore(a, b)).toBe(0);
  });

  it("counts 2-hour windows in overlap", () => {
    const a = avail(["saturday", 8, 14]);  // 6 hours
    const b = avail(["saturday", 10, 16]); // overlap: 10-14 = 4 hours = 3 windows (10-12, 11-13, 12-14)
    expect(computeOverlapScore(a, b)).toBe(3);
  });

  it("counts across multiple days", () => {
    const a = avail(["saturday", 10, 12], ["sunday", 10, 12]);
    const b = avail(["saturday", 10, 12], ["sunday", 10, 12]);
    // Each day: 10-12 = 1 window of 2 hours, total 2
    expect(computeOverlapScore(a, b)).toBe(2);
  });

  it("returns 0 for overlap shorter than match duration", () => {
    const a = avail(["monday", 10, 11]); // 1 hour
    const b = avail(["monday", 10, 11]); // overlap: 1 hour, need 2
    expect(computeOverlapScore(a, b)).toBe(0);
  });
});

describe("clusterPlayersByAvailability", () => {
  it("returns single group for 4-8 players (no clustering needed)", () => {
    const players = Array.from({ length: 6 }, (_, i) =>
      player(`p${i}`, avail(["saturday", 10, 14]))
    );
    const result = clusterPlayersByAvailability(players);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]!.players).toHaveLength(6);
    expect(result.waitlisted).toHaveLength(0);
  });

  it("clusters players with similar availability together", () => {
    // Group A: weekend mornings
    const weekendPlayers = Array.from({ length: 6 }, (_, i) =>
      player(`weekend-${i}`, avail(["saturday", 8, 14], ["sunday", 8, 14]))
    );
    // Group B: weekday evenings
    const weekdayPlayers = Array.from({ length: 6 }, (_, i) =>
      player(`weekday-${i}`, avail(["tuesday", 18, 22], ["thursday", 18, 22]))
    );

    const result = clusterPlayersByAvailability([...weekendPlayers, ...weekdayPlayers]);

    expect(result.groups.length).toBeGreaterThanOrEqual(2);
    // Total players in groups should equal input
    const totalInGroups = result.groups.reduce((sum, g) => sum + g.players.length, 0);
    expect(totalInGroups + result.waitlisted.length).toBe(12);
  });

  it("respects max group size", () => {
    const players = Array.from({ length: 16 }, (_, i) =>
      player(`p${i}`, avail(["saturday", 8, 14], ["sunday", 8, 14], ["tuesday", 18, 22]))
    );

    const result = clusterPlayersByAvailability(players, { maxGroupSize: 8 });

    for (const group of result.groups) {
      expect(group.players.length).toBeLessThanOrEqual(8);
    }
  });

  it("handles players with zero availability", () => {
    const normal = Array.from({ length: 6 }, (_, i) =>
      player(`p${i}`, avail(["saturday", 10, 14]))
    );
    const empty = player("empty", []);

    const result = clusterPlayersByAvailability([...normal, empty]);

    // Empty player should still be placed somewhere (single group scenario since <= 8)
    const totalPlaced = result.groups.reduce((s, g) => s + g.players.length, 0);
    expect(totalPlaced + result.waitlisted.length).toBe(7);
  });

  it("assigns all players across groups", () => {
    // 20 players with varied availability
    const players: PlayerAvailability[] = [];
    for (let i = 0; i < 20; i++) {
      const day = i % 2 === 0 ? "saturday" : "sunday";
      players.push(player(`p${i}`, avail([day, 8, 14], ["tuesday", 18, 22])));
    }

    const result = clusterPlayersByAvailability(players);

    const totalPlaced = result.groups.reduce((s, g) => s + g.players.length, 0);
    expect(totalPlaced + result.waitlisted.length).toBe(20);
  });

  it("every group has at least minGroupSize players", () => {
    const players = Array.from({ length: 16 }, (_, i) =>
      player(`p${i}`, avail(["saturday", 8, 14], ["sunday", 8, 14]))
    );

    const result = clusterPlayersByAvailability(players, { minGroupSize: 4 });

    for (const group of result.groups) {
      expect(group.players.length).toBeGreaterThanOrEqual(4);
    }
  });
});
