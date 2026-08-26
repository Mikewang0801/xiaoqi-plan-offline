# 小淇计划 · 离线版

[简体中文](README.md) | [English](README_EN.md)

一款完全离线、本地优先的 Android 与 iOS 学习计划及番茄专注应用。完成任务可以投喂小猫“小淇”，让日常学习更有陪伴感。

![小淇计划图标](assets/icon.png)

## 下载安装

[**下载 Android APK v2.1.1**](https://github.com/Mikewang0801/xiaoqi-plan-offline/releases/download/v2.1.1/xiaoqi-plan-offline-v2.1.1.apk)

- 支持 Android 7.0（API 24）及更高版本
- SHA-256：`E2495BCFE3F593A28FE84DB9876E8A5D21C9B65BE394CEEE69AE4D1DF96C4072`
- 若系统阻止安装，请只为当前文件管理器开启“允许来自此来源”
- 安装包无联网权限，任务与学习数据只保存在当前设备

iPhone 不能安装 APK。本仓库已包含 V2.1.1 的 iOS/Xcode 工程；iOS 安装包必须在 macOS 上使用 Xcode 和 Apple 签名证书生成，当前 Release 暂不提供通用签名 IPA。

## 功能特色

- 今日计划、周表拖动、历史记录和学习统计
- 单任务累计计时与番茄钟
- 番茄钟支持倒计时与正向计时，时长可在专注页直接调整
- 周表日期栏固定，支持左右滑动浏览日期
- 小淇采用全局悬浮逐帧动画，在今天、周表、专注、统计和设置页面均可见并可自由拖动
- 点击小淇依次触发呼吸眨眼、左右行走、招手、跳跃、失落、等待、专注、复盘和环视 10 组基础动作；拖动不会误触动作
- 小淇投喂、等级成长和连续打卡
- 重复任务、自动顺延与系统通知
- 浅色、深色及跟随系统主题
- JSON 数据导入与导出
- 无账号、广告、遥测、云同步或 AI 接口
- Android 清单不申请 `INTERNET` 权限

## 隐私设计

任务、番茄钟和小淇成长数据只保存在当前设备。应用不会上传学习内容；卸载或清除应用数据前，请先导出 JSON 备份。

本仓库不包含：

- 在线学习复盘 API
- 大模型或第三方服务密钥
- Android 发布证书、Apple 签名证书、描述文件及口令
- 用户计划、笔记或备份数据

## 技术栈

- React 19 + TypeScript + Vite 8
- Capacitor 8
- Android Gradle Plugin 8.13
- Android：最低 API 24，目标 API 36
- iOS：最低 iOS 15，Xcode 工程版本 2.1.1（Build 211）

## 本地运行

需要 Node.js 20 或更高版本。

```powershell
npm ci
npm run dev
```

浏览器生产构建：

```powershell
npm run build
```

## Android 构建

需要 JDK 21、Android SDK Platform 36 和 Build Tools 35/36。

如果本机尚未配置 Android 环境，可以先运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\准备本地Android工具链.ps1
```

然后执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\构建离线版.ps1 `
  -JavaHome 'JDK目录' `
  -AndroidSdk 'Android SDK目录'
```

调试 APK 输出到：

```text
build-output/xiaoqi-plan-offline-debug.apk
```

正式发布时请使用自己的私有 keystore 签名，证书及口令不要提交到仓库。

## iOS 构建

iOS 工程必须在 macOS 上构建，需要 Xcode 16 或更高版本以及有效的 Apple 开发者签名配置。

```bash
npm ci
npm run ios
open ios/App/App.xcodeproj
```

在 Xcode 的 `Signing & Capabilities` 中选择自己的 Team，并确认 Bundle Identifier 唯一，然后连接 iPhone 运行；发布 IPA 时使用 `Product > Archive`。仓库不会提交签名证书或 Provisioning Profile。

## 项目结构

```text
xiaoqi-plan-offline/
├─ src/                         React 应用源码
├─ public/                      离线 PWA 资源
│  └─ pet/                     小淇动态动作图集
├─ assets/                      图标和启动图源文件
├─ android/                     Android 原生工程
├─ ios/                         iOS/Xcode 原生工程
├─ 构建离线版.ps1               Windows 一键构建脚本
└─ 准备本地Android工具链.ps1    可选的本地工具链准备脚本
```

## 开源许可证

本项目采用 [MIT License](LICENSE)。欢迎学习、修改和二次开发，并请保留原始版权与许可证声明。

## 联系方式

- QQ：2361319392
- 微信：15224700421
- 邮箱：[15224700421@163.com](mailto:15224700421@163.com)
