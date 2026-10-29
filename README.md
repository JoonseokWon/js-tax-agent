# JS Tax Agent

공식 근거를 확인하고 종합소득세의 가정에 따른 산출세액을 비교하는 한국어 웹 앱입니다. **2025년 귀속, 장부에 의한 단일 사업소득 검토용 첫 버전**입니다.

[GitHub 저장소](https://github.com/JoonseokWon/js-tax-agent) · [v0.1.0 다운로드](https://github.com/JoonseokWon/js-tax-agent/releases/tag/v0.1.0) · [호스팅 체험판](https://js-tax-agent.keengiant19.chatgpt.site) (소유자 개인 접근 권한, ChatGPT 로그인 필요)

![데스크톱 세액 비교](docs/screenshots/desktop-comparison.jpg)

## 실행

Node.js **22.9 이상**만 필요합니다. 별도 패키지 설치나 API 키 없이 실행됩니다.

```powershell
Set-Location -LiteralPath 'C:\Users\user\Documents\For ax node Project\JS Tax Agent'
node server.mjs
```

표시된 `http://127.0.0.1:4317`을 엽니다. 종료는 `Ctrl+C`입니다. `start.ps1` 또는 `node --env-file-if-exists=.env server.mjs`로 실행하면 선택 설정 파일도 읽습니다. 포트가 사용 중이면 `$env:PORT = '4320'`으로 변경합니다.

```powershell
node --test
node scripts/build.mjs
```

`dist/`는 정적 호스팅용 결과물입니다. `index.html`을 파일로 직접 열지 말고 HTTP 서버를 사용하세요. npm이 있는 환경에서는 `npm start`, `npm test`, `npm run build`도 가능합니다. 런타임 외부 의존성은 없습니다.

## 할 수 있는 일

- 공식 자료 5개의 출처·적용 시점·확인일을 확인하고 원문 열기.
- 국세청 안내 4개를 대상으로 한국어 키워드·동의어 검색 후 근거 요약 답변. 다른 연도/세목/미수록 질의회신·판례/특정 공제는 답변 유보.
- 기준안/비교안의 총수입·필요경비·소득공제를 입력해 산출세액·과세표준·구간 세율과 차이 비교.
- 질문·근거·비교 조건·제외 범위를 검토 메모 Markdown으로 다운로드.
- 데스크톱·모바일 화면, 키보드 포커스·라벨, 입력 오류와 빈 검색 상태.

기본 답변은 **검색한 자료의 요약 조합이며 생성 AI를 사용하지 않습니다.** 근거 보관함의 소득세법 제27조는 2026년 시행 조문 참고용이고, 2025년 답변 검색에서는 제외됩니다. 실제 국세청 질의회신·판례 전수 RAG와 자동 법령 갱신은 후속 작업입니다.

## 선택: 생성 AI RAG

1. `.env.example`을 같은 폴더의 `.env`로 복사합니다.
2. 본인 OpenAI API 키와 사용할 수 있는 모델 ID를 설정합니다. 키는 `.env`에만 두고 커밋하지 마세요.
3. `node --env-file-if-exists=.env server.mjs`로 다시 실행합니다.
4. 질문 화면의 **생성 AI로 답변 보기**를 누릅니다.

이 버튼을 선택할 때 질문과 검색된 근거 요약이 OpenAI에 전송됩니다. 계산 금액은 전송하지 않습니다. Responses API의 `store:false`를 사용하며, 이는 모든 제공자 로그의 부재를 의미하지 않습니다. 키는 서버 환경에만 두며 브라우저로 보내지 않습니다. 서버는 루프백 주소에만 바인딩됩니다. 공개 서버로 변경하려면 인증·요금 한도·모니터링을 별도로 설계해야 합니다.

생성 답변은 검색된 근거 ID만 인용하도록 구조화하고 서버에서 인용 ID를 검증합니다. 이는 문장 전체의 정확성을 보증하지 않습니다. **실제 API 키를 사용한 호출은 미검증**이며, 요청·응답 계약과 실패 처리는 모의 응답으로 테스트했습니다. 정적 호스팅판은 생성 AI 버튼을 제공하지 않습니다.

API 참고: [OpenAI 텍스트 생성](https://developers.openai.com/api/docs/guides/text), [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create).

## 계산 범위

`과세표준 = max(0, 총수입 − 필요경비 − 소득공제)`

`국세 산출세액 = floor(과세표준 × 구간 세율) − 누진공제`

지방소득세, 다른 소득 합산, 결손금, 추계신고, 분리과세, 세액공제·감면, 가산세, 기납부세액은 제외합니다. 경비와 공제의 인정 여부를 자동 판단하지 않습니다. 결과는 최종 납부액·환급액이나 확정 절세액이 아닙니다. 신고 전 해당 귀속연도 원문과 사실관계를 확인해야 합니다.

예시: 총수입 8,000만원, 경비 2,000만원, 공제 150만원은 산출세액 828만원. 경비를 3,000만원으로 바꾸면 601만5천원, 차이는 226만5천원입니다.

## 구조와 작업 기록

- `public/`: 화면·스타일·한국어 검색·세액 엔진·공식 자료 요약.
- `server.mjs`, `lib/generate.mjs`: 로컬 HTTP 서버와 선택형 생성 RAG.
- `tests/`: 세율 경계·검색 평가·입력 오류·API 계약/실패 검증.
- `scripts/`: 정적 빌드·릴리스 지원 도구.
- `docs/spec.md`, `plan.md`, `todo.md`, `design.md`: 요구사항·계획·진행·화면 규칙.
- `docs/sources.md`, `validation.md`, `handoff.md`: 출처·검증 결과·인계.

## 라이선스

애플리케이션 코드는 MIT입니다. 공식 자료 자체의 권리는 각 원출처에 따릅니다. 이 저장소는 제한된 자체 요약과 원문 링크를 제공하며 국세청 공식 서비스가 아닙니다.
