// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: DOMAIN TYPES & DATA TRANSFER OBJECTS
// ==============================================================================

export type Category = 'male' | 'female';
export type ArtistType = 'soloist' | 'group';
export type GroupType = 'boy_group' | 'girl_group' | 'mixed_group';
export type MusicScene = 'kpop' | 'jpop' | 'both';
export type ArtistStatus = 'approved' | 'pending' | 'deactivated';
export type SeasonStatus = 'draft' | 'active' | 'archived';
export type ParticipantRole = 'participant' | 'admin';
export type SyncStatus = 'success' | 'partial' | 'failed';

export interface Participant {
  id: string;
  username: string;
  displayName: string;
  role: ParticipantRole;
  avatarUrl?: string;
}

export interface Artist {
  id: string;
  spotifyArtistId: string;
  displayName: string;
  searchNormalizedName: string;
  imageUrl: string;
  category: Category;
  artistType: ArtistType;
  groupType?: GroupType;
  musicScene: MusicScene;
  originCountry: string; // e.g. 'KR', 'JP'
  status: ArtistStatus;
  isEligible: boolean;
  eligibilityEffectiveDate: string; // YYYY-MM-DD
}

export interface BallotItem {
  rankPosition: 1 | 2 | 3 | 4 | 5;
  artistId: string;
  pointsAwarded: 5 | 4 | 3 | 2 | 1;
}

export interface DailyBallot {
  id: string;
  seasonId: string;
  participantId: string;
  category: Category;
  competitionDate: string; // YYYY-MM-DD
  isLocked: boolean;
  items: BallotItem[];
  updatedAt: string;
}

export interface DailyArtistListeningRecord {
  spotifyArtistId: string;
  artistName: string;
  imageUrl?: string;
  competitionDate: string;
  account1Streams: number;
  account2Streams: number;
  combinedStreams: number;
  dataStatus: 'available' | 'incomplete' | 'unavailable' | 'mock';
}

export interface StreamBonusTier {
  minStreams: number;
  maxStreams: number | null; // null for unbounded (e.g. 16+)
  bonusPoints: number;
}

export interface ArtistDailyScore {
  artistId: string;
  competitionDate: string;
  votePoints: number; // 0..10
  listeningBonus: number; // 0..5
  totalDailyPoints: number; // 0..15
  dailyStreams: number;
  account1Streams: number;
  account2Streams: number;
}

export interface ArtistCumulativeStats {
  artist: Artist;
  cumulativePoints: number;
  cumulativeVotePoints: number;
  cumulativeBonusPoints: number;
  cumulativeStreams: number;
  daysWithPoints: number;
  firstPlaceVotesCount: number;
  todayPoints: number;
  todayVotePoints: number;
  todayListeningBonus: number;
  todayStreams: number;
  currentRank: number;
  previousRank: number;
  rankDelta: number; // positive = climbed, negative = dropped, 0 = unchanged
  isNewEntry: boolean;
}

export interface Season {
  id: string;
  name: string;
  description?: string;
  status: SeasonStatus;
  startDate: string; // YYYY-MM-DD
  closedAt?: string;
  closedBy?: string;
  daysActive: number;
}

export interface SeasonFrozenResult {
  artistId: string;
  category: Category;
  finalRank: number;
  isCategoryChampion: boolean;
  isAbsoluteChampion: boolean;
  finalPoints: number;
  totalVotePoints: number;
  totalBonusPoints: number;
  totalStreams: number;
  daysScored: number;
}

export interface ArchivedSeasonRecord {
  idolRankings?: import('./idols').IdolRankings;
  season: Season;
  closedAt: string;
  closedByDisplayName: string;
  absoluteChampion: ArtistCumulativeStats;
  maleTop10: ArtistCumulativeStats[];
  femaleTop10: ArtistCumulativeStats[];
  totalVotesCast: number;
  totalStreamsLogged: number;
}

export interface LeagueSnapshot {
  season: Season | null;
  absoluteChampion: ArtistCumulativeStats | null;
  maleTop10: ArtistCumulativeStats[];
  femaleTop10: ArtistCumulativeStats[];
  todayHighlights: {
    biggestGainer: { artist: Artist; delta: number } | null;
    topDailyPoints: { artist: Artist; points: number } | null;
    newEntries: Artist[];
  };
  lastSync: {
    timestamp: string;
    isMock: boolean;
    status: SyncStatus;
    totalRecords: number;
  };
}
