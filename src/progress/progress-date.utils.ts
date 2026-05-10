import { BadRequestException } from '@nestjs/common';

export const PROGRESS_TIME_ZONE = 'Europe/Istanbul';
export const ISO_DATE_STRING_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const PROGRESS_PERIODS = [
  'current-month',
  'current-week',
  'current-quarter',
  'current-year',
  'custom',
] as const;

export type ProgressPeriod = (typeof PROGRESS_PERIODS)[number];

export interface ProgressDateRangeInput {
  period?: ProgressPeriod;
  from?: string;
  to?: string;
  timeZone?: string;
}

export interface ProgressDateRange {
  period: ProgressPeriod | null;
  from: string;
  to: string;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function normalizeProgressDataDate(value?: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }

  return assertValidIsoDate(value, 'dataDate');
}

export function getProgressToday(timeZone = PROGRESS_TIME_ZONE): string {
  return getTodayInTimeZone(timeZone);
}

export function resolveProgressDateRange(
  input: ProgressDateRangeInput,
): ProgressDateRange | null {
  const period = input.period ?? null;
  const from = normalizeOptionalIsoDate(input.from, 'from');
  const to = normalizeOptionalIsoDate(input.to, 'to');

  if (!period && !from && !to) {
    return null;
  }

  if (period === 'custom' && (!from || !to)) {
    throw new BadRequestException('from and to are required when period=custom');
  }

  const today = getTodayInTimeZone(input.timeZone ?? PROGRESS_TIME_ZONE);
  const presetRange = period ? buildPresetRange(period, today) : null;

  let effectiveFrom = from;
  let effectiveTo = to;

  if (!effectiveFrom && !effectiveTo) {
    effectiveFrom = presetRange?.from ?? today;
    effectiveTo = presetRange?.to ?? today;
  } else if (period && period !== 'custom') {
    effectiveFrom = effectiveFrom ?? presetRange?.from ?? today;
    effectiveTo = effectiveTo ?? presetRange?.to ?? today;
  } else {
    effectiveFrom = effectiveFrom ?? effectiveTo ?? today;
    effectiveTo = effectiveTo ?? effectiveFrom ?? today;
  }

  if (effectiveFrom > effectiveTo) {
    return {
      period,
      from: effectiveTo,
      to: effectiveFrom,
    };
  }

  return {
    period,
    from: effectiveFrom,
    to: effectiveTo,
  };
}

export function assertValidIsoDate(value: string, label: string): string {
  const normalized = value.trim();
  if (!ISO_DATE_STRING_REGEX.test(normalized)) {
    throw new BadRequestException(`${label} must be in YYYY-MM-DD format`);
  }

  const parts = parseIsoDateParts(normalized, label);
  return formatDate(parts);
}

function normalizeOptionalIsoDate(value: string | undefined, label: string): string | null {
  if (!value?.trim()) {
    return null;
  }

  return assertValidIsoDate(value, label);
}

function buildPresetRange(
  period: ProgressPeriod,
  today: string,
): Omit<ProgressDateRange, 'period'> | null {
  if (period === 'custom') {
    return null;
  }

  const todayParts = parseIsoDateParts(today, 'today');

  switch (period) {
    case 'current-month':
      return {
        from: formatDate({
          year: todayParts.year,
          month: todayParts.month,
          day: 1,
        }),
        to: today,
      };
    case 'current-week':
      return {
        from: startOfWeek(todayParts),
        to: today,
      };
    case 'current-quarter':
      return {
        from: formatDate({
          year: todayParts.year,
          month: Math.floor((todayParts.month - 1) / 3) * 3 + 1,
          day: 1,
        }),
        to: today,
      };
    case 'current-year':
      return {
        from: formatDate({
          year: todayParts.year,
          month: 1,
          day: 1,
        }),
        to: today,
      };
    default:
      return null;
  }
}

function getTodayInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new BadRequestException(`Unable to resolve current date for time zone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

function startOfWeek(parts: DateParts): string {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);

  return formatDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

function parseIsoDateParts(value: string, label: string): DateParts {
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new BadRequestException(`${label} must be in YYYY-MM-DD format`);
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${label} must be in YYYY-MM-DD format`);
  }

  return { year, month, day };
}

function formatDate(parts: DateParts): string {
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}
