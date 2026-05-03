import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { In, Repository } from 'typeorm';
import type { ConstructionSummary, GroupData } from './domain/progress.types';
import { ProjectProgressBlock } from './entities/project-progress-block.entity';

interface ProjectBlockImportPayload {
  required?: Record<string, GroupData>;
  built?: Record<string, GroupData>;
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
    blockNames?: string[],
  ): Promise<ConstructionSummary> {
    const rows = await this.findProjectBlocks(projectId, blockNames);
    if (rows.length > 0) {
      return this.buildSummaryFromRows(rows);
    }

    const filePath = this.resolvePath(
      'PROGRESS_SUMMARY_PATH',
      'data/progress_summary.json',
    );
    if (!fs.existsSync(filePath)) {
      throw new Error(`progress summary not found: ${filePath}`);
    }
    return JSON.parse(
      fs.readFileSync(filePath, 'utf8'),
    ) as ConstructionSummary;
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
  ): Promise<{ importedBlockCount: number; sourcePath: string }> {
    const resolvedPath = this.resolvePath(
      'PROJECT_BLOCK_IMPORT_PATH',
      sourcePath?.trim() || 'data.json',
    );
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`project block import file not found: ${resolvedPath}`);
    }

    const raw = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as ProjectBlockImportPayload;
    const importedBlockCount = await this.replaceProjectBlocks(projectId, raw);
    return { importedBlockCount, sourcePath: resolvedPath };
  }

  async replaceProjectBlocksFromUploadedJson(
    projectId: string,
    fileBuffer: Buffer,
    fileName?: string,
  ): Promise<{ importedBlockCount: number; sourceFileName: string | null }> {
    const payload = this.parseProjectBlockPayload(fileBuffer);
    const importedBlockCount = await this.replaceProjectBlocks(projectId, payload);

    return {
      importedBlockCount,
      sourceFileName: fileName?.trim() || null,
    };
  }

  async replaceProjectBlocks(
    projectId: string,
    payload: ProjectBlockImportPayload,
  ): Promise<number> {
    const normalized = this.normalizePayload(payload);
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
          requiredData: normalized.required[blockName] ?? null,
          builtData: normalized.built[blockName] ?? null,
        }),
      );

    await this.blocks.delete({ projectId });
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

  private async findProjectBlocks(
    projectId: string,
    blockNames?: string[],
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
      },
      order: {
        blockName: 'ASC',
      },
    });
  }

  private buildSummaryFromRows(rows: ProjectProgressBlock[]): ConstructionSummary {
    const required: Record<string, GroupData> = {};
    const built: Record<string, GroupData> = {};

    for (const row of rows) {
      if (row.requiredData) {
        required[row.blockName] = structuredClone(row.requiredData);
      }
      if (row.builtData) {
        built[row.blockName] = structuredClone(row.builtData);
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
