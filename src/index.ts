/**
 * 神蓍广告 SDK 入口文件
 * 运行环境: App WebView 容器内的 H5 页面 (通过 HBuilderX 打包的 App)
 * 
 * 使用方式:
 * 1. H5 端引入此 SDK
 * 2. 调用 $initSDK 初始化
 * 3. 调用 $showAd 触发广告展示
 * 4. App 端通过 web-view 的 @message 事件接收消息并调用广告
 */

import AdManager from './sdk/AdManager';
import Reporter from './sdk/Reporter';
import EventBus from './sdk/EventBus';
import Startup from './sdk/Startup';
import Aop from './sdk/Aop';
import AdNet from './sdk/AdNet';
import Request from './sdk/Request';
import * as Util from './sdk/Util';
import type { SDKConfig, AdType, AdCallbacks, GlobalData } from './sdk/types/index.d';

/** SDK 版本 */
const SDK_VERSION = '1.0.0';

/** SDK 品牌标识 */
const SDK_BRAND = 'shenshiad';

/**
 * 初始化全局数据
 */
function initGlobalData(): void {
  window.$Global = {
    hasInitial: false,
    config: {},
    deviceInfo: Util.getDeviceInfo(),
    startId: Date.now(),
    adStatus: {
      reward: 'idle',
      inters: 'idle',
      fullScreen: 'idle'
    }
  };
  window.$GlobalBrand = SDK_BRAND;
}

/**
 * 设置全局数据
 * @param nextState 要更新的状态
 */
function setGlobalData(nextState: Partial<GlobalData>): void {
  Object.assign(window.$Global, nextState);
}

/**
 * SDK 初始化主函数
 * @param config SDK 配置
 * @param callback 初始化完成回调
 */
async function initSDK(config?: SDKConfig, callback?: Function): Promise<void> {
  console.log(`[ShenShiAd SDK] v${SDK_VERSION} initializing...`);
  
  // 检查是否已初始化
  if (window.$Global?.hasInitial) {
    console.log('[ShenShiAd SDK] Already initialized');
    callback?.();
    return;
  }

  // 初始化全局数据
  initGlobalData();

  // 合并配置
  const finalConfig: SDKConfig = {
    debug: false,
    ...config
  };
  
  setGlobalData({ config: finalConfig });

  // 初始化上报器
  Reporter.GetInstance().init({
    appId: finalConfig.appId,
    debug: finalConfig.debug,
    enabled: true
  });
  Reporter.GetInstance().setGlobalData({
    app_id: finalConfig.appId,
    channel_id: finalConfig.channelId,
    sdk_version: SDK_VERSION,
    platform: 'h5_webapp',
    device_info: window.$Global.deviceInfo
  });

  // 初始化广告管理器
  AdManager.GetInstance().init({
    rewardAdUnitId: finalConfig.rewardAdUnitId,
    interstitialAdUnitId: finalConfig.interstitialAdUnitId,
    fullScreenAdUnitId: finalConfig.fullScreenAdUnitId,
    userId: finalConfig.userId,
    extra: finalConfig.extra,
    debug: finalConfig.debug
  });

  // 监听 UniAppJSBridgeReady 事件
  setupBridgeListener();

  // 标记初始化完成
  setGlobalData({ hasInitial: true });
  
  // 上报初始化事件
  Reporter.GetInstance().reportSDKInit();
  
  console.log('[ShenShiAd SDK] Initialized successfully');
  console.log('[ShenShiAd SDK] Running in App WebView container');
  
  callback?.();
}

/**
 * 设置 JSBridge 监听器
 */
function setupBridgeListener(): void {
  // 监听 UniAppJSBridgeReady 事件 (表示 uni.postMessage 可用)
  document.addEventListener('UniAppJSBridgeReady', () => {
    console.log('[ShenShiAd SDK] UniAppJSBridgeReady');
    EventBus.$emit('bridge_ready');
  });
}

/**
 * 展示广告
 * @param type 广告类型: 'reward' | 'inters' | 'fullScreen'
 * @param callbacks 广告回调
 */
function showAd(type: AdType, callbacks?: AdCallbacks): void {
  if (!window.$Global?.hasInitial) {
    console.warn('[ShenShiAd SDK] SDK not initialized, please call $initSDK first');
    callbacks?.onError?.({ code: -100, message: 'SDK 未初始化' });
    return;
  }
  
  AdManager.GetInstance().showAd(type, callbacks);
}

/**
 * 展示激励视频广告
 * @param callbacks 广告回调
 */
function showRewardAd(callbacks?: AdCallbacks): void {
  showAd('reward', callbacks);
}

/**
 * 展示插屏广告
 * @param callbacks 广告回调
 */
function showInterstitialAd(callbacks?: AdCallbacks): void {
  showAd('inters', callbacks);
}

/**
 * 展示全屏视频广告
 * @param callbacks 广告回调
 */
function showFullScreenAd(callbacks?: AdCallbacks): void {
  showAd('fullScreen', callbacks);
}

// ============== 挂载到全局 ==============
window.$GlobalBrand = SDK_BRAND;
window.$AdManager = AdManager.GetInstance();
window.$Evt = EventBus;
window.$Reporter = Reporter.GetInstance();
window.$initSDK = initSDK;
window.$showAd = showAd;

// ============== 导出模块 ==============
export {
  // 核心方法
  initSDK,
  showAd,
  showRewardAd,
  showInterstitialAd,
  showFullScreenAd,
  
  // 模块实例
  AdManager,
  Reporter,
  EventBus,
  Startup,
  Aop,
  AdNet,
  Request,
  Util,
  
  // 版本信息
  SDK_VERSION,
  SDK_BRAND
};
