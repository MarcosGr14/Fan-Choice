// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: DETERMINISTIC SCORING ENGINE TESTS
// ==============================================================================

import {
  calculateListeningBonus,
  getPointsForPosition,
  aggregateBallotVotes,
  compareArtists,
  rankLadder,
  determineAbsoluteChampion,
  DEFAULT_BONUS_TIERS,
} from './scoringEngine';
import { Artist, DailyBallot, ArtistCumulativeStats } from '../types';

export function runScoringEngineTests(): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, testName: string) {
    if (condition) {
      passed++;
    } else {
      failed++;
      errors.push(`Assertion failed: ${testName}`);
    }
  }

  // 1. Position-to-points mapping
  assert(getPointsForPosition(1) === 5, '1st place must award 5 points');
  assert(getPointsForPosition(2) === 4, '2nd place must award 4 points');
  assert(getPointsForPosition(3) === 3, '3rd place must award 3 points');
  assert(getPointsForPosition(4) === 2, '4th place must award 2 points');
  assert(getPointsForPosition(5) === 1, '5th place must award 1 point');
  assert(getPointsForPosition(6) === 0, 'Out-of-bounds position must award 0 points');

  // 2. Stream bonus tier mapping
  assert(calculateListeningBonus(0) === 0, '0 streams must yield 0 bonus points');
  assert(calculateListeningBonus(1) === 1, '1 stream must yield 1 bonus point');
  assert(calculateListeningBonus(2) === 1, '2 streams must yield 1 bonus point');
  assert(calculateListeningBonus(3) === 2, '3 streams must yield 2 bonus points');
  assert(calculateListeningBonus(5) === 2, '5 streams must yield 2 bonus points');
  assert(calculateListeningBonus(6) === 3, '6 streams must yield 3 bonus points');
  assert(calculateListeningBonus(9) === 3, '9 streams must yield 3 bonus points');
  assert(calculateListeningBonus(10) === 4, '10 streams must yield 4 bonus points');
  assert(calculateListeningBonus(15) === 4, '15 streams must yield 4 bonus points');
  assert(calculateListeningBonus(16) === 5, '16 streams must yield 5 bonus points');
  assert(calculateListeningBonus(50) === 5, '50 streams must yield 5 bonus points (max tier)');

  // 3. Category Vote Aggregation across two participants
  const mockBallots: DailyBallot[] = [
    {
      id: 'b1',
      seasonId: 's1',
      participantId: 'alex',
      category: 'male',
      competitionDate: '2026-10-17',
      isLocked: true,
      updatedAt: '2026-10-17T20:00:00Z',
      items: [
        { rankPosition: 1, artistId: 'bts', pointsAwarded: 5 },
        { rankPosition: 2, artistId: 'skz', pointsAwarded: 4 },
        { rankPosition: 3, artistId: 'svt', pointsAwarded: 3 },
        { rankPosition: 4, artistId: 'txt', pointsAwarded: 2 },
        { rankPosition: 5, artistId: 'kaze', pointsAwarded: 1 },
      ],
    },
    {
      id: 'b2',
      seasonId: 's1',
      participantId: 'sam',
      category: 'male',
      competitionDate: '2026-10-17',
      isLocked: true,
      updatedAt: '2026-10-17T20:05:00Z',
      items: [
        { rankPosition: 1, artistId: 'bts', pointsAwarded: 5 }, // 5 + 5 = 10 max
        { rankPosition: 2, artistId: 'svt', pointsAwarded: 4 }, // 3 + 4 = 7
        { rankPosition: 3, artistId: 'skz', pointsAwarded: 3 }, // 4 + 3 = 7
        { rankPosition: 4, artistId: 'kaze', pointsAwarded: 2 }, // 1 + 2 = 3
        { rankPosition: 5, artistId: 'enhypen', pointsAwarded: 1 },
      ],
    },
  ];

  const aggregatedMale = aggregateBallotVotes(mockBallots, 'male');
  assert(aggregatedMale.get('bts')?.votePoints === 10, 'BTS should have 10 combined vote points');
  assert(aggregatedMale.get('bts')?.firstPlaceCount === 2, 'BTS should have 2 first-place votes');
  assert(aggregatedMale.get('svt')?.votePoints === 7, 'SEVENTEEN should have 7 combined vote points');
  assert(aggregatedMale.get('skz')?.votePoints === 7, 'Stray Kids should have 7 combined vote points');

  // 4. Deterministic Tie-Breaker Tests
  const baseArtistA: Artist = {
    id: 'art-a',
    spotifyArtistId: 'spot-a',
    displayName: 'Artist Alpha',
    searchNormalizedName: 'artist alpha',
    imageUrl: '',
    category: 'male',
    artistType: 'group',
    musicScene: 'kpop',
    originCountry: 'KR',
    status: 'approved',
    isEligible: true,
    eligibilityEffectiveDate: '2026-09-01',
  };

  const baseArtistB: Artist = {
    id: 'art-b',
    spotifyArtistId: 'spot-b',
    displayName: 'Artist Beta',
    searchNormalizedName: 'artist beta',
    imageUrl: '',
    category: 'male',
    artistType: 'group',
    musicScene: 'kpop',
    originCountry: 'KR',
    status: 'approved',
    isEligible: true,
    eligibilityEffectiveDate: '2026-09-01',
  };

  // Test Tie-Breaker 1: Vote dominance
  const statsA: ArtistCumulativeStats = {
    artist: baseArtistA,
    cumulativePoints: 100,
    cumulativeVotePoints: 60, // higher vote points
    cumulativeBonusPoints: 40,
    cumulativeStreams: 300,
    daysWithPoints: 10,
    firstPlaceVotesCount: 4,
    todayPoints: 8,
    todayVotePoints: 5,
    todayListeningBonus: 3,
    todayStreams: 8,
    currentRank: 1,
    previousRank: 1,
    rankDelta: 0,
    isNewEntry: false,
  };

  const statsB: ArtistCumulativeStats = {
    artist: baseArtistB,
    cumulativePoints: 100, // equal total points
    cumulativeVotePoints: 50, // lower vote points
    cumulativeBonusPoints: 50,
    cumulativeStreams: 400,
    daysWithPoints: 10,
    firstPlaceVotesCount: 4,
    todayPoints: 8,
    todayVotePoints: 4,
    todayListeningBonus: 4,
    todayStreams: 12,
    currentRank: 2,
    previousRank: 2,
    rankDelta: 0,
    isNewEntry: false,
  };

  const cmpResult = compareArtists(statsA, statsB);
  assert(cmpResult < 0, 'Artist Alpha with higher vote points must win tie-breaker 1');

  // Test Tie-Breaker 2: Stream volume when points and vote points tie
  const statsA2 = { ...statsA, cumulativeVotePoints: 50, cumulativeStreams: 500 };
  const statsB2 = { ...statsB, cumulativeVotePoints: 50, cumulativeStreams: 300 };
  assert(compareArtists(statsA2, statsB2) < 0, 'Artist Alpha with higher streams must win tie-breaker 2');

  // Test Tie-Breaker 3: Consistency (days with points)
  const statsA3 = { ...statsA2, cumulativeStreams: 500, daysWithPoints: 12 };
  const statsB3 = { ...statsB2, cumulativeStreams: 500, daysWithPoints: 8 };
  assert(compareArtists(statsA3, statsB3) < 0, 'Artist Alpha with more days scored must win tie-breaker 3');

  // Test Tie-Breaker 4: 1st place votes count
  const statsA4 = { ...statsA3, daysWithPoints: 10, firstPlaceVotesCount: 5 };
  const statsB4 = { ...statsB3, daysWithPoints: 10, firstPlaceVotesCount: 2 };
  assert(compareArtists(statsA4, statsB4) < 0, 'Artist Alpha with more 1st place votes must win tie-breaker 4');

  // Test Tie-Breaker 5: Lexicographical stability (spotifyArtistId ascending)
  const statsA5 = { ...statsA4, firstPlaceVotesCount: 3, artist: { ...baseArtistA, spotifyArtistId: 'spot-01' } };
  const statsB5 = { ...statsB4, firstPlaceVotesCount: 3, artist: { ...baseArtistB, spotifyArtistId: 'spot-02' } };
  assert(compareArtists(statsA5, statsB5) < 0, 'Artist Alpha with spot-01 must rank ahead of spot-02 in tie-breaker 5');

  // Test rankLadder and rankDelta calculation
  const prevRanks = new Map<string, number>([
    ['art-a', 3], // Was #3, now #1 -> climbed +2
    ['art-b', 1], // Was #1, now #2 -> dropped -1
  ]);
  const ranked = rankLadder([statsB, statsA], prevRanks);
  assert(ranked[0].artist.id === 'art-a', 'Rank 1 must be Artist Alpha');
  assert(ranked[0].currentRank === 1, 'Current rank must be 1');
  assert(ranked[0].rankDelta === 2, 'Rank delta must be +2 (climbed from 3 to 1)');
  assert(ranked[1].artist.id === 'art-b', 'Rank 2 must be Artist Beta');
  assert(ranked[1].currentRank === 2, 'Current rank must be 2');
  assert(ranked[1].rankDelta === -1, 'Rank delta must be -1 (dropped from 1 to 2)');

  // Test Absolute Champion determination
  const champion = determineAbsoluteChampion([statsB, statsA]);
  assert(champion?.artist.id === 'art-a', 'Champion must be Artist Alpha');

  return { passed, failed, errors };
}
