import { describe, expect, it } from 'vitest';
import { getLevelConfig, type LevelConfig } from '../src/data/levels';
import { GUEST_ROTATION } from '../src/data/schedule';
import { PAIR_KINDS, type FlyerKind } from '../src/data/species';
import {
  GUEST_CUTOFF_MS,
  guestMaySpawn,
  pickGuestTime,
  pickSpawn,
  quietLane,
  rollMix,
  type KindCounts,
  type SpawnState,
} from '../src/data/spawn';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const idle = (over: Partial<SpawnState> = {}): SpawnState => ({
  playMs: 0,
  timeLeft: 30_000,
  alive: 0,
  guestDueAt: Infinity,
  guestSpawned: false,
  guestOnScreen: false,
  counts: {},
  ...over,
});

/** Plays a level's spawn ticks with random crowding and counts what came out. */
function simulate(cfg: LevelConfig, seed: number) {
  const rand = seeded(seed);
  const dur = cfg.duration * 1000;
  const counts: KindCounts = {};
  const st = idle({ timeLeft: dur, guestDueAt: cfg.guest ? pickGuestTime(cfg.guest, dur, rand) : Infinity, counts });
  let guests = 0;
  let total = 0;
  let pairs = 0;
  let maxGuestsOnScreen = 0;
  let guestLeavesAt = -1;
  const guestTimes: number[] = [];
  const firstAt: Partial<Record<FlyerKind, number>> = {};
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
      continue;
    }
    const n = p.type === 'pair' ? 2 : 1;
    if (p.type === 'pair') pairs++;
    counts[p.kind] = (counts[p.kind] ?? 0) + n;
    firstAt[p.kind] ??= st.playMs;
  }
  return { guests, total, pairs, counts, guestTimes, maxGuestsOnScreen, firstAt };
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

  it('super, quiet hour, plain levels and the first race bring no guests', () => {
    for (const level of [1, 2, 5, 6, 8, 10, 12, 19, 26, 40]) {
      const cfg = getLevelConfig(level);
      expect(cfg.guest).toBeNull();
      expect(simulate(cfg, level).guests).toBe(0);
    }
  });

  it('quiet hour fills about half of the spawns with sleepy flies', () => {
    const nap = simulate(getLevelConfig(19), 3);
    const sleepy = nap.counts.sleepy ?? 0;
    expect(sleepy / nap.total).toBeGreaterThan(0.3);
    expect(sleepy / nap.total).toBeLessThan(0.7);
  });

  it('a freshly met kind flies once or twice, and shows up early enough to be seen', () => {
    for (const [level, kind] of [
      [2, 'gold'],
      [3, 'gold'],
      [4, 'sleepy'],
      [6, 'mosquito'],
      [7, 'fat'],
    ] as const) {
      for (let seed = 1; seed <= 10; seed++) {
        const r = simulate(getLevelConfig(level), seed * 31 + level);
        const n = r.counts[kind] ?? 0;
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(2);
        expect(r.firstAt[kind]!).toBeLessThan(getLevelConfig(level).duration * 1000 * 0.4);
      }
    }
  });

  it('every kind of the level really flies in it', () => {
    for (let level = 1; level <= 60; level++) {
      const cfg = getLevelConfig(level);
      const r = simulate(cfg, level * 7);
      for (const s of cfg.mix) expect(r.counts[s.kind] ?? 0).toBeGreaterThan(0);
      for (const k of Object.keys(r.counts)) expect(cfg.mix.map((m) => m.kind)).toContain(k);
    }
  });

  it('level 1 is only ordinary flies', () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(Object.keys(simulate(getLevelConfig(1), seed).counts)).toEqual(['fly']);
    }
  });

  it('super levels keep pairs, with specials among them so it is not all grey', () => {
    for (const level of [5, 10, 15, 20, 25, 30]) {
      const r = simulate(getLevelConfig(level), level);
      expect(r.pairs / r.total).toBeGreaterThan(0.5);
      const special = Object.entries(r.counts).filter(([k]) => k !== 'fly');
      expect(special.length).toBeGreaterThan(0);
    }
  });

  it('pairs are only of kinds that can fly as a pair', () => {
    const cfg = getLevelConfig(20);
    const rand = seeded(9);
    for (let i = 0; i < 300; i++) {
      const p = pickSpawn(cfg, idle({ playMs: 20_000 }), rand);
      if (p.type === 'pair') expect(PAIR_KINDS).toContain(p.kind);
    }
  });

  it('the roll respects caps', () => {
    const slots = [
      { kind: 'fly' as const, weight: 1, cap: Infinity, fresh: false },
      { kind: 'gold' as const, weight: 100, cap: 2, fresh: true },
    ];
    expect(rollMix(slots, { gold: 1 }, 0.5)).toBe('gold');
    expect(rollMix(slots, { gold: 2 }, 0.5)).toBe('fly');
    expect(rollMix([slots[1]], { gold: 2 }, 0.5)).toBeNull();
  });

  it('the squeaker and every new guest refuse to appear in the last 5 seconds', () => {
    for (const guest of GUEST_ROTATION) {
      const cfg = { ...getLevelConfig(9), guest };
      for (const timeLeft of [GUEST_CUTOFF_MS, 4000, 1000, 0]) {
        const st = idle({ playMs: 26_000, timeLeft, guestDueAt: 0 });
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
    const base = idle({ playMs: 20_000, timeLeft: 10_000, guestDueAt: 0 });
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
