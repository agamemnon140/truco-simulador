import { describe, expect, it } from "vitest";
import {
  GENOME_LENGTH,
  fromVector,
  parseGenome,
  randomGenome,
  seedGenome,
  toVector,
} from "../src/players/genome.js";
import { seededRng } from "./helpers.js";

describe("genome", () => {
  it("toVector/fromVector e ida-e-volta", () => {
    const g = seedGenome();
    const v = toVector(g);
    expect(v.length).toBe(GENOME_LENGTH);
    expect(fromVector(v)).toEqual(g);
  });

  it("randomGenome tem o tamanho certo", () => {
    const g = randomGenome(seededRng(3));
    expect(toVector(g).length).toBe(GENOME_LENGTH);
  });

  it("parseGenome aceita um genoma valido e rejeita invalidos", () => {
    const g = seedGenome();
    expect(parseGenome(JSON.parse(JSON.stringify(g)))).toEqual(g);
    expect(() => parseGenome({})).toThrow();
    expect(() => parseGenome({ ...g, cardWeights: [1, 2, 3] })).toThrow();
    expect(() => parseGenome({ ...g, thrCall: "x" })).toThrow();
  });
});
