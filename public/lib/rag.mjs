import {corpus,VERIFIED_AT} from '../data/corpus.mjs';
const excluded = /부가가치세|법인세|양도소득|상속세|증여세|주식|가상자산|비트코인|취득세|부양가족|연금저축|노란우산|접대비|차량|자동차|식대|세액공제/;
const aliases=[['경비',['경비','비용','영수증','증빙']],['세율',['세율','누진','구간']],['소득공제',['소득공제','인적공제']],['신고',['신고','기한','언제','마감']],['납부',['환급','납부','원천징수']]];
const topicRules={startup:/사업자\s*등록|등록\s*전|개업|창업|사업\s*시작|콘텐츠|유튜브/,education:/교육비|대학원|등록금|강사/,evidence:/증빙|입증|누락\s*수입|실지조사|추계/,interest:/차입금|대출\s*이자|지급이자|초과인출금|가사관련경비/,household:/가사관련경비|초과인출금/,timing:/귀속\s*(시기|연도)|이전\s*과세기간|비용\s*이월|수익\s*비용\s*대응/,depreciation:/감가상각|고정자산|가구|비품/};
const normalizeNumber=text=>text.toLowerCase().replace(/[^가-힣a-z0-9]/g,'');
export function validateQuestion(q) {
 if(typeof q!=='string'||q.trim().length<4) throw new Error('궁금한 내용을 4자 이상 적어 주세요.');
 if(q.trim().length>2000) throw new Error('질문을 2,000자 이내로 줄여 주세요.');
 if(/\d{6}[-\s]?[1-8]\d{6}|\b\d{3}[- ]?\d{2}[- ]?\d{5}\b|sk-(?:proj-)?[a-zA-Z0-9_-]{16,}/.test(q)) throw new Error('주민등록번호·사업자등록번호·API 키는 지운 뒤 질문해 주세요.');
 return q.trim();
}
function terms(text){return text.toLowerCase().match(/[가-힣a-z0-9]+/g)||[];}
export function retrieve(question,{year=2025,limit=5}={}){
 const q=validateQuestion(question);
 const documentQuery=/판례|회신|사례|사건|서면|두\d{3,}/.test(q);
 const otherYears=[...q.matchAll(/(20\d{2})\s*년/g)].some(m=>Number(m[1])!==2025);
 if(year!==2025 || excluded.test(q) || (otherYears&&(!documentQuery||/년\s*귀속/.test(q)))) return [];
 const topics=Object.entries(topicRules).filter(([,pattern])=>pattern.test(q)).map(([topic])=>topic);
 const onlyCases=/판례|대법원/.test(q)&&!/회신/.test(q);
 const onlyRulings=/질의회신|국세청\s*회신|서면/.test(q)&&!/판례/.test(q);
 const normalized=normalizeNumber(q);
 const exact=corpus.find(d=>d.number&&normalized.includes(normalizeNumber(d.number.split(' [')[0])));
 if(exact)return [exact,...(exact.pairedIds||[]).map(id=>corpus.find(d=>d.id===id)).filter(Boolean)].slice(0,Math.max(1,Math.min(limit,5))).map(d=>({...d,score:100}));
 if(/\d{2,4}(?:두|누|구합|구단)\d+|서면[-\s]\d{4}[-\s]/.test(q))return [];
 const expanded=new Set(terms(q));
 for(const [canonical,words] of aliases) if(words.some(w=>q.includes(w))) expanded.add(canonical);
 const ranked=corpus.filter(d=>(d.years.includes(year)||d.referenceOnly)&&(!onlyCases||d.kind==='판례')&&(!onlyRulings||d.kind==='질의회신')).map(d=>{
   const tags=d.tags.filter(tag=>[...expanded].some(t=>t.includes(tag)||tag.includes(t)));
   let score=tags.length*3;
   for(const t of expanded) if(t.length>1 && d.title.includes(t))score+=2;
   const matchingTopics=(d.topics||[]).filter(t=>topics.includes(t));
   const exactNumber=d.number&&normalized.includes(normalizeNumber(d.number.split(' [')[0]));
   if(exactNumber)score+=100;
   if(d.referenceOnly){if(topics.length&&!matchingTopics.length&&!exactNumber)score=0;else score+=matchingTopics.length*12;}
   return {...d,score};
 }).filter(d=>d.score>=3).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 const maximum=Math.max(1,Math.min(limit,5)),selected=ranked.slice(0,maximum);
 for(const d of [...selected])for(const id of d.pairedIds||[]){if(maximum>1&&!selected.some(x=>x.id===id)){const paired=ranked.find(x=>x.id===id);if(paired){if(selected.length>=maximum)selected.pop();selected.push(paired);}}}
 return selected;
}
export function answerQuestion(question){
 const q=validateQuestion(question),sources=retrieve(q);
 if(!sources.length)return {question:q,mode:'local',status:'insufficient',year:2025,verifiedAt:VERIFIED_AT,sources:[],
   message:'수록한 자료만으로는 답하기 어려워요.',next:'2025년 사업소득의 기본세율·계산 순서 또는 수록한 경비 사례를 질문해 주세요. 모든 세목·공제·회신·판례를 수록한 것은 아니에요.'};
 return {question:q,mode:'local',status:'grounded',year:2025,verifiedAt:VERIFIED_AT,sources,
   message:'찾은 공식 자료에서 확인한 내용이에요.',next:'과거 회신·판례는 당시 사실관계의 참고 자료예요. 현재 사안의 적용 법령·귀속연도·사실관계는 별도로 확인해 주세요.'};
}
