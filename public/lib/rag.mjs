import {corpus,VERIFIED_AT} from '../data/corpus.mjs';
const excluded = /부가가치세|법인세|양도소득|상속세|증여세|주식|가상자산|비트코인|취득세|부양가족|연금저축|노란우산|접대비|차량|자동차|식대|세액공제|질의회신|판례/;
const aliases=[['경비',['경비','비용','영수증','증빙']],['세율',['세율','누진','구간']],['소득공제',['소득공제','인적공제']],['신고',['신고','기한','언제','마감']],['납부',['환급','납부','원천징수']]];
export function validateQuestion(q) {
 if(typeof q!=='string'||q.trim().length<4) throw new Error('궁금한 내용을 4자 이상 적어 주세요.');
 if(q.trim().length>2000) throw new Error('질문을 2,000자 이내로 줄여 주세요.');
 if(/\d{6}[-\s]?[1-8]\d{6}|\b\d{3}[- ]?\d{2}[- ]?\d{5}\b/.test(q)) throw new Error('주민등록번호·사업자등록번호는 지운 뒤 질문해 주세요.');
 return q.trim();
}
function terms(text){return text.toLowerCase().match(/[가-힣a-z0-9]+/g)||[];}
export function retrieve(question,{year=2025,limit=3}={}){
 const q=validateQuestion(question);
 if(year!==2025 || excluded.test(q) || /202[0-46-9]|203\d/.test(q)) return [];
 const expanded=new Set(terms(q));
 for(const [canonical,words] of aliases) if(words.some(w=>q.includes(w))) expanded.add(canonical);
 return corpus.filter(d=>d.years.includes(year)).map(d=>{
   const tags=d.tags.filter(tag=>[...expanded].some(t=>t.includes(tag)||tag.includes(t)));
   let score=tags.length*3;
   for(const t of expanded) if(t.length>1 && d.title.includes(t))score+=2;
   return {...d,score};
 }).filter(d=>d.score>=3).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,limit);
}
export function answerQuestion(question){
 const q=validateQuestion(question),sources=retrieve(q);
 if(!sources.length)return {question:q,mode:'local',status:'insufficient',year:2025,verifiedAt:VERIFIED_AT,sources:[],
   message:'수록한 자료만으로는 답하기 어려워요.',next:'2025년 사업소득의 경비·기본세율·계산 순서·신고기한을 질문해 주세요. 개별 공제 요건과 질의회신·판례는 아직 수록하지 않았어요.'};
 return {question:q,mode:'local',status:'grounded',year:2025,verifiedAt:VERIFIED_AT,sources,
   message:'찾은 공식 자료에서 확인한 내용이에요.',next:'귀속연도와 신고 방식을 먼저 확인하고, 개별 공제·경비의 인정 여부는 사실관계와 원문으로 검토해 주세요.'};
}
