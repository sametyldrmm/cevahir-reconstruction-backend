/** progress_summary.json ile uyumlu gevşek tipler */

export interface ElementTypeData {
  count: number;
  concrete_m3: number;
  steel_kg: number;
  steel_ton: number;
}

export interface GroupData {
  total_all_elements: number;
  concrete_m3: number;
  steel_kg: number;
  steel_ton: number;
  pile_concrete_m3?: number;
  pile_count?: number;
  by_type: Record<string, ElementTypeData>;
}

export interface ConstructionSummary {
  required: Record<string, GroupData>;
  built: Record<string, GroupData>;
  totals: {
    required: GroupData;
    built: GroupData;
  };
}
