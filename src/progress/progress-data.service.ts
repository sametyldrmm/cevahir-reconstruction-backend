import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Between, In, Repository } from 'typeorm';
import type { ConstructionSummary, GroupData } from './domain/progress.types';
import { ProjectProgressBlock } from './entities/project-progress-block.entity';
import {
  normalizeProgressDataDate,
  type ProgressDateRange,
} from './progress-date.utils';

interface ProjectBlockImportPayload {
  required?: Record<string, GroupData>;
  built?: Record<string, GroupData>;
}

interface LoadSummaryOptions {
  blockNames?: string[];
  dateRange?: Omit<ProgressDateRange, 'period'>;
}

@Injectable()
export class ProgressDataService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(ProjectProgressBlock)
    private readonly blocks: Repository<ProjectProgressBlock>,
  ) {}

  private resolvePath(envKey: string, fallback: string): string {
    const p = this.config.get<string>(envKey);
    const raw = p?.trim() || fallback;
    return path.isAbsolute(raw)
      ? raw
      : path.join(process.cwd(), raw);
  }

  async loadSummary(
    projectId: string,
    options?: LoadSummaryOptions,
  ): Promise<ConstructionSummary> {
    const requiredRows = await this.findProjectBlocks(projectId, options?.blockNames);
    const builtRows = this.selectBuiltRowsForAggregation(
      await this.findProjectBlocks(
        projectId,
        options?.blockNames,
        options?.dateRange,
      ),
      Boolean(options?.dateRange),
    );

    if (requiredRows.length > 0 || builtRows.length > 0) {
      return this.buildSummaryFromRows(requiredRows, builtRows);
    }

    const fallback = this.loadSummaryRoot();
    if (!options?.dateRange) {
      return this.sliceSummaryBlocks(fallback, options?.blockNames);
    }

    return this.zeroBuiltSummary(
      this.sliceSummaryBlocks(fallback, options?.blockNames),
    );
  }

  async loadDetailBlock(
    projectId: string,
    blockId: string,
  ): Promise<Record<string, unknown> | null> {
    const row = await this.blocks.findOne({
      where: {
        projectId,
        blockName: blockId.trim(),
      },
    });
    if (row) {
      return this.buildDetailRoot(row);
    }

    return this.loadDetailRoot();
  }

  async replaceProjectBlocksFromFile(
    projectId: string,
    sourcePath?: string,
    dataDate?: string | null,
  ): Promise<{ importedBlockCount: number; sourcePath: string }> {
    const resolvedPath = this.resolvePath(
      'PROJECT_BLOCK_IMPORT_PATH',
      sourcePath?.trim() || 'data.json',
    );
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`project block import file not found: ${resolvedPath}`);
    }

    const raw = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as ProjectBlockImportPayload;
    const importedBlockCount = await this.replaceProjectBlocks(
      projectId,
      raw,
      dataDate,
    );
    return { importedBlockCount, sourcePath: resolvedPath };
  }

  async replaceProjectBlocksFromUploadedJson(
    projectId: string,
    fileBuffer: Buffer,
    fileName?: string,
    dataDate?: string | null,
  ): Promise<{ importedBlockCount: number; sourceFileName: string | null }> {
    const payload = this.parseProjectBlockPayload(fileBuffer);
    const importedBlockCount = await this.replaceProjectBlocks(
      projectId,
      payload,
      dataDate,
    );

    return {
      importedBlockCount,
      sourceFileName: fileName?.trim() || null,
    };
  }

  async replaceProjectBlocks(
    projectId: string,
    payload: ProjectBlockImportPayload,
    dataDate?: string | null,
  ): Promise<number> {
    const normalized = this.normalizePayload(payload);
    const normalizedDataDate = normalizeProgressDataDate(dataDate);
    const blockNames = new Set([
      ...Object.keys(normalized.required),
      ...Object.keys(normalized.built),
    ]);
    const rows = [...blockNames]
      .sort((a, b) => a.localeCompare(b, 'tr'))
      .map((blockName) =>
        this.blocks.create({
          projectId,
          blockName,
          dataDate: normalizedDataDate,
          requiredData: normalized.required[blockName] ?? null,
          builtData: normalized.built[blockName] ?? null,
        }),
      );

    if (normalizedDataDate) {
      await this.blocks.delete({ projectId, dataDate: normalizedDataDate });
    } else {
      await this.blocks.delete({ projectId });
    }
    if (rows.length > 0) {
      await this.blocks.save(rows);
    }

    return rows.length;
  }

  loadDetailRoot(): Record<string, unknown> {
    const filePath = this.resolvePath(
      'PROGRESS_DETAIL_PATH',
      'data/progress_from_results.json',
    );
    if (!fs.existsSync(filePath)) {
      throw new Error(`progress detail not found: ${filePath}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<
      string,
      unknown
    >;
  }

  private loadSummaryRoot(): ConstructionSummary {
    const filePath = this.resolvePath(
      'PROGRESS_SUMMARY_PATH',
      'data/progress_summary.json',
    );
    if (!fs.existsSync(filePath)) {
      throw new Error(`progress summary not found: ${filePath}`);
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as ConstructionSummary;
  }

  private async findProjectBlocks(
    projectId: string,
    blockNames?: string[],
    dateRange?: Omit<ProgressDateRange, 'period'>,
  ): Promise<ProjectProgressBlock[]> {
    const normalizedNames = blockNames
      ?.map((name) => name.trim())
      .filter((name) => name.length > 0);

    return this.blocks.find({
      where: {
        projectId,
        ...(normalizedNames?.length
          ? { blockName: In(normalizedNames) }
          : {}),
        ...(dateRange
          ? { dataDate: Between(dateRange.from, dateRange.to) }
          : {}),
      },
      order: {
        blockName: 'ASC',
        dataDate: 'DESC',
        updatedAt: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  private buildSummaryFromRows(
    requiredRows: ProjectProgressBlock[],
    builtRows: ProjectProgressBlock[],
  ): ConstructionSummary {
    const required: Record<string, GroupData> = {};
    const builtGroups: Record<string, GroupData[]> = {};

    for (const row of requiredRows) {
      if (row.requiredData && !required[row.blockName]) {
        required[row.blockName] = structuredClone(row.requiredData);
      }
    }

    for (const row of builtRows) {
      if (row.builtData) {
        const bucket = builtGroups[row.blockName] ?? [];
        bucket.push(structuredClone(row.builtData));
        builtGroups[row.blockName] = bucket;
      }
    }

    const built: Record<string, GroupData> = {};
    for (const [blockName, groups] of Object.entries(builtGroups)) {
      built[blockName] = this.aggregate(groups);
    }

    return {
      required,
      built,
      totals: {
        required: this.aggregate(Object.values(required)),
        built: this.aggregate(Object.values(built)),
      },
    };
  }

  private buildDetailRoot(row: ProjectProgressBlock): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (row.requiredData) {
      out.required = {
        [row.blockName]: structuredClone(row.requiredData),
      };
    }
    if (row.builtData) {
      out.built = {
        [row.blockName]: structuredClone(row.builtData),
      };
    }
    return out;
  }

  private normalizePayload(
    payload: ProjectBlockImportPayload,
  ): Required<ProjectBlockImportPayload> {
    return {
      required: payload.required ?? {},
      built: payload.built ?? {},
    };
  }

  private parseProjectBlockPayload(fileBuffer: Buffer): ProjectBlockImportPayload {
    try {
      const parsed = JSON.parse(fileBuffer.toString('utf8')) as ProjectBlockImportPayload;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('JSON root must be an object');
      }

      return parsed;
    } catch (error) {
      throw new BadRequestException('Uploaded file must be a valid JSON object');
    }
  }

  private selectBuiltRowsForAggregation(
    rows: ProjectProgressBlock[],
    hasDateFilter: boolean,
  ): ProjectProgressBlock[] {
    const builtRows = rows.filter((row) => row.builtData != null);
    if (hasDateFilter) {
      return builtRows;
    }

    const selected: ProjectProgressBlock[] = [];
    const rowsByBlock = new Map<string, ProjectProgressBlock[]>();

    for (const row of builtRows) {
      const bucket = rowsByBlock.get(row.blockName) ?? [];
      bucket.push(row);
      rowsByBlock.set(row.blockName, bucket);
    }

    for (const blockRows of rowsByBlock.values()) {
      const datedRows = blockRows.filter((row) => row.dataDate != null);
      selected.push(...(datedRows.length > 0 ? datedRows : blockRows));
    }

    return selected;
  }

  private sliceSummaryBlocks(
    raw: ConstructionSummary,
    blockNames?: string[],
  ): ConstructionSummary {
    const normalizedNames = blockNames
      ?.map((name) => name.trim())
      .filter((name) => name.length > 0);
    const selectedBlocks = normalizedNames?.length
      ? normalizedNames
      : [...new Set([...Object.keys(raw.required), ...Object.keys(raw.built)])];
    const required: Record<string, GroupData> = {};
    const built: Record<string, GroupData> = {};

    for (const blockName of selectedBlocks) {
      const requiredGroup = raw.required[blockName];
      const builtGroup = raw.built[blockName];
      if (requiredGroup) {
        required[blockName] = structuredClone(requiredGroup);
      }
      if (builtGroup) {
        built[blockName] = structuredClone(builtGroup);
      }
    }

    return {
      required,
      built,
      totals: {
        required: this.aggregate(Object.values(required)),
        built: this.aggregate(Object.values(built)),
      },
    };
  }

  private zeroBuiltSummary(summary: ConstructionSummary): ConstructionSummary {
    const built: Record<string, GroupData> = {};
    for (const blockName of Object.keys(summary.built)) {
      built[blockName] = this.aggregate([]);
    }

    return {
      required: summary.required,
      built,
      totals: {
        required: summary.totals.required,
        built: this.aggregate([]),
      },
    };
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

    const byType: GroupData['by_type'] = {};
    let total_all_elements = 0;
    let concrete_m3 = 0;
    let steel_kg = 0;
    let steel_ton = 0;
    let pile_concrete_m3 = 0;
    let pile_count = 0;
    let hasPileConcrete = false;
    let hasPileCount = false;

    for (const group of groups) {
      total_all_elements += group.total_all_elements || 0;
      concrete_m3 += group.concrete_m3 || 0;
      steel_kg += group.steel_kg || 0;
      steel_ton += group.steel_ton || 0;

      if (group.pile_concrete_m3 != null) {
        pile_concrete_m3 += group.pile_concrete_m3;
        hasPileConcrete = true;
      }
      if (group.pile_count != null) {
        pile_count += group.pile_count;
        hasPileCount = true;
      }

      for (const [type, row] of Object.entries(group.by_type || {})) {
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

    return {
      total_all_elements,
      concrete_m3,
      steel_kg,
      steel_ton,
      ...(hasPileConcrete ? { pile_concrete_m3 } : {}),
      ...(hasPileCount ? { pile_count } : {}),
      by_type: byType,
    };
  }
}
