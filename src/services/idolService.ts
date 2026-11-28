import { dailyIdolPoints } from '../data/voteRules';
import { IDOLS } from '../data/idols';
import type { IdolRankings, IdolSubmission } from '../types/idols';
import type { PeriodicSubmission } from '../types/idols';
import { periodicPoints } from './periodicVoting';

export function rankIdols(submissions: IdolSubmission[], seasonId: string, onlySubmitted = false, periodic: PeriodicSubmission[] = []): IdolRankings {
  const submittedIds = onlySubmitted
    ? new Set([...submissions.filter(submission => submission.seasonId === seasonId).flatMap(submission => submission.idolIds),...periodic.filter(v=>v.seasonId===seasonId&&v.kind.endsWith('idols')).flatMap(v=>[...v.selections.male,...v.selections.female])])
    : null;
  const rows = IDOLS.filter(idol => !submittedIds || submittedIds.has(idol.id))
    .map(idol => ({...idol, points:0, favoritePoints:0, votePoints:0, periodicPoints:0, firstPlaces:0, rank:0}));
  const byId = new Map(rows.map(row => [row.id,row]));
  for (const submission of submissions) {
    if (submission.seasonId !== seasonId) continue;
    submission.idolIds.forEach((id,index) => {
      const row = byId.get(id);
      if (!row) return;
      if (submission.kind === 'favorites') row.favoritePoints += 5;
      else { row.votePoints += dailyIdolPoints(index + 1, submission.scoringVersion ?? 1); if (index === 0) row.firstPlaces++; }
      row.points = row.favoritePoints + row.votePoints;
    });
  }
  for (const kind of ['weekly_idols','monthly_idols'] as const) for (const category of ['male','female'] as const) {
    for (const {id,points} of periodicPoints(periodic,seasonId,kind,rows.filter(r=>r.category===category).map(r=>r.id),category)) {
      const row=byId.get(id); if(row){row.periodicPoints=(row.periodicPoints||0)+points;row.points+=points;}
    }
  }
  // Stable final tiebreak guarantees one winner per category, never across categories.
  const sort = (category: 'male' | 'female') => rows.filter(r => r.category===category)
    .sort((a,b) => b.points-a.points || b.firstPlaces-a.firstPlaces || b.votePoints-a.votePoints || a.id.localeCompare(b.id))
    .map((r,index) => ({...r,rank:index+1}));
  return {male:sort('male'),female:sort('female')};
}
