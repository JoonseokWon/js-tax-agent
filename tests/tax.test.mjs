import test from 'node:test';
import assert from 'node:assert/strict';
import {taxFromBase,compareScenarios,calculateScenario,parseAmount} from '../public/lib/tax.mjs';
// 별도의 누진 구간 적분으로 확인. 누진공제 공식을 그대로 복제하지 않음.
function marginalReference(base){let left=base,last=0,total=0;for(const[upper,rate]of [[14000000,6],[50000000,15],[88000000,24],[150000000,35],[300000000,38],[500000000,40],[1000000000,42],[Infinity,45]]){const portion=Math.max(0,Math.min(left,upper-last));total+=portion*rate;left-=portion;last=upper;if(left<=0)break;}return Math.floor(total/100);}
test('모든 누진세 경계의 전후와 고액에서 독립 계산식과 일치',()=>{
 for(const boundary of [0,14000000,50000000,88000000,150000000,300000000,500000000,1000000000,1000000000000])for(const offset of [-1,0,1]){const n=boundary+offset;if(n<0||n>1e12)continue;assert.equal(taxFromBase(n).tax,marginalReference(n),String(n));}
});
test('국세청 예시: 과세표준 3천만원 → 324만원',()=>assert.equal(taxFromBase(30000000).tax,3240000));
test('기준안 828만원, 비교안 601.5만원과 차이 226.5만원',()=>{
 const r=compareScenarios({year:2025,revenue:80000000,expenses:20000000,deductions:1500000},{year:2025,revenue:80000000,expenses:30000000,deductions:1500000});
 assert.equal(r.baseline.base,58500000);assert.equal(r.baseline.tax,8280000);assert.equal(r.alternative.tax,6015000);assert.equal(r.difference,-2265000);
});
test('소득공제가 소득 이상이면 과세표준·산출세액 0',()=>{const r=calculateScenario({year:2025,revenue:100,expenses:100,deductions:1500000});assert.equal(r.tax,0);assert.equal(r.base,0);});
test('음수·빈 값·문자·소수·비정상 객체·상한 초과 금액 거부',()=>{for(const value of ['',null,undefined,{},-1,'1,000','1.2','1e4',Infinity,'9007199254740992',1000000000001])assert.throws(()=>parseAmount(value));assert.equal(parseAmount(' 1000 '),1000);});
test('미지원 연도·결손금의 잘못된 계산을 거부',()=>{
 assert.throws(()=>calculateScenario({year:2026,revenue:100,expenses:0,deductions:0}),/2025/);
 assert.throws(()=>calculateScenario({year:2025,revenue:100,expenses:101,deductions:0}),/결손금/);
});
