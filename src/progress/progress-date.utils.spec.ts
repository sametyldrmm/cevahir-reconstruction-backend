import { BadRequestException } from '@nestjs/common';
import {
  getProgressToday,
  PROGRESS_TIME_ZONE,
  resolveProgressDateRange,
} from './progress-date.utils';

describe('progress-date.utils', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-10T08:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses provided from/to as source of truth when both are present', () => {
    const range = resolveProgressDateRange({
      period: 'current-month',
      from: '2026-03-10',
      to: '2026-03-15',
      timeZone: PROGRESS_TIME_ZONE,
    });

    expect(range).toEqual({
      period: 'current-month',
      from: '2026-03-10',
      to: '2026-03-15',
    });
  });

  it('builds current week preset from Monday to today in Istanbul time', () => {
    const range = resolveProgressDateRange({
      period: 'current-week',
      timeZone: PROGRESS_TIME_ZONE,
    });

    expect(range).toEqual({
      period: 'current-week',
      from: '2026-05-04',
      to: '2026-05-10',
    });
  });

  it('returns today in Europe/Istanbul', () => {
    expect(getProgressToday()).toBe('2026-05-10');
  });

  it('normalizes inverted date inputs', () => {
    const range = resolveProgressDateRange({
      from: '2026-05-10',
      to: '2026-05-01',
      timeZone: PROGRESS_TIME_ZONE,
    });

    expect(range).toEqual({
      period: null,
      from: '2026-05-01',
      to: '2026-05-10',
    });
  });

  it('requires from and to for custom period', () => {
    expect(() =>
      resolveProgressDateRange({
        period: 'custom',
        from: '2026-05-01',
        timeZone: PROGRESS_TIME_ZONE,
      }),
    ).toThrow(BadRequestException);
  });
});
