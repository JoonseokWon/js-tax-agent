import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {answerQuestion} from './public/lib/rag.mjs';
import {generateAnswer} from './lib/generate.mjs';
const root=path.resolve(fileURLToPath(new URL('./public/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
export function createApp({apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL,fetchImpl=fetch}={}){
 const requests=new Map();
 return http.createServer(async(req,res)=>{
  const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
  function json(code,data){res.writeHead(code,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
  try{
   const host=req.headers.host||'';
   if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))return json(403,{error:'로컬 주소로 접속해 주세요.'});
   if(req.headers.origin && req.headers.origin!==`http://${host}`)return json(403,{error:'이 화면에서 다시 요청해 주세요.'});
   const url=new URL(req.url,`http://${host}`);
   if(url.pathname==='/runtime.json'&&req.method==='GET')return json(200,{aiAvailable:!!apiKey&&!!model});
   if(url.pathname==='/api/ask'&&req.method==='POST'){
    if(!String(req.headers['content-type']).startsWith('application/json'))return json(415,{error:'JSON 형식으로 요청해 주세요.'});
    const now=Date.now();for(const[k,v]of requests)if(now-v.start>60000)requests.delete(k);
    const addr=req.socket.remoteAddress,r=requests.get(addr)||{start:now,count:0};r.count++;requests.set(addr,r);
    if(r.count>12)return json(429,{error:'요청이 많아요. 1분 뒤 다시 시도해 주세요.'});
    let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>12000)return json(413,{error:'질문이 너무 길어요.'});}
    let input;try{input=JSON.parse(data);}catch{return json(400,{error:'요청 형식을 확인해 주세요.'});}
    if(!input||typeof input!=='object'||Array.isArray(input)||!['local','ai',undefined].includes(input.mode))return json(400,{error:'질문과 답변 방식을 확인해 주세요.'});
    let grounded;try{grounded=answerQuestion(input.question);}catch(e){return json(400,{error:e.message});}
    if(input.mode!=='ai')return json(200,grounded);
    if(!apiKey||!model)return json(503,{error:'생성 AI가 설정되지 않았어요. 근거로 답변 보기를 이용해 주세요.'});
    try{return json(200,await generateAnswer(grounded,{apiKey,model,fetchImpl}));}
    catch{return json(502,{error:'생성 AI 답변을 받지 못했어요. 다시 시도하거나 근거로 답변 보기를 이용해 주세요.'});}
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
 createApp().listen(port,'127.0.0.1',()=>console.log(`JS Tax Agent: http://127.0.0.1:${port}\n종료: Ctrl+C`));
}
