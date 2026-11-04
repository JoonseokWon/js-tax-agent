import {LAW_REVIEW,isCalendarDate} from '../public/lib/law-review.mjs';
import {createLawFetch} from './law-network.mjs';

const ENDPOINT = 'https://www.law.go.kr/DRF/lawSearch.do';
const fetchLaw = createLawFetch();
const DISPLAY = 100;
const QUERY = {
  income:['종합소득세','필요경비'],
  corporate:['법인세','손금'],
  vat:['부가가치세','매입세액'],
  inheritance:['상속세','상속공제'],
  gift:['증여세','증여재산공제']
};
const FIELDS = {
  eflaw:['법령일련번호','법령명한글','시행일자','공포번호'],
  ntsCgmExpc:['법령해석일련번호','안건명','해석일자','안건번호'],
  prec:['판례일련번호','사건명','선고일자','사건번호']
};
const cleanDate = value => String(value??'').replace(/\D/g,'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
const compactDate = date => date.replaceAll('-','');

function officialNtsLink(record) {
  try {
    const url = new URL(record['법령해석상세링크']??record['상세링크'],'https://www.law.go.kr');
    if (url.hostname === 'taxlaw.nts.go.kr') {
      const id = url.searchParams.get('ntstDcmId');
      if (/^\d+$/.test(id??'')) return 'https://taxlaw.nts.go.kr/qt/USEQTA002P.do?ntstDcmId='+id;
    }
  } catch {}
  return 'https://taxlaw.nts.go.kr/';
}

export function parseLawList(payload,target) {
  if (typeof payload?.result==='string'&&payload.result.includes('사용자 정보 검증에 실패')) {
    throw new Error('법제처 API가 사용자 검증을 거부했어요. 승인된 OC와 신청에 등록한 서버 IP·도메인을 확인해 주세요.');
  }
  const [idKey,titleKey,dateKey,numberKey] = FIELDS[target];
  const result = [payload,...Object.values(payload??{})].find(entry=>entry&&Object.hasOwn(entry,'totalCnt'));
  const rawCount = result?.totalCnt;
  if ((typeof rawCount !== 'string' && typeof rawCount !== 'number') || !/^\d+$/.test(String(rawCount))) {
    throw new Error('공식 목록 형식을 확인할 수 없어요. 인증값과 데이터 이용 권한을 확인하세요.');
  }
  const total = Number(rawCount);
  const entries = Object.values(result).flatMap(value=>Array.isArray(value)?value:[value])
    .filter(record=>record&&typeof record==='object'&&Object.hasOwn(record,idKey));
  const records = entries.map(record=>{
    const id = String(record[idKey]??''), title = String(record[titleKey]??'').trim(), date = cleanDate(record[dateKey]);
    if (!/^\d+$/.test(id)||!title) throw new Error('공식 목록의 문서번호 또는 제목이 비어 있어요.');
    const link = target==='eflaw'?'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq='+id+(isCalendarDate(date)?'&efYd='+compactDate(date):''):
      target==='prec'?'https://www.law.go.kr/precInfoP.do?precSeq='+id:officialNtsLink(record);
    return {id,title,date:isCalendarDate(date)?date:null,number:String(record[numberKey]??''),link};
  });
  if (total>0&&!records.length) throw new Error('검색 건수와 목록 형식이 일치하지 않아요.');
  return {total,records};
}

export function resolveVersions(records,lawName,date) {
  const versions = records.filter(d=>d.title===lawName&&d.date);
  const effective = versions.filter(d=>d.date<=date).sort((a,b)=>b.date.localeCompare(a.date));
  const upcoming = versions.filter(d=>d.date>date).sort((a,b)=>a.date.localeCompare(b.date));
  // 같은 시행일에 복수 개정본이 있으면 순번으로 적용 조문을 단정하지 않는다.
  return {effective:effective.filter(d=>d.date===effective[0]?.date),upcoming};
}

export async function discoverTaxLaw({tax,date,today,oc,maxPages,fetchImpl=fetchLaw,pause}) {
  if (!Object.hasOwn(LAW_REVIEW,tax)||!isCalendarDate(date)||!isCalendarDate(today)) throw new Error('세목과 기준일을 확인해 주세요.');
  if (!oc?.trim()) throw new Error('승인된 법제처 API 인증값을 LAW_OPEN_DATA_OC에 설정해 주세요.');
  if (!Number.isInteger(maxPages)||maxPages<1||maxPages>20) throw new Error('목록 페이지 수는 1~20 사이로 입력해 주세요.');
  async function page(target,query,params) {
    await pause?.();
    const url = new URL(ENDPOINT);
    url.search = new URLSearchParams({OC:oc,target,type:'JSON',query,display:String(DISPLAY),...params});
    let response;
    try { response = await fetchImpl(url,{signal:AbortSignal.timeout(20000),redirect:'error'}); }
    catch (error) {
      if (['ENOTFOUND','EAI_AGAIN'].includes(error.code??error.cause?.code)) {
        throw new Error('법제처 API 주소(www.law.go.kr)를 찾지 못했어요. DNS 연결이 복구된 뒤 다시 실행해 주세요.');
      }
      if (error.name==='TimeoutError'||error.cause?.name==='TimeoutError') throw new Error('법제처 API 연결 시간이 초과됐어요. 연결 상태를 확인해 주세요.');
      throw new Error('법제처 API에 연결하지 못했어요. 네트워크를 확인해 주세요.');
    }
    if (!response.ok) throw new Error('법제처 API 오류 (HTTP '+response.status+'). 인증값과 이용 권한을 확인하세요.');
    let payload;
    try { payload = await response.json(); } catch { throw new Error('법제처 API가 JSON을 반환하지 않았어요. 인증값과 이용 권한을 확인하세요.'); }
    return parseLawList(payload,target);
  }
  const lawName = LAW_REVIEW[tax].lawName, laws = [];
  for (const name of [lawName,lawName+' 시행령',lawName+' 시행규칙']) {
    const query = '"'+name+'"', basis = compactDate(date), current = compactDate(today);
    const onDate = await page('eflaw',query,{efYd:'19000101~'+basis,sort:'efdes'});
    const now = date===today?onDate:await page('eflaw',query,{efYd:'19000101~'+current,sort:'efdes'});
    const next = await page('eflaw',query,{efYd:current+'~99991231',sort:'efasc'});
    const applicable = resolveVersions(onDate.records,name,date).effective;
    const live = resolveVersions(now.records,name,today).effective;
    laws.push({name,applicable,live,upcoming:resolveVersions(next.records,name,today).upcoming,
      review:!applicable.length||!live.length?'공식 연혁에서 직접 확인':applicable.length>1||live.length>1?'동일 시행일의 복수 개정본 검토':'조문·부칙·적용례 검토'});
  }
  const candidates = {};
  for (const target of ['ntsCgmExpc','prec']) {
    const documents = new Map(), searches = [];
    for (const query of QUERY[tax]) {
      let total = 0, fetched = 0;
      for (let number=1;number<=maxPages;number++) {
        const result = await page(target,query,{page:String(number)});
        total=result.total;
        fetched+=result.records.length;
        for (const doc of result.records) documents.set(doc.id,doc);
        if (number*DISPLAY>=total) break;
      }
      searches.push({query,total,fetched,truncated:fetched<total});
    }
    candidates[target]={searches,records:[...documents.values()]};
  }
  return {tax,date,checkedOn:today,status:'검토 후보 · 계산 및 AI 근거에 자동 반영하지 않음',laws,candidates};
}

export function changedLaws(previous,current) {
  if (!previous?.laws) return [];
  const ids = docs=>docs.map(d=>d.id).sort().join(',');
  return current.laws.filter(law=>{
    const old=previous.laws.find(item=>item.name===law.name);
    return old&&(ids(old.live)!==ids(law.live)||ids(old.upcoming)!==ids(law.upcoming));
  }).map(law=>law.name);
}
