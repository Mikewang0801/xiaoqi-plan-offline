param(
    [string]$JavaHome = $env:JAVA_HOME,
    [string]$AndroidSdk = $env:ANDROID_SDK_ROOT
)

$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $JavaHome -or -not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin\java.exe'))) {
    throw 'Specify JDK 21 with -JavaHome or JAVA_HOME.'
}
if (-not $AndroidSdk -or -not (Test-Path -LiteralPath $AndroidSdk)) {
    throw 'Specify Android SDK with -AndroidSdk or ANDROID_SDK_ROOT.'
}

$env:JAVA_HOME = $JavaHome
$env:ANDROID_SDK_ROOT = $AndroidSdk
$env:ANDROID_HOME = $AndroidSdk
$env:ANDROID_USER_HOME = Join-Path $sourceRoot '.android-user-home'
$env:GRADLE_USER_HOME = Join-Path $sourceRoot '.gradle-user-home'

Push-Location $sourceRoot
try {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    & npx.cmd cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
    & '.\android\gradlew.bat' -p '.\android' --no-daemon assembleDebug
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }

    $outputDir = Join-Path $sourceRoot 'build-output'
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    Copy-Item -LiteralPath '.\android\app\build\outputs\apk\debug\app-debug.apk' -Destination (Join-Path $outputDir 'xiaoqi-plan-offline-debug.apk') -Force
    Write-Host "Build succeeded: $(Join-Path $outputDir 'xiaoqi-plan-offline-debug.apk')"
}
finally {
    Pop-Location
}
