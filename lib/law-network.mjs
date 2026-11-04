import {lookup} from 'node:dns/promises';
import {get} from 'node:https';
import {isIPv4} from 'node:net';
import {Readable} from 'node:stream';

const LAW_HOST = 'www.law.go.kr';
const DNS_URL = 'https://cloudflare-dns.com/dns-query?name='+LAW_HOST+'&type=A';
const DNS_ERRORS = ['EAI_AGAIN','ENOTFOUND'];

export function createLawFetch({fetchImpl=fetch,lookupImpl=lookup,getImpl=get,now=Date.now}={}) {
  let cached;
  async function resolveHost(signal) {
    if (cached && cached.expires>now()) return cached.address;
    try {
      return (await lookupImpl(LAW_HOST,{family:4})).address;
    } catch (error) {
      if (!DNS_ERRORS.includes(error.code)) throw error;
      const reply = await fetchImpl(DNS_URL,{
        headers:{Accept:'application/dns-json'},signal,redirect:'error'
      });
      if (!reply.ok) throw error;
      const result = await reply.json();
      const answer = result.Status===0 && Array.isArray(result.Answer) &&
        result.Answer.find(record=>record.type===1&&isIPv4(record.data));
      if (!answer) throw error;
      const ttl = Math.min(300,Math.max(0,Number(answer.TTL)||0));
      cached = {address:answer.data,expires:now()+ttl*1000};
      return answer.data;
    }
  }

  return async function lawFetch(url,{signal}={}) {
    if (url.origin!=='https://'+LAW_HOST || url.username || url.password || !url.pathname.startsWith('/DRF/')) {
      throw new Error('지원하는 법제처 HTTPS 경로를 확인해 주세요.');
    }
    const address = await resolveHost(signal);
    return new Promise((resolve,reject)=>{
      getImpl(url,{
        signal,family:4,servername:LAW_HOST,rejectUnauthorized:true,
        headers:{Accept:'application/json','Accept-Encoding':'identity'},
        lookup:(hostname,options,callback)=>options.all?
          callback(null,[{address,family:4}]):callback(null,address,4)
      },response=>{
        const status=response.statusCode;
        if (status>=300 && status<400) {
          response.resume();
          reject(new Error('법제처 API가 주소를 변경했어요.'));
          return;
        }
        const body=[204,205].includes(status)?null:Readable.toWeb(response);
        if (!body) response.resume();
        resolve(new Response(body,{status,headers:response.headers}));
      }).once('error',reject);
    });
  };
}
