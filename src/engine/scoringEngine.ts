// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: PURE DETERMINISTIC SCORING ENGINE
// ==============================================================================

import {
  Artist,
  DailyBallot,
  DailyArtistListeningRecord,
  StreamBonusTier,
  ArtistDailyScore,
  ArtistCumulativeStats,
  Category,
} from '../types';

/**
 * Default Non-Linear Streaming Bonus Curve
 * Thresholds:
 * 0 streams   -> 0 bonus
 * 1-2 streams -> 1 bonus
 * 3-5 streams -> 2 bonus
 * 6-9 streams -> 3 bonus
 * 10-15 str   -> 4 bonus
 * 16+ streams -> 5 bonus
 */
export const DEFAULT_BONUS_TIERS: StreamBonusTier[] = [
  { minStreams: 1, maxStreams: 2, bonusPoints: 1 },
  { minStreams: 3, maxStreams: 5, bonusPoints: 2 },
  { minStreams: 6, maxStreams: 9, bonusPoints: 3 },
  { minStreams: 10, maxStreams: 15, bonusPoints: 4 },
  { minStreams: 16, maxStreams: null, bonusPoints: 5 },
];

/**
 * Calculates the bonus points for a given stream count against configurable tiers.
 * Pure function: deterministic.
 */
export function calculateListeningBonus(
  streams: number,
  tiers: StreamBonusTier[] = DEFAULT_BONUS_TIERS
): number {
  if (streams <= 0) return 0;
  for (const tier of tiers) {
    if (tier.maxStreams === null) {
      if (streams >= tier.minStreams) return tier.bonusPoints;
    } else {
      if (streams >= tier.minStreams && streams <= tier.maxStreams) {
        return tier.bonusPoints;
      }
    }
  }
  return 0;
}

/**
 * Position-to-points mapping:
 * 1st -> 5 pts
 * 2nd -> 4 pts
 * 3rd -> 3 pts
 * 4th -> 2 pts
 * 5th -> 1 pt
 */
export function getPointsForPosition(position: number): number {
  switch (position) {
    case 1: return 5;
    case 2: return 4;
    case 3: return 3;
    case 4: return 2;
    case 5: return 1;
    default: return 0;
  }
}

/**
 * Computes the aggregated vote points per artist for date D across both participant ballots.
 * Guarantees maximum 10 vote points per artist.
 */
export function aggregateBallotVotes(
  ballots: DailyBallot[],
  category: Category
): Map<string, { votePoints: number; firstPlaceCount: number }> {
  const result = new Map<string, { votePoints: number; firstPlaceCount: number }>();

  // Filter ballots for the requested category
  const activeBallots = ballots.filter((b) => b.category === category);

  for (const ballot of activeBallots) {
    for (const item of ballot.items) {
      const current = result.get(item.artistId) || { votePoints: 0, firstPlaceCount: 0 };
      const points = getPointsForPosition(item.rankPosition);
      current.votePoints += points;
      if (item.rankPosition === 1) {
        current.firstPlaceCount += 1;
      }
      result.set(item.artistId, current);
    }
  }

  return result;
}

/**
 * Computes consolidated daily score for each artist on date D.
 */
export function computeDailyScores(
  artists: Artist[],
  ballots: DailyBallot[],
  listeningRecords: DailyArtistListeningRecord[],
  competitionDate: string,
  bonusTiers: StreamBonusTier[] = DEFAULT_BONUS_TIERS
): Map<string, ArtistDailyScore> {
  const scores = new Map<string, ArtistDailyScore>();

  // Build quick map of streams by spotifyArtistId
  const streamMap = new Map<string, DailyArtistListeningRecord>();
  for (const rec of listeningRecords) {
    streamMap.set(rec.spotifyArtistId, rec);
  }

  // Pre-calculate votes by category
  const maleVotes = aggregateBallotVotes(ballots, 'male');
  const femaleVotes = aggregateBallotVotes(ballots, 'female');

  for (const artist of artists) {
    if (!artist.isEligible || artist.status !== 'approved' || artist.eligibilityEffectiveDate > competitionDate) continue;

    const voteInfo = artist.category === 'male'
      ? maleVotes.get(artist.id)
      : femaleVotes.get(artist.id);

    const votePoints = voteInfo ? voteInfo.votePoints : 0;

    const streamRecord = streamMap.get(artist.spotifyArtistId);
    const combinedStreams = streamRecord ? streamRecord.combinedStreams : 0;
    const account1Streams = streamRecord ? streamRecord.account1Streams : 0;
    const account2Streams = streamRecord ? streamRecord.account2Streams : 0;

    const listeningBonus = calculateListeningBonus(combinedStreams, bonusTiers);
    const totalDailyPoints = votePoints + listeningBonus;

    scores.set(artist.id, {
      artistId: artist.id,
      competitionDate,
      votePoints,
      listeningBonus,
      totalDailyPoints,
      dailyStreams: combinedStreams,
      account1Streams,
      account2Streams,
    });
  }

  return scores;
}

/**
 * Strict 5-Step Deterministic Tie-Breaker Comparator
 * Returns negative if A is ranked higher than B, positive if B is ranked higher than A.
 */
export function compareArtists(a: ArtistCumulativeStats, b: ArtistCumulativeStats): number {
  // 1. Total season points (Descending)
  if (b.cumulativePoints !== a.cumulativePoints) {
    return b.cumulativePoints - a.cumulativePoints;
  }

  // 2. Cumulative vote points (Descending)
  if (b.cumulativeVotePoints !== a.cumulativeVotePoints) {
    return b.cumulativeVotePoints - a.cumulativeVotePoints;
  }

  // 3. Cumulative streams (Descending)
  if (b.cumulativeStreams !== a.cumulativeStreams) {
    return b.cumulativeStreams - a.cumulativeStreams;
  }

  // 4. Days with positive points (Descending)
  if (b.daysWithPoints !== a.daysWithPoints) {
    return b.daysWithPoints - a.daysWithPoints;
  }

  // 5. First-place ballot finishes (Descending)
  if (b.firstPlaceVotesCount !== a.firstPlaceVotesCount) {
    return b.firstPlaceVotesCount - a.firstPlaceVotesCount;
  }

  // 6. Lexicographical stability on spotifyArtistId (Ascending A-Z)
  return a.artist.spotifyArtistId.localeCompare(b.artist.spotifyArtistId);
}

/**
 * Sorts and assigns ladder ranks (1..N) with previous rank deltas (positive = climbed).
 */
export function rankLadder(
  statsList: ArtistCumulativeStats[],
  previousRankMap?: Map<string, number>
): ArtistCumulativeStats[] {
  // Stable sort
  const sorted = [...statsList].sort(compareArtists);

  return sorted.map((item, index) => {
    const currentRank = index + 1;
    const prevRank = previousRankMap?.get(item.artist.id) ?? currentRank;
    // rankDelta: previousRank - currentRank (e.g. from 3 to 1 => 3 - 1 = +2 climbed)
    const rankDelta = previousRankMap ? (prevRank - currentRank) : 0;
    const isNewEntry = previousRankMap ? (!previousRankMap.has(item.artist.id) && currentRank <= 10) : false;

    return {
      ...item,
      currentRank,
      previousRank: prevRank,
      rankDelta,
      isNewEntry,
    };
  });
}

/**
 * Selects the Absolute League Champion across both categories.
 */
export function determineAbsoluteChampion(
  allStats: ArtistCumulativeStats[]
): ArtistCumulativeStats | null {
  if (allStats.length === 0) return null;
  const sorted = [...allStats].sort(compareArtists);
  return sorted[0];
}
