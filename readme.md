快速 Demo 方案
如果你想快速搭一个 H5 广告 SDK Demo（不依赖注册审核）：
用神蓍广告的测试 ID：
advertId: '1013000002'
国内平台，H5 可用
文档里有示例代码
或者先 Mock 假数据：
自己搭一个 Mock Server 返回广告数据
用假的广告位 ID（如 'DEMO_AD_001'）
验证你 SDK 的"请求 → 渲染 → 上报"流程
正式项目方案
如果要对接真实广告平台：
国内 H5 场景：
注册腾讯优量汇 / 穿山甲 / 百度联盟
创建测试状态的广告位
拿到真实的测试代码位 ID
国际 H5 场景：
注册 Google AdSense
添加网站并创建广告单元
用自己的广告单元 ID 测试


国内的一个广告平台，官方文档里直接提供了测试广告位 ID。
官方文档
接入文档：https://doc.shenshiads.com/xcx.html
测试广告位 ID
文档中明确提供了测试用的 advertId：
示例测试 ID：1013000002
可用于激励视频、插屏、原生模板等多种广告类型
适用场景


# 神蓍广告 SDK

适配神蓍广告平台的 H5 广告 SDK，用于 HBuilderX 打包的 WebApp。

> **运行环境说明**: 此 SDK 运行在 **App WebView 容器内的 H5 页面**中（通过 HBuilderX 打包的 App），通过 `uni.postMessage` 与原生 App 通信来触发广告展示。广告无法在独立浏览器 H5 环境中运行。

## 安装

```bash
npm install
npm run build
```

## 构建产物

- `dist/index.esm.js` - ES Module 格式
- `dist/index.cjs.js` - CommonJS 格式
- `dist/sdk.umd.js` - UMD 格式（可直接在浏览器中使用）
- `dist/sdk.umd.min.js` - UMD 压缩版

## 使用方式

### H5 端接入

#### 方式一：原生 HTML 引入

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>H5 广告页面</title>
  <!-- 引入神蓍广告桥接 SDK -->
  <script src="https://fpvideo.shenshiads.com/h5tovue/index.js"></script>
  <!-- 引入本 SDK -->
  <script src="./dist/sdk.umd.min.js"></script>
</head>
<body>
  <button id="reward-btn">展示激励视频</button>
  <button id="inters-btn">展示插屏广告</button>
  <button id="fullscreen-btn">展示全屏视频</button>

  <script>
    // 等待 JSBridge 就绪
    document.addEventListener('UniAppJSBridgeReady', function() {
      // 初始化 SDK
      window.$initSDK({
        appId: 'your_app_id',
        userId: 'user_123',
        debug: true
      });

      // 绑定按钮事件
      document.getElementById('reward-btn').addEventListener('click', function() {
        window.$showAd('reward', {
          onLoad: function() { console.log('广告加载成功'); },
          onShow: function() { console.log('广告展示'); },
          onClose: function(res) { 
            if (res.isEnded) {
              console.log('激励视频播放完成，发放奖励');
            }
          },
          onError: function(err) { console.log('广告错误:', err); }
        });
      });
    });
  </script>
</body>
</html>
```

#### 方式二：Vue/React 等框架

```javascript
// 安装依赖
// npm install shenshiad

import { initSDK, showAd, showRewardAd } from './dist/index.esm.js';

// 初始化
await initSDK({
  appId: 'your_app_id',
  userId: 'user_123',
  debug: true
});

// 展示激励视频
showRewardAd({
  onClose: (result) => {
    if (result.isEnded) {
      // 发放奖励
    }
  }
});

// 或使用通用方法
showAd('inters'); // 插屏广告
showAd('fullScreen'); // 全屏视频
```

### APP 端接入 (HBuilderX)

参考[神蓍广告官方文档](https://doc.shenshiads.com/H5.html)配置 APP 端。

```vue
<template>
  <web-view 
    :src="h5Url" 
    @message="handleMessage"
  />
</template>

<script>
import { adReward, rewardedVideoInit, adInter, interstitialInit, adFull, fullScreenInit } from 'shenshiad/ads.js';

export default {
  methods: {
    handleMessage(e) {
      const { type, userId, extra } = e.detail.data[0];
      
      if (type === 'reward') {
        rewardedVideoInit('广告位ID', { userId, extra });
        adReward.onLoad(() => adReward.show());
        adReward.onClose((res) => {
          if (res.isEnded) {
            // 通知 H5 发放奖励
          }
        });
        adReward.load();
      }
      // ... 处理其他广告类型
    }
  }
}
</script>
```

## API 文档

### initSDK(config, callback?)

初始化 SDK。

```typescript
interface SDKConfig {
  appId?: string;           // 应用 ID
  channelId?: string;       // 渠道 ID
  userId?: string;          // 用户标识（激励回调用）
  extra?: string;           // 扩展参数
  debug?: boolean;          // 调试模式
  rewardAdUnitId?: string;  // 激励视频广告位
  interstitialAdUnitId?: string; // 插屏广告位
  fullScreenAdUnitId?: string;   // 全屏视频广告位
}
```

### showAd(type, callbacks?)

展示广告。

- **type**: `'reward'` | `'inters'` | `'fullScreen'`
- **callbacks**: 
  - `onLoad()` - 广告加载成功
  - `onShow()` - 广告展示
  - `onClose({ isEnded, adType })` - 广告关闭
  - `onError({ code, message })` - 广告错误

### 便捷方法

- `showRewardAd(callbacks?)` - 展示激励视频
- `showInterstitialAd(callbacks?)` - 展示插屏广告
- `showFullScreenAd(callbacks?)` - 展示全屏视频

## 架构说明

```
src/
├── index.ts              # SDK 入口
└── sdk/
    ├── AdManager.ts      # 广告管理器（核心）
    ├── EventBus.ts       # 事件总线
    ├── Reporter.ts       # 数据上报
    ├── Util.ts           # 工具函数
    └── types/
        └── index.d.ts    # 类型定义
```

## 参考

- [神蓍广告 H5 对接文档](https://doc.shenshiads.com/H5.html)
- [HBuilderX 下载](https://www.dcloud.io/hbuilderx.html)
