export type ProductTier = "guest" | "free" | "professional" | "team";

export type ProductEntitlement = {
  label: string;
  shortLabel: string;
  cloudProjects: number;
  aiPagesPerMonth: number;
  takeoffExportsPerMonth: number;
  revisionsPerProject: number;
  collaborators: number;
  driveSync: boolean;
  revisionComparison: boolean;
};

export const PRODUCT_ENTITLEMENTS: Record<ProductTier, ProductEntitlement> = {
  guest: {
    label: "Guest preview",
    shortLabel: "Guest",
    cloudProjects: 0,
    aiPagesPerMonth: 10,
    takeoffExportsPerMonth: 0,
    revisionsPerProject: 0,
    collaborators: 0,
    driveSync: false,
    revisionComparison: false,
  },
  free: {
    label: "Free workspace",
    shortLabel: "Free",
    cloudProjects: 2,
    aiPagesPerMonth: 100,
    takeoffExportsPerMonth: 1,
    revisionsPerProject: 3,
    collaborators: 0,
    driveSync: false,
    revisionComparison: false,
  },
  professional: {
    label: "Professional",
    shortLabel: "Pro",
    cloudProjects: 25,
    aiPagesPerMonth: 1500,
    takeoffExportsPerMonth: Number.POSITIVE_INFINITY,
    revisionsPerProject: Number.POSITIVE_INFINITY,
    collaborators: 3,
    driveSync: true,
    revisionComparison: true,
  },
  team: {
    label: "Team",
    shortLabel: "Team",
    cloudProjects: Number.POSITIVE_INFINITY,
    aiPagesPerMonth: 5000,
    takeoffExportsPerMonth: Number.POSITIVE_INFINITY,
    revisionsPerProject: Number.POSITIVE_INFINITY,
    collaborators: Number.POSITIVE_INFINITY,
    driveSync: true,
    revisionComparison: true,
  },
};

export function tierFromProfile(value?: string | null): ProductTier {
  if (value === "professional" || value === "team" || value === "free") return value;
  return "free";
}

export function formatEntitlementLimit(value: number) {
  return Number.isFinite(value) ? String(value) : "Unlimited";
}
