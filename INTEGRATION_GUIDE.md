# 神蓍广告 SDK - WebView H5 集成指南

## 架构概述

本 SDK 专为 **App WebView 容器内的 H5 页面**设计（通过 HBuilderX 打包的 App），通过 JSBridge 与原生 App 端通信。

### 核心设计理念

- **H5 端（本 SDK）**：维护"逻辑广告池"，负责策略、频控、状态管理
- **App 端**：真正创建和管理广告实例（神蓍/UniApp SDK）
- **通信桥梁**：通过 `uni.postMessage` 和 `web-view @message` 实现双向通信

### 架构图

```
┌──────────────────────────────────────┐
│         H5 页面 (本 SDK)              │
│  ┌────────────────────────────────┐  │
│  │  AdManager (广告编排控制器)    │  │
│  │  - showAd()                    │  │
│  │  - 频率控制                     │  │
│  │  - 回调管理                     │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  AdNet (逻辑广告池)            │  │
│  │  - loadAd() 请求预加载         │  │
│  │  - getAdToken() 获取可用广告   │  │
│  │  - 维护 LogicalAdSlot 状态     │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Startup (启动管理)            │  │
│  │  - 初始化计数器                 │  │
│  │  - 频控数据管理                 │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Aop (生命周期监听)            │  │
│  │  - 前后台切换                   │  │
│  │  - 错误捕获                     │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
         ↕ (uni.postMessage)
┌──────────────────────────────────────┐
│         App 端 (UniApp)              │
│  ┌────────────────────────────────┐  │
│  │  web-view 组件                 │  │
│  │  @message="handleH5Message"    │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  神蓍广告 SDK                   │  │
│  │  - createRewardedVideoAd()     │  │
│  │  - show() / load()             │  │
│  │  - 真实广告实例管理             │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## 核心模块说明

### 1. AdNet（逻辑广告池）

**作用**：在 WebView 环境下，不存储真实广告实例，只维护广告位的"逻辑状态"。

**核心数据结构**：

```typescript
interface LogicalAdSlot {
  adUnitId: string;      // 广告位ID
  type: AdType;          // 广告类型
  isReady: boolean;      // App 端是否已预加载好
  lastLoadTime: number;  // 上次预加载时间
  lastShowTime?: number; // 上次展示时间
  price?: number;        // 广告价格
}
```

**主要方法**：

- `loadAd(type)` - 通知 App 端预加载广告
- `getAdToken(type)` - 获取已预加载好的广告 token
- `handlePreloadSuccess(data)` - 处理 App 返回的预加载成功事件
- `handleShowClose(data)` - 处理广告关闭事件

### 2. AdManager（广告管理器）

**作用**：广告展示的编排控制器，负责频率控制、回调管理、消息发送。

**主要方法**：

- `init(config)` - 初始化配置
- `showAd(type, callbacks)` - 展示广告（策略：先从 AdNet 取，没有则预加载）
- `requestShowToApp(type, adUnitId)` - 发送展示指令给 App

### 3. Startup（启动管理）

**作用**：初始化全局数据、计数器、频控数据。

**主要功能**：

- 初始化启动计数器（DayStCount）
- 初始化广告请求计数器（DayJLRequesttimes、DayYSRequesttimes）
- 初始化广告点击计数器（DayJLtimes、DayYSClicktimes）

### 4. Aop（生命周期监听）

**作用**：监听 H5 生命周期事件。

**主要功能**：

- 监听前后台切换（visibilitychange）
- 监听页面加载/卸载
- 全局错误捕获

### 5. Request（网络请求）

**作用**：基于 fetch 的网络请求封装。

**特性**：

- 支持超时控制
- 支持重试机制
- 支持 GET/POST
- 支持 URL 参数拼接

## 集成步骤

### Step 1: 安装 SDK

```bash
npm install /path/to/sdd
```

### Step 2: 创建配置文件

在你的 H5 项目中创建 `src/sdk/adConfig.ts`：

```typescript
import { AdManager, Startup, Aop, AdNet } from 'sdk'

export const AD_STOREY_CONFIG = {
  JL: [
    {
      platform: 'shenshi',
      adUnitIds: ['reward_video_001'],
      probability: [100],
      price: 100
    }
  ],
  YS: [
    {
      platform: 'shenshi',
      adUnitIds: ['interstitial_001'],
      probability: [100],
      price: 80
    }
  ]
}

export function initAdSdk(userId: string) {
  Startup.GetInstance().init({ userId })
  Aop.GetInstance().init()
  AdManager.GetInstance().init({
    userId,
    debug: true,
    storeyConfig: AD_STOREY_CONFIG
  })
}

export function getAdManager() {
  return AdManager.GetInstance()
}
```

### Step 3: 在 main.ts 中初始化

```typescript
import { initAdSdk } from './sdk/adConfig'

initAdSdk('user_12345')
```

### Step 4: 使用广告

```typescript
import { getAdManager } from '@/sdk/adConfig'

// 展示激励视频
getAdManager().showAd('REWARD_VIDEO', {
  onLoad: () => console.log('广告加载成功'),
  onShow: () => console.log('广告开始播放'),
  onClose: (isReward) => {
    if (isReward) {
      console.log('用户获得奖励')
      // 发放奖励逻辑
    }
  },
  onError: (error) => console.error('广告错误', error)
})
```

## JSBridge 通信协议

### H5 → App（通过 uni.postMessage）

#### 1. 预加载广告

```javascript
{
  data: {
    action: 'preload',
    type: 'REWARD_VIDEO',
    adUnitId: 'reward_video_001',
    price: 100,
    timestamp: 1706854321000
  }
}
```

#### 2. 展示广告

```javascript
{
  data: {
    action: 'show',
    type: 'REWARD_VIDEO',
    adUnitId: 'reward_video_001',
    userId: 'user_12345',
    extra: { ... },
    timestamp: 1706854321000
  }
}
```

### App → H5（通过 EventBus）

H5 需要监听以下事件：

#### 1. 预加载成功

```javascript
EventBus.$on('app_ad_preload_ok', (data) => {
  // data: { type, adUnitId, price }
})
```

#### 2. 预加载失败

```javascript
EventBus.$on('app_ad_preload_error', (data) => {
  // data: { type, adUnitId, error }
})
```

#### 3. 广告关闭

```javascript
EventBus.$on('app_ad_show_close', (data) => {
  // data: { type, adUnitId, isReward }
})
```

#### 4. 广告错误

```javascript
EventBus.$on('app_ad_show_error', (data) => {
  // data: { type, adUnitId, error }
})
```

## App 端实现示例

### UniApp web-view 组件

```vue
<template>
  <web-view :src="h5Url" @message="handleH5Message"></web-view>
</template>

<script>
export default {
  data() {
    return {
      h5Url: 'https://your-h5-domain.com',
      rewardedVideoAd: null
    }
  },
  
  methods: {
    // 接收 H5 发来的消息
    handleH5Message(event) {
      const message = event.detail.data[0]
      const { action, type, adUnitId } = message.data
      
      if (action === 'preload') {
        this.preloadAd(type, adUnitId)
      } else if (action === 'show') {
        this.showAd(type, adUnitId)
      }
    },
    
    // 预加载广告
    preloadAd(type, adUnitId) {
      if (type === 'REWARD_VIDEO') {
        if (!this.rewardedVideoAd) {
          this.rewardedVideoAd = uni.createRewardedVideoAd({
            adUnitId: adUnitId
          })
          
          this.rewardedVideoAd.onLoad(() => {
            // 通知 H5 预加载成功
            this.postMessageToH5('app_ad_preload_ok', {
              type,
              adUnitId
            })
          })
          
          this.rewardedVideoAd.onError((err) => {
            // 通知 H5 预加载失败
            this.postMessageToH5('app_ad_preload_error', {
              type,
              adUnitId,
              error: err
            })
          })
        }
        
        this.rewardedVideoAd.load()
      }
    },
    
    // 展示广告
    showAd(type, adUnitId) {
      if (type === 'REWARD_VIDEO' && this.rewardedVideoAd) {
        this.rewardedVideoAd.show().catch(() => {
          // 失败时重新加载
          this.rewardedVideoAd.load()
        })
      }
    },
    
    // 向 H5 发送消息（通过评估 JS 代码）
    postMessageToH5(eventName, data) {
      const script = `
        if (window.EventBus) {
          window.EventBus.$emit('${eventName}', ${JSON.stringify(data)})
        }
      `
      // 注意：web-view 不支持直接执行脚本，需要其他方式
      // 可以通过 URL scheme 或其他方式实现
    }
  }
}
</script>
```

## 频率控制说明

SDK 内置了频率控制机制，通过 localStorage 存储：

- `DayJLRequesttimes` - 激励视频请求次数（格式：`2026-02-02,5`）
- `DayYSRequesttimes` - 插屏广告请求次数
- `DayJLtimes` - 激励视频点击次数
- `DayYSClicktimes` - 插屏广告点击次数

每天自动重置计数器。

## 注意事项

1. **环境要求**：
   - H5 必须运行在 App WebView 容器内
   - 不支持独立浏览器环境
   - 需要 `window.uni` 对象可用

2. **消息通信**：
   - H5 → App：使用 `uni.postMessage`
   - App → H5：通过 EventBus 事件机制

3. **广告池逻辑**：
   - H5 端不存储真实广告实例
   - 只维护 `adUnitId + isReady` 状态
   - 真实广告由 App 端管理

4. **调试建议**：
   - 开发环境设置 `debug: true`
   - 检查 console 日志（`[AdNet]`、`[AdManager]` 前缀）
   - 使用 Chrome DevTools 远程调试 WebView

## 文件结构

```
sdd/
├── src/
│   ├── sdk/
│   │   ├── AdManager.ts      # 广告管理器
│   │   ├── AdNet.ts          # 逻辑广告池
│   │   ├── Startup.ts        # 启动管理
│   │   ├── Aop.ts            # 生命周期监听
│   │   ├── Request.ts        # 网络请求
│   │   ├── EventBus.ts       # 事件总线
│   │   ├── Reporter.ts       # 数据上报
│   │   └── Util.ts           # 工具函数
│   └── index.ts              # 入口文件
├── dist/                     # 构建产物
├── package.json
├── tsconfig.json
└── rollup.config.mjs
```

## 构建命令

```bash
# 开发构建
npm run build

# 监听模式
npm run watch
```

## 许可证

ISC
