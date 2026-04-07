import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import type { ConstructionSummary } from './domain/progress.types';

@Injectable()
export class ProgressDataService {
  constructor(private readonly config: ConfigService) {}

  private resolvePath(envKey: string, fallback: string): string {
    const p = this.config.get<string>(envKey);
    const raw = p?.trim() || fallback;
    return path.isAbsolute(raw)
      ? raw
      : path.join(process.cwd(), raw);
  }

  loadSummary(): ConstructionSummary {
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
}
