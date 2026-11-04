# 세법 근거 수집과 개정 확인

법제처 [국가법령정보 공동활용 신청](https://open.law.go.kr/LSO/information/guide.do)에서 이용 신청을 합니다. JSON으로 현행법령(시행일) 목록, 국세청 법령해석 목록, 판례 목록을 선택하세요. 실제 운영에 필요한 별도 승인 여부도 신청 화면에서 확인하세요. 국세청 해석의 본문 API는 [공식 제공 목록](https://open.law.go.kr/LSO/openApi/guideList.do)에 없으므로 해석의 문서번호를 [국세법령정보시스템](https://taxlaw.nts.go.kr/)에서 찾아 원문을 확인합니다.

승인된 API 인증값은 PowerShell에서 숨김 입력으로 현재 세션에만 설정합니다. 채팅이나 GitHub에는 인증값을 넣지 않습니다.

```powershell
$env:LAW_OPEN_DATA_OC = Read-Host '승인된 법제처 인증값' -MaskInput
try { node scripts/discover-law.mjs all 2026-11-04 1 }
finally { Remove-Item Env:LAW_OPEN_DATA_OC -ErrorAction SilentlyContinue }
```

- 명령은 프로젝트 폴더에서 실행합니다. 첫 인자는 `income`, `corporate`, `vat`, `all` 중 하나입니다. 날짜 생략 시 한국 날짜의 오늘을 사용합니다. 마지막 숫자는 해석과 판례의 키워드별 최대 페이지 수로 1~20입니다.
- 결과는 Git에서 제외된 `outputs/law-discovery-*.json`에 저장됩니다. 법률·시행령·시행규칙별로 기준일 이전의 최근 시행본, 실행일 현재 시행본, 이후 시행예정본을 구분합니다. 동일 시행일에 여러 개정본이 있으면 모두 표시합니다.
- 이전 실행 결과와 시행·시행예정 일련번호가 달라지면 검토 대상 법령명에 표시합니다. 첫 실행은 비교 기준을 만듭니다. API의 검색 대상과 페이지 한도에 따라 해석·판례 목록의 범위가 제한됩니다.
- 변경 표시가 나오면 공식 원문의 해당 조문, 신구 비교, 부칙의 적용례·경과조치를 확인합니다. 적용 시점이 기존 계산 범위와 다르면 새 규칙에 대해 경계값 테스트를 추가한 뒤 배포합니다.
- 수집 문서의 제목·일자·공식 링크는 검토 후보입니다. 회신·판결 원문에서 사실관계, 판단, 판결 결과 및 당시 법령을 확인하고, 검토한 요약만 검색 자료에 추가합니다. API 승인과 실수집 검증은 별도 진행이 필요합니다.

[시행일 목록 명세](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=lsEfYdListGuide) · [국세청 해석 목록 명세](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=cgmExpcNtsListGuide) · [판례 목록 명세](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precListGuide)
