param(
    [ValidateRange(1,65535)][int]$Port = 4327,
    [string]$Model = 'gpt-5.4-mini'
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22.9 이상이 필요합니다.' }
Write-Host 'API 키는 표시하거나 파일에 저장하지 않습니다. 이 실행에서만 사용합니다.'
Write-Host '먼저 공식 API에 예시 질문 1건을 보내 연결을 확인합니다. API 사용량이 발생합니다.'
$taxSecureKey = Read-Host 'OpenAI API 키 (채팅에 붙여 넣지 마세요)' -AsSecureString
$taxKeyPointer = [IntPtr]::Zero
$taxPreviousKey = $env:OPENAI_API_KEY
$taxPreviousModel = $env:OPENAI_MODEL
$taxPreviousPort = $env:PORT
try {
    $taxKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taxSecureKey)
    $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taxKeyPointer)
    if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) { throw '키를 입력하지 않았습니다.' }
    $env:OPENAI_MODEL = $Model
    $env:PORT = [string]$Port
    node scripts/check-ai.mjs
    if ($LASTEXITCODE -ne 0) { throw 'AI 연결을 확인하지 못했습니다. 위 안내를 확인해 주세요.' }
    Write-Host ('AI 서버를 시작합니다: http://127.0.0.1:' + $Port)
    node server.mjs
} finally {
    if ($taxKeyPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taxKeyPointer) }
    $taxSecureKey.Dispose()
    $env:OPENAI_API_KEY = $taxPreviousKey
    $env:OPENAI_MODEL = $taxPreviousModel
    $env:PORT = $taxPreviousPort
    $taxPreviousKey = $null
}
