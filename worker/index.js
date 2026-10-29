// Sites Worker ESM starter의 fetch 계약. 화면 자산은 빌드 시 단일 모듈에 포함한다.
import assets from 'virtual:tax-assets';
import {createApiHandler,SECURITY_HEADERS} from '../lib/http-api.mjs';
import {DEFAULT_MODEL} from '../lib/generate.mjs';
let api,lastKey,lastModel;
export default {
 async fetch(request,env){
  const key=env.OPENAI_API_KEY||'',model=env.OPENAI_MODEL||DEFAULT_MODEL;
  if(!api||key!==lastKey||model!==lastModel){lastKey=key;lastModel=model;api=createApiHandler({apiKey:key,model,requireIdentity:true,runtime:'hosted'});}
  const response=await api(request);if(response)return response;
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:SECURITY_HEADERS});
  const url=new URL(request.url),asset=assets[url.pathname==='/'?'/index.html':url.pathname];
  if(!asset)return new Response('Not found',{status:404,headers:SECURITY_HEADERS});
  return new Response(request.method==='HEAD'?null:asset.body,{headers:{...SECURITY_HEADERS,'Content-Type':asset.type}});
 }
};
