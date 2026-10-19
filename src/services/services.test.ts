// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: DOMAIN SERVICES UNIT TESTS
// ==============================================================================

import { VotingService } from './votingService';
import { SeasonService } from './seasonService';
import { Artist, Season, ArtistCumulativeStats } from '../types';

export function runDomainServicesTests(): { passed: number; failed: number; errors: string[] } {
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

  // --- 1. VOTING SERVICE TESTS ---
  const votingService = new VotingService('America/Panama');
  const today = votingService.getCompetitionDate();

  const mockCatalog = new Map<string, Artist>([
    ['art-m1', { id: 'art-m1', spotifyArtistId: 'sm1', displayName: 'BTS', searchNormalizedName: 'bts', imageUrl: '', category: 'male', artistType: 'group', musicScene: 'kpop', originCountry: 'KR', status: 'approved', isEligible: true, eligibilityEffectiveDate: '2026-09-01' }],
    ['art-m2', { id: 'art-m2', spotifyArtistId: 'sm2', displayName: 'SKZ', searchNormalizedName: 'skz', imageUrl: '', category: 'male', artistType: 'group', musicScene: 'kpop', originCountry: 'KR', status: 'approved', isEligible: true, eligibilityEffectiveDate: '2026-09-01' }],
    ['art-m3', { id: 'art-m3', spotifyArtistId: 'sm3', displayName: 'SVT', searchNormalizedName: 'svt', imageUrl: '', category: 'male', artistType: 'group', musicScene: 'kpop', originCountry: 'KR', status: 'approved', isEligible: true, eligibilityEffectiveDate: '2026-09-01' }],
    ['art-m4', { id: 'art-m4', spotifyArtistId: 'sm4', displayName: 'TXT', searchNormalizedName: 'txt', imageUrl: '', category: 'male', artistType: 'group', musicScene: 'kpop', originCountry: 'KR', status: 'approved', isEligible: true, eligibilityEffectiveDate: '2026-09-01' }],
    ['art-m5', { id: 'art-m5', spotifyArtistId: 'sm5', displayName: 'ENHA', searchNormalizedName: 'enha', imageUrl: '', category: 'male', artistType: 'group', musicScene: 'kpop', originCountry: 'KR', status: 'approved', isEligible: true, eligibilityEffectiveDate: '2026-09-01' }],
    ['art-f1', { id: 'art-f1', spotifyArtistId: 'sf1', displayName: 'NewJeans', searchNormalizedName: 'nj', imageUrl: '', category: 'female', artistType: 'group', musicScene: 'kpop', originCountry: 'KR', status: 'approved', isEligible: true, eligibilityEffectiveDate: '2026-09-01' }],
  ]);

  // Valid male ballot
  const validResult = votingService.validateBallot(
    {
      seasonId: 's1',
      participantId: 'alex',
      category: 'male',
      competitionDate: today,
      items: [
        { rankPosition: 1, artistId: 'art-m1' },
        { rankPosition: 2, artistId: 'art-m2' },
        { rankPosition: 3, artistId: 'art-m3' },
        { rankPosition: 4, artistId: 'art-m4' },
        { rankPosition: 5, artistId: 'art-m5' },
      ],
    },
    mockCatalog
  );
  assert(validResult.isValid, 'Valid 5-slot ballot must pass validation');

  // Reject duplicate artist
  const dupResult = votingService.validateBallot(
    {
      seasonId: 's1',
      participantId: 'alex',
      category: 'male',
      competitionDate: today,
      items: [
        { rankPosition: 1, artistId: 'art-m1' },
        { rankPosition: 2, artistId: 'art-m1' }, // duplicate
        { rankPosition: 3, artistId: 'art-m3' },
        { rankPosition: 4, artistId: 'art-m4' },
        { rankPosition: 5, artistId: 'art-m5' },
      ],
    },
    mockCatalog
  );
  assert(!dupResult.isValid, 'Ballot with duplicate artist must fail');

  // Reject female artist in male ballot
  const crossCategoryResult = votingService.validateBallot(
    {
      seasonId: 's1',
      participantId: 'alex',
      category: 'male',
      competitionDate: today,
      items: [
        { rankPosition: 1, artistId: 'art-f1' }, // female in male ballot
        { rankPosition: 2, artistId: 'art-m2' },
        { rankPosition: 3, artistId: 'art-m3' },
        { rankPosition: 4, artistId: 'art-m4' },
        { rankPosition: 5, artistId: 'art-m5' },
      ],
    },
    mockCatalog
  );
  assert(!crossCategoryResult.isValid, 'Cross-category artist ballot must fail');

  // Reject incomplete ballot (less than 5 items)
  const shortResult = votingService.validateBallot(
    {
      seasonId: 's1',
      participantId: 'alex',
      category: 'male',
      competitionDate: today,
      items: [
        { rankPosition: 1, artistId: 'art-m1' },
        { rankPosition: 2, artistId: 'art-m2' },
      ],
    },
    mockCatalog
  );
  assert(!shortResult.isValid, 'Ballot with fewer than 5 items must fail');

  // --- 2. SEASON SERVICE TESTS ---
  const seasonService = new SeasonService();
  const activeSeason: Season = {
    id: 's1',
    name: 'Season 1',
    status: 'active',
    startDate: '2026-09-01',
    daysActive: 40,
  };

  // Single active season invariant: cannot create 2nd active season
  const activationCheck = seasonService.canActivateSeason([activeSeason]);
  assert(!activationCheck.allowed, 'Cannot activate second season while one is already active');

  // Can activate if only draft/archived exist
  const archivedSeason: Season = { ...activeSeason, status: 'archived' };
  const canActivateArchived = seasonService.canActivateSeason([archivedSeason]);
  assert(canActivateArchived.allowed, 'Can activate season when existing seasons are archived');

  // Atomic closure of active season
  const mockMaleStats: ArtistCumulativeStats[] = [
    {
      artist: mockCatalog.get('art-m1')!,
      cumulativePoints: 120,
      cumulativeVotePoints: 70,
      cumulativeBonusPoints: 50,
      cumulativeStreams: 300,
      daysWithPoints: 15,
      firstPlaceVotesCount: 6,
      todayPoints: 8,
      todayVotePoints: 5,
      todayListeningBonus: 3,
      todayStreams: 8,
      currentRank: 1,
      previousRank: 1,
      rankDelta: 0,
      isNewEntry: false,
    },
  ];

  const mockFemaleStats: ArtistCumulativeStats[] = [
    {
      artist: mockCatalog.get('art-f1')!,
      cumulativePoints: 95,
      cumulativeVotePoints: 55,
      cumulativeBonusPoints: 40,
      cumulativeStreams: 250,
      daysWithPoints: 12,
      firstPlaceVotesCount: 4,
      todayPoints: 7,
      todayVotePoints: 4,
      todayListeningBonus: 3,
      todayStreams: 6,
      currentRank: 1,
      previousRank: 1,
      rankDelta: 0,
      isNewEntry: false,
    },
  ];

  const closureResult = seasonService.closeSeason(activeSeason, {
    seasonId: 's1',
    adminParticipantId: 'alex',
    adminDisplayName: 'Alex',
    maleStats: mockMaleStats,
    femaleStats: mockFemaleStats,
  });

  assert(closureResult.archivedSeason.status === 'archived', 'Closed season must be archived');
  assert(closureResult.archivedRecord.absoluteChampion.artist.id === 'art-m1', 'Absolute Champion must be art-m1 (120 pts > 95 pts)');
  assert(closureResult.frozenResults.length === 2, 'Must freeze exactly 2 artist result records');

  return { passed, failed, errors };
}
