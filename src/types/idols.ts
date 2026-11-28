import type { DailyScoringVersion } from '../data/voteRules';
import type { Category, Season } from './index';
export interface Idol { id: string; name: string; group: string; category: Category }
export interface IdolSubmission { seasonId: string; participantId: string; kind: 'favorites' | 'daily'; category: Category | 'all'; competitionDate: string; idolIds: string[]; scoringVersion?: DailyScoringVersion }
export type PeriodicVoteKind = 'weekly_artists' | 'weekly_idols' | 'monthly_artists' | 'monthly_idols';
export interface PeriodicSubmission { seasonId: string; participantId: string; kind: PeriodicVoteKind; periodKey: string; submittedDate: string; selections: { male: string[]; female: string[] }; createdAt?: string }
export interface IdolStanding extends Idol { points: number; favoritePoints: number; votePoints: number; periodicPoints?: number; firstPlaces: number; rank: number }
export interface IdolRankings { male: IdolStanding[]; female: IdolStanding[] }
export interface IdolOverview { season: Season | null; rankings: IdolRankings; catalog: Idol[]; seasons: Season[]; competitionDate: string }
export interface IdolStatus { seasonId: string | null; competitionDate: string; favorites: string[] | null; male: string[] | null; female: string[] | null; dailyScoringVersions?: Partial<Record<Category, DailyScoringVersion>> }
