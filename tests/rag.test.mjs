import test from 'node:test';
import assert from 'node:assert/strict';
import {retrieve,answerQuestion,validateQuestion} from '../public/lib/rag.mjs';
import {corpus} from '../public/data/corpus.mjs';
test('주제별 검색 평가: 적절한 근거가 상위 3개에 포함',()=>{
 for(const[q,expected]of [['필요경비 인정 기준이 궁금해요','books'],['2025년 종합소득세 세율은?','rates'],['소득공제를 빼면 어떻게 계산하나요?','flow'],['신고기한이 언제인가요?','filing'],['산출세액과 납부세액은 다른가요?','flow']])assert.ok(retrieve(q).some(d=>d.id===expected),q);
});
test('범위 밖·특정 공제·다른 연도·미수록 사건번호·무관 질문은 유보',()=>{
 for(const q of ['부가가치세 신고 방법','부양가족 공제 가능한가요','2026년 종합소득세 세율','2024년 종합소득세 경비','2099두987654 판례','오늘 서울 날씨 어때요','연금저축 세액공제는?'])assert.equal(answerQuestion(q).status,'insufficient',q);
});
test('공식 출처·확인일·적용 시점이 있고 현재 법령은 2025 답변에서 제외',()=>{
 for(const d of corpus){assert.ok(['www.nts.go.kr','www.law.go.kr','law.go.kr','taxlaw.nts.go.kr'].includes(new URL(d.url).hostname));assert.equal(d.verifiedAt,'2026-10-29');assert.ok(d.period);}
 assert.ok(!retrieve('필요경비 제27조 법령').some(d=>d.id==='law27'));
});
test('공백·지나치게 긴 질문·식별정보 형식 거부',()=>{for(const q of ['',null,'가나','가'.repeat(2001),'주민번호 900101-1234567 세금','사업자 123-45-67890 경비'])assert.throws(()=>validateQuestion(q));});
test('키가 없어도 로컬 답변은 생성 AI 사용으로 표시하지 않음',()=>assert.equal(answerQuestion('필요경비는 무엇인가요?').mode,'local'));
test('등록 전 비용: 등록 시점과 과세기간 이월을 구분할 회신 두 건 동시 검색',()=>{
 const ids=retrieve('사업자등록 전 비용을 다음 과세기간으로 옮겨 공제하나요?').map(s=>s.id);
 assert.ok(ids.includes('nts-2024-0703'));assert.ok(ids.includes('nts-2004-1423'));
});
test('회신·사건번호 검색은 해당 자료를 선택하고 존재하지 않는 사건을 꾸미지 않음',()=>{
 assert.deepEqual(retrieve('2001두4399 판례의 판단은?').map(s=>s.id),['court-2001du4399']);
 assert.equal(retrieve('서면-2015-소득-0179 판단과 한계')[0].id,'nts-2015-0179');
 assert.deepEqual(retrieve('서면-2025-소득-999999 내용'),[]);
});
test('대학원·증빙·차입금·초과인출금 사례 검색 평가',()=>{
 for(const[q,id]of [['강사 대학원 등록금 질의회신','nts-2015-0179'],['누락 수입 대응 필요경비 입증 판례','court-2001du4399'],['임대사업 대출이자 판례','court-2009du11874'],['초과인출금 가사관련경비 추정 판례','court-2022du32382']])assert.ok(retrieve(q).some(s=>s.id===id),q);
});
test('역사적 회신·판례는 계산 귀속연도와 구분하고 번호·사실·한계가 필수',()=>{
 const records=corpus.filter(d=>d.referenceOnly);assert.equal(records.length,6);
 for(const d of records){assert.deepEqual(d.years,[]);assert.ok(d.number&&d.issuedAt&&d.facts&&d.limitations&&d.sourceLocation);}
 const caseDoc=records.find(d=>d.id==='court-2022du32382');assert.equal(caseDoc.outcome,'파기환송');
 const ruling=records.find(d=>d.id==='nts-2024-0703');assert.equal(ruling.issuedAt,'2025-07-18');assert.ok(ruling.facts.includes('2022'));
});
test('복사된 API 키 형식은 질문 전송 전 차단',()=>assert.throws(()=>validateQuestion('내 키 sk-proj-'+ 'x'.repeat(32)+'로 경비 질문')));
