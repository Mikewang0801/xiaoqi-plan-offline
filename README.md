# 小淇计划 · 离线版

[简体中文](README.md) | [English](README_EN.md)

一款完全离线、本地优先的 Android 学习计划与番茄专注应用。完成任务可以投喂小猫“小淇”，让日常学习更有陪伴感。

![小淇计划图标](assets/icon.png)

## 下载安装

[**下载 Android APK v2.0.0**](https://github.com/Mikewang0801/xiaoqi-plan-offline/releases/download/v2.0.0/xiaoqi-plan-offline-v2.0.0.apk)

- 支持 Android 7.0（API 24）及更高版本
- SHA-256：`3EEEC21828FBD7977B69776B27BBAEEF1647499705A04EA831A6E19A0564308E`
- 若系统阻止安装，请只为当前文件管理器开启“允许来自此来源”
- 安装包无联网权限，任务与学习数据只保存在当前设备

## 功能特色

- 今日计划、周表拖动、历史记录和学习统计
- 单任务累计计时与番茄钟
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
- Android 发布证书及口令
- 用户计划、笔记或备份数据

## 技术栈

- React 19 + TypeScript + Vite 8
- Capacitor 8
- Android Gradle Plugin 8.13
- Android：最低 API 24，目标 API 36

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

## 项目结构

```text
xiaoqi-plan-offline/
├─ src/                         React 应用源码
├─ public/                      离线 PWA 资源
├─ assets/                      图标和启动图源文件
├─ android/                     Android 原生工程
├─ 构建离线版.ps1               Windows 一键构建脚本
└─ 准备本地Android工具链.ps1    可选的本地工具链准备脚本
```

## 开源许可证

本项目采用 [MIT License](LICENSE)。欢迎学习、修改和二次开发，并请保留原始版权与许可证声明。
