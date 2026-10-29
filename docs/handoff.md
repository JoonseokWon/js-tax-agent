# JS Tax Agent 인계

- UI·UX 적용 여부: 적용 / 화면 있음.
- 목적: 공식 자료로 종합소득세를 검토하고 입력 가정별 산출세액을 비교한다.
- 현재 공개 버전: v0.2.0. 기존 개인 전용 호스팅 주소에 Worker 버전을 게시했다.
- 완료: 국세청 질의회신·판례 자료, 문서번호 검색, 사실관계·적용 한계, 서버 AI 연결 구현, 안전한 키 설정 안내, 자료 요약·세액 비교·메모 다운로드.
- 검증: 자동 검사와 빌드, 로컬의 공개 AI 예시, 데스크톱·모바일 기본 흐름을 확인했다. 호스팅에서 정상 생성 답변이 나오는지에 대한 평가는 아직 완료하지 않았다.
- 설계: 키는 서버 환경에만 두고 웹 입력·공개 소스·배포 번들에 포함하지 않는다. 호스팅의 개인 접근 권한을 유지한다.
- 실행: 프로젝트 폴더에서 `node server.mjs`. 승인된 로컬 설정을 읽을 때는 `node --env-file-if-exists=.env server.mjs`.
- 관련 문서: spec.md, plan.md, todo.md, design.md, sources.md, validation.md, api-key-setup.md.
- 계정별 설정·운영 진단의 상세 인계는 Git에서 제외된 `outputs/hosting-handoff-private.md`와 `outputs/hosting-validation-private.md`에 로컬 전용으로 보관한다.
- 다음: 운영 조건을 확인한 뒤 호스팅 생성 답변 평가를 마무리하고, 법인세·부가가치세 범위를 순서대로 구체화한다.
