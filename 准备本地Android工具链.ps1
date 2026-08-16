$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$toolRoot = Join-Path $root '.android-toolchain'
$downloadRoot = Join-Path $toolRoot 'downloads'
$jdkHome = Join-Path $toolRoot 'jdk'
$sdkRoot = Join-Path $toolRoot 'android-sdk'
$androidToolsVersion = '15859902'
$androidToolsSha256 = '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'
$jdkZip = Join-Path $downloadRoot 'temurin-jdk21.zip'
$androidZip = Join-Path $downloadRoot "commandlinetools-win-$androidToolsVersion.zip"

New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null

if (-not (Test-Path -LiteralPath (Join-Path $jdkHome 'bin\java.exe'))) {
    if (-not (Test-Path -LiteralPath $jdkZip)) {
        Write-Host 'Downloading Eclipse Temurin JDK 21...'
        Invoke-WebRequest -Uri 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk' -OutFile $jdkZip
    }
    $jdkExtract = Join-Path $toolRoot 'jdk-extracted'
    if (Test-Path -LiteralPath $jdkExtract) { Remove-Item -LiteralPath $jdkExtract -Recurse -Force }
    Expand-Archive -LiteralPath $jdkZip -DestinationPath $jdkExtract -Force
    $jdkSource = Get-ChildItem -LiteralPath $jdkExtract -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin\java.exe') } | Select-Object -First 1
    if (-not $jdkSource) { throw 'Downloaded JDK archive did not contain bin\java.exe.' }
    $resolvedSource = (Resolve-Path -LiteralPath $jdkSource.FullName).Path
    $resolvedToolRoot = (Resolve-Path -LiteralPath $toolRoot).Path
    if (-not $resolvedSource.StartsWith($resolvedToolRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid JDK extraction path.' }
    if (Test-Path -LiteralPath $jdkHome) { Remove-Item -LiteralPath $jdkHome -Recurse -Force }
    Move-Item -LiteralPath $resolvedSource -Destination $jdkHome
    Remove-Item -LiteralPath $jdkExtract -Recurse -Force
}

$sdkManager = Join-Path $sdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'
if (-not (Test-Path -LiteralPath $sdkManager)) {
    if (-not (Test-Path -LiteralPath $androidZip)) {
        Write-Host 'Downloading Android SDK Command-line Tools...'
        Invoke-WebRequest -Uri "https://dl.google.com/android/repository/commandlinetools-win-${androidToolsVersion}_latest.zip" -OutFile $androidZip
    }
    $actualHash = (Get-FileHash -LiteralPath $androidZip -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $androidToolsSha256) { throw "Android tools checksum mismatch: $actualHash" }
    $androidExtract = Join-Path $toolRoot 'android-extracted'
    if (Test-Path -LiteralPath $androidExtract) { Remove-Item -LiteralPath $androidExtract -Recurse -Force }
    Expand-Archive -LiteralPath $androidZip -DestinationPath $androidExtract -Force
    $sourceTools = Join-Path $androidExtract 'cmdline-tools'
    if (-not (Test-Path -LiteralPath (Join-Path $sourceTools 'bin\sdkmanager.bat'))) { throw 'Android tools archive is invalid.' }
    $latestParent = Join-Path $sdkRoot 'cmdline-tools'
    New-Item -ItemType Directory -Path $latestParent -Force | Out-Null
    Move-Item -LiteralPath $sourceTools -Destination (Join-Path $latestParent 'latest')
    Remove-Item -LiteralPath $androidExtract -Recurse -Force
}

$env:JAVA_HOME = $jdkHome
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_HOME = $sdkRoot
$licenseAnswers = 1..20 | ForEach-Object { 'y' }
$licenseAnswers | & $sdkManager --sdk_root=$sdkRoot --licenses | Out-Host
& $sdkManager --sdk_root=$sdkRoot 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'
if ($LASTEXITCODE -ne 0) { throw 'Android SDK package installation failed.' }

Write-Host "JDK ready: $jdkHome"
Write-Host "Android SDK ready: $sdkRoot"
Write-Host "Build command: .\构建离线版.ps1 -JavaHome '$jdkHome' -AndroidSdk '$sdkRoot'"
