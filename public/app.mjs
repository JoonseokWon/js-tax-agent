import {answerQuestion,validateQuestion} from './lib/rag.mjs';
import {compareScenarios,BRACKETS,parseAmount} from './lib/tax.mjs';
import {corpus,VERIFIED_AT} from './data/corpus.mjs';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('ko-KR').format(n)+'원';
let latestAnswer=null,latestComparison=null,busy=false,requestNumber=0;
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
function setBusy(value){busy=value;$('#question-form').setAttribute('aria-busy',String(value));$('#ask-submit').disabled=value;$('#ask-ai').disabled=value;$('#ask-submit').textContent=value?'공식 근거를 살펴보고 있어요…':'근거로 답변 보기 ↗';}
function renderAnswer(result){
 latestAnswer=result;const area=$('#answer');
 area.innerHTML=`<div class="eyebrow"><span class="dot"></span> ${result.mode==='ai'?'생성 AI · 검색 근거 기반':'자료 요약 · 생성 AI 미사용'} · 2025년 귀속</div><div class="answer-question">${esc(result.question)}</div><h2 id="answer-title">${esc(result.message)}</h2>`;
 if(result.generated)area.innerHTML+=`<div class="generated-answer">${esc(result.generated)}</div>`;
 if(!result.sources.length)area.innerHTML+=`<p>${esc(result.next)}</p>`;
 for(const[s,d]of result.sources.entries())area.innerHTML+=`<section class="answer-section"><h3><span class="source-number">${s+1}</span>${esc(d.title)}</h3><p>${esc(d.summary)}</p><details><summary>근거와 확인할 사실 보기</summary><p>${esc(d.detail)}</p><p><strong>확인할 사실</strong> · ${esc(d.check)}</p><p>${esc(d.publisher)} · ${esc(d.period)}<br>자료 확인일 ${esc(d.verifiedAt)}</p><a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">공식 원문 열기 ↗</a></details></section>`;
 if(result.sources.length)area.innerHTML+=`<div class="answer-caution">개별 비용·공제의 인정 여부를 확정하는 답변은 아니에요. 귀속연도와 원문을 확인해 주세요.</div>`;
 area.innerHTML+=`<div class="answer-actions"><a class="button primary" href="#compare">가정을 바꿔 세액 비교하기 →</a><button class="button secondary" id="download-answer">검토 메모 다운로드</button></div>`;
 $('#download-answer').addEventListener('click',downloadMemo);area.hidden=false;focusHeading($('#answer-title'));
}
async function ask(mode='local'){
 if(busy)return;errorAt($('#question-error'),'');$('#question').removeAttribute('aria-invalid');
 let question;try{question=validateQuestion($('#question').value);}catch(e){errorAt($('#question-error'),e.message);$('#question').setAttribute('aria-invalid','true');$('#question').focus();return;}
 const seq=++requestNumber;setBusy(true);$('#answer').hidden=true;latestAnswer=null;
 try{
  let result;
  if(mode==='ai'){
   const response=await fetch('./api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,mode:'ai'}),signal:AbortSignal.timeout(30000)});
   const payload=await response.json();if(!response.ok)throw new Error(payload.error||'답변을 받지 못했어요. 다시 시도해 주세요.');result=payload;
  }else{await new Promise(resolve=>setTimeout(resolve,150));result=answerQuestion(question);}
  if(seq===requestNumber)renderAnswer(result);
 }catch(e){if(seq===requestNumber)errorAt($('#question-error'),e.name==='TimeoutError'?'응답이 늦어지고 있어요. 다시 시도하거나 근거로 답변 보기를 이용해 주세요.':e.message);}
 finally{if(seq===requestNumber)setBusy(false);}
}
$('#question-form').addEventListener('submit',e=>{e.preventDefault();ask();});
$('#ask-ai').addEventListener('click',()=>ask('ai'));
$('#question').addEventListener('input',()=>{
 $('#char-count').textContent=`${$('#question').value.trim().length.toLocaleString('ko-KR')} / 2,000`;
 if(busy){requestNumber++;setBusy(false);}
 latestAnswer=null;$('#answer').hidden=true;errorAt($('#question-error'),'');$('#question').removeAttribute('aria-invalid');
});
$('#clear-question').addEventListener('click',()=>{requestNumber++;setBusy(false);$('#question').value='';$('#question').dispatchEvent(new Event('input'));$('#question').focus();});
document.querySelectorAll('[data-question]').forEach(button=>button.addEventListener('click',()=>{
 $('#question').value=button.dataset.question;$('#question').dispatchEvent(new Event('input'));$('#question').focus();
}));
function showAmount(input){const help=$('#'+input.id+'-help');try{help.textContent=money(parseAmount(input.value));}catch{help.textContent='원 단위 정수로 입력해 주세요.';}}
const amountInputs=[...document.querySelectorAll('.scenario input')];
amountInputs.forEach(input=>{showAmount(input);input.addEventListener('input',()=>{
 showAmount(input);latestComparison=null;$('#comparison-result').hidden=true;$('#compare-state').textContent='입력이 바뀌었어요. 세액 비교하기를 눌러 다시 계산하세요.';input.removeAttribute('aria-invalid');errorAt($('#compare-error'),'');
});});
function readScenario(prefix){
 const data={year:2025};for(const key of ['revenue','expenses','deductions']){
  const input=$('#'+prefix+'-'+key);try{data[key]=parseAmount(input.value,{revenue:'총수입',expenses:'필요경비',deductions:'소득공제'}[key]);}
  catch(e){input.setAttribute('aria-invalid','true');input.focus();throw e;}
 }
 if(data.expenses>data.revenue){const input=$('#'+prefix+'-expenses');input.setAttribute('aria-invalid','true');input.focus();throw new Error('필요경비가 수입보다 커요. 이 버전은 결손금 계산을 지원하지 않아요.');}
 return data;
}
$('#compare-form').addEventListener('submit',e=>{
 e.preventDefault();latestComparison=null;$('#comparison-result').hidden=true;errorAt($('#compare-error'),'');amountInputs.forEach(i=>i.removeAttribute('aria-invalid'));
 try{const result=compareScenarios(readScenario('a'),readScenario('b'));latestComparison=result;renderComparison(result);$('#compare-state').textContent='입력한 가정으로 비교했어요. 인정 요건은 별도 확인해 주세요.';}
 catch(e){errorAt($('#compare-error'),e.message);$('#compare-state').textContent='입력값을 수정한 뒤 다시 비교해 주세요.';}
});
$('#load-example').addEventListener('click',()=>{
 const values=[80000000,20000000,1500000,80000000,30000000,1500000];amountInputs.forEach((i,n)=>{i.value=values[n];i.dispatchEvent(new Event('input'));});$('#compare-state').textContent='예시값을 불러왔어요. 세액 비교하기를 눌러 확인하세요.';
});
function renderComparison({baseline:a,alternative:b,difference}){
 const max=Math.max(a.tax,b.tax,1),area=$('#comparison-result');
 area.innerHTML=`<div class="result-summary"><div class="eyebrow">비교안 B − 기준안 A · 국세 산출세액</div><h2 id="result-title">${difference===0?'두 안의 산출세액이 같아요':money(Math.abs(difference))+' '+(difference<0?'적게 나와요':'많이 나와요')}</h2><p>입력한 경비·공제가 인정된다는 가정의 차이예요. 실제 납부액이나 확정 절세액이 아니에요.</p></div><div class="result-panel"><h3>두 안을 나란히 비교해요</h3><div class="bars" aria-hidden="true"><div class="bar-row"><span>기준안</span><div class="bar-track"><div class="bar-fill" data-width="${a.tax/max*100}"></div></div><strong>${money(a.tax)}</strong></div><div class="bar-row"><span>비교안</span><div class="bar-track"><div class="bar-fill" data-width="${b.tax/max*100}"></div></div><strong>${money(b.tax)}</strong></div></div><div class="table-wrap"><table><caption class="sr-only">기준안과 비교안의 계산 내역</caption><thead><tr><th scope="col">계산 항목</th><th scope="col">기준안 A</th><th scope="col">비교안 B</th></tr></thead><tbody>${[['총수입','revenue'],['필요경비','expenses'],['소득금액','income'],['소득공제','deductions'],['과세표준','base']].map(([label,key])=>`<tr><th scope="row">${label}</th><td>${money(a[key])}</td><td>${money(b[key])}</td></tr>`).join('')}<tr><th scope="row">적용 구간 세율</th><td>${a.rate}%</td><td>${b.rate}%</td></tr><tr><th scope="row">누진공제</th><td>${money(a.deduction)}</td><td>${money(b.deduction)}</td></tr><tr class="tax-row"><th scope="row">국세 산출세액</th><td>${money(a.tax)}</td><td>${money(b.tax)}</td></tr></tbody></table></div><p class="table-foot">산출세액 = 과세표준 × 적용 구간 세율 − 누진공제 · 원 미만 버림</p><div class="answer-actions"><button id="download-comparison" class="button secondary">검토 메모 다운로드</button><a href="#sources" class="button secondary">계산 근거 살펴보기</a></div></div>`;
 area.querySelectorAll('[data-width]').forEach(el=>el.style.width=el.dataset.width+'%');$('#download-comparison').addEventListener('click',downloadMemo);area.hidden=false;focusHeading($('#result-title'));
}
$('#rates-table').innerHTML=`<div class="table-wrap"><table><caption class="sr-only">2025년 귀속 종합소득세 기본세율</caption><thead><tr><th scope="col">과세표준 상한</th><th scope="col">세율</th><th scope="col">누진공제</th></tr></thead><tbody>${BRACKETS.map(b=>`<tr><td>${b.limit===Infinity?'10억원 초과':money(b.limit)+' 이하'}</td><td>${b.rate}%</td><td>${money(b.deduction)}</td></tr>`).join('')}</tbody></table></div>`;
function renderSources(){
 const q=$('#source-search').value.trim().toLowerCase();const docs=corpus.filter(d=>[d.title,d.publisher,d.kind,d.summary,...d.tags].join(' ').toLowerCase().includes(q));
 $('#source-list').innerHTML=docs.length?docs.map(d=>`<article class="source-card"><div class="eyebrow">${esc(d.kind)} · ${esc(d.publisher)}</div><h2>${esc(d.title)}</h2><p>${esc(d.summary)}</p><div class="source-meta">${esc(d.period)} · 확인일 ${esc(d.verifiedAt)}</div><div class="source-actions"><a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">공식 원문 열기 ↗</a>${d.years.includes(2025)?`<button data-source-question="${esc(d.tags[0])}">이 주제로 질문하기 →</button>`:'<span>2025년 답변 검색 제외</span>'}</div></article>`).join(''):'<div class="empty-state"><h2>일치하는 자료가 없어요</h2><p>경비, 세율, 신고 같은 짧은 단어로 찾아보세요.</p></div>';
 $('#source-list').querySelectorAll('[data-source-question]').forEach(button=>button.addEventListener('click',()=>{
  $('#question').value=`2025년 종합소득세 ${button.dataset.sourceQuestion}에 대해 알려주세요.`;$('#question').dispatchEvent(new Event('input'));location.hash='ask';
 }));
}
$('#source-search').addEventListener('input',renderSources);
function downloadMemo(){
 let text=`# JS Tax Agent 검토 메모\n\n작성일: ${new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date())}\n귀속연도: 2025\n자료 확인일: ${VERIFIED_AT}\n\n`;
 if(latestAnswer){text+=`## 질문\n\n${latestAnswer.question}\n\n답변 방식: ${latestAnswer.mode==='ai'?'생성 AI RAG':'로컬 검색 요약 (생성 AI 미사용)'}\n\n`;if(latestAnswer.generated)text+=latestAnswer.generated+'\n\n';if(!latestAnswer.sources.length)text+=latestAnswer.message+'\n'+latestAnswer.next+'\n\n';for(const d of latestAnswer.sources)text+=`### ${d.title}\n\n${d.summary}\n\n확인할 사실: ${d.check}\n\n출처: ${d.publisher} · ${d.period}\n${d.url}\n\n`;}
 if(latestComparison){const {baseline:a,alternative:b,difference}=latestComparison;text+='## 세액 비교 (국세 산출세액)\n\n|항목|기준안 A|비교안 B|\n|---|---:|---:|\n';for(const[label,key]of [['총수입','revenue'],['필요경비','expenses'],['소득공제','deductions'],['과세표준','base'],['산출세액','tax']])text+=`|${label}|${money(a[key])}|${money(b[key])}|\n`;text+=`\n차이 (B−A): ${money(difference)}\n\n세율 출처: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7667&mi=2227\n\n`;}
 text+='## 검토 범위\n\n장부에 의한 단일 사업소득의 일반 누진세율만 계산합니다. 지방소득세·세액공제·감면·가산세·기납부세액·결손금·추계신고는 제외합니다. 입력 가정의 경비·공제 인정 여부를 판단하지 않으며, 최종 납부액이나 신고서가 아닙니다. 개별 질의회신·판례는 미수록입니다. 신고 전 귀속연도에 맞는 원문과 사실관계를 확인하세요.\n';
 const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/markdown;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='JS-Tax-Agent-검토메모.md';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
renderSources();route();
fetch('./runtime.json').then(r=>r.json()).then(config=>{if(config.aiAvailable){$('#ask-ai').hidden=false;$('#ai-notice').hidden=false;}}).catch(()=>{});
