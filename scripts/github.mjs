// GitHub 연결 도구에 없는 저장소 생성·Release 작업용 공식 REST 어댑터.
// Git Credential Manager의 기존 GitHub 인증을 메모리에서만 사용합니다.
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const [action='probe',repo='js-tax-agent',...args]=process.argv.slice(2);
const p=spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'},windowsHide:true});
const values=Object.fromEntries((p.stdout||'').trim().split(/\r?\n/).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)];}));
if(!values.password){console.error('GITHUB_AUTH_UNAVAILABLE: Git Credential Manager에 사용 가능한 GitHub 인증이 없습니다.');process.exit(2);}
const headers={'Authorization':`Bearer ${values.password}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'JS-Tax-Agent-release'};
async function api(route,options={}){const r=await fetch('https://api.github.com'+route,{...options,headers:{...headers,...options.headers}});const data=await r.json();if(!r.ok)throw new Error(`GitHub ${r.status}: ${data.message}`);return data;}
try{
 const user=await api('/user');
 if(action==='probe'){console.log(JSON.stringify({login:user.login}));}
 else {
 if(user.login!=='JoonseokWon')throw new Error('연결된 GitHub 사용자와 로컬 인증 사용자가 다릅니다.');
 if(action==='create'){
  const r=await fetch(`https://api.github.com/repos/${user.login}/${repo}`,{headers});
  if(r.ok)throw new Error('동일 이름의 저장소가 이미 있습니다. 기존 저장소를 변경하지 않았습니다.');
  if(r.status!==404)throw new Error('저장소 존재 여부를 확인하지 못했습니다.');
  const data=await api('/user/repos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:repo,description:'공식 근거로 살펴보는 종합소득세 · 2025년 귀속 근거 검색과 세액 비교',private:false,auto_init:false,has_issues:true})});
  console.log(JSON.stringify({url:data.html_url,clone_url:data.clone_url,private:data.private}));
 }else if(action==='release'){
  const[tag,bodyFile,...assets]=args;
  const data=await api(`/repos/${user.login}/${repo}/releases`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tag_name:tag,name:'JS Tax Agent '+tag,body:await readFile(bodyFile,'utf8'),draft:false,prerelease:true})});
  for(const asset of assets){const filename=asset.replaceAll('\\','/').split('/').at(-1);const r=await fetch(data.upload_url.split('{')[0]+'?name='+encodeURIComponent(filename),{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:await readFile(asset)});if(!r.ok)throw new Error(`릴리스 자산 업로드 실패: ${r.status}`);const a=await r.json();console.log(JSON.stringify({asset:a.name,size:a.size,url:a.browser_download_url}));}
  console.log(JSON.stringify({url:data.html_url,tag:data.tag_name,prerelease:data.prerelease}));
 }else if(action==='check'){
  const repository=await api(`/repos/${user.login}/${repo}`);const release=await api(`/repos/${user.login}/${repo}/releases/latest`).catch(()=>null);const releases=release?[release]:await api(`/repos/${user.login}/${repo}/releases`);
  console.log(JSON.stringify({url:repository.html_url,private:repository.private,branch:repository.default_branch,releases:releases.map(r=>({url:r.html_url,tag:r.tag_name,assets:r.assets.map(a=>({name:a.name,size:a.size}))}))}));
 }else throw new Error('지원하지 않는 작업입니다.');
 }
}catch(e){console.error(e.message);process.exitCode=1;}
