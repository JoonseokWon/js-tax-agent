import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
test('정적 빌드는 재현 가능하고 이전 생성 파일을 포함하지 않음',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const build=()=>{const p=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(p.status,0,p.stderr);};
 build();const first=await readFile(new URL('../dist/build-manifest.json',import.meta.url),'utf8');
 await writeFile(new URL('../dist/stale-test.txt',import.meta.url),'must not ship');build();
 const second=await readFile(new URL('../dist/build-manifest.json',import.meta.url),'utf8');assert.equal(first,second);
 const manifest=JSON.parse(second);assert.equal(manifest.files.length,8);assert.ok(!manifest.files.some(x=>x.path==='build-manifest.json'||x.path==='stale-test.txt'));
 for(const entry of manifest.files){const data=await readFile(new URL('../dist/'+entry.path,import.meta.url));assert.equal(createHash('sha256').update(data).digest('hex'),entry.sha256);}
});
test('Sites 단일 Worker 번들은 자산·동적 API·로그인 검사 계약을 유지',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));const p=spawnSync(process.execPath,['scripts/build-site.mjs'],{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(p.status,0,p.stderr);
 const source=await readFile(new URL('../dist/server/index.js',import.meta.url),'utf8');
 const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
 const env={OPENAI_API_KEY:'test-credential-not-in-bundle'};
 const home=await worker.fetch(new Request('https://tax.example/'),env);assert.equal(home.status,200);assert.match(await home.text(),/source-kind/);
 const runtime=await worker.fetch(new Request('https://tax.example/runtime.json'),env);const status=await runtime.text();assert.equal(JSON.parse(status).runtime,'hosted');assert.ok(!status.includes(env.OPENAI_API_KEY));
 const request=new Request('https://tax.example/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'경비는?',mode:'ai'})});assert.equal((await worker.fetch(request,env)).status,401);
 assert.equal((await worker.fetch(new Request('https://tax.example/.env'),env)).status,404);assert.ok(!source.includes(env.OPENAI_API_KEY));
});
