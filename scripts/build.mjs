import {cp,mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(root,'dist');
// 생성 디렉터리의 절대 위치가 프로젝트 바로 아래 dist인지 확인한 뒤 재생성.
if(path.dirname(path.resolve(dist))!==path.resolve(root)||path.basename(dist)!=='dist')throw new Error('빌드 출력 위치를 확인하세요.');
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
await cp(path.join(root,'public'),dist,{recursive:true});
const files=[];
async function visit(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await visit(p);else files.push({path:path.relative(dist,p).replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(p)).digest('hex')});}}
await visit(dist);
await writeFile(path.join(dist,'build-manifest.json'),JSON.stringify({version:'0.1.0',files},null,2)+'\n');
console.log(`정적 체험판 빌드 완료: dist (${files.length}개 파일)`);
