import {corpus,VERIFIED_AT} from '../data/corpus.mjs';
import {TAX_SCOPES} from './tax.mjs';
const excluded = /양도소득|상속세|증여세|가상자산|비트코인|취득세|부양가족|연금저축|노란우산|세액공제/;
const namedTaxes={income:/종합소득세|종소세/,corporate:/법인세/,vat:/부가가치세|부가세/};
const extendedTopics={
 'corp-rates':/세율|누진|구간|산출세액|얼마|과세표준.*(?:곱|계산)/,
 'corp-law55':/세율|사업연도|제\s*55\s*조|산출세액/,
 'corp-base':/과세표준|세무조정|회계이익|익금|손금|소득금액|제\s*(?:13|14)\s*조/,
 'vat-flow':/매출세액|공급가액|공급대가|매입세액|납부|환급|계산|세율/,
 'vat-credit':/매입세액|세금계산서|공급시기|제\s*38\s*조/,
 'vat-noncredit':/매입세액|세금계산서|불공제|증빙|제\s*39\s*조/
};
const historicalTopics={
 'corp-court-2007du12422':/판매부대|판매촉진|대리점|통상.*(?:비용|손비)/,
 'corp-nts-2020-1478':/판매.*위탁|성과\s*보상|실비|명절\s*선물/,
 'vat-court-2023du41314':/실제\s*공급자|명의|거래\s*당사자|사실과\s*다른/,
 'vat-nts-2019-4175':/지연\s*(?:수취|발급)|늦게|등록\s*전|인테리어/
};
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
function selectTax(q,tax){
 if(tax!==undefined&&(typeof tax!=='string'||!Object.hasOwn(TAX_SCOPES,tax)))throw new Error('세목을 선택해 주세요.');
 const named=Object.keys(namedTaxes).filter(key=>namedTaxes[key].test(q));
 return {tax:tax??named[0]??'income',conflict:named.length>1||(tax!==undefined&&named.length===1&&named[0]!==tax)};
}
export function retrieve(question,{tax,year,limit=5}={}){
 const q=validateQuestion(question);
 const selected=selectTax(q,tax);
 if(selected.conflict)return [];
 tax=selected.tax;
 const scope=TAX_SCOPES[tax];
 year??=scope.year;
 if(year!==scope.year)return [];
 const maximum=Math.max(1,Math.min(limit,5));
 const scopedCorpus=corpus.filter(d=>d.tax===tax);
 const normalized=normalizeNumber(q);
 const onlyCases=/판례|대법원/.test(q)&&!/회신/.test(q);
 const onlyRulings=/질의\s*회신|국세청\s*회신|서면/.test(q)&&!/판례/.test(q);
 const otherYears=[...q.matchAll(/(?:^|[^\d])(20\d{2})(?=\s*년|[./-]\d{1,2}(?:[./-]|$)|\s*(?:$|귀속|사업연도|과세기간|세율))/g)].some(m=>Number(m[1])!==year);
 const unknownNumber=/\d{2,4}(?:두|누|구합|구단)\d+|서면[-\s]\d{4}[-\s]/;
 const exact=scopedCorpus.find(d=>d.number&&normalized.includes(normalizeNumber(d.number.split(' [')[0])));
 if(excluded.test(q))return [];
 if(tax!=='income'){
  if(exact&&!otherYears)return [{...exact,score:100}];
  const unsupported=/신고\s*(?:기한|방법)|간이과세|영세율|면세|안분|가산세|감면|지방소득세|조특법|특수관계|외국법인|비영리|단기\s*사업연도|소규모\s*법인|의제매입|신용카드.*공제/;
  if(otherYears||unsupported.test(q)||unknownNumber.test(q))return [];
  const matches=scopedCorpus.filter(d=>d.referenceOnly&&historicalTopics[d.id].test(q)&&
   (!onlyCases||d.kind==='판례')&&(!onlyRulings||d.kind==='질의회신'));
  if(onlyCases||onlyRulings)return matches.slice(0,maximum);
  const rules=scopedCorpus.filter(d=>d.years.includes(year)&&extendedTopics[d.id].test(q));
  return [...rules,...matches].slice(0,maximum);
 }
 const documentQuery=/판례|회신|사례|사건|서면|두\d{3,}/.test(q);
 if(/주식|접대비|차량|자동차|식대/.test(q)||(otherYears&&(!documentQuery||/년\s*귀속/.test(q))))return [];
 const topics=Object.entries(topicRules).filter(([,pattern])=>pattern.test(q)).map(([topic])=>topic);
 if(exact)return [exact,...(exact.pairedIds||[]).map(id=>scopedCorpus.find(d=>d.id===id)).filter(Boolean)].slice(0,maximum).map(d=>({...d,score:100}));
 if(unknownNumber.test(q))return [];
 const expanded=new Set(terms(q));
 for(const [canonical,words] of aliases) if(words.some(w=>q.includes(w))) expanded.add(canonical);
 const ranked=scopedCorpus.filter(d=>(otherYears?d.referenceOnly:d.years.includes(year)||d.referenceOnly)&&(!onlyCases||d.kind==='판례')&&(!onlyRulings||d.kind==='질의회신')).map(d=>{
   const tags=d.tags.filter(tag=>[...expanded].some(t=>t.includes(tag)||tag.includes(t)));
   let score=tags.length*3;
   for(const t of expanded) if(t.length>1 && d.title.includes(t))score+=2;
   const matchingTopics=(d.topics||[]).filter(t=>topics.includes(t));
   const exactNumber=d.number&&normalized.includes(normalizeNumber(d.number.split(' [')[0]));
   if(exactNumber)score+=100;
   if(d.referenceOnly){if(topics.length&&!matchingTopics.length&&!exactNumber)score=0;else score+=matchingTopics.length*12;}
   return {...d,score};
 }).filter(d=>d.score>=3).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 const results=ranked.slice(0,maximum);
 for(const d of [...results])for(const id of d.pairedIds||[]){if(maximum>1&&!results.some(x=>x.id===id)){const paired=ranked.find(x=>x.id===id);if(paired){if(results.length>=maximum)results.pop();results.push(paired);}}}
 return results;
}
export function answerQuestion(question,{tax}={}){
 const q=validateQuestion(question),selected=selectTax(q,tax),sources=retrieve(q,{tax});
 const {name,year,period}=TAX_SCOPES[selected.tax];
 const base={question:q,mode:'local',tax:selected.tax,taxName:name,year,period,verifiedAt:VERIFIED_AT,sources};
 const next={
  income:'2025년 사업소득의 기본세율·계산 순서 또는 수록한 경비 사례를 질문해 주세요.',
  corporate:'2026년 개시 사업연도의 일반 법인세율이나 세무조정 후 과세표준을 질문해 주세요.',
  vat:'2026년 일반과세자의 매출세액·매입세액·환급 계산을 질문해 주세요.'
 };
 if(!sources.length)return {...base,status:'insufficient',
   message:'수록한 자료만으로는 답하기 어려워요.',next:selected.conflict?'질문과 같은 세목을 선택하고 한 세목씩 나누어 질문해 주세요.':next[selected.tax]};
 return {...base,status:'grounded',message:'찾은 공식 자료에서 확인한 내용이에요.',
   next:sources.some(d=>d.referenceOnly)?'과거 회신·판례는 당시 사실관계의 참고 자료예요. 현재 사안의 적용 법령과 부칙, 사실관계를 별도로 확인해 주세요.':'적용 기간과 세목별 예외 요건을 원문에서 확인해 주세요.'};
}
