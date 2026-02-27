export type BuildingConfig = {
  id: string;
  label: string;
  xPct: number;
  yPct: number;
  difficulty: number;
  rewardPoints: number;
  penaltyPoints: number;
  cooldownTurns: number;
};

export const BUILDINGS: BuildingConfig[] = [
  {
    id: "bank-vault",
    label: "Bank Vault",
    xPct: 28,
    yPct: 32,
    difficulty: 8,
    rewardPoints: 24,
    penaltyPoints: 2,
    cooldownTurns: 1,
  },
  {
    id: "watchtower",
    label: "Watchtower",
    xPct: 58,
    yPct: 22,
    difficulty: 6,
    rewardPoints: 18,
    penaltyPoints: 1,
    cooldownTurns: 0,
  },
  {
    id: "archives",
    label: "Archives",
    xPct: 45,
    yPct: 46,
    difficulty: 7,
    rewardPoints: 20,
    penaltyPoints: 2,
    cooldownTurns: 1,
  },
  {
    id: "armory",
    label: "Armory",
    xPct: 68,
    yPct: 55,
    difficulty: 9,
    rewardPoints: 28,
    penaltyPoints: 2,
    cooldownTurns: 2,
  },
  {
    id: "docks",
    label: "Docks",
    xPct: 24,
    yPct: 63,
    difficulty: 5,
    rewardPoints: 16,
    penaltyPoints: 1,
    cooldownTurns: 0,
  },
  {
    id: "signal-hub",
    label: "Signal Hub",
    xPct: 78,
    yPct: 36,
    difficulty: 7,
    rewardPoints: 21,
    penaltyPoints: 2,
    cooldownTurns: 1,
  },
];

export const BUILDINGS_BY_ID: Record<string, BuildingConfig> = BUILDINGS.reduce(
  (lookup, building) => {
    lookup[building.id] = building;
    return lookup;
  },
  {} as Record<string, BuildingConfig>
);
