/**
 * Small deterministic PRNG so the seeded dataset is identical on every run,
 * on the server and in the browser.
 */

/** cyrb53 string hash → 32-bit seed. */
export function hashSeed(input: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0) ^ (h1 >>> 0);
}

export interface Random {
  /** Uniform in [0, 1). */
  next(): number;
  /** Standard normal (mean 0, sd 1). */
  normal(): number;
  /** Multiplicative log-normal noise centred on 1. */
  jitter(sigma: number): number;
  /** Poisson-distributed integer with the given mean. */
  poisson(mean: number): number;
}

/** mulberry32 generator. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const jitter = (sigma: number) => Math.exp(sigma * normal() - (sigma * sigma) / 2);
  const poisson = (mean: number) => {
    if (mean <= 0) return 0;
    if (mean > 40) return Math.max(0, Math.round(mean + Math.sqrt(mean) * normal()));
    const limit = Math.exp(-mean);
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= next();
    } while (p > limit);
    return k - 1;
  };
  return { next, normal, jitter, poisson };
}
