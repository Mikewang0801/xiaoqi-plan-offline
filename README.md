# 小淇计划 · 离线版

一款完全离线、本地优先的 Android 学习计划与番茄专注应用。完成任务可以投喂小猫“小淇”，累计食物、等级和连续打卡天数。

![小淇计划图标](assets/icon.png)

## 功能

- 今日计划、周表拖动、历史和学习统计
- 独立任务计时与番茄钟
- 小淇投喂、等级和连续打卡养成
- 重复任务、自动顺延与系统通知
- 深浅主题、JSON 导入导出
- 无账号、广告、遥测、云同步或 AI 接口
- Android 清单不申请 `INTERNET` 权限

## 本地运行

需要 Node.js 20+。

```powershell
npm ci
npm run dev
```

生产构建：

```powershell
npm run build
```

## Android 构建

需要 JDK 21、Android SDK Platform 36 和 Build Tools 35/36。也可以先运行 `准备本地Android工具链.ps1`，把工具链下载到项目内的忽略目录。

```powershell
powershell -ExecutionPolicy Bypass -File .\构建离线版.ps1 `
  -JavaHome 'JDK目录' `
  -AndroidSdk 'Android SDK目录'
```

调试 APK 输出到 `build-output/xiaoqi-plan-offline-debug.apk`。正式发布请使用自己的 keystore 签名，证书和口令不要提交到仓库。

## 隐私说明

任务、番茄钟和小淇成长数据只保存在当前设备。卸载或清除应用数据前请先导出 JSON 备份。本仓库不包含在线复盘 API、模型密钥、发布证书或用户数据。

## 许可证

[MIT](LICENSE)
