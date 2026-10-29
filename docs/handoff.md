# JS Tax Agent 인계

## v0.2 진행 인계 (2026-10-29)

- 최근 사용자 지시: 추가 결제나 자동 결제가 필요하면 중단한다. 무료 크레딧만 사용하며 충전·카드 등록·자동 충전·유료 잔액 사용은 승인하지 않았다. 새 키 1개를 승인된 로컬 `.env`에 저장했고 공개 예시 실제 API 호출 2건이 성공했다. 결제 설정은 변경하지 않았다.
- 로그인한 공식 Platform 결제 화면에서 무료 구독 혜택을 확인했다. 자동 수령 도구가 없어 사용자가 직접 Link & claim을 완료했으며, 지급 잔액·Available 상태·만료일을 확인했다. 결제 수단 화면은 유료 결제 플랜을 시작하지 않았다고 표시한다. 현재 무료 크레딧으로 진행 가능하지만, 추가 결제가 필요하거나 자동 결제가 가능한 상태로 바뀌면 중단한다.
- 계정별 금액·만료일 등 비공개 확인 기록과 화면은 Git 무시 대상인 outputs/에만 둔다. 공개 저장소에 계정 결제 화면·잔액 캡처를 포함하지 않는다. 연결 도구 목록에는 preview_api_credit_promo/discover_api_orgs/link_api_org가 없어 자동 수령은 시도하지 않았다.
- 보안 picker가 선택값을 반환하지 않는 문제가 반복돼 같은 창을 다시 열지 않았다. 런처에 대상 ID가 없고 MCP Apps 목록에도 선택 UI가 없음을 확인했다. picker가 정상적으로 열리지 않는 것으로 판단해 스킬의 로컬 fallback을 사용했다. 연결 가능한 기본 대상은 하나였다. native 저장 위치 확인에서 `.env`/OPENAI_API_KEY를 명시적으로 승인받고 키를 암호화 생성·로컬 복호화했다. 생성된 조직/프로젝트가 무료 크레딧 확인 대상과 일치함을 검사했다. 키 이름은 JS Tax Agent v0.2이며 값은 출력하지 않았다.
- 사용자 추가 범위: 종합소득세 v0.2 검증·배포를 마친 뒤 법인세와 부가가치세도 진행한다. 이 순서를 유지한다.

- 사용자 요청: 공식 질의회신·판례 추가와 실제 AI 연결. 기존 첫 버전 범위와 GitHub 공개/릴리스 요청을 유지한다.
- 국세청 회신 3개·대법원 판례 3개를 공식 본문에서 검증해 수록했다. 총 11개 자료. 사례의 번호·날짜·사실관계·판단·한계를 표시하고 계산 귀속연도와 분리했다.
- 등록 전 비용 두 회신 동시 검색, 문서·사건번호 정확 검색과 종류 필터를 구현했다.
- Responses API에 문장별 제공 근거 ID·추가 확인 사실·적용 한계 구조를 연결했다. 인증/권한/모델/할당량/속도/시간초과/통신 오류를 구분한다. 키와 원시 오류 본문은 브라우저로 보내지 않는다.
- 로컬 Node와 Sites Worker가 `lib/http-api.mjs`를 공유한다. Worker는 로그인 헤더를 요구하며 기존 사이트의 개인 접근 권한을 유지한다. 웹 자산은 esbuild로 단일 Worker에 내장한다.
- `node scripts/test.mjs`: 현재 테스트 31개 통과. 과거 outputs/압축 해제본까지 중복 실행되는 `node --test` 대신 현재 tests/만 명시적으로 실행하도록 변경했다.
- 크레딧 잔액 소진 오류를 속도 제한과 구분하도록 보완하고 `node --test tests/ai.test.mjs` 8개 재통과. 이 오류 처리 검증은 모의 응답으로 수행했다.
- 이후 실제 검증: `node --env-file=.env scripts/check-ai.mjs`의 개업 전 비용 질문이 성공했고 두 상호 보완 국세청 회신을 인용했다. 브라우저에서 초과인출금 이자 판례 질문도 실제 성공했고 2022두32382/2009두11874의 추정·증명·파기환송 한계를 유지했다. 검토 메모 다운로드 내용 확인 완료. 실제 공개 예시 2건이며 전수 정확성 평가는 아니다.
- 최종 전체 테스트 31개·Worker 빌드 통과. AI 화면 1440×1000/390×844 확인, 모바일 지우기 문구 줄바꿈을 수정하고 301px 너비의 두 답변 버튼과 가로 넘침 없음을 재확인했다. AI 캡처는 docs/screenshots/v0.2/desktop-ai.png, mobile-ai.png, mobile-controls.png.
- 1440×1000/390×844에서 회신 두 건 표시·판례 필터·사건번호→질문·사실관계/한계 펼침을 확인했다. 모바일 가로 넘침 없음. 캡처는 docs/screenshots/v0.2/.
- 새 개발 의존성 esbuild 0.28.2, pnpm 11.25.0. 런타임 서버에는 외부 패키지가 필요 없다. 의존성 store는 프로젝트 .pnpm-store/에만 둔다. pnpm 11은 .npmrc 대신 pnpm-workspace.yaml의 설정을 읽으므로 해당 위치로 수정했고, 검증한 esbuild 버전의 설치 스크립트만 허용했다.
- Windows 샌드박스에서는 Go 기반 esbuild가 상위 폴더 탐색을 거절당한다. 일반 Windows 사용자 권한 실행에서 Worker 빌드와 전체 테스트가 통과했다. 코드/검사 기준을 낮추지 않았다.
- **키 상태:** 로컬 `.env`에 승인된 키 설정, 실제 호출 확인 완료. Sites 환경변수 revision 0/항목 없음 확인. 현재 도구의 value 인자는 문자열이며 로컬 비밀 파일 참조를 받지 않는다. plaintext를 도구 출력으로 읽거나 소스/번들에 넣는 우회는 하지 않았다. 사용자에게 Sites 환경변수 화면 확인을 요청했으나 설정 화면을 찾을 수 없다는 답을 받았다. 같은 질문을 반복하지 않는다.
- **다음 순서:** Sites 런타임 비밀값을 안전하게 등록할 경로 확보 → 기존 Site에 Worker 배포 및 인증 후 AI 검증 → 종합소득세 완료 후 법인세·부가가치세 순서 확장. 등록 전 호스팅 AI가 연결됐다고 표시하지 않는다. 잔액 부족·만료·추가 결제 필요 시 충전하지 않고 중단한다.
- 키 작업은 `C:/Users/user/.codex/plugins/cache/openai-curated-remote/openai-developers/1.3.13/skills/openai-platform-api-key/SKILL.md`를 따른다. plaintext 출력·키가 든 .env 읽기·Git 포함 금지. picker 선택값을 추측하지 않는다.
- 현재 로컬 AI QA 서버 http://127.0.0.1:4327, exec session 4774. `.env`를 읽고 실행 중이며 실제 AI 확인 완료. 초기 키 없는 QA 서버는 4317/session 50586이었다. 기본 실행은 `node --env-file-if-exists=.env server.mjs`이며 포트는 환경변수 PORT로 바꾼다. 브라우저 tab 5를 사용했다.
- **GitHub v0.2.0 공개 완료:** https://github.com/JoonseokWon/js-tax-agent/releases/tag/v0.2.0 · draft=false, prerelease=true. 소스/태그 커밋 `0525d7ed9ac46355dd28b5ec2b7983bc7038cb18`.
- 실행 ZIP 624,991바이트와 SHA256SUMS-v0.2.0.txt 게시. SHA-256 `7b338f3051cffea22c6c0f77e124f88938dbe5162a18271711b1e96080e2af8c`. 익명 다운로드 결과 일치. 새 폴더 압축 해제 후 키 없는 서버·자료 검색·비밀 파일 차단을 확인했고, 패키지와 Worker 54개 파일에서 실제 키 미포함을 검사했다.
- **원격 CI:** https://github.com/JoonseokWon/js-tax-agent/actions/runs/40821323059 및 40821322435 모두 completed/success, 태그 커밋과 일치. pnpm 고정 설치·31개 테스트·정적/Worker 빌드 단계 각각 success 확인.
- **Sites v0.2는 미배포:** 서버 비밀값 전달이 미완료라 기존 v0.1 개인 접근 체험판을 유지한다. GitHub 공개 릴리스와 호스팅 AI 배포의 완료 여부를 혼동하지 않는다. 아래는 v0.1 완료 기록이다.

## 목적과 현재 상태

- UI·UX 적용 여부: 적용 / 화면 있음.
- 2025년 귀속 종합소득세의 근거 검색·요약, 단일 사업소득 가정별 산출세액 비교, 메모 다운로드를 구현했다.
- 새 프로젝트 폴더와 전용 Git 저장소에 격리했으며 기존 메일 자동화 등 다른 프로젝트는 수정하지 않았다.
- 자동 테스트 17개와 데스크톱/모바일 실제 화면 검증 완료. Sites 배포 성공, GitHub 공개 소스와 v0.1.0 프리릴리스 게시 및 자산 검증 완료.

## 완료한 작업

- spec/plan/todo/design 작성, 공식 출처의 기간·확인일을 분리한 코퍼스 작성.
- 한국어 키워드·동의어 검색과 근거 부족/미지원 범위 답변 유보.
- 누진세 계산과 A/B 비교, 정수/상한/결손금/연도 검증.
- 질문→근거→비교→메모, 보관함 필터, 오류 복구·로딩·빈 상태·포커스 표시.
- 선택형 로컬 OpenAI Responses 생성 RAG, 제공 근거 ID 검증, API 실패 안내. 모의 응답 테스트 완료.
- 실행 스크립트·정적 빌드·CI 설정·라이선스·릴리스 노트 작성.

## 중요한 결정과 이유

- 사용자 선택으로 종합소득세부터 시작. 공식 연도별 표가 검증된 2025년만 계산 지원.
- 키 없이 실행 가능한 기본 모드는 로컬 자료 요약. 생성 AI를 쓴 것처럼 표시하지 않음.
- 현재 시행 소득세법 제27조는 2026년 참고 자료라 2025년 답변 검색에서 제외. 과거 법령/부칙을 임의 추정하지 않음.
- 런타임 패키지 의존성 없이 Node 표준 API·ES 모듈·HTML/CSS 사용. Windows에서 설치 단계를 줄이고 정적 호스팅에서도 핵심 기능 유지.
- Sites 체험판은 정적 기능만 제공하고 기본 개인 접근 권한을 유지. GitHub 소스 공개 요청과 별개다.
- 생성 AI 질문 전송은 별도 버튼으로 사용자가 선택. 키는 서버, 질문/검색 문단만 API 전송, 계산 금액은 미전송.

## 실행과 관련 파일

```powershell
Set-Location -LiteralPath 'C:\Users\user\Documents\For ax node Project\JS Tax Agent'
node server.mjs
# http://127.0.0.1:4317
node --test
node scripts/build.mjs
```

Node 22.9 이상. `.env.example`을 `.env`로 복사해 키/모델을 설정하면 `node --env-file-if-exists=.env server.mjs` 또는 `start.ps1`로 생성 AI 기능을 켠다. API 실호출은 아직 검증하지 않았다.

코드 `public/`, `server.mjs`, `lib/`; 테스트 `tests/`; 배포/빌드 `scripts/`, `.openai/hosting.json`; 요구사항/설계/진행 `docs/`; 공식 출처 `docs/sources.md`; 실제 검증과 조사 이력 `docs/validation.md`.

## 남은 작업과 다음 행동

1. 실제 API 키로 생성 답변의 정확성·인용 충실도·실패 복구를 평가한다.
2. 2025년 당시 법령/부칙과 국세청 질의회신·예규·판례를 문서번호와 원문 중심으로 수록한다. 임베딩 검색과 질문 평가 세트를 추가한다.
3. 2026년 이후 세액 규칙과 세액공제·지방소득세는 별도 검증 후 확장한다.

## 실패한 접근과 확인된 원인

- 광범위한 상위 파일 검색은 무관한 검증 폴더의 읽기 제한을 만남. 새 프로젝트가 없음을 상위 목록으로 확인하고 해당 프로젝트 안에서만 작업했다.
- 샌드박스 계정의 Git Credential Manager에는 GitHub 인증이 없어 최초 probe가 실패했다. 일반 Windows 사용자 계정에는 기존 인증이 있었고, 승인된 실행 환경에서 같은 GitHub 사용자 `JoonseokWon`임을 확인하여 추가 로그인 없이 저장소 생성에 성공했다. 인증값은 메모리에서만 사용했다.
- Sites 첫 소스 업로드는 샌드박스 네트워크 차단으로 실패. 일반 계정에서는 새 Git 폴더 소유자 차이로 Git 검사가 막혔다. 이 프로젝트의 절대 경로만 해당 프로세스의 safe.directory로 지정하여 성공했다. 전역 설정은 바꾸지 않았다.
- Sites 아카이브 도구는 임의 release/ 위치를 받지 않아, 도구가 지원하는 프로젝트 내부의 무시된 outputs/ 경로로 수정했다.
- GitHub 태그 첫 push에서 원격 `fatal error in commit_refs` 발생. 원격 main 성공·태그 미등록을 확인한 뒤 태그만 재시도하여 성공. 코드/검사 기준을 변경하지 않았다.
- 법령센터의 2025년 날짜 지정 URL을 도구로 읽을 수 없어 2025 적용 검증 완료로 처리하지 않았다. 확인 가능한 2026년 원문은 참고 자료로만 수록했다.

## 배포 기록

- Sites 프로젝트: `appgprj_6ae2b6df48a881919a4d6293c682de23`. `.openai/hosting.json`의 ID를 재사용한다.
- Sites: https://js-tax-agent.keengiant19.chatgpt.site · 배포 `appgdep_6ae2bc6cca98819196839ce2cad8e70d`, 상태 succeeded. 소스 `7987dac5229874e5116f4021e810b7c2dde228ef`, 기본 개인 접근 유지.
- GitHub: https://github.com/JoonseokWon/js-tax-agent · private=false, 소스 push 완료.
- Release: https://github.com/JoonseokWon/js-tax-agent/releases/tag/v0.1.0 · draft=false, prerelease=true, 태그 커밋 `096caf3c6052afca2f964ef5871f4f943ae5cad3`.
- 자산: `js-tax-agent-v0.1.0.zip` 289,732바이트와 `SHA256SUMS.txt`. 로그인 없는 공개 다운로드 후 로컬 원본 SHA-256 일치 확인. ZIP을 프로젝트 outputs/package-check/에 새로 풀어 테스트 17개 재통과.
- 원격 CI: https://github.com/JoonseokWon/js-tax-agent/actions/runs/40812207475 · completed/success, 태그 커밋 일치.
- Sites 실제 접속은 ChatGPT 로그인 게이트를 표시. 배포 도구의 succeeded를 확인했으며 인증 뒤 호스팅 화면의 별도 기능 검증은 수행하지 않았다. 로컬 화면 검증은 완료했다.
- 로컬 QA 서버는 종료했다. 사용자는 README 명령으로 다시 실행할 수 있다.
- 마지막 main 커밋은 릴리스 게시 후 실제 결과를 추가한 문서 갱신이다. v0.1.0 태그와 실행 ZIP은 검증한 스냅샷을 그대로 유지한다.
