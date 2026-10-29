# API 키를 안전하게 설정하기

키를 채팅·스크린샷·GitHub·브라우저 코드에 붙여 넣지 마세요. 이 앱에는 웹 키 입력란이 없습니다. 키는 서버에서만 사용합니다.

## 로컬에서 시작하기 (권장)

1. [OpenAI API 키 설정](https://platform.openai.com/api-keys)에서 프로젝트 전용 키를 직접 만드세요. 계정의 API 사용 가능 여부와 결제/사용 한도도 확인하세요. 키 생성·결제 설정은 사용자가 진행합니다.
2. 프로젝트 폴더에서 PowerShell로 다음 명령을 실행하세요.

```powershell
Set-Location -LiteralPath 'C:\Users\user\Documents\For ax node Project\JS Tax Agent'
.\setup-ai.ps1
```

3. `OpenAI API 키` 입력에서 키를 붙여 넣으세요. 문자는 화면에 표시되지 않고, 명령 기록·설정 파일에 키를 넣지 않습니다. Windows 정책이 스크립트 실행을 제한하면 조직의 허용된 실행 방법을 사용하세요. 이 앱은 실행 정책을 바꾸지 않습니다.
4. 스크립트가 공개 예시 질문 1건으로 실제 API를 확인하고, 성공하면 `http://127.0.0.1:4327`에서 서버를 시작합니다. 이 확인과 생성 AI 질문은 API 사용량이 발생합니다.
5. 종료는 `Ctrl+C`입니다. 키는 해당 실행 프로세스의 메모리/환경에만 전달하며, 스크립트 종료 시 이전 환경변수로 복원합니다. `.env`를 만들지 않습니다. 실행 중인 프로세스의 메모리까지 암호화되거나 모든 흔적이 지워진다는 뜻은 아닙니다.

포트·모델을 바꾸려면 `.\setup-ai.ps1 -Port 4328 -Model '사용 가능한 모델 ID'`를 사용하세요. 기본 모델은 기존 프로젝트의 `gpt-5.4-mini`이며 사용자 계정의 접근 권한은 별도 확인이 필요합니다.

## 이미 환경변수를 설정한 경우

서버 환경의 `OPENAI_API_KEY`, 선택값 `OPENAI_MODEL`을 사용합니다. 키 값 자체를 명령 인수에 넣지 마세요.

```powershell
node scripts/check-ai.mjs
node server.mjs
```

이전 `.env` 방식도 지원하지만 평문 파일이므로 접근 권한과 백업을 직접 관리해야 합니다. `.gitignore`로 제외하고 `public/`·`dist/`·배포 번들에는 넣지 않습니다. 서버는 키·원시 API 오류 본문을 로그나 브라우저에 반환하지 않습니다.

## 호스팅 사이트

공식 [Sites 관리 안내](https://learn.chatgpt.com/docs/sites/managing-a-site#configure-runtime-environment-values)에 따라 설정합니다.

1. [Sites 목록](https://chatgpt.com/space/sites)에서 해당 사이트의 추가 액션(⋯) → 설정을 엽니다.
2. 환경 변수에서 변수 추가를 선택하고 키 이름을 `OPENAI_API_KEY`로 지정합니다.
3. 시크릿을 켠 뒤 값 입력란이 가려지는지 확인하고, 승인된 키를 직접 전달합니다. 키를 채팅·소스·명령 인수에 넣지 않습니다.
4. 입력을 마치고 서버 설정에서 값이 비공개인지 확인합니다.
5. 사이트 버전을 게시한 뒤 로그인 상태에서 공개 예시로 검증합니다. 추가 결제·유료 업그레이드·자동 충전은 설정하지 않습니다.


호스팅 앱은 서버 API를 포함하며, 키는 Sites 런타임 비밀값 `OPENAI_API_KEY`로 설정해야 합니다. 소스·`.openai/hosting.json`·브라우저 저장소에 넣지 마세요. OpenAI Developers 플러그인의 승인된 키 연결이 가능하면 그 경로로 설정합니다. 플러그인 설치·연결이 확인되기 전에는 키가 설정됐다고 표시하지 않습니다.

사이트는 기존 개인 접근 권한을 유지하고 AI 요청에서 로그인 사용자도 확인합니다. 화면의 `AI 연결 확인`은 공개 예시만 보내 실제 응답과 인용 형식을 확인합니다. 페이지를 여는 것만으로는 API를 호출하지 않습니다. 사용 제한은 실행 인스턴스 단위이며 공유 서비스용 영구 과금 한도가 아닙니다.

## 데이터 전송과 오류

- 생성 AI로 질문하면 질문과 검색된 공식 근거의 자체 요약·사례 사실관계·적용 한계가 OpenAI로 전송됩니다. 세액 비교 폼의 금액은 전송하지 않습니다. 질문에 직접 입력한 금액은 질문 일부로 전송됩니다.
- `store:false`를 사용하지만 모든 제공자 로그의 부재나 자동 ZDR을 의미하지 않습니다.
- 인증 실패는 키 유효 상태, 모델 오류는 접근 권한/모델 ID, 사용 한도 오류는 API 결제·크레딧/프로젝트 한도, 통신 오류는 서버 네트워크를 확인하세요.
- 키가 노출된 경우 공식 설정에서 폐기하고 새 키를 직접 발급하세요. 폐기한 키를 채팅에 보내지 마세요.

공식 문서: [API 인증과 서버 비밀값](https://developers.openai.com/api/reference/overview), [구조화 응답](https://developers.openai.com/api/docs/guides/structured-outputs), [데이터 보관](https://developers.openai.com/api/docs/guides/your-data).
