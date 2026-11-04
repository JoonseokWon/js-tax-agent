import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {changedLaws,discoverTaxLaw,parseLawList,resolveVersions} from '../lib/law-discovery.mjs';
import {createLawFetch} from '../lib/law-network.mjs';
import {supportedReviewDate,transferLawAt,transferLawUrl} from '../public/lib/law-review.mjs';
import {compareTransferBodies,transferReviewStatus} from '../lib/transfer-law-impact.mjs';
import {calculationImpact,sourceImpact} from '../public/lib/law-impact.mjs';

test('상증세 새 시행본은 재수집해도 검토 기준에 남고 변경된 조문만 답변과 계산에 연결한다',async()=>{
 const name='상속세 및 증여세법';
 const updated={id:'999999',title:name,date:'2026-12-01'};
 const laws=[{name,live:[{id:'276123',date:'2026-01-02'}],upcoming:[updated]}];
 const body=version=>({법령:{
  기본정보:{법령명_한글:version.name,시행일자:version.date.replaceAll('-','')},
  조문:{조문단위:[
   {조문여부:'전문',조문번호:'25',조문내용:'과세표준과 세율'},
   {조문여부:'조문',조문번호:'25',조문내용:'상속세 과세표준',조문변경여부:'Y'},
   {조문여부:'조문',조문번호:'26',조문제목:'상속세 세율',항:{항내용:version.id===updated.id?'세율 B':'세율 A'}},
   {조문여부:'조문',조문번호:'53',조문가지번호:'02',조문내용:'혼인·출산 증여재산 공제'}
  ]},
  부칙:{부칙단위:{부칙내용:version.id===updated.id?'시행일 이후 적용':'종전 규정'}}
 }});
 const articleChanges=await compareTransferBodies(laws,body);
 assert.deepEqual(articleChanges[0].articles,['26']);
 const first=transferReviewStatus({checkedOn:'2026-11-04',laws,articleChanges});
 assert.deepEqual(calculationImpact(first,'inheritance').map(rule=>rule.label),['상속세 기본세율·누진공제']);
 assert.deepEqual(calculationImpact(first,'gift').map(rule=>rule.label),['증여세 기본세율·누진공제']);
 assert.equal(sourceImpact(first,'inheritance-base').length,0);
 assert.equal(sourceImpact(first,'inheritance-flow').length,1);
 assert.equal(sourceImpact(first,'gift-deduction').length,0);
 assert.equal(first.amendments[0].addendaChanged,true);
 const after=transferReviewStatus({checkedOn:'2026-12-02',laws:[{name,live:[updated]}],articleChanges});
 assert.deepEqual(after.amendments,first.amendments);
 const failed=await compareTransferBodies(laws,()=>({error:'본문 미수신'}));
 const incomplete=transferReviewStatus({checkedOn:'2026-11-04',laws,articleChanges:failed});
 assert.equal(incomplete.amendments[0].articles,null);
 assert.deepEqual(calculationImpact(incomplete,'gift'),[]);
});

test('상증세 시행일 경계마다 해당 날짜의 법률·시행령·시행규칙을 찾는다',()=>{
 const dates=[
  ['2026-01-01','280353','277615','272739'],
  ['2026-01-02','276123','280859','282647'],
  ['2026-02-26','276123','280859','282647'],
  ['2026-02-27','276123','283637','282647'],
  ['2026-03-19','276123','283637','282647'],
  ['2026-03-20','276123','283637','284609'],
  ['2026-09-17','276123','283637','284609'],
  ['2026-09-18','276123','288887','284609'],
  ['2026-09-30','276123','288887','284609'],
  ['2026-10-01','276123','290845','284609'],
  ['2026-11-04','276123','290845','284609']
 ];
 for(const [date,...expected] of dates)for(const tax of ['inheritance','gift']){
  assert.deepEqual(transferLawAt(tax,date).versions.map(version=>version.id),expected,date);
 }
 for(const date of ['','2025-12-31','2026-02-30','2026-11-05']){
  assert.deepEqual(transferLawAt('gift',date).versions,[]);
 }
 assert.equal(transferLawAt('vat','2026-10-01'),null);
});

test('상속개시일 적용례와 별도 신고일을 보는 증여세 부칙을 구분한다',()=>{
 const before=transferLawAt('inheritance','2026-02-26');
 const after=transferLawAt('inheritance','2026-02-27');
 assert.ok(!before.provisions.some(note=>note.id==='283637'&&note.eventDate));
 assert.ok(after.provisions.some(note=>note.id==='283637'&&note.eventDate));
 assert.ok(!after.provisions.some(note=>note.id==='290845'));
 const gift=transferLawAt('gift','2026-09-30');
 assert.equal(gift.versions[1].id,'288887');
 const filing=gift.provisions.find(note=>note.id==='290845');
 assert.equal(filing.timing,'증여세 과세표준 신고일');
 assert.equal(transferLawUrl(filing.version,true),
  'https://law.go.kr/LSW/lsInfoP.do?lsiSeq=290845&efYd=20261001&viewCls=lsRvsDocInfoR');
});

test('시행일에 맞는 법령과 시행예정본을 분리하고 동시 시행본을 모두 보여준다',()=>{
 const records=[
  {id:'1',title:'법인세법',date:'2025-01-01'},
  {id:'2',title:'법인세법',date:'2026-01-01'},
  {id:'3',title:'법인세법',date:'2026-01-01'},
  {id:'4',title:'법인세법',date:'2027-01-01'},
  {id:'5',title:'법인세법 시행령',date:'2026-05-01'}
 ];
 assert.deepEqual(resolveVersions(records,'법인세법','2025-12-31').effective.map(d=>d.id),['1']);
 const version=resolveVersions(records,'법인세법','2026-11-04');
 assert.deepEqual(version.effective.map(d=>d.id),['2','3']);
 assert.deepEqual(version.upcoming.map(d=>d.id),['4']);
 assert.equal(supportedReviewDate('corporate','2026-02-30'),false);
 assert.equal(supportedReviewDate('corporate','2025-12-31'),false);
 assert.equal(supportedReviewDate('vat','2026-01-01'),true);
 assert.deepEqual(changedLaws({laws:[{name:'법인세법',live:version.effective,upcoming:[]}]},
  {laws:[{name:'법인세법',live:version.effective,upcoming:version.upcoming}]}),['법인세법']);
});

test('공식 목록을 페이지별로 읽어 중복을 제거하며 후보 파일에 인증값을 전달하지 않는다',async()=>{
 const calls=[];
 const report=await discoverTaxLaw({tax:'vat',date:'2026-01-01',today:'2026-11-04',maxPages:2,oc:'test-oc-value',
  fetchImpl:async(url,options)=>{
   const params=url.searchParams,target=params.get('target'),number=params.get('page');
   calls.push({target,number,search:params.get('efYd')});
   assert.equal(url.protocol,'https:');assert.equal(options.redirect,'error');
   if(target==='eflaw')return Response.json({LawSearch:{totalCnt:1,law:{
    법령일련번호:'100001',법령명한글:params.get('query').slice(1,-1),시행일자:'20260101',공포번호:'12345'
   }}});
   if(target==='ntsCgmExpc')return Response.json({NtsSearch:{totalCnt:101,items:[{
    법령해석일련번호:'22',안건명:'공제 관련 회신',해석일자:'20250101',안건번호:'서면-예시',
    법령해석상세링크:'https://taxlaw.nts.go.kr/qt/USEQTA002P.do?ntstDcmId=001&OC=test-oc-value'
   }]}});
   return Response.json({PrecSearch:{totalCnt:1,prec:{판례일련번호:'33',사건명:'부과처분취소',선고일자:'2024.12.31',사건번호:'2024두12345'}}});
  }});
 assert.equal(report.laws.length,3);assert.equal(report.candidates.ntsCgmExpc.records.length,1);
 assert.equal(report.candidates.prec.records[0].date,'2024-12-31');
 assert.ok(calls.some(call=>call.target==='ntsCgmExpc'&&call.number==='2'));
 assert.ok(calls.some(call=>call.search==='19000101~20260101'));
 assert.ok(!JSON.stringify(report).includes('test-oc-value'));
 assert.throws(()=>parseLawList({error:'test-oc-value'},'prec'),/공식 목록 형식/);
});

test('DNS 실패는 인증 오류와 구분하고 원래 요청 URL과 인증값을 노출하지 않는다',async()=>{
 const oc='test-oc-not-for-output';
 await assert.rejects(discoverTaxLaw({tax:'vat',date:'2026-01-02',today:'2026-11-04',maxPages:1,oc,
  fetchImpl:async url=>{
   throw new Error(String(url),{cause:{code:'ENOTFOUND'}});
  }}),error=>error.message.includes('DNS')&&!error.message.includes(oc));
});

test('Windows DNS 실패 시 DNS 서비스에는 호스트명만 보내고 공식 주소의 TLS를 유지한다',async()=>{
 const url=new URL('https://www.law.go.kr/DRF/lawSearch.do?OC=test-only-credential');
 let checks=0,dnsCalls=0,clock=0,status=200;
 const request=createLawFetch({
  now:()=>clock,
  lookupImpl:async()=>{checks++;throw Object.assign(new Error(),{code:'EAI_AGAIN'});},
  fetchImpl:async(dnsUrl,options)=>{
   dnsCalls++;
   assert.equal(dnsUrl,'https://cloudflare-dns.com/dns-query?name=www.law.go.kr&type=A');
   assert.equal(options.redirect,'error');
   return Response.json({Status:0,Answer:[{type:1,data:'192.0.2.1',TTL:30}]});
  },
  getImpl:(actual,options,callback)=>{
   assert.equal(actual.href,url.href);
   assert.equal(options.servername,'www.law.go.kr');assert.equal(options.rejectUnauthorized,true);
   options.lookup(actual.hostname,{all:false},(error,address,family)=>{
    assert.equal(error,null);assert.equal(address,'192.0.2.1');assert.equal(family,4);
   });
   const reply=Readable.from([Buffer.from('{}')]);
   Object.assign(reply,{statusCode:status,headers:{}});
   callback(reply);
   return new EventEmitter();
  }
 });
 assert.deepEqual(await (await request(url)).json(),{});
 await (await request(url)).json();
 assert.equal(checks,1);assert.equal(dnsCalls,1);
 clock=30_001;
 status=302;
 await assert.rejects(request(url),/주소를 변경/);
 assert.equal(checks,2);assert.equal(dnsCalls,2);
 await assert.rejects(request(new URL('https://different.example/DRF/lawSearch.do')),/HTTPS 경로/);
 assert.throws(()=>parseLawList({result:'사용자 정보 검증에 실패하였습니다.',msg:'test-only-credential'},'prec'),
  error=>error.message.includes('사용자 검증')&&!error.message.includes('test-only-credential'));
});
