/**
 * 神蓍广告 SDK 类型定义
 * 运行环境: App WebView 容器内的 H5 页面 (HBuilderX 打包)
 */

/** 广告类型枚举 */
export type AdType = 'reward' | 'inters' | 'fullScreen';

/** 广告状态 */
export type AdStatus = 'idle' | 'loading' | 'loaded' | 'showing' | 'closed' | 'error';

/** 广告配置接口 */
export interface AdConfig {
  /** 激励视频广告位 ID */
  rewardAdUnitId?: string;
  /** 插屏视频广告位 ID */
  interstitialAdUnitId?: string;
  /** 全屏视频广告位 ID */
  fullScreenAdUnitId?: string;
  /** 用户唯一标识 (用于激励回调) */
  userId?: string;
  /** 自定义扩展参数 */
  extra?: string;
  /** 是否开启调试模式 */
  debug?: boolean;
}

/** SDK 初始化配置 */
export interface SDKConfig extends AdConfig {
  /** 应用 ID */
  appId?: string;
  /** 渠道 ID */
  channelId?: string;
  /** 版本号 */
  version?: string;
}

/** 广告回调接口 */
export interface AdCallbacks {
  /** 广告加载成功 */
  onLoad?: () => void;
  /** 广告加载失败 */
  onError?: (error: AdError) => void;
  /** 广告关闭 */
  onClose?: (result: AdCloseResult) => void;
  /** 广告展示成功 */
  onShow?: () => void;
}

/** 广告错误信息 */
export interface AdError {
  code: number;
  message: string;
}

/** 广告关闭结果 */
export interface AdCloseResult {
  /** 是否完整播放 (仅激励/全屏视频) */
  isEnded: boolean;
  /** 广告类型 */
  adType: AdType;
}

/** 上报事件数据 */
export interface ReportEventData {
  event_id: string;
  event_name: string;
  ad_type?: AdType;
  ad_unit_id?: string;
  result?: string;
  error_msg?: string;
  timestamp?: number;
  [key: string]: any;
}

/** 全局 Window 扩展 */
declare global {
  interface Window {
    /** 全局数据存储 */
    $Global: GlobalData;
    /** SDK 品牌标识 */
    $GlobalBrand: string;
    /** 广告管理器实例 */
    $AdManager: any;
    /** 事件总线实例 */
    $Evt: any;
    /** 上报器实例 */
    $Reporter: any;
    /** SDK 初始化方法 */
    $initSDK: (config?: SDKConfig, callback?: Function) => Promise<void>;
    /** 展示广告方法 */
    $showAd: (type: AdType, callbacks?: AdCallbacks) => void;
    /** uni-app JSBridge (由外部 SDK 注入) */
    uni?: UniApp;
    /** 兼容旧版全局对象（用于 Request.ts） */
    Global?: {
      reportData?: any;
      deviceInfo?: { benchmarkLevel?: string };
      $config?: { backEventListConfig?: string[] };
      referer?: string;
    };
  }

  /** UniApp JSBridge 接口 */
  interface UniApp {
    postMessage: (data: { data: any }) => void;
    webView?: {
      postMessage: (data: any) => void;
    };
  }
}

/** 全局数据结构 */
export interface GlobalData {
  /** 是否已初始化 */
  hasInitial: boolean;
  /** SDK 配置 */
  config: SDKConfig;
  /** 设备信息 */
  deviceInfo: DeviceInfo;
  /** 启动时间戳 */
  startId: number;
  /** 当前广告状态 */
  adStatus: Record<AdType, AdStatus>;
}

/** 设备信息 */
export interface DeviceInfo {
  screenWidth?: number;
  screenHeight?: number;
  platform?: string;
  userAgent?: string;
}

export {};
