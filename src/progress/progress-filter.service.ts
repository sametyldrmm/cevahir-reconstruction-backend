import { Injectable } from '@nestjs/common';
import type { EffectiveVisibility } from '../access/domain/visibility.types';
import type {
  ConstructionSummary,
  ElementTypeData,
  GroupData,
} from './domain/progress.types';

@Injectable()
export class ProgressFilterService {
  filterSummary(
    raw: ConstructionSummary,
    v: EffectiveVisibility,
  ): ConstructionSummary {
    const reqKeys = Object.keys(raw.required).filter((k) => k !== 'totals');
    let blocks = reqKeys;

    if (v.visibleBlockIds?.length) {
      const allow = new Set(v.visibleBlockIds);
      blocks = blocks.filter((k) => allow.has(k));
    }
    if (v.hiddenBlockIds?.length) {
      const deny = new Set(v.hiddenBlockIds);
      blocks = blocks.filter((k) => !deny.has(k));
    }

    const required: Record<string, GroupData> = {};
    const built: Record<string, GroupData> = {};

    for (const key of blocks) {
      const r = raw.required[key];
      const b = raw.built[key];
      if (r) required[key] = this.maskGroup(structuredClone(r), v);
      if (b) built[key] = this.maskGroup(structuredClone(b), v);
    }

    const totalsRequired = this.aggregate(Object.values(required));
    const totalsBuilt = this.aggregate(Object.values(built));

    return {
      required,
      built,
      totals: {
        required: this.maskGroup(totalsRequired, v),
        built: this.maskGroup(totalsBuilt, v),
      },
    };
  }

  private maskGroup(g: GroupData, v: EffectiveVisibility): GroupData {
    if (!v.showIfcBreakdown) {
      g.by_type = {};
    }
    if (!v.showPileMetrics) {
      delete g.pile_concrete_m3;
      delete g.pile_count;
    }
    if (!v.showSteel) {
      g.steel_kg = 0;
      g.steel_ton = 0;
      for (const t of Object.keys(g.by_type || {})) {
        const row = g.by_type[t];
        if (row) {
          row.steel_kg = 0;
          row.steel_ton = 0;
        }
      }
    }
    if (!v.showConcrete) {
      g.concrete_m3 = 0;
      for (const t of Object.keys(g.by_type || {})) {
        const row = g.by_type[t];
        if (row) row.concrete_m3 = 0;
      }
    }
    if (!v.showElementCounts) {
      g.total_all_elements = 0;
      for (const t of Object.keys(g.by_type || {})) {
        const row = g.by_type[t];
        if (row) row.count = 0;
      }
    }
    return g;
  }

  private aggregate(groups: GroupData[]): GroupData {
    if (groups.length === 0) {
      return {
        total_all_elements: 0,
        concrete_m3: 0,
        steel_kg: 0,
        steel_ton: 0,
        by_type: {},
      };
    }
    const byType: Record<string, ElementTypeData> = {};
    let total_all_elements = 0;
    let concrete_m3 = 0;
    let steel_kg = 0;
    let steel_ton = 0;
    let pile_concrete_m3 = 0;
    let pile_count = 0;
    let hasPile = false;
    let hasPileCount = false;

    for (const g of groups) {
      total_all_elements += g.total_all_elements || 0;
      concrete_m3 += g.concrete_m3 || 0;
      steel_kg += g.steel_kg || 0;
      steel_ton += g.steel_ton || 0;
      if (g.pile_concrete_m3 != null) {
        pile_concrete_m3 += g.pile_concrete_m3;
        hasPile = true;
      }
      if (g.pile_count != null) {
        pile_count += g.pile_count;
        hasPileCount = true;
      }
      for (const [type, row] of Object.entries(g.by_type || {})) {
        if (!byType[type]) {
          byType[type] = {
            count: 0,
            concrete_m3: 0,
            steel_kg: 0,
            steel_ton: 0,
          };
        }
        byType[type].count += row.count || 0;
        byType[type].concrete_m3 += row.concrete_m3 || 0;
        byType[type].steel_kg += row.steel_kg || 0;
        byType[type].steel_ton += row.steel_ton || 0;
      }
    }

    const out: GroupData = {
      total_all_elements,
      concrete_m3,
      steel_kg,
      steel_ton,
      by_type: byType,
    };
    if (hasPile) out.pile_concrete_m3 = pile_concrete_m3;
    if (hasPileCount) out.pile_count = pile_count;
    return out;
  }

  filterDetailBlock(
    raw: Record<string, unknown>,
    blockId: string,
    v: EffectiveVisibility,
  ): Record<string, unknown> | null {
    if (!v.showElementLevelDetail) {
      return null;
    }
    const required = raw.required as Record<string, unknown> | undefined;
    const built = raw.built as Record<string, unknown> | undefined;
    if (!required?.[blockId] && !built?.[blockId]) {
      return null;
    }

    const vis = v.visibleBlockIds;
    if (vis?.length && !vis.includes(blockId)) return null;
    if (v.hiddenBlockIds?.includes(blockId)) return null;

    const out: Record<string, unknown> = {};
    const reqSlice = required?.[blockId];
    const builtSlice = built?.[blockId];

    if (reqSlice && typeof reqSlice === 'object') {
      const r = structuredClone(reqSlice) as Record<string, unknown>;
      if (!v.showIfcBreakdown && r.by_type) delete r.by_type;
      if (!v.showPileMetrics) {
        delete r.pile_count;
        delete r.pile_concrete_m3;
        delete r.pile_concrete_kg;
      }
      if (!v.showSteel) this.zeroSteelInBlock(r);
      if (!v.showConcrete) this.zeroConcreteInBlock(r);
      if (!v.showElementCounts && r.elements) delete r.elements;
      out.required = { [blockId]: r };
    }

    if (builtSlice && typeof builtSlice === 'object') {
      const b = structuredClone(builtSlice) as Record<string, unknown>;
      if (!v.showIfcBreakdown && b.by_type) delete b.by_type;
      if (!v.showPileMetrics) {
        delete b.pile_count;
        delete b.pile_concrete_m3;
        delete b.pile_concrete_kg;
      }
      if (!v.showSteel) this.zeroSteelInBlock(b);
      if (!v.showConcrete) this.zeroConcreteInBlock(b);
      if (!v.showElementCounts) {
        delete b.element_count;
        delete b.total_all_elements;
      }
      out.built = { [blockId]: b };
    }

    if (v.showPipelineDiagnostics && raw.summary && typeof raw.summary === 'object') {
      out.summary = raw.summary;
    }

    if (Object.keys(out).length === 0) {
      return null;
    }

    return out;
  }

  private zeroSteelInBlock(block: Record<string, unknown>) {
    if (typeof block.total_steel_kg === 'number') block.total_steel_kg = 0;
    const bt = block.by_type as Record<string, Record<string, number>> | undefined;
    if (bt) {
      for (const k of Object.keys(bt)) {
        const row = bt[k];
        if (row) {
          row.steel_kg = 0;
          row.steel_ton = 0;
        }
      }
    }
    const els = block.elements as Record<string, Record<string, unknown>> | undefined;
    if (els) {
      for (const el of Object.values(els)) {
        if (typeof el.steel_kg === 'number') el.steel_kg = 0;
      }
    }
  }

  private zeroConcreteInBlock(block: Record<string, unknown>) {
    for (const k of [
      'total_concrete_m3',
      'total_concrete_kg',
      'ongoing_concrete_m3',
      'completed_concrete_m3',
    ]) {
      if (typeof block[k] === 'number') (block as Record<string, number>)[k] = 0;
    }
    const bt = block.by_type as Record<string, Record<string, number>> | undefined;
    if (bt) {
      for (const row of Object.values(bt)) {
        if (row) row.concrete_m3 = 0;
      }
    }
    const els = block.elements as Record<string, Record<string, unknown>> | undefined;
    if (els) {
      for (const el of Object.values(els)) {
        if (typeof el.concrete_m3 === 'number') el.concrete_m3 = 0;
        if (typeof el.concrete_kg === 'number') el.concrete_kg = 0;
      }
    }
  }
}
