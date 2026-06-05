import { describe, expect, it } from "bun:test";
import { mergeNeteaseCookies } from "../meting-cookie";

describe("mergeNeteaseCookies", () => {
  it("appends MUSIC_U when user pastes token value only", () => {
    const base = "osver=android; appver=8.7.01";
    expect(mergeNeteaseCookies(base, "abc123")).toBe(
      "osver=android; appver=8.7.01; MUSIC_U=abc123",
    );
  });

  it("replaces existing MUSIC_U while keeping base cookies", () => {
    const base = "osver=android; appver=8.7.01";
    expect(mergeNeteaseCookies(base, "MUSIC_U=new-token")).toBe(
      "osver=android; appver=8.7.01; MUSIC_U=new-token",
    );
  });

  it("merges multiple user cookie parts", () => {
    const base = "osver=android";
    expect(mergeNeteaseCookies(base, "MUSIC_U=vip; __csrf=abc")).toBe(
      "osver=android; MUSIC_U=vip; __csrf=abc",
    );
  });
});
