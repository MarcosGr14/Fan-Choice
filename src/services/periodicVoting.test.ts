import {currentPeriod,periodicPoints,validSelections} from './periodicVoting';
import type {PeriodicSubmission} from '../types/idols';
import {rankIdols} from './idolService';
import {IDOLS} from '../data/idols';

export function runPeriodicVotingTests(){
 let passed=0;const assert=(ok:boolean,msg:string)=>{if(!ok)throw new Error(`Periodic voting: ${msg}`);passed++;};
 assert(currentPeriod('weekly_artists','2026-11-23')==='2026-11-23','weekly period starts Monday');
 assert(currentPeriod('weekly_idols','2026-11-29')==='2026-11-23','Sunday belongs to Monday period');
 assert(currentPeriod('monthly_artists','2026-11-30')==='2026-11','monthly key is stable');
 const votes:PeriodicSubmission[]=[{seasonId:'s',participantId:'p',kind:'weekly_artists',periodKey:'2026-11-23',submittedDate:'2026-11-24',selections:{male:['a','b'],female:['c']}}];
 const points=periodicPoints(votes,'s','weekly_artists',['a','b','z'],'male');
 assert(points.find(x=>x.id==='a')?.points===25,'weekly artist first place gets 25');
 assert(points.find(x=>x.id==='b')?.points===15,'weekly artist second gets 15');
 assert(points.find(x=>x.id==='z')?.points===0,'unselected artist gets zero');
 assert(periodicPoints(votes,'s','weekly_artists',['a'],'male',undefined,'2026-11-23')[0].points===0,'future submissions stay out of historical standings');
 const artists=Array.from({length:10},(_,i)=>({id:`m${i}`,category:'male',artistType:'group',status:'approved',isEligible:true}));
 const idols=Array.from({length:10},(_,i)=>({id:`i${i}`,category:'female'}));
 assert(validSelections('weekly_artists',{male:artists.map(x=>x.id),female:artists.map(x=>`f${x.id.slice(1)}`)},{artists:[...artists,...artists.map((x,i)=>({...x,id:`f${i}`,category:'female'}))],idols}),'valid weekly artist ballot passes');
 assert(!validSelections('monthly_idols',{male:['i0','i1'],female:['i0','i1']},{artists,idols}),'monthly idol ballot rejects cross-category selection');
 assert(!validSelections('weekly_artists',{male:['m0'],female:[]},{artists,idols}),'incomplete ballot is rejected');
 const soloCatalog=[...artists,...artists.map((x,i)=>({...x,id:`f${i}`,category:'female'}))].map((x,i)=>i===0?{...x,artistType:'soloist'}:x);
 assert(!validSelections('weekly_artists',{male:artists.map(x=>x.id),female:artists.map((_,i)=>`f${i}`)},{artists:soloCatalog,idols}),'weekly artist ballots only accept groups');
 const female=IDOLS.filter(i=>i.category==='female').slice(0,2);
 const monthlyIdol:PeriodicSubmission={seasonId:'s',participantId:'p',kind:'monthly_idols',periodKey:'2026-11',submittedDate:'2026-11-24',selections:{male:[],female:female.map(i=>i.id)}};
 const ranked=rankIdols([],'s',false,[monthlyIdol]);
 assert(ranked.female.find(i=>i.id===female[0].id)?.periodicPoints===75,'monthly bias receives 75 idol points');
 assert(ranked.female.find(i=>i.id===female[1].id)?.periodicPoints===50,'monthly wrecker receives 50 idol points');
 return passed;
}
