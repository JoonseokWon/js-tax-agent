$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 22.9 이상을 설치한 뒤 다시 실행해 주세요. https://nodejs.org/'
}
node --env-file-if-exists=.env server.mjs
