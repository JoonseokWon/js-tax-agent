import {answerQuestion,validateQuestion} from './lib/rag.mjs';
import {compareTax,BRACKETS,CORPORATE_BRACKETS,TRANSFER_BRACKETS,TAX_SCOPES,VAT_RATE,parseAmount} from './lib/tax.mjs';
import {LAW_REVIEW,TRANSFER_LAW_BASELINE,supportedReviewDate} from './lib/law-review.mjs';
import {corpus,corpusStats} from './data/corpus.mjs';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numberFormat=new Intl.NumberFormat('ko-KR');
const money=n=>numberFormat.format(n)+'원';
let busy=false,checking=false,requestNumber=0,aiAvailable=false;
document.querySelectorAll('[data-corpus-count]').forEach(el=>el.textContent=corpusStats.total);
function focusHeading(el){el.setAttribute('tabindex','-1');el.focus({preventScroll:true});(el.closest('#answer,#comparison-result')||el).scrollIntoView({behavior:'instant',block:'start'});}
function route(){
 const view=['ask','compare','sources'].includes(location.hash.slice(1))?location.hash.slice(1):'ask';
 for(const key of ['ask','compare','sources'])$('#view-'+key).hidden=key!==view;
 document.querySelectorAll('[data-view]').forEach(el=>{if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
 $('#breadcrumb').textContent='워크스페이스 / '+({ask:'세금 질문하기',compare:'세액 비교하기',sources:'근거 보관함'}[view]);
 $('#'+view+'-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',route);
function errorAt(el,message){el.textContent=message||'';el.hidden=!message;}
function setBusy(value){busy=value;$('#question-form').setAttribute('aria-busy',String(value));$('#ask-submit').disabled=value;$('#ask-ai').disabled=value||checking;$('#ask-submit').textContent=value?'공식 근거를 살펴보고 있어요…':'근거로 답변 보기 ↗';}
function sourceDetails(d){return `<details class="source-details"><summary>${d.referenceOnly?'사실관계·판단·적용 한계 보기':'근거와 확인할 사실 보기'}</summary>${d.number?`<p class="document-number">${esc(d.number)}${d.outcome?' · '+esc(d.outcome):''}</p>`:''}${d.facts?`<p><strong>사실관계</strong><br>${esc(d.facts)}</p>`:''}<p>${esc(d.detail)}</p>${d.limitations?`<p class="source-limit"><strong>적용 한계</strong><br>${esc(d.limitations)}</p>`:''}<p><strong>확인할 사실</strong> · ${esc(d.check)}</p><p>${esc(d.publisher)} · ${esc(d.period)}<br>자료 확인일 ${esc(d.verifiedAt)}</p>${d.sourceLocation?`<p>원문 확인 위치: ${esc(d.sourceLocation)}</p>`:''}<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">공식 원문 열기 ↗</a></details>`;}
function renderAnswer(result){
 const area=$('#answer');
 area.innerHTML=`<div class="eyebrow"><span class="dot"></span> ${result.mode==='ai'?'생성 AI · '+esc(result.model):'자료 요약 · 생성 AI 미사용'} · ${esc(result.taxName)} · ${esc(result.period)}</div><div class="answer-question">${esc(result.question)}</div><h2 id="answer-title">${esc(result.status==='insufficient'?'수록한 근거로는 확정하기 어려워요.':result.message)}</h2>`;
 if(result.generated)area.innerHTML+=`<div class="generated-answer">${esc(result.generated)}</div>`;
 if(result.points?.length)area.innerHTML+=`<ul class="ai-points">${result.points.map(p=>`<li>${esc(p.text)} <span class="citations">${p.sourceIds.map(id=>{const n=result.sources.findIndex(d=>d.id===id),d=result.sources[n];return `<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer" aria-label="근거 ${n+1}: ${esc(d.title)}">[${n+1}]</a>`;}).join(' ')}</span></li>`).join('')}</ul>`;
 if(result.missingFacts?.length)area.innerHTML+=`<div class="missing-facts"><h3>더 확인하면 좋은 사실</h3><ul>${result.missingFacts.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div>`;
 if(!result.sources.length&&!result.generated)area.innerHTML+=`<p>${esc(result.next)}</p>`;
 for(const[s,d]of result.sources.entries())area.innerHTML+=`<section class="answer-section"><div class="eyebrow">${esc(d.kind)}${d.referenceOnly?' · 역사적 참고 사례':''}</div><h3><span class="source-number">${s+1}</span>${esc(d.title)}</h3>${d.number?`<p class="document-number">${esc(d.number)} · ${esc(d.issuedAt)}${d.outcome?' · '+esc(d.outcome):''}</p>`:''}<p>${esc(d.summary)}</p>${sourceDetails(d)}</section>`;
 if(result.sources.length||result.limitations)area.innerHTML+=`<div class="answer-caution">${esc(result.limitations||result.next)}</div>`;
 area.innerHTML+=`<div class="answer-actions"><a class="button primary" href="#compare">가정을 바꿔 세액 비교하기 →</a><button class="button secondary" id="download-answer">검토 메모 다운로드</button></div>`;
 $('#download-answer').addEventListener('click',()=>downloadMemo({answer:result}));area.querySelector('a[href="#compare"]').addEventListener('click',()=>setCompareTax(result.tax));area.hidden=false;focusHeading($('#answer-title'));
}
async function ask(mode='local'){
 if(busy)return;errorAt($('#question-error'),'');$('#question').removeAttribute('aria-invalid');
 let question;try{question=validateQuestion($('#question').value);}catch(e){errorAt($('#question-error'),e.message);$('#question').setAttribute('aria-invalid','true');$('#question').focus();return;}
 const tax=$('#ask-tax').value,seq=++requestNumber;setBusy(true);$('#answer').hidden=true;
 try{
  let result;
  if(mode==='ai'){
   const response=await fetch('./api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,tax,mode:'ai'}),signal:AbortSignal.timeout(55000)});
   const payload=await response.json();if(!response.ok)throw new Error(payload.error||'답변을 받지 못했어요. 다시 시도해 주세요.');result=payload;
  }else{await new Promise(resolve=>setTimeout(resolve,150));result=answerQuestion(question,{tax});}
  if(seq===requestNumber){renderAnswer(result);if(result.mode==='ai')refreshRuntime();}
 }catch(e){if(seq===requestNumber)errorAt($('#question-error'),e.name==='TimeoutError'?'응답이 늦어지고 있어요. 다시 시도하거나 근거로 답변 보기를 이용해 주세요.':e.message);}
 finally{if(seq===requestNumber)setBusy(false);}
}
$('#question-form').addEventListener('submit',e=>{e.preventDefault();ask();});
function showSetup(){const d=$('#ai-setup');d.open=true;d.scrollIntoView({behavior:'instant',block:'center'});d.querySelector('summary').focus();}
$('#ask-ai').addEventListener('click',()=>aiAvailable?ask('ai'):showSetup());
$('#question').addEventListener('input',()=>{
 $('#char-count').textContent=`${$('#question').value.trim().length.toLocaleString('ko-KR')} / 2,000`;
 if(busy){requestNumber++;setBusy(false);}
 $('#answer').hidden=true;errorAt($('#question-error'),'');$('#question').removeAttribute('aria-invalid');
});
$('#clear-question').addEventListener('click',()=>{requestNumber++;setBusy(false);$('#question').value='';$('#question').dispatchEvent(new Event('input'));$('#question').focus();});
const suggestedQuestions={
 income:[['개업 전 비용의 귀속','사업자등록 전 비용을 다음 과세기간에 공제할 수 있나요?'],['초과인출금 이자 판례','초과인출금 지급이자 판례의 판단과 한계를 알려주세요.'],['2025년 기본세율','2025년 종합소득세 세율은 어떻게 되나요?']],
 corporate:[['2026년 기본세율','2026년 개시 사업연도의 법인세 세율은 어떻게 되나요?'],['과세표준의 뜻','법인세 과세표준과 회계이익은 어떻게 다른가요?']],
 vat:[['납부와 환급','일반과세자 부가세는 매출세액과 매입세액으로 어떻게 계산하나요?'],['매입세액 공제','부가세 매입세액 공제에 필요한 조건은 무엇인가요?']],
 inheritance:[['기본세율','2026년 상속세의 기본세율과 계산 순서는 어떻게 되나요?'],['일괄공제와 배우자공제','상속세 일괄공제와 배우자 상속공제의 기준은 무엇인가요?'],['배우자공제 판례','배우자 상속공제에서 상속재산 분할을 다룬 판례가 있나요?']],
 gift:[['기본세율','2026년 증여세의 기본세율과 계산 순서는 어떻게 되나요?'],['부모가 자녀에게 증여','부모가 자녀에게 증여할 때 증여재산공제의 기준은 무엇인가요?'],['채무면제와 혼인 공제','자녀에게 빌려준 돈을 면제하면 혼인 증여재산공제를 받을 수 있나요?']]
};
function renderAskTax(){
 const tax=$('#ask-tax').value;
 $('#ask-period').textContent=TAX_SCOPES[tax].period;
 $('#question').placeholder='예: '+suggestedQuestions[tax][0][1];
 $('#suggested-questions').replaceChildren(...suggestedQuestions[tax].map(([label,question])=>{
  const button=document.createElement('button');button.type='button';button.textContent=label+' ↗';
  button.addEventListener('click',()=>{$('#question').value=question;$('#question').dispatchEvent(new Event('input'));$('#question').focus();});
  return button;
 }));
}
$('#ask-tax').addEventListener('change',()=>{renderAskTax();$('#question').dispatchEvent(new Event('input'));});
const progressiveFormula='산출세액 = 과세표준 × 적용 구간 세율 − 누진공제 · 원 미만 버림';
const transferComparison={
 rows:[['과세가액','amount'],['확인한 공제·수수료','deductions'],['과세표준','base']],
 brackets:TRANSFER_BRACKETS,highest:'30억원 초과',
 formula:'과세표준 = 과세가액 − 확인한 공제·수수료 (최저 0원). '+progressiveFormula+'. 과세표준 50만원 미만은 세액 0원.'
};
const comparisons={
 income:{fields:[['revenue','연간 총수입',80000000,80000000],['expenses','필요경비',20000000,30000000],['deductions','소득공제 합계',1500000,1500000]],
  rows:[['총수입','revenue'],['필요경비','expenses'],['소득금액','income'],['소득공제','deductions'],['과세표준','base']],brackets:BRACKETS,highest:'10억원 초과',
  title:'2025년 · 장부에 의한 단일 사업소득',scope:'지방소득세·세액공제·감면·가산세·기납부세액은 제외해요.',
  notes:'과세표준은 총수입에서 필요경비와 소득공제를 뺀 금액이에요. 결손금·추계신고·다른 소득은 계산 범위 밖이에요.',formula:progressiveFormula,source:'rates'},
 corporate:{fields:[['base','세무조정 후 과세표준',250000000,180000000]],rows:[['과세표준','base']],brackets:CORPORATE_BRACKETS,highest:'3,000억원 초과',
  title:'2026년 개시 · 1년 사업연도 · 국내 일반 영리법인',scope:'별도 세율 적용 법인, 지방소득세, 추가 과세, 세액공제·감면, 기납부세액은 제외해요.',
  notes:'회계이익 대신 세무조정과 과세표준 산정을 마친 금액을 넣어 주세요. 1년 미만 사업연도는 별도로 검토해 주세요.',formula:progressiveFormula,source:'corp-rates'},
 vat:{fields:[['sales','과세 매출 공급가액 (부가세 제외)',100000000,100000000],['inputTax','공제 가능 매입세액',7000000,12000000]],
  rows:[['매출 공급가액','sales'],['매출세액','outputTax'],['공제 가능 매입세액','inputTax']],
  title:'2026년 · 일반과세자 · 국내 10% 과세 거래',scope:'간이과세·영세율·면세·공통매입세액 안분·가산세·기납부세액은 제외해요.',
  notes:'두 안에는 같은 신고 대상 기간의 금액을 넣어 주세요. 매입 금액 전체가 아니라 공제 가능한 부가세액을 입력해요.',formula:'매출 공급가액 × '+VAT_RATE+'% (원 미만 버림) − 공제 가능 매입세액',source:'vat-flow'},
 inheritance:{...transferComparison,fields:[['amount','상속세 과세가액',800000000,800000000],['deductions','확인한 상속공제·수수료 합계',500000000,600000000]],
  title:'2026년 상속개시 · 일반 상속세 산출세액',scope:'채무·사전증여를 반영한 과세가액과 한도 확인을 마친 공제·수수료를 넣어 주세요. 할증·세액공제·가산세는 제외해요.',
  notes:'과세가액은 상속재산 평가와 합산·차감 항목을 반영해 구해요. 일괄공제·배우자공제 등은 상속인 구성과 적용 한도를 확인한 뒤 합산해 주세요.',source:'inheritance-flow'},
 gift:{...transferComparison,fields:[['amount','증여세 과세가액',150000000,100000000],['deductions','확인한 증여 공제·수수료 합계',50000000,50000000]],
  title:'2026년 증여 · 일반 증여세 산출세액',scope:'합산 대상 증여를 반영한 과세가액과 한도 확인을 마친 공제·수수료를 넣어 주세요. 특례·할증·세액공제·가산세는 제외해요.',
  notes:'관계에 따른 증여재산공제 한도와 최근 10년간 적용한 공제액을 확인하세요. 혼인·출산 공제는 요건과 한도를 별도로 확인해 주세요.',source:'gift-flow'}
};
const comparisonValues={};
const reviewDates={};
function resetComparison(message){
 $('#comparison-result').hidden=true;$('#compare-state').textContent=message;errorAt($('#compare-error'),'');
}
function renderAmount(input){
 const help=$('#'+input.id+'-help');
 try{help.textContent=money(parseAmount(input.value));}catch{help.textContent='원 단위 정수로 입력해 주세요.';}
}
function setCompareTax(tax){
 $('#compare-tax').value=tax;
 const config=comparisons[tax],saved=comparisonValues[tax];
 for(const [index,prefix] of ['a','b'].entries()){
  $('#'+prefix+'-fields').innerHTML=config.fields.map(([key,label,...examples])=>{
   const id=prefix+'-'+key,value=saved?.[id]??examples[index];
   return `<label for="${id}">${esc(label)} <span>원</span></label><input id="${id}" inputmode="numeric" value="${esc(value)}" aria-describedby="${id}-help compare-error"><small id="${id}-help" class="amount-help"></small>`;
  }).join('');
 }
 $('#compare-scope').innerHTML=`<strong>${esc(config.title)}</strong><span>${esc(config.scope)}</span>`;
 $('#compare-rules').open=false;
 $('#compare-rules-title').textContent=config.brackets?'계산 범위와 기본세율 확인하기':'부가세 계산 범위 확인하기';
 const source=corpus.find(doc=>doc.id===config.source);
 const rates=config.brackets?`<div class="table-wrap"><table><caption class="sr-only">${esc(TAX_SCOPES[tax].name)} 기본세율</caption><thead><tr><th scope="col">과세표준 상한</th><th scope="col">세율</th><th scope="col">누진공제</th></tr></thead><tbody>${config.brackets.map(b=>`<tr><td>${b.limit===Infinity?config.highest:money(b.limit)+' 이하'}</td><td>${b.rate}%</td><td>${money(b.deduction)}</td></tr>`).join('')}</tbody></table></div>`:'';
 $('#compare-rules-body').innerHTML=`<p>${esc(config.notes)}</p><p>${esc(config.formula)}</p>${rates}<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">국세청 계산 근거 보기 ↗</a>`;
 document.querySelectorAll('.scenario input').forEach(renderAmount);
 renderLawReview(tax);
 resetComparison(saved?'이전에 입력한 값을 불러왔어요. 세액 비교하기를 눌러 확인하세요.':'예시값이에요. 본인 조건에 맞게 수정한 뒤 비교해 주세요.');
}
function renderLawReview(tax){
 const review=LAW_REVIEW[tax],input=$('#review-date'),date=reviewDates[tax]??'';
 input.value=date;
 $('#review-date-label').textContent=review.dateLabel+' (선택)';
 const law=$('#review-law-link');
 law.href='https://www.law.go.kr/LSW/lsInfoP.do?lsId='+review.lawId;
 law.textContent=review.lawName+' '+review.articles+' · 원문과 연혁 열기 ↗';
 const versions=$('#review-versions');
 versions.hidden=tax!=='inheritance'&&tax!=='gift';
 if(!versions.hidden){
  const {checkedOn,versions:entries}=TRANSFER_LAW_BASELINE;
  versions.innerHTML=`<p><strong>법제처 수집일 ${checkedOn} 기준 시행본</strong></p><ul>${entries.map(({label,date,id})=>`<li><a href="https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=${id}" target="_blank" rel="noopener noreferrer">${label} · ${date} 시행 ↗</a></li>`).join('')}</ul>`;
 }
 $('#review-evidence').textContent=review.evidence;
 const valid=!date||supportedReviewDate(tax,date);
 if(valid)input.removeAttribute('aria-invalid');else input.setAttribute('aria-invalid','true');
 $('#review-date-status').textContent=!date?'기준일을 넣으면 계산 지원 연도와 맞는지 확인해요.':
  valid?'계산 지원 연도에 해당해요. 기준일의 조문과 부칙에서 실제 적용 여부를 확인하세요.':
  TAX_SCOPES[tax].period+'만 계산할 수 있어요. 다른 시점은 공식 원문과 연혁을 확인하세요.';
}
$('#review-date').addEventListener('change',e=>{
 const tax=$('#compare-tax').value;reviewDates[tax]=e.target.value;
 renderLawReview(tax);resetComparison('기준일이 바뀌었어요. 적용 범위를 확인한 뒤 다시 비교하세요.');
});
function filterTaxSources(tax,kind='all'){
 $('#source-tax').value=tax;$('#source-kind').value=kind;$('#source-search').value='';renderSources();
}
$('#review-sources').addEventListener('click',()=>filterTaxSources($('#compare-tax').value));
$('#compare-tax').addEventListener('change',e=>setCompareTax(e.target.value));
$('#compare-form').addEventListener('input',e=>{
 const input=e.target;
 if(!input.matches('.scenario input'))return;
 const tax=$('#compare-tax').value;
 comparisonValues[tax]??={};comparisonValues[tax][input.id]=input.value;
 renderAmount(input);input.removeAttribute('aria-invalid');
 resetComparison('입력이 바뀌었어요. 세액 비교하기를 눌러 다시 계산하세요.');
});
function invalidAmount(input,error){input.setAttribute('aria-invalid','true');input.focus();throw error;}
function readScenario(tax,prefix){
 const data={year:TAX_SCOPES[tax].year};
 for(const [key,label] of comparisons[tax].fields){
  const input=$('#'+prefix+'-'+key);
  try{data[key]=parseAmount(input.value,label);}catch(error){invalidAmount(input,error);}
 }
 if(tax==='income'&&data.expenses>data.revenue)invalidAmount($('#'+prefix+'-expenses'),new Error('필요경비가 수입보다 커요. 이 버전은 결손금 계산을 지원하지 않아요.'));
 return data;
}
$('#compare-form').addEventListener('submit',e=>{
 e.preventDefault();const tax=$('#compare-tax').value;
 resetComparison('');document.querySelectorAll('.scenario input').forEach(i=>i.removeAttribute('aria-invalid'));
 const date=reviewDates[tax];
 if(date&&!supportedReviewDate(tax,date)){
  $('#law-review').open=true;$('#review-date').focus();
  errorAt($('#compare-error'),'선택한 기준일은 계산 범위 밖이에요. 절세 검토 순서에서 기준일을 확인해 주세요.');
  return;
 }
 try{const result=compareTax(tax,readScenario(tax,'a'),readScenario(tax,'b'));renderComparison(tax,result);$('#compare-state').textContent='입력한 가정으로 비교했어요.';}
 catch(e){errorAt($('#compare-error'),e.message);$('#compare-state').textContent='입력값을 수정한 뒤 다시 비교해 주세요.';}
});
$('#load-example').addEventListener('click',()=>{
 const tax=$('#compare-tax').value;delete comparisonValues[tax];setCompareTax(tax);
 $('#compare-state').textContent='예시값을 불러왔어요. 세액 비교하기를 눌러 확인하세요.';
});
const vatResult=tax=>tax===0?'0원':(tax>0?'납부 ':'환급 ')+money(Math.abs(tax));
function comparisonRows(tax){
 const {rows}=comparisons[tax];
 return tax==='vat'?[...rows,['납부·환급 추정','tax',vatResult]]:
  [...rows,['적용 구간 세율','rate',n=>n+'%'],['누진공제','deduction'],['국세 산출세액','tax']];
}
function renderComparison(tax,{baseline:a,alternative:b,difference}){
 const config=comparisons[tax],scope=TAX_SCOPES[tax],vat=tax==='vat',area=$('#comparison-result');
 const title=difference===0?'두 안의 결과가 같아요':vat?`${vatResult(a.tax)} → ${vatResult(b.tax)}`:money(Math.abs(difference))+' '+(difference<0?'적게 나와요':'많이 나와요');
 const change=vat?`납부 방향을 양수, 환급 방향을 음수로 본 차이는 ${money(difference)}이에요. `:'';
 const max=Math.max(a.tax,b.tax,1);
 const bars=vat?'':`<div class="bars" aria-hidden="true">${[['기준안',a],['비교안',b]].map(([label,scenario])=>`<div class="bar-row"><span>${label}</span><progress max="${max}" value="${scenario.tax}"></progress><strong>${money(scenario.tax)}</strong></div>`).join('')}</div>`;
 const rows=comparisonRows(tax).map(([label,key,format=money])=>`<tr${key==='tax'?' class="tax-row"':''}><th scope="row">${label}</th><td>${format(a[key])}</td><td>${format(b[key])}</td></tr>`).join('');
 area.innerHTML=`<div class="result-summary"><div class="eyebrow">${esc(scope.name)} · 비교안 B − 기준안 A</div><h2 id="result-title">${title}</h2><p>${change}입력한 가정으로 비교한 금액이에요. 실제 신고 금액은 별도로 확인해 주세요.</p></div><div class="result-panel"><h3>두 안을 나란히 비교해요</h3>${bars}<div class="table-wrap"><table><caption class="sr-only">기준안과 비교안의 계산 내역</caption><thead><tr><th scope="col">계산 항목</th><th scope="col">기준안 A</th><th scope="col">비교안 B</th></tr></thead><tbody>${rows}</tbody></table></div><p class="table-foot">${esc(config.formula)}</p><div class="answer-actions"><button id="download-comparison" class="button secondary">검토 메모 다운로드</button><a id="comparison-sources" href="#sources" class="button secondary">계산 근거 살펴보기</a></div></div>`;
 $('#download-comparison').addEventListener('click',()=>downloadMemo({tax,comparison:{baseline:a,alternative:b,difference},date:reviewDates[tax]}));
 $('#comparison-sources').addEventListener('click',()=>filterTaxSources(tax,'guidance'));
 area.hidden=false;focusHeading($('#result-title'));
}
function renderSources(){
 const norm=s=>s.toLowerCase().replace(/[^가-힣a-z0-9]/g,'');const q=norm($('#source-search').value),kind=$('#source-kind').value,tax=$('#source-tax').value;
 const docs=corpus.filter(d=>(tax==='all'||d.tax===tax)&&(kind==='all'||(kind==='guidance'?!d.referenceOnly:d.kind===kind))&&norm([TAX_SCOPES[d.tax].name,d.title,d.publisher,d.kind,d.number||'',d.summary,...d.tags].join(' ')).includes(q));
 $('#source-result-count').textContent=`${docs.length}개 자료`;
 $('#source-list').innerHTML=docs.length?docs.map(d=>`<article class="source-card"><div class="eyebrow">${esc(TAX_SCOPES[d.tax].name)} · ${esc(d.kind)} · ${esc(d.publisher)}</div><h2>${esc(d.title)}</h2>${d.number?`<p class="document-number">${esc(d.number)}${d.outcome?' · '+esc(d.outcome):''}</p>`:''}<p>${esc(d.summary)}</p><div class="source-meta">${esc(d.period)} · 확인일 ${esc(d.verifiedAt)}</div>${d.referenceOnly?sourceDetails(d):''}<div class="source-actions"><a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">공식 원문 열기 ↗</a>${d.years.includes(TAX_SCOPES[d.tax].year)||d.referenceOnly?`<button data-source-tax="${d.tax}" data-source-question="${esc(d.referenceOnly?d.number+'의 판단과 적용 한계를 알려주세요.':TAX_SCOPES[d.tax].name+' '+d.tags[0]+'에 대해 알려주세요.')}">이 주제로 질문하기 →</button>`:'<span>2025년 답변 검색 제외</span>'}</div></article>`).join(''):'<div class="empty-state"><h2>일치하는 자료가 없어요</h2><p>자료 종류를 바꾸거나 문서·사건번호로 찾아보세요.</p></div>';
 $('#source-list').querySelectorAll('[data-source-question]').forEach(button=>button.addEventListener('click',()=>{
  $('#ask-tax').value=button.dataset.sourceTax;renderAskTax();
  $('#question').value=button.dataset.sourceQuestion;$('#question').dispatchEvent(new Event('input'));location.hash='ask';
 }));
}
$('#source-search').addEventListener('input',renderSources);
$('#source-kind').addEventListener('change',renderSources);
$('#source-tax').addEventListener('change',renderSources);
function downloadMemo({answer,tax=answer?.tax,comparison,date}){
 const scope=TAX_SCOPES[tax];
 let text=`# JS Tax Agent 검토 메모\n\n작성일: ${new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date())}\n세목: ${scope.name}\n지원 범위: ${scope.period}\n\n`;
 if(answer){
  text+=`## 질문\n\n${answer.question}\n\n답변 방식: ${answer.mode==='ai'?'생성 AI RAG ('+answer.model+')':'자료 요약 (생성 AI 미사용)'}\n\n`;
  if(answer.generated)text+=answer.generated+'\n\n';
  for(const p of answer.points||[])text+=`- ${p.text} (근거: ${p.sourceIds.map(id=>answer.sources.find(d=>d.id===id)?.number||id).join(', ')})\n`;
  if(answer.missingFacts?.length)text+='\n추가 확인: '+answer.missingFacts.join(' / ')+'\n\n';
  if(answer.limitations)text+='적용 한계: '+answer.limitations+'\n\n';
  if(!answer.sources.length&&!answer.generated)text+=answer.message+'\n'+answer.next+'\n\n';
  for(const d of answer.sources)text+=`### ${d.title}\n\n${d.number||d.kind} · ${d.period}${d.outcome?' · '+d.outcome:''}\n\n${d.facts?'사실관계: '+d.facts+'\n\n':''}${d.summary}\n\n${d.limitations?'적용 한계: '+d.limitations+'\n\n':''}확인할 사실: ${d.check}\n\n출처: ${d.publisher} · 확인일 ${d.verifiedAt}\n${d.url}\n\n`;
 }
 if(comparison){
  const {baseline:a,alternative:b,difference}=comparison,config=comparisons[tax];
  if(date)text+=LAW_REVIEW[tax].dateLabel+': '+date+'\n\n';
  text+='## 세액 비교\n\n|항목|기준안 A|비교안 B|\n|---|---:|---:|\n';
  for(const [label,key,format=money] of comparisonRows(tax))text+=`|${label}|${format(a[key])}|${format(b[key])}|\n`;
  const source=corpus.find(doc=>doc.id===config.source);
  text+=`\n차이 (B−A${tax==='vat'?', 납부 양수·환급 음수':''}): ${money(difference)}\n\n${config.formula}\n\n${config.title}\n${config.scope}\n${config.notes}\n\n출처: ${source.publisher} · 확인일 ${source.verifiedAt}\n${source.url}\n\n`;
 }
 text+='입력한 가정과 수록 자료를 바탕으로 검토한 내용입니다. 신고 전 적용 기간과 원문, 개별 사실관계를 확인하세요.\n';
 const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/markdown;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='JS-Tax-Agent-검토메모.md';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function refreshRuntime(){
 try{const response=await fetch('./runtime.json',{signal:AbortSignal.timeout(4000)});if(!response.ok)throw new Error();const config=await response.json();aiAvailable=!!config.aiAvailable;$('#ask-ai').textContent=aiAvailable?'생성 AI로 답변 보기':'AI 설정 방법';$('#ai-status').textContent=aiAvailable?(config.lastVerifiedAt?'실제 AI 응답 확인됨 · ':'키 설정됨 · 실연결 확인 전 · ')+(config.aiModel||'설정 모델'):'생성 AI 키 미설정 · 자료 요약은 바로 이용할 수 있어요.';return config;}
 catch{$('#ai-status').textContent='AI 설정 상태를 읽지 못했어요. 서버 연결을 확인해 주세요.';return null;}
}
$('#check-ai').addEventListener('click',async()=>{
 if(checking||busy)return;const config=await refreshRuntime();if(!config?.aiAvailable){showSetup();return;}
 checking=true;$('#check-ai').disabled=true;$('#ask-ai').disabled=true;$('#ai-status').textContent='공개 예시 질문으로 실제 AI 응답을 확인하고 있어요…';
 try{const response=await fetch('./api/ai/check',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(55000)});const result=await response.json();if(!response.ok)throw new Error(result.error);$('#ai-status').textContent='실제 AI 연결을 확인했어요 · '+result.model;}
 catch(e){$('#ai-status').textContent=e.name==='TimeoutError'?'연결 확인이 늦어지고 있어요. 잠시 뒤 다시 시도해 주세요.':e.message;}
 finally{checking=false;$('#check-ai').disabled=false;$('#ask-ai').disabled=busy;}
});
renderAskTax();setCompareTax($('#compare-tax').value);renderSources();route();refreshRuntime();
