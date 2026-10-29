import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server.mjs';
import {generateAnswer} from '../lib/generate.mjs';
import {answerQuestion} from '../public/lib/rag.mjs';
async function withServer(t,options={}){const server=createApp(options);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));return 'http://127.0.0.1:'+server.address().port;}
test('화면·모듈은 제공하고 비밀/상위 경로는 차단',async t=>{
 const base=await withServer(t,{apiKey:'',model:''});
 const response=await fetch(base+'/');assert.equal(response.status,200);assert.match(await response.text(),/JS Tax Agent/);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 for(const route of ['/app.mjs','/lib/rag.mjs','/data/corpus.mjs','/style.css'])assert.equal((await fetch(base+route)).status,200,route);
 for(const route of ['/.env','/server.mjs','/docs/spec.md','/%2eenv','/..%5c.env'])assert.equal((await fetch(base+route)).status,404,route);
 const status=await(await fetch(base+'/runtime.json')).json();assert.equal(status.aiAvailable,false);assert.equal(status.version,'0.2.0');assert.equal(status.corpus.total,11);assert.equal(status.lastVerifiedAt,null);
});
test('JSON 입력 오류·미설정 AI·비정상 출처 처리',async t=>{
 const base=await withServer(t,{apiKey:'',model:''});const post=body=>fetch(base+'/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body});
 assert.equal((await post('{')).status,400);assert.equal((await post('null')).status,400);assert.equal((await post(JSON.stringify({question:' '}))).status,400);
 const local=await post(JSON.stringify({question:'필요경비는 무엇인가요?'}));assert.equal(local.status,200);assert.equal((await local.json()).mode,'local');
 assert.equal((await post(JSON.stringify({question:'필요경비는 무엇인가요?',mode:'ai'}))).status,503);
 assert.equal((await fetch(base+'/api/ask',{method:'POST',headers:{'Origin':'https://untrusted.example','Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await post(JSON.stringify({question:'가'.repeat(13000)}))).status,413);
});
test('Responses 계약: 키는 헤더, store false, 제공 근거와 질문만 전송',async()=>{
 const grounded=answerQuestion('2025년 종합소득세 세율은?');let received;
 const result=await generateAnswer(grounded,{apiKey:'test-placeholder',model:'test-model',fetchImpl:async(url,options)=>{
  received={url,options};return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({status:'answered',answer:'과세표준에 따라 기본세율을 적용해요.',points:[{text:'2025년 기본세율을 확인하세요.',sourceIds:['rates']}],missingFacts:[],limitations:'개별 세액공제 등은 별도 검토가 필요해요.'})}]}]}),{status:200});
 }});
 assert.equal(received.url,'https://api.openai.com/v1/responses');const body=JSON.parse(received.options.body);assert.equal(body.store,false);assert.equal(body.text.format.type,'json_schema');assert.ok(!received.options.body.includes('test-placeholder'));assert.ok(!received.options.body.includes('revenue'));assert.equal(result.mode,'ai');assert.equal(result.sources[0].id,'rates');
});
test('미제공 인용·외부 링크·불완전 답변·상위 오류 거부',async()=>{
 const grounded=answerQuestion('종합소득세 세율은?');
 for(const payload of [{status:'incomplete'},...['unknown','rates'].map(id=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({answer:id==='rates'?'https://fake.example':'내용',sourceIds:[id]})}]}]}))])await assert.rejects(()=>generateAnswer(grounded,{apiKey:'test',model:'test',fetchImpl:async()=>new Response(JSON.stringify(payload))}));
 await assert.rejects(()=>generateAnswer(grounded,{apiKey:'test',model:'test',fetchImpl:async()=>new Response('{}',{status:429})}),/AI_RATE_LIMIT/);
});
test('서버가 생성 오류를 사용자 안내로 변환',async t=>{
 const base=await withServer(t,{apiKey:'test',model:'test',fetchImpl:async()=>{throw new Error('test');}});
 const r=await fetch(base+'/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'세율을 알려주세요',mode:'ai'})});assert.equal(r.status,502);assert.equal((await r.json()).code,'AI_NETWORK');
});
