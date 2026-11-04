param(
    [ValidateRange(1, 20)]
    [int] $Pages = 1
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 22.9 이상을 설치해 주세요.'
}

$oc = Read-Host '승인된 법제처 API 인증값(OC)' -AsSecureString
if ($oc.Length -eq 0) {
    $oc.Dispose()
    throw '인증값을 입력해 주세요.'
}

$previousOc = $env:LAW_OPEN_DATA_OC
$secretPointer = [IntPtr]::Zero
try {
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($oc)
    $env:LAW_OPEN_DATA_OC = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    $collector = Join-Path $PSScriptRoot 'scripts/discover-law.mjs'
    node $collector all supported $Pages
    if ($LASTEXITCODE -ne 0) {
        throw '수집이 멈췄어요. 위에 표시된 단계와 오류를 확인해 주세요.'
    }
} finally {
    if ($null -eq $previousOc) { Remove-Item Env:LAW_OPEN_DATA_OC -ErrorAction SilentlyContinue }
    else { $env:LAW_OPEN_DATA_OC = $previousOc }
    if ($secretPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    }
    $oc.Dispose()
}
