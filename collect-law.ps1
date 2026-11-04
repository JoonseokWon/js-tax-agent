param(
    [ValidateRange(1, 20)]
    [int] $Pages = 1,
    [ValidateSet('all', 'income', 'corporate', 'vat', 'inheritance', 'gift')]
    [string] $Tax = 'all',
    [switch] $SaveOc,
    [switch] $RequireSavedOc
)

$ErrorActionPreference = 'Stop'
if ($SaveOc -and $RequireSavedOc) {
    throw '-SaveOc 또는 -RequireSavedOc 중 하나를 선택해 주세요.'
}
$nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if ($nodeCommand) {
    $nodePath = $nodeCommand.Source
} elseif (Test-Path -LiteralPath $bundledNode -PathType Leaf) {
    $nodePath = $bundledNode
} else {
    throw 'Node.js 22.9 이상을 설치해 주세요.'
}

$secretFile = Join-Path $PSScriptRoot 'outputs/law-open-data-oc.xml'
if (!$SaveOc -and (Test-Path -LiteralPath $secretFile -PathType Leaf)) {
    try { $oc = Import-Clixml -LiteralPath $secretFile }
    catch { throw '이 Windows 계정에서 저장된 OC를 읽지 못했어요. -SaveOc로 다시 등록해 주세요.' }
} elseif ($RequireSavedOc) {
    throw '저장된 법제처 OC가 없어요. -SaveOc로 먼저 등록해 주세요.'
} else {
    $oc = Read-Host '승인된 법제처 API 인증값(OC)' -AsSecureString
}
if ($oc -isnot [Security.SecureString] -or $oc.Length -eq 0) {
    if ($oc -is [Security.SecureString]) { $oc.Dispose() }
    throw '인증값을 입력해 주세요.'
}

$previousOc = $env:LAW_OPEN_DATA_OC
$secretPointer = [IntPtr]::Zero
try {
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($oc)
    $env:LAW_OPEN_DATA_OC = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    $collector = Join-Path $PSScriptRoot 'scripts/discover-law.mjs'
    & $nodePath $collector $Tax supported $Pages
    if ($LASTEXITCODE -ne 0) {
        throw '수집이 멈췄어요. 위에 표시된 단계와 오류를 확인해 주세요.'
    }
    if ($SaveOc) {
        # Windows DPAPI protects an exported SecureString for this user and device.
        $temporarySecret = $secretFile + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
        try {
            $oc | Export-Clixml -LiteralPath $temporarySecret
            if ([IO.File]::Exists($secretFile)) {
                [IO.File]::Replace($temporarySecret, $secretFile, [NullString]::Value)
            } else {
                [IO.File]::Move($temporarySecret, $secretFile)
            }
        } finally {
            if (Test-Path -LiteralPath $temporarySecret) { Remove-Item -LiteralPath $temporarySecret }
        }
        Write-Host '이 Windows 계정에 법제처 OC를 암호화해 저장했어요.'
    }
} finally {
    if ($null -eq $previousOc) { Remove-Item Env:LAW_OPEN_DATA_OC -ErrorAction SilentlyContinue }
    else { $env:LAW_OPEN_DATA_OC = $previousOc }
    if ($secretPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    }
    $oc.Dispose()
}
