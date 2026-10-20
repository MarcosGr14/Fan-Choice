import { IDOLS } from '../data/idols';
import type { IdolRankings, IdolSubmission } from '../types/idols';

export function rankIdols(submissions: IdolSubmission[], seasonId: string): IdolRankings {
  const rows = IDOLS.map(idol => ({...idol, points:0, favoritePoints:0, votePoints:0, firstPlaces:0, rank:0}));
  const byId = new Map(rows.map(row => [row.id,row]));
  for (const submission of submissions) {
    if (submission.seasonId !== seasonId) continue;
    submission.idolIds.forEach((id,index) => {
      const row = byId.get(id);
      if (!row) return;
      if (submission.kind === 'favorites') row.favoritePoints += 5;
      else { row.votePoints += 10-index; if (index === 0) row.firstPlaces++; }
      row.points = row.favoritePoints + row.votePoints;
    });
  }
  // Stable final tiebreak guarantees one winner per category, never across categories.
  const sort = (category: 'male' | 'female') => rows.filter(r => r.category===category)
    .sort((a,b) => b.points-a.points || b.firstPlaces-a.firstPlaces || b.votePoints-a.votePoints || a.id.localeCompare(b.id))
    .map((r,index) => ({...r,rank:index+1}));
  return {male:sort('male'),female:sort('female')};
}
