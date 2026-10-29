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
