import {answerQuestion} from '../public/lib/rag.mjs';
import {corpusStats} from '../public/data/corpus.mjs';
import {generateAnswer,DEFAULT_MODEL} from './generate.mjs';
import {safeAIError} from './ai-errors.mjs';
export const SECURITY_HEADERS=Object.freeze({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{...SECURITY_HEADERS,'Content-Type':'application/json; charset=utf-8'}});
async function readJSON(request){
 const reader=request.body?.getReader();if(!reader)return {};
 let size=0,parts=[];for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>12000){await reader.cancel();throw Object.assign(new Error(),{status:413});}parts.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw Object.assign(new Error(),{status:400});}
}
export function createApiHandler({apiKey,model=DEFAULT_MODEL,fetchImpl=fetch,requireIdentity=false,runtime='local',now=Date.now}={}){
 const buckets=new Map();let lastVerifiedAt=null;
 return async function handleAPI(request){
  const url=new URL(request.url),path=url.pathname;
  if(path!=='/runtime.json'&&!path.startsWith('/api/'))return null;
  const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json(403,{error:'이 화면에서 다시 요청해 주세요.'});
  if(path==='/runtime.json'&&request.method==='GET')return json(200,{version:'0.2.0',runtime,aiAvailable:!!apiKey?.trim(),aiModel:model,lastVerifiedAt,corpus:corpusStats});
  if(!['/api/ask','/api/ai/check'].includes(path))return json(404,{error:'경로를 찾을 수 없어요.'});
  if(request.method!=='POST')return json(405,{error:'POST 요청으로 이용해 주세요.'});
  if(requireIdentity&&!request.headers.get('oai-authenticated-user-id'))return json(401,{error:'본인 ChatGPT 계정으로 로그인한 뒤 이용해 주세요.',code:'SIGN_IN_REQUIRED'});
  if(!String(request.headers.get('content-type')).startsWith('application/json'))return json(415,{error:'JSON 형식으로 요청해 주세요.'});
  let input;try{input=await readJSON(request);}catch(e){return json(e.status||400,{error:e.status===413?'질문이 너무 길어요.':'요청 형식을 확인해 주세요.'});}
  if(!input||typeof input!=='object'||Array.isArray(input)||!['local','ai',undefined].includes(input.mode))return json(400,{error:'질문과 답변 방식을 확인해 주세요.'});
  const check=path==='/api/ai/check';let grounded;
  try{grounded=answerQuestion(check?'사업자등록 전 지출한 경비는 어떻게 검토하나요?':input.question);}catch(e){return json(400,{error:e.message});}
  if(!check&&input.mode!=='ai')return json(200,grounded);
  if(!apiKey?.trim())return json(503,safeAIError({code:'AI_NOT_CONFIGURED'}));
  if(!grounded.sources.length)return json(200,grounded);
  const time=now();for(const[k,b]of buckets)if(time-b.start>60000&&!b.active)buckets.delete(k);
  const identity=request.headers.get('oai-authenticated-user-id')||'local-user';
  const bucket=buckets.get(identity)||{start:time,count:0,active:false};buckets.set(identity,bucket);
  if(bucket.active)return json(409,{error:'이전 AI 요청을 처리 중이에요. 답변을 받은 뒤 다시 시도해 주세요.',code:'AI_BUSY'});
  if(bucket.count>=12)return json(429,{error:'요청이 많아요. 1분 뒤 다시 시도해 주세요.',code:'LOCAL_RATE_LIMIT'});
  bucket.count++;bucket.active=true;
  try{const result=await generateAnswer(grounded,{apiKey,model,fetchImpl});lastVerifiedAt=new Date(time).toISOString();return check?json(200,{ok:true,model,verifiedAt:lastVerifiedAt,sourceIds:result.sources.map(s=>s.id)}):json(200,result);}
  catch(e){const safe=safeAIError(e);return json(safe.code==='AI_TIMEOUT'?504:502,safe);}
  finally{bucket.active=false;}
 };
}
