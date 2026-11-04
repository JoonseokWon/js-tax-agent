import {isCalendarDate} from './law-review.mjs';
import {parseAmount} from './tax.mjs';

export const transferDeductions = {
  inheritance:{
    lump:'일괄공제', base:'기초공제', personal:'그 밖의 인적공제',
    spouse:'배우자 상속공제', finance:'금융재산 상속공제', home:'동거주택 상속공제',
    disaster:'재해손실공제', valuation:'감정평가 수수료', other:'그 밖의 확인한 공제 합계'
  },
  gift:{
    basic:'증여재산공제', family:'혼인·출산 증여재산공제 합계',
    disaster:'재해손실공제', valuation:'감정평가 수수료'
  }
};

export function transferFactIssue(tax, facts, eventDate) {
  if (!['none','included'].includes(facts.priorGifts)) {
    return {field:'priorGifts', message:'사전증여 내역과 과세가액에 반영했는지 확인해 주세요.'};
  }
  if (!['none','used'].includes(facts.priorDeductions)) {
    return {field:'priorDeductions', message:'이미 적용한 공제 내역을 확인해 주세요.'};
  }
  if (tax!=='inheritance') return null;
  if (!['irrelevant','completed','pending','exception'].includes(facts.split)) {
    return {field:'split', message:'배우자 상속재산의 분할·등기 상태를 확인해 주세요.'};
  }
  if (facts.split==='completed' && !isCalendarDate(facts.splitDate)) {
    return {field:'splitDate', message:'배우자 상속재산 분할일을 입력해 주세요.'};
  }
  if (facts.split==='completed' && isCalendarDate(eventDate) && facts.splitDate<eventDate) {
    return {field:'splitDate', message:'분할일은 상속개시일과 같거나 그 이후여야 해요.'};
  }
  return null;
}

export function transferDeductionConflict(tax, rows) {
  const selected=new Set();
  for (const [index,{kind}] of rows.entries()) {
    if (!kind) continue;
    if (selected.has(kind)) {
      return {index, field:'kind', message:'같은 안에 '+transferDeductions[tax][kind]+' 항목을 두 번 넣었어요. 중복된 줄을 삭제하고 적용할 금액만 한 줄에 적어 주세요.'};
    }
    if (tax==='inheritance' && (
      (kind==='lump' && (selected.has('base') || selected.has('personal'))) ||
      (['base','personal'].includes(kind) && selected.has('lump'))
    )) {
      return {index, field:'kind', message:'일괄공제와 기초·인적공제는 같은 안에 함께 넣을 수 없어요.'};
    }
    selected.add(kind);
  }
  return null;
}

export function transferDeductionTotal(tax, rows, facts) {
  const conflict=transferDeductionConflict(tax,rows);
  if (conflict) return {issue:conflict};
  let total=0;
  for (const [index,{kind,amount}] of rows.entries()) {
    const name=transferDeductions[tax][kind];
    if (!Object.hasOwn(transferDeductions[tax],kind)) {
      return {issue:{index, field:'kind', message:'공제 항목을 선택하거나 빈 줄을 삭제해 주세요.'}};
    }
    let value;
    try { value=parseAmount(amount,name); }
    catch (error) { return {issue:{index,field:'amount',message:error.message}}; }
    if (kind==='spouse' && !['completed','exception'].includes(facts.split)) {
      return {issue:{field:'split',message:'배우자 상속공제를 넣으려면 분할·등기 완료나 분할일 없이 적용할 수 있는 근거를 확인해 주세요.'}};
    }
    if (tax==='gift' && facts.priorDeductions==='used' && ['basic','family'].includes(kind)) {
      let remaining;
      try { remaining=parseAmount(facts[kind],name+' 남은 한도'); }
      catch (error) { return {issue:{field:kind,message:error.message}}; }
      if (value>remaining) {
        return {issue:{index,field:'amount',message:name+' 금액이 확인한 남은 한도를 넘어요. 이미 쓴 공제액을 확인하고 이번 금액을 줄여 주세요.'}};
      }
    }
    total+=value;
    try { parseAmount(total,'공제·수수료 합계'); }
    catch (error) { return {issue:{index,field:'amount',message:error.message}}; }
  }
  return {total};
}
