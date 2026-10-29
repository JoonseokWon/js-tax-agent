import test from 'node:test';
import assert from 'node:assert/strict';
import {answerQuestion} from '../public/lib/rag.mjs';
import {generateAnswer,validateGenerated} from '../lib/generate.mjs';
import {createApiHandler} from '../lib/http-api.mjs';
const key='test-only-credential';
const result=(ids=['rates'])=>({status:'answered',answer:'공식 근거를 바탕으로 검토해요.',points:[{text:'개별 사실관계를 확인해야 해요.',sourceIds:ids}],missingFacts:['비용이 확정된 과세기간'],limitations:'과거 사례의 현재 적용 여부는 별도 확인이 필요해요.'});
const providerResponse=data=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(data)}]}]}));
const post=(path,body={},headers={})=>new Request('https://tax.example'+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('동적 인용 스키마와 회신/판례의 사실·한계를 실제 컨텍스트에 포함',async()=>{
 const grounded=answerQuestion('사업자등록 전 비용을 다음 과세기간에 공제하나요?');let payload;
 const answer=await generateAnswer(grounded,{apiKey:key,fetchImpl:async(url,options)=>{payload=JSON.parse(options.body);return providerResponse(result(['nts-2024-0703','nts-2004-1423']));}});
 const context=JSON.parse(payload.input).context;
 assert.ok(context.some(d=>d.number==='서면인터넷방문상담1팀-1423'&&d.referenceOnly&&d.limitations));
 assert.ok(context.every(d=>!d.referenceOnly||d.facts));assert.equal(payload.store,false);
 assert.deepEqual(new Set(payload.text.format.schema.properties.points.items.properties.sourceIds.items.enum),new Set(grounded.sources.map(d=>d.id)));
 assert.equal(answer.points[0].sourceIds.length,2);assert.equal(answer.model,'gpt-5.4-mini');
});
test('문장별 미제공 인용·빈 인용·비정상 형식·허위 링크 차단',()=>{
 const grounded=answerQuestion('종합소득세 세율은?');
 for(const value of [{...result(),points:[null]},{...result(),points:[]},{...result(),points:[{text:'문장',sourceIds:[]}]},{...result(),points:[{text:'문장',sourceIds:['made-up']}]},{...result(),limitations:'https://fake.example'},{...result(),missingFacts:[null]}])assert.throws(()=>validateGenerated(value,grounded),/AI_INVALID_RESPONSE/);
});
test('상위 API 인증·권한·모델·할당량·요청 제한 오류를 구분',async()=>{
 const grounded=answerQuestion('종합소득세 세율은?');
 for(const[status,upstreamCode,expected]of [[401,null,'AI_AUTH'],[403,null,'AI_ACCESS'],[404,null,'AI_MODEL'],[429,'insufficient_quota','AI_QUOTA'],[429,'rate_limit_exceeded','AI_RATE_LIMIT'],[500,null,'AI_UPSTREAM_ERROR']])await assert.rejects(()=>generateAnswer(grounded,{apiKey:key,fetchImpl:async()=>new Response(JSON.stringify({error:{code:upstreamCode,message:'sensitive upstream details'}}),{status})}),new RegExp(expected));
 await assert.rejects(()=>generateAnswer(grounded,{apiKey:key,fetchImpl:async()=>{throw Object.assign(new Error(),{name:'TimeoutError'});}}),/AI_TIMEOUT/);
});
test('설정 조회는 과금 API를 호출하지 않고 키를 노출하지 않음',async()=>{
 let calls=0;const handler=createApiHandler({apiKey:key,fetchImpl:async()=>{calls++;throw new Error();}});
 const response=await handler(new Request('https://tax.example/runtime.json'));const text=await response.text();assert.ok(!text.includes(key));assert.equal(JSON.parse(text).aiAvailable,true);assert.equal(calls,0);
 await handler(post('/api/ask',{question:'오늘 날씨는 어때요?',mode:'ai'}));assert.equal(calls,0);
});
test('실연결 확인은 공개 예시만 전송하고 성공 상태와 실제 인용을 반환',async()=>{
 let input;const handler=createApiHandler({apiKey:key,fetchImpl:async(url,options)=>{input=JSON.parse(JSON.parse(options.body).input);return providerResponse(result(['nts-2024-0703']));}});
 const response=await handler(post('/api/ai/check',{question:'사용자가 입력한 비공개 내용'}));const data=await response.json();assert.equal(data.ok,true);assert.ok(input.question.includes('사업자등록'));assert.ok(!JSON.stringify(input).includes('비공개 내용'));
 assert.ok((await(await handler(new Request('https://tax.example/runtime.json'))).json()).lastVerifiedAt);
});
test('호스팅 AI 요청의 로그인과 출처 검사, 키 미설정 안내',async()=>{
 const handler=createApiHandler({apiKey:'',requireIdentity:true});
 assert.equal((await handler(post('/api/ask',{question:'경비 질문',mode:'ai'}))).status,401);
 assert.equal((await handler(post('/api/ask',{question:'경비 질문'},{Origin:'https://other.example','oai-authenticated-user-id':'owner'}))).status,403);
 const response=await handler(post('/api/ask',{question:'필요경비 질문',mode:'ai'},{'oai-authenticated-user-id':'owner'}));assert.equal(response.status,503);assert.equal((await response.json()).code,'AI_NOT_CONFIGURED');
});
test('동시 AI 요청은 중복 과금을 막고, 분당 제한 후 다음 창에서 복구',async()=>{
 let release,clock=0;const waiting=new Promise(resolve=>release=resolve);
 const handler=createApiHandler({apiKey:key,now:()=>clock,fetchImpl:async()=>{await waiting;return providerResponse(result());}});
 const input=()=>post('/api/ask',{question:'종합소득세 세율은?',mode:'ai'});
 const first=handler(input());await new Promise(resolve=>setTimeout(resolve,15));assert.equal((await handler(input())).status,409);release();assert.equal((await first).status,200);
 for(let i=1;i<12;i++)assert.equal((await handler(input())).status,200);assert.equal((await handler(input())).status,429);clock=60001;assert.equal((await handler(input())).status,200);
});
test('원시 제공자 오류와 키가 브라우저 응답에 포함되지 않음',async()=>{
 const handler=createApiHandler({apiKey:key,fetchImpl:async()=>new Response(JSON.stringify({error:{message:key+' confidential'}}),{status:401})});
 const response=await handler(post('/api/ask',{question:'세율을 알려주세요',mode:'ai'}));const text=await response.text();assert.equal(response.status,502);assert.ok(!text.includes(key)&&!text.includes('confidential'));assert.equal(JSON.parse(text).code,'AI_AUTH');
});
