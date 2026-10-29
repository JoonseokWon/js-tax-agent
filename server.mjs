import http from 'node:http';
import {Readable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createApiHandler,SECURITY_HEADERS} from './lib/http-api.mjs';
import {DEFAULT_MODEL} from './lib/generate.mjs';
const root=path.resolve(fileURLToPath(new URL('./public/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
export function createApp({apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL||DEFAULT_MODEL,fetchImpl=fetch}={}){
 const handleAPI=createApiHandler({apiKey,model,fetchImpl});
 return http.createServer(async(req,res)=>{
  const headers=SECURITY_HEADERS;
  function json(code,data){res.writeHead(code,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
  try{
   const host=req.headers.host||'';
   if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))return json(403,{error:'로컬 주소로 접속해 주세요.'});
   if(req.headers.origin && req.headers.origin!==`http://${host}`)return json(403,{error:'이 화면에서 다시 요청해 주세요.'});
   const url=new URL(req.url,`http://${host}`);
   if(url.pathname==='/runtime.json'||url.pathname.startsWith('/api/')){
    const requestHeaders=new Headers();for(const[key,value]of Object.entries(req.headers))if(value)requestHeaders.set(key,Array.isArray(value)?value.join(','):value);
    const request=new Request(url,{method:req.method,headers:requestHeaders,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
    const response=await handleAPI(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return json(405,{error:'지원하지 않는 요청이에요.'});
   if(url.pathname.startsWith('/api/'))return json(404,{error:'경로를 찾을 수 없어요.'});
   let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{return json(400,{error:'주소를 확인해 주세요.'});}
   if(pathname.includes('\\')||pathname.split('/').some(s=>s.startsWith('.')))return json(404,{error:'파일을 찾을 수 없어요.'});
   const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
   if(!file.startsWith(root+path.sep))return json(404,{error:'파일을 찾을 수 없어요.'});
   const body=await readFile(file);
   res.writeHead(200,{...headers,'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:body);
  }catch(e){if(e.code==='ENOENT'||e.code==='EISDIR')return json(404,{error:'파일을 찾을 수 없어요.'});json(500,{error:'처리하지 못했어요. 다시 시도해 주세요.'});}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||4317);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT는 1~65535 정수여야 합니다.');
 createApp().listen(port,'127.0.0.1',()=>console.log(`JS Tax Agent: http://127.0.0.1:${port}\nAI: ${process.env.OPENAI_API_KEY?'키 설정됨 (실연결 확인은 화면 버튼)':'키 미설정 · setup-ai.ps1 안내 참고'}\n종료: Ctrl+C`));
}
