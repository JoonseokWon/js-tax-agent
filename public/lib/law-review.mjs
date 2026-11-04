import {TAX_SCOPES} from './tax.mjs';
import {TRANSFER_HISTORY_RANGE,transferLawHistory,transferProvisions} from '../data/transfer-law-history.mjs';
const transferVersions = transferLawHistory.flatMap(group=>group.versions);

export const LAW_REVIEW = {
  income:{lawId:'001565',lawName:'소득세법',articles:'제27조·제55조 및 부칙',dateLabel:'소득 귀속 기준일',
    evidence:'수입과 지출의 귀속연도, 사업 관련성, 장부와 거래 증빙을 확인하세요.'},
  corporate:{lawId:'001563',lawName:'법인세법',articles:'제13·14조·제19조·제55조 및 부칙',dateLabel:'사업연도 시작일',
    evidence:'계약서, 지출의 목적과 상대방, 세무조정 내역과 조정 후 과세표준을 확인하세요.'},
  vat:{lawId:'001571',lawName:'부가가치세법',articles:'제30조·제37~39조 및 부칙',dateLabel:'거래 공급일',
    evidence:'실제 공급자와 공급일, 세금계산서의 명의·기재사항, 공제 제외 사유를 확인하세요.'},
  inheritance:{lawId:'001561',lawName:'상속세 및 증여세법',articles:'제13조·제18~27조 및 부칙',dateLabel:'상속개시일',
    evidence:'재산 평가, 채무와 공과금, 사전증여 합산, 배우자 분할·신고와 상속공제 한도를 확인하세요.'},
  gift:{lawId:'001561',lawName:'상속세 및 증여세법',articles:'제47조·제53~58조 및 부칙',dateLabel:'증여일',
    evidence:'증여자와의 관계, 과거 10년 증여 내역과 공제 사용액, 재산 평가와 할증 여부를 확인하세요.'}
};
export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0,10) === value;
}
export function supportedReviewDate(tax,date) {
  return isCalendarDate(date) && Number(date.slice(0,4)) === TAX_SCOPES[tax].year;
}

export function transferLawAt(tax,date) {
  if (tax!=='inheritance' && tax!=='gift') return null;
  const range = TRANSFER_HISTORY_RANGE;
  const verified = isCalendarDate(date) && date >= range.from && date <= range.through;
  if (!verified) return {range,versions:[],provisions:[]};
  const versions = transferLawHistory.map(({label,versions})=>({label,...versions.find(version=>version.date<=date)}));
  const provisions = transferProvisions.flatMap(provision=>{
    if (provision.tax && provision.tax!==tax) return [];
    const version = transferVersions.find(item=>item.id===provision.id);
    if (provision.eventDate && date<version.date) return [];
    return [{...provision,version}];
  });
  return {range,versions,provisions};
}

export function transferLawUrl({id,date},amendment=false) {
  const url = 'https://law.go.kr/LSW/lsInfoP.do?lsiSeq='+id+'&efYd='+date.replaceAll('-','');
  return amendment?url+'&viewCls=lsRvsDocInfoR':url;
}
