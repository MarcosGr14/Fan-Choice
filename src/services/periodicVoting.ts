import { periodicLimits, pointsForPeriodicPosition, validVoteCount } from '../data/voteRules';
import type { PeriodicSubmission, PeriodicVoteKind } from '../types/idols';
import { today } from './dates';

export function currentPeriod(kind: PeriodicVoteKind, date = today()): string {
  if (kind.startsWith('monthly')) return date.slice(0,7);
  const value = new Date(`${date}T12:00:00Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value.toISOString().slice(0,10);
}

export function periodicPoints(rows: PeriodicSubmission[], seasonId: string, kind: PeriodicVoteKind, targetIds: string[], category: 'male'|'female', periodKey?: string, asOfDate?: string) {
  const totals = new Map<string,number>();
  for (const row of rows) {
    if (row.seasonId!==seasonId || row.kind!==kind || (periodKey && row.periodKey!==periodKey) || (asOfDate&&row.submittedDate>asOfDate)) continue;
    row.selections[category].forEach((id,index)=>{
      const points = pointsForPeriodicPosition(kind, index + 1);
      totals.set(id,(totals.get(id)||0)+points);
    });
  }
  return targetIds.map(id=>({id,points:totals.get(id)||0}));
}

export function validSelections(kind: PeriodicVoteKind, selections: unknown, catalogs: {artists:{id:string;category:string;status?:string;isEligible?:boolean;artistType?:string}[];idols:{id:string;category:string}[]}) {
  if (!selections || typeof selections!=='object') return false;
  const value=selections as {male?:unknown;female?:unknown};
  for (const category of ['male','female'] as const) {
    const ids=value[category];
    const isArtist=kind.endsWith('artists');
    if(!Array.isArray(ids)||!validVoteCount(ids.length, periodicLimits[kind])||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length) return false;
    const catalog: {id:string;category:string;status?:string;isEligible?:boolean;artistType?:string}[]=isArtist?catalogs.artists:catalogs.idols;
    if(ids.some(id=>!catalog.some(item=>item.id===id&&item.category===category&&(!isArtist||(item.status==='approved'&&item.isEligible)))))return false;
  }
  return true;
}
