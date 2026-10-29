export class AIError extends Error {
 constructor(code){super(code);this.name='AIError';this.code=code;}
}
export const AI_MESSAGES=Object.freeze({
 AI_NOT_CONFIGURED:'AI 키가 아직 설정되지 않았어요. 안전한 키 설정 안내를 확인해 주세요.',
 AI_AUTH:'OpenAI API 키 인증에 실패했어요. 키의 유효 상태와 프로젝트를 확인해 주세요.',
 AI_ACCESS:'이 키로 요청한 모델을 사용할 수 없어요. 프로젝트 권한과 모델 설정을 확인해 주세요.',
 AI_MODEL:'설정한 모델을 찾을 수 없어요. OPENAI_MODEL을 확인해 주세요.',
 AI_QUOTA:'OpenAI API 사용 한도를 확인해 주세요. API 결제·크레딧 또는 프로젝트 한도가 부족할 수 있어요.',
 AI_RATE_LIMIT:'OpenAI 요청이 잠시 제한됐어요. 잠시 뒤 다시 시도해 주세요.',
 AI_TIMEOUT:'AI 응답 시간이 길어졌어요. 입력은 유지했으니 잠시 뒤 다시 시도해 주세요.',
 AI_NETWORK:'OpenAI에 연결하지 못했어요. 인터넷 연결과 서버의 외부 통신 설정을 확인해 주세요.',
 AI_INCOMPLETE:'AI 답변이 끝까지 생성되지 않았어요. 다시 시도해 주세요.',
 AI_INVALID_RESPONSE:'AI 답변의 근거 형식을 확인하지 못했어요. 원문을 확인하거나 다시 시도해 주세요.',
 AI_UPSTREAM_ERROR:'AI 서비스에서 답변을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.'
});
export function safeAIError(error){const code=AI_MESSAGES[error?.code]?error.code:'AI_UPSTREAM_ERROR';return {code,error:AI_MESSAGES[code]};}
