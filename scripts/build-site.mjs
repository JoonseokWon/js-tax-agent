import {build} from 'esbuild';
import {readFile,readdir,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const output=path.join(root,'dist');
if(path.dirname(output)!==root||path.basename(output)!=='dist')throw new Error('빌드 출력 경로 오류');
const manifest=JSON.parse(await readFile(path.join(root,'.openai/hosting.json'),'utf8'));
if(manifest.static)throw new Error('Worker 배포 manifest에는 static.directory를 사용하지 않습니다.');
const assets={};const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
async function collect(directory){for(const e of await readdir(directory,{withFileTypes:true})){const p=path.join(directory,e.name);if(e.name.startsWith('.'))throw new Error('숨김 파일은 웹 자산에 포함할 수 없습니다.');if(e.isDirectory())await collect(p);else{const type=types[path.extname(p)];if(!type)throw new Error('허용하지 않은 정적 자산 형식');assets['/'+path.relative(path.join(root,'public'),p).replaceAll('\\','/')]={body:await readFile(p,'utf8'),type};}}}
await collect(path.join(root,'public'));
await rm(output,{recursive:true,force:true});await mkdir(path.join(output,'server'),{recursive:true});await mkdir(path.join(output,'.openai'),{recursive:true});
await build({absWorkingDir:root,tsconfigRaw:{},entryPoints:['worker/index.js'],outfile:path.join(output,'server/index.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',charset:'utf8',plugins:[{name:'tax-assets',setup(b){b.onResolve({filter:/^virtual:tax-assets$/},()=>({path:'assets',namespace:'tax-assets'}));b.onLoad({filter:/.*/,namespace:'tax-assets'},()=>({contents:'export default '+JSON.stringify(assets),loader:'js'}));}}]});
await writeFile(path.join(output,'.openai/hosting.json'),JSON.stringify(manifest,null,2)+'\n');
const source=await readFile(path.join(output,'server/index.js'),'utf8');const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
if(typeof module.default?.fetch!=='function')throw new Error('Worker fetch 계약 오류');
console.log(`Sites Worker 빌드 완료: ${Buffer.byteLength(source)} bytes, 웹 자산 ${Object.keys(assets).length}개 내장`);
