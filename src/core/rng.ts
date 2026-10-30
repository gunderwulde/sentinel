export interface Rng {
  s: number;
}

// mulberry32
export function next(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) | 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextInt(r: Rng, n: number): number {
  return Math.floor(next(r) * n);
}

export function seedFromCode(code: number): number {
  return (Math.imul(code + 1, 2654435761) ^ 0x9e3779b9) >>> 0;
}
