# 세법 근거 수집과 개정 확인

1. [국가법령정보 공동활용](https://open.law.go.kr/LSO/information/guide.do)에 로그인하고 **OPEN API 신청**에서 인터넷용 **대한민국 현행법령**, **국세청 법령해석**, **판례**의 목록 JSON을 선택합니다. 법령과 판례 원문도 직접 조회할 수 있도록 각각 본문 JSON을 선택합니다.
2. **공동활용 신청리스트**에서 승인 상태를 확인합니다. 가입과 신청을 함께 했더라도 승인 표시를 기준으로 합니다. [API인증키관리](https://open.law.go.kr/LSO/usr/usrOcInfoMod.do)에서 승인된 인증값(OC)을 확인할 수 있습니다.
3. 프로젝트 폴더에서 다음 명령을 실행하고 인증값을 숨김 입력란에 넣습니다. 채팅, 명령 인수, 소스 파일에 붙여 넣지 않습니다.

```powershell
.\collect-law.ps1
```

첫 실행은 세목별로 2025년 말(종합소득세), 2026년 1월 1일(법인세), 2026년 1월 2일(부가가치세·상속세·증여세)의 검토 기준을 저장하고 실행일 시행본 및 시행예정본과 대조합니다. 이 기준일은 수집을 시작하기 위한 대표 날짜입니다. 개별 거래에는 실제 적용 기준일을 지정하세요. 인증값은 실행 중 메모리에만 사용합니다.

다른 기준일이나 세목으로 좁혀 확인하려면 아래처럼 실행합니다.

```powershell
$secret = Read-Host '승인된 법제처 API 인증값(OC)' -AsSecureString
try {
    $env:LAW_OPEN_DATA_OC = [System.Net.NetworkCredential]::new('', $secret).Password
    node scripts/discover-law.mjs vat 2026-07-01 1
}
finally { Remove-Item Env:LAW_OPEN_DATA_OC -ErrorAction SilentlyContinue }
```

- 명령은 프로젝트 폴더에서 실행합니다. 첫 인자는 `income`, `corporate`, `vat`, `inheritance`(상속세), `gift`(증여세), `all` 중 하나입니다. 날짜 생략 시 한국 날짜의 오늘을 사용합니다. 마지막 숫자는 해석과 판례의 키워드별 최대 페이지 수로 1~20입니다.
- 결과는 Git에서 제외된 `outputs/law-discovery-*.json`에 저장됩니다. 법률·시행령·시행규칙별로 기준일 이전의 최근 시행본, 실행일 현재 시행본, 이후 시행예정본을 구분합니다. 동일 시행일에 여러 개정본이 있으면 모두 표시합니다.
- 이전 실행 결과와 시행·시행예정 일련번호가 달라지면 검토 대상 법령명에 표시합니다. 첫 실행은 비교 기준을 만듭니다. API의 검색 대상과 페이지 한도에 따라 해석·판례 목록의 범위가 제한됩니다.
- 운영체제 DNS 조회가 실패하면 수집기에서만 Cloudflare DNS-over-HTTPS로 `www.law.go.kr` 주소를 확인합니다. DNS 조회에는 호스트명만 보내고, OC는 인증서 검증을 거친 법제처 공식 HTTPS API로 보냅니다. [DNS-over-HTTPS 명세](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/)
- 법제처 응답에서 사용자 검증 거부가 나오면 신청의 승인 상태, OC, 등록한 서버 IP와 도메인을 확인하세요. Windows DNS 확인 명령은 `Resolve-DnsName www.law.go.kr`입니다.
- 변경 표시가 나오면 공식 원문의 해당 조문, 신구 비교, 부칙의 적용례·경과조치를 확인합니다. 적용 시점이 기존 계산 범위와 다르면 새 규칙에 대해 경계값 테스트를 추가한 뒤 배포합니다.
- 수집 문서의 제목·일자·공식 링크는 검토 후보입니다. 국세청 해석의 본문 API는 [공식 제공 목록](https://open.law.go.kr/LSO/openApi/guideList.do)에 없으므로 해석 문서번호로 [국세법령정보시스템](https://taxlaw.nts.go.kr/)에서 원문을 확인합니다. 회신·판결 원문에서 사실관계, 판단, 판결 결과 및 당시 법령을 확인하고, 검토한 요약만 검색 자료에 추가합니다.

[시행일 목록 명세](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=lsEfYdListGuide) · [국세청 해석 목록 명세](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=cgmExpcNtsListGuide) · [판례 목록 명세](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precListGuide)
