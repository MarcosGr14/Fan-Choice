import type { PeriodicVoteKind } from '../types/idols';

export const dailyArtistLimits = { min: 5, max: 10 };
export const dailyIdolLimits = { min: 10, max: 25 };
export const periodicLimits = {
  weekly_artists: { min: 10, max: 15 },
  weekly_idols: { min: 10, max: 25 },
  monthly_artists: { min: 1, max: 1 },
  monthly_idols: { min: 2, max: 2 },
} satisfies Record<PeriodicVoteKind, { min: number; max: number }>;

export function validVoteCount(count: number, limits: { min: number; max: number }): boolean {
  return count >= limits.min && count <= limits.max;
}

export const currentDailyScoringVersion = 2;
export type DailyScoringVersion = 1 | typeof currentDailyScoringVersion;

export function dailyArtistPoints(position: number): number {
  if (!Number.isInteger(position) || position < 1 || position > dailyArtistLimits.max) return 0;
  return 5 * (11 - position);
}

export function dailyIdolPoints(
  position: number,
  version: DailyScoringVersion = currentDailyScoringVersion,
): number {
  if (!Number.isInteger(position) || position < 1 || position > dailyIdolLimits.max) return 0;
  if (version === 1) return Math.max(1, 11 - position);
  if (position === 1) return 30;
  if (position <= 5) return 25;
  if (position <= 10) return 20;
  if (position <= 15) return 15;
  return 30 - position;
}

export function pointsForPeriodicPosition(kind: PeriodicVoteKind, position: number): number {
  if (position < 1 || position > periodicLimits[kind].max) return 0;
  switch (kind) {
    case 'weekly_artists': return position === 1 ? 25 : position <= 10 ? 15 : 10;
    case 'weekly_idols': return position === 1 ? 50 : position <= 10 ? 20 : 8;
    case 'monthly_artists': return 50;
    case 'monthly_idols': return position === 1 ? 75 : 50;
  }
}
