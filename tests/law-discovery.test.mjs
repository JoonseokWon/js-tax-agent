import test from 'node:test';
import assert from 'node:assert/strict';
import {changedLaws,discoverTaxLaw,parseLawList,resolveVersions} from '../lib/law-discovery.mjs';
import {supportedReviewDate} from '../public/lib/law-review.mjs';

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
