/** Front / docs ile uyumlu görünürlük — admin API ve session çıktısı */
export interface EffectiveVisibility {
  showDashboard: boolean;
  showConcrete: boolean;
  showSteel: boolean;
  showElementCounts: boolean;
  showPileMetrics: boolean;
  showIfcBreakdown: boolean;
  showCharts: boolean;
  showFieldReports: boolean;
  showMedia: boolean;
  showPipelineDiagnostics: boolean;
  showElementLevelDetail: boolean;
  visibleBlockIds: string[] | null;
  hiddenBlockIds: string[];
}

export const DEFAULT_VISIBILITY: EffectiveVisibility = {
  showDashboard: true,
  showConcrete: true,
  showSteel: true,
  showElementCounts: true,
  showPileMetrics: true,
  showIfcBreakdown: true,
  showCharts: true,
  showFieldReports: true,
  showMedia: true,
  showPipelineDiagnostics: false,
  showElementLevelDetail: true,
  visibleBlockIds: null,
  hiddenBlockIds: [],
};

export const ADMIN_VISIBILITY: EffectiveVisibility = {
  ...DEFAULT_VISIBILITY,
  showPipelineDiagnostics: true,
};

/** JSON profil anahtarları (kısmi override) */
export const FEATURE_FLAG_KEYS = [
  'showDashboard',
  'showConcrete',
  'showSteel',
  'showElementCounts',
  'showPileMetrics',
  'showIfcBreakdown',
  'showCharts',
  'showFieldReports',
  'showMedia',
  'showPipelineDiagnostics',
  'showElementLevelDetail',
] as const satisfies readonly (keyof EffectiveVisibility)[];

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export function mergeVisibility(
  base: EffectiveVisibility,
  patch: Partial<Record<string, boolean>> | null | undefined,
  visibleBlockIds: string[] | null | undefined,
  hiddenBlockIds: string[] | null | undefined,
): EffectiveVisibility {
  const out = { ...base };
  if (patch) {
    for (const k of FEATURE_FLAG_KEYS) {
      if (k in patch && typeof patch[k] === 'boolean') {
        (out as any)[k] = patch[k];
      }
    }
  }
  if (visibleBlockIds !== undefined) {
    out.visibleBlockIds =
      visibleBlockIds === null ? null : [...visibleBlockIds];
  }
  if (hiddenBlockIds !== undefined && hiddenBlockIds !== null) {
    out.hiddenBlockIds = [...hiddenBlockIds];
  }
  return out;
}
