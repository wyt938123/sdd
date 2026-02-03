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
import type { SDKConfig, AdType, AdCallbacks } from './sdk/types/index.d';
/** SDK 版本 */
declare const SDK_VERSION = "1.0.0";
/** SDK 品牌标识 */
declare const SDK_BRAND = "shenshiad";
/**
 * SDK 初始化主函数
 * @param config SDK 配置
 * @param callback 初始化完成回调
 */
declare function initSDK(config?: SDKConfig, callback?: Function): Promise<void>;
/**
 * 展示广告
 * @param type 广告类型: 'reward' | 'inters' | 'fullScreen'
 * @param callbacks 广告回调
 */
declare function showAd(type: AdType, callbacks?: AdCallbacks): void;
/**
 * 展示激励视频广告
 * @param callbacks 广告回调
 */
declare function showRewardAd(callbacks?: AdCallbacks): void;
/**
 * 展示插屏广告
 * @param callbacks 广告回调
 */
declare function showInterstitialAd(callbacks?: AdCallbacks): void;
/**
 * 展示全屏视频广告
 * @param callbacks 广告回调
 */
declare function showFullScreenAd(callbacks?: AdCallbacks): void;
export { initSDK, showAd, showRewardAd, showInterstitialAd, showFullScreenAd, AdManager, Reporter, EventBus, Startup, Aop, AdNet, Request, Util, SDK_VERSION, SDK_BRAND };
