import type { Category, Season } from './index';
export interface Idol { id: string; name: string; group: string; category: Category }
export interface IdolSubmission { seasonId: string; participantId: string; kind: 'favorites' | 'daily'; category: Category | 'all'; competitionDate: string; idolIds: string[] }
export interface IdolStanding extends Idol { points: number; favoritePoints: number; votePoints: number; firstPlaces: number; rank: number }
export interface IdolRankings { male: IdolStanding[]; female: IdolStanding[] }
export interface IdolOverview { season: Season | null; rankings: IdolRankings; catalog: Idol[]; seasons: Season[]; competitionDate: string }
export interface IdolStatus { seasonId: string | null; competitionDate: string; favorites: string[] | null; male: string[] | null; female: string[] | null }
