import {transferLawHistory} from '../public/data/transfer-law-history.mjs';
import {isCalendarDate} from '../public/lib/law-review.mjs';

export const isTransferTax = tax => tax==='inheritance'||tax==='gift';
const lawName = '상속세 및 증여세법';
const array = value => Array.isArray(value)?value:value==null?[]:[value];
const bodyFields = ['조문제목','조문내용','항번호','항내용','호번호','호내용','목번호','목내용'];
const subdivisions = ['항','호','목'];
const normalize = value => String(value??'').replace(/\s+/g,' ').trim();
const articleText = node => [
  ...bodyFields.map(key=>normalize(node[key])),
  ...subdivisions.flatMap(key=>array(node[key]).filter(part=>part&&typeof part==='object').map(articleText))
];

function readBody(payload,expected) {
  const body=payload?.법령, info=body?.기본정보;
  if(info?.법령명_한글!==expected.name || String(info?.시행일자)!==expected.date.replaceAll('-','')){
    throw new Error('법제처 본문 버전이 일치하지 않아요.');
  }
  const articles=new Map();
  for(const article of array(body.조문?.조문단위)){
    if(article?.조문여부!=='조문')continue;
    const number=String(article.조문번호??''), branch=String(article.조문가지번호??'0');
    if(!/^\d+$/.test(number)||!/^\d+$/.test(branch))throw new Error('조문 번호를 읽지 못했어요.');
    const key=String(Number(number))+(Number(branch)?'-'+Number(branch):'');
    if(articles.has(key))throw new Error('같은 번호의 조문이 여러 개예요.');
    articles.set(key,JSON.stringify(articleText(article)));
  }
  if(!articles.size)throw new Error('법제처 본문의 조문을 읽지 못했어요.');
  const addenda=array(body.부칙?.부칙단위).map(item=>normalize(array(item?.부칙내용).flat(Infinity).join(' '))).sort();
  return {articles,addenda:JSON.stringify(addenda)};
}

export function pendingTransferVersions(laws) {
  return transferLawHistory.flatMap(({lawId,label,versions})=>{
    const name=label==='법률'?lawName:lawName+' '+label;
    const law=laws.find(entry=>entry.name===name);
    const baseline={...versions[0],name};
    const candidates=new Map();
    for(const item of [...(law?.live??[]),...(law?.recent??[]),...(law?.upcoming??[])]){
      if(!/^\d+$/.test(item.id)||!isCalendarDate(item.date)||item.date<baseline.date)continue;
      if(!versions.some(version=>version.id===item.id&&version.date===item.date)){
        candidates.set(item.id+':'+item.date,{id:item.id,date:item.date,name});
      }
    }
    return [...candidates.values()].map(version=>({lawId,label,baseline,version}));
  });
}

export async function compareTransferBodies(laws,fetchBody) {
  const bodies=new Map(), results=[];
  async function getBody(version){
    const key=version.id+':'+version.date;
    if(!bodies.has(key))bodies.set(key,Promise.resolve().then(()=>fetchBody(version)).then(payload=>readBody(payload,version)));
    return bodies.get(key);
  }
  for(const {lawId,baseline,version} of pendingTransferVersions(laws)){
    const entry={lawId,id:version.id,date:version.date,baseId:baseline.id,baseDate:baseline.date};
    try{
      const before=await getBody(baseline), after=await getBody(version);
      const keys=new Set([...before.articles.keys(),...after.articles.keys()]);
      const articles=[...keys].filter(key=>before.articles.get(key)!==after.articles.get(key));
      results.push({...entry,articles,addendaChanged:before.addenda!==after.addenda});
    }catch{
      results.push({...entry,articles:null});
    }
  }
  return results;
}

export async function verifyTransferBody(fetchBody) {
  const baseline={...transferLawHistory[0].versions[0],name:lawName};
  try{readBody(await fetchBody(baseline),baseline);return true;}
  catch{return false;}
}

// Only checked version IDs, effective dates and changed article numbers reach the browser.
export function transferReviewStatus(report) {
  if(!isCalendarDate(report?.checkedOn)||!Array.isArray(report.laws))return null;
  const complete=transferLawHistory.every(({label})=>{
    const name=label==='법률'?lawName:lawName+' '+label;
    return report.laws.some(law=>law.name===name&&law.live?.length);
  });
  const amendments=pendingTransferVersions(report.laws).map(({lawId,label,baseline,version})=>{
    const comparison=report.articleChanges?.find(item=>item.lawId===lawId&&item.id===version.id&&
      item.date===version.date&&item.baseId===baseline.id&&item.baseDate===baseline.date);
    return {lawId,label,id:version.id,date:version.date,
      articles:Array.isArray(comparison?.articles)?comparison.articles.filter(article=>/^\d+(?:-\d+)?$/.test(article)):null,
      addendaChanged:comparison?.addendaChanged===true};
  });
  return {checkedOn:report.checkedOn,complete,bodyAvailable:report.articleBodyAvailable??null,amendments};
}
