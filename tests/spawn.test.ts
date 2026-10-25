import { describe, expect, it } from 'vitest';
import { getLevelConfig, type LevelConfig } from '../src/data/levels';
import { GUEST_ROTATION } from '../src/data/schedule';
import { GUEST_CUTOFF_MS, guestMaySpawn, pickGuestTime, pickSpawn, quietLane, type SpawnState } from '../src/data/spawn';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Plays a level's spawn ticks with random crowding and counts what came out. */
function simulate(cfg: LevelConfig, seed: number) {
  const rand = seeded(seed);
  const dur = cfg.duration * 1000;
  const st: SpawnState = {
    playMs: 0,
    timeLeft: dur,
    alive: 0,
    guestDueAt: cfg.guest ? pickGuestTime(cfg.guest, dur, rand) : Infinity,
    guestSpawned: false,
    guestOnScreen: false,
  };
  let guests = 0;
  let sleepy = 0;
  let total = 0;
  let maxGuestsOnScreen = 0;
  let guestLeavesAt = -1;
  const guestTimes: number[] = [];
  let acc = 0;
  for (; st.playMs < dur; st.playMs += 16, st.timeLeft -= 16) {
    acc += 16;
    st.alive = Math.floor(rand() * (cfg.maxAlive + 1));
    if (guestLeavesAt >= 0 && st.playMs >= guestLeavesAt) {
      st.guestOnScreen = false;
      guestLeavesAt = -1;
    }
    if (acc < cfg.spawnInterval || st.alive >= cfg.maxAlive) continue;
    acc = 0;
    const p = pickSpawn(cfg, st, rand);
    total++;
    if (p.type === 'guest') {
      expect(st.guestOnScreen).toBe(false);
      guests++;
      guestTimes.push(st.playMs);
      st.guestSpawned = true;
      st.guestOnScreen = true;
      guestLeavesAt = st.playMs + 4000;
      maxGuestsOnScreen = Math.max(maxGuestsOnScreen, 1);
    } else if (p.sleepy) sleepy++;
  }
  return { guests, sleepy, total, guestTimes, maxGuestsOnScreen };
}

describe('spawning', () => {
  it('a guest level brings exactly one guest, never in the last 5 seconds', () => {
    for (let level = 4; level <= 120; level++) {
      const cfg = getLevelConfig(level);
      if (!cfg.guest) continue;
      for (let seed = 1; seed <= 12; seed++) {
        const r = simulate(cfg, seed * 97 + level);
        expect(r.guests).toBe(1);
        expect(r.maxGuestsOnScreen).toBeLessThanOrEqual(1);
        for (const t of r.guestTimes) expect(cfg.duration * 1000 - t).toBeGreaterThan(GUEST_CUTOFF_MS);
      }
    }
  });

  it('super, race, quiet hour and plain levels bring no guests', () => {
    for (const level of [1, 2, 5, 6, 8, 10, 12, 19, 26, 40, 41]) {
      const cfg = getLevelConfig(level);
      expect(cfg.guest).toBeNull();
      expect(simulate(cfg, level).guests).toBe(0);
    }
  });

  it('quiet hour fills about half of the spawns with sleepy flies; other levels have none', () => {
    const nap = simulate(getLevelConfig(19), 3);
    expect(nap.sleepy / nap.total).toBeGreaterThan(0.3);
    expect(nap.sleepy / nap.total).toBeLessThan(0.7);
    for (const level of [7, 8, 10, 12]) expect(simulate(getLevelConfig(level), 5).sleepy).toBe(0);
  });

  it('the squeaker and every new guest refuse to appear in the last 5 seconds', () => {
    for (const guest of GUEST_ROTATION) {
      const cfg = { ...getLevelConfig(9), guest };
      for (const timeLeft of [GUEST_CUTOFF_MS, 4000, 1000, 0]) {
        const st: SpawnState = { playMs: 26_000, timeLeft, alive: 0, guestDueAt: 0, guestSpawned: false, guestOnScreen: false };
        expect(guestMaySpawn(cfg, st)).toBe(false);
        expect(pickSpawn(cfg, st, () => 0.9).type).toBe('normal');
      }
      for (let s = 0; s < 50; s++) {
        const at = pickGuestTime(guest, 30_000, seeded(s));
        expect(30_000 - at).toBeGreaterThan(GUEST_CUTOFF_MS);
      }
    }
  });

  it('a guest never pushes the screen past maxAlive and never joins another guest', () => {
    const cfg = getLevelConfig(9);
    const base: SpawnState = { playMs: 20_000, timeLeft: 10_000, alive: 0, guestDueAt: 0, guestSpawned: false, guestOnScreen: false };
    expect(guestMaySpawn(cfg, { ...base, alive: cfg.maxAlive })).toBe(false);
    expect(guestMaySpawn(cfg, { ...base, guestOnScreen: true })).toBe(false);
    expect(guestMaySpawn(cfg, { ...base, guestSpawned: true })).toBe(false);
    expect(guestMaySpawn(cfg, base)).toBe(true);
  });

  it('the thief is due around the middle of the level', () => {
    for (let s = 0; s < 50; s++) {
      const at = pickGuestTime('thief', 30_000, seeded(s));
      expect(at).toBeGreaterThanOrEqual(12_000);
      expect(at).toBeLessThanOrEqual(16_500);
    }
  });

  it('the squeaker lane keeps away from the others', () => {
    const y = quietLane([340, 380, 420], 340, 680);
    expect(y).toBeGreaterThan(600);
  });
});
