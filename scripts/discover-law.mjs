import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {changedLaws,discoverTaxLaw} from '../lib/law-discovery.mjs';
import {LAW_REVIEW,isCalendarDate} from '../public/lib/law-review.mjs';

const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
const [selection='all',date=today,pages='1'] = process.argv.slice(2);
const taxes = selection==='all'?Object.keys(LAW_REVIEW):[selection];
const out = new URL('../outputs/',import.meta.url);
try {
  if (!process.env.LAW_OPEN_DATA_OC?.trim()) throw new Error('승인된 법제처 API 인증값을 LAW_OPEN_DATA_OC에 설정해 주세요. docs/law-discovery.md를 참고하세요.');
  if (!isCalendarDate(date)||taxes.some(tax=>!Object.hasOwn(LAW_REVIEW,tax))) throw new Error('사용법: node scripts/discover-law.mjs [income|corporate|vat|all] [YYYY-MM-DD] [페이지 수]');
  await mkdir(out,{recursive:true});
  for (const tax of taxes) {
    const file = new URL('law-discovery-'+tax+'.json',out);
    const temp = new URL('law-discovery-'+tax+'-'+process.pid+'.tmp',out);
    let previous;
    try { previous=JSON.parse(await readFile(file,'utf8')); }
    catch (error) { if (error.code!=='ENOENT') throw new Error('기존 검토 후보 파일을 읽을 수 없어요. 파일을 확인하세요.'); }
    const report = await discoverTaxLaw({tax,date,today,maxPages:Number(pages),oc:process.env.LAW_OPEN_DATA_OC,pause:()=>delay(600)});
    report.changedLaws=changedLaws(previous,report);
    await writeFile(temp,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    await rename(temp,file);
    console.log(tax+' · '+report.laws.length+'개 법령 연혁 · 해석 '+report.candidates.ntsCgmExpc.records.length+'건 · 판례 '+report.candidates.prec.records.length+'건');
    console.log('검토 후보: outputs/law-discovery-'+tax+'.json · 변경 확인: '+(report.changedLaws.join(', ')||'기록된 변경 없음'));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode=1;
}
