export type BuildingConfig = {
  id: string;
  label: string;
  xPct: number;
  yPct: number;
};

export const BUILDINGS: BuildingConfig[] = [
  { id: "bank-vault", label: "Bank Vault", xPct: 28, yPct: 32 },
  { id: "watchtower", label: "Watchtower", xPct: 58, yPct: 22 },
  { id: "archives", label: "Archives", xPct: 45, yPct: 46 },
  { id: "armory", label: "Armory", xPct: 68, yPct: 55 },
  { id: "docks", label: "Docks", xPct: 24, yPct: 63 },
  { id: "radio-tower", label: "Radio Tower", xPct: 75, yPct: 34 },
];

export const BUILDINGS_BY_ID: Record<string, BuildingConfig> = Object.fromEntries(
  BUILDINGS.map((b) => [b.id, b])
);

