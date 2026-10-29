import test from 'node:test';
import assert from 'node:assert/strict';
import {retrieve,answerQuestion,validateQuestion} from '../public/lib/rag.mjs';
import {corpus} from '../public/data/corpus.mjs';
test('주제별 검색 평가: 적절한 근거가 상위 3개에 포함',()=>{
 for(const[q,expected]of [['필요경비 인정 기준이 궁금해요','books'],['2025년 종합소득세 세율은?','rates'],['소득공제를 빼면 어떻게 계산하나요?','flow'],['신고기한이 언제인가요?','filing'],['산출세액과 납부세액은 다른가요?','flow']])assert.ok(retrieve(q).some(d=>d.id===expected),q);
});
test('범위 밖·특정 공제·미수록 판례·다른 연도·무관 질문은 유보',()=>{
 for(const q of ['부가가치세 신고 방법','부양가족 공제 가능한가요','2026년 종합소득세 세율','2024년 종합소득세 경비','판례로 필요경비 인정 여부 알려줘','오늘 서울 날씨 어때요','연금저축 세액공제는?'])assert.equal(answerQuestion(q).status,'insufficient',q);
});
test('공식 출처·확인일·적용 시점이 있고 현재 법령은 2025 답변에서 제외',()=>{
 for(const d of corpus){assert.ok(['www.nts.go.kr','www.law.go.kr'].includes(new URL(d.url).hostname));assert.equal(d.verifiedAt,'2026-10-29');assert.ok(d.period);}
 assert.ok(!retrieve('필요경비 제27조 법령').some(d=>d.id==='law27'));
});
test('공백·지나치게 긴 질문·식별정보 형식 거부',()=>{for(const q of ['',null,'가나','가'.repeat(2001),'주민번호 900101-1234567 세금','사업자 123-45-67890 경비'])assert.throws(()=>validateQuestion(q));});
test('키가 없어도 로컬 답변은 생성 AI 사용으로 표시하지 않음',()=>assert.equal(answerQuestion('필요경비는 무엇인가요?').mode,'local'));
