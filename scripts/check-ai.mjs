import {answerQuestion} from '../public/lib/rag.mjs';
import {generateAnswer,DEFAULT_MODEL} from '../lib/generate.mjs';
import {safeAIError} from '../lib/ai-errors.mjs';
try {
 const grounded=answerQuestion('사업자등록 전 지출한 경비를 다음 과세기간에 공제할 수 있나요?');
 const result=await generateAnswer(grounded,{apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||DEFAULT_MODEL});
 if(result.mode!=='ai'||!result.points?.length)throw new Error('근거를 포함한 답변을 확인하지 못했습니다.');
 console.log(JSON.stringify({ok:true,model:result.model,verifiedAt:new Date().toISOString(),question:result.question,answer:result.generated,points:result.points,sourceIds:result.sources.map(s=>s.id),limitations:result.limitations},null,2));
} catch(e) {
 const safe=safeAIError(e);console.error(JSON.stringify({ok:false,...safe}));process.exitCode=1;
}
