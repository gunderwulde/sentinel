import type { ObjectKind } from './types';

// Valores marcados [V] en docs/RULES.md: pendientes de verificar contra el original.
export const config = {
  energy: { tree: 1, boulder: 2, synthoid: 3, sentinel: 4 } as Record<ObjectKind, number>,
  startEnergy: 10, // [V]
  hyperspaceCost: 3, // [V]
  boulderHeight: 1,
  pedestalHeight: 1,
  eyeHeight: { synthoid: 1.2, sentinel: 1.6 },
  treesPerLandscape: 14,
  maxTerrainHeight: 8,
  visibilityStep: 0.1, // 0.2 dejaba pasar rayos rasantes a esquinas de rocas/pedestal (~0.35 % de pares)
  ai: {
    turnStepRad: (10 * Math.PI) / 180, // [V]
    turnIntervalTicks: 30, // [V] a 30 Hz = 1 s por paso
    coneHalfRad: (15 * Math.PI) / 180, // [V]
    actCount: 2, // pasos consecutivos viendo el objetivo antes de actuar
  },
  tickHz: 30,
} as const;
