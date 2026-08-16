# Xiaoqi Plan · Offline Edition

[简体中文](README.md) | [English](README_EN.md)

A fully offline, local-first Android study planner and Pomodoro app. Completing a task feeds Xiaoqi, a little cat companion that grows with your study streak.

![Xiaoqi Plan icon](assets/icon.png)

## Download and Install

[**Download Android APK v2.0.0**](https://github.com/Mikewang0801/xiaoqi-plan-offline/releases/download/v2.0.0/xiaoqi-plan-offline-v2.0.0.apk)

- Requires Android 7.0 (API 24) or later
- SHA-256: `3EEEC21828FBD7977B69776B27BBAEEF1647499705A04EA831A6E19A0564308E`
- If Android blocks the installation, allow installs from the current file manager only
- The APK has no network permission; plans and study data stay on the device

## Features

- Daily planner, draggable weekly calendar, history, and study statistics
- Per-task time tracking and a Pomodoro timer
- Feed Xiaoqi, level up, and maintain a study streak
- Recurring tasks, automatic rollover, and system notifications
- Light, dark, and system themes
- JSON data import and export
- No account, ads, telemetry, cloud sync, or AI service
- No Android `INTERNET` permission

## Privacy

Tasks, Pomodoro sessions, and pet progress stay on the current device. The app never uploads study content. Export a JSON backup before uninstalling the app or clearing its data.

This repository does not contain:

- The online study-review API
- Model or third-party service keys
- Android release certificates or passwords
- User plans, notes, or backup data

## Tech Stack

- React 19 + TypeScript + Vite 8
- Capacitor 8
- Android Gradle Plugin 8.13
- Android: minimum API 24, target API 36

## Run Locally

Node.js 20 or later is required.

```powershell
npm ci
npm run dev
```

Create a production web build:

```powershell
npm run build
```

## Build for Android

JDK 21, Android SDK Platform 36, and Build Tools 35/36 are required.

If the Android toolchain is not installed, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\准备本地Android工具链.ps1
```

Then build the debug APK:

```powershell
powershell -ExecutionPolicy Bypass -File .\构建离线版.ps1 `
  -JavaHome 'path-to-jdk' `
  -AndroidSdk 'path-to-android-sdk'
```

The APK is written to:

```text
build-output/xiaoqi-plan-offline-debug.apk
```

Use your own private keystore for production releases. Never commit a certificate or its passwords.

## Project Layout

```text
xiaoqi-plan-offline/
├─ src/                         React application source
├─ public/                      Offline PWA assets
├─ assets/                      Icon and splash source files
├─ android/                     Native Android project
├─ 构建离线版.ps1               Windows build script
└─ 准备本地Android工具链.ps1    Optional toolchain setup script
```

## License

Licensed under the [MIT License](LICENSE). You may study, modify, and redistribute the project while retaining the original copyright and license notice.

## Contact

- QQ: 2361319392
- WeChat: 15224700421
- Email: [15224700421@163.com](mailto:15224700421@163.com)
