/**
 * 广告管理器（结合 AdNet 逻辑池）
 * 负责通过 uni.postMessage 与 App 通信，触发广告展示
 * 运行环境: App WebView 容器内的 H5 页面
 */
import type { AdType, AdCallbacks, AdConfig, AdStatus, AdError, AdCloseResult } from './types/index.d';
import EventBus from './EventBus';
import Reporter from './Reporter';
import AdNet from './AdNet';

/** 广告事件名称常量 */
export const AD_EVENTS = {
  AD_REQUEST: 'ad_request',
  AD_LOAD: 'ad_load',
  AD_ERROR: 'ad_error',
  AD_SHOW: 'ad_show',
  AD_CLOSE: 'ad_close',
  AD_CLICK: 'ad_click',
} as const;

export default class AdManager {
  private static instance: AdManager;
  
  private config: AdConfig = {};
  
  private adStatus: Record<AdType, AdStatus> = {
    reward: 'idle',
    inters: 'idle',
    fullScreen: 'idle'
  };
  
  private currentCallbacks: Record<AdType, AdCallbacks | null> = {
    reward: null,
    inters: null,
    fullScreen: null
  };

  private bridgeReady: boolean = false;
  private debug: boolean = false;

  public static GetInstance(): AdManager {
    if (!AdManager.instance) {
      AdManager.instance = new AdManager();
    }
    return AdManager.instance;
  }

  public init(config: AdConfig): void {
    this.config = { ...this.config, ...config };
    this.debug = config.debug || false;
    this.setupBridge();
    
    // 初始化 AdNet 的广告位配置（这里使用测试 ID）
    this.setupAdNetConfig();
    
    this.log('[AdManager] Initialized with config:', this.config);
  }

  /**
   * 设置 AdNet 广告位配置
   */
  private setupAdNetConfig(): void {
    // 激励视频配置（使用测试 ID 1013000002）
    const rewardConfig = [{
      platform_list: [{
        adid_list: [
          { adUnitId: this.config.rewardAdUnitId || '1013000002', ad_type: 2 as 1 | 2, price: '100' }
        ],
        rand_num: 1,
        platform: 'shenshiad'
      }]
    }];

    // 插屏配置
    const intersConfig = [{
      platform_list: [{
        adid_list: [
          { adUnitId: this.config.interstitialAdUnitId || '1013000002', ad_type: 1 as 1 | 2, price: '50' }
        ],
        rand_num: 1,
        platform: 'shenshiad'
      }]
    }];

    AdNet.GetInstance().setStoreyData(rewardConfig, 1);
    AdNet.GetInstance().setStoreyData(intersConfig, 2);
  }

  private setupBridge(): void {
    if (this.bridgeReady) return;
    this.setupMessageListener();
    this.bridgeReady = true;
    this.log('[AdManager] Bridge setup completed');
  }

  private setupMessageListener(): void {
    // 监听 App 端预加载成功
    EventBus.$on('app_ad_preload_ok', (data: { type: AdType }) => {
      this.handleAdLoad(data.type);
    });

    // 监听 App 端错误
    EventBus.$on('app_ad_preload_error', (data: { type: AdType; error: AdError }) => {
      this.handleAdError(data.type, data.error);
    });

    // 监听 App 端广告关闭
    EventBus.$on('app_ad_show_close', (data: { type: AdType; isEnded: boolean }) => {
      this.handleAdClose(data.type, data.isEnded);
    });

    // 监听 App 端展示
    EventBus.$on('app_ad_show', (data: { type: AdType }) => {
      this.handleAdShow(data.type);
    });
  }

  /**
   * 展示广告（结合 AdNet 逻辑池）
   * @param type 广告类型
   * @param callbacks 广告回调
   */
  public showAd(type: AdType, callbacks?: AdCallbacks): void {
    this.log(`[AdManager] Request to show ad: ${type}`);

    // 检查状态
    if (this.adStatus[type] === 'loading' || this.adStatus[type] === 'showing') {
      this.log(`[AdManager] Ad ${type} is busy`);
      callbacks?.onError?.({ code: -1, message: `广告正在加载或展示中` });
      return;
    }

    // 检查 JSBridge
    if (!this.isBridgeAvailable()) {
      const error: AdError = { code: -2, message: 'JSBridge 未就绪' };
      callbacks?.onError?.(error);
      Reporter.GetInstance().reportAdError(type, error);
      return;
    }

    // 保存回调
    this.currentCallbacks[type] = callbacks || null;
    this.adStatus[type] = 'loading';

    // 先尝试从 AdNet 逻辑池取已预加载好的广告 token
    const adToken = AdNet.GetInstance().getAdToken(type);
    
    if (adToken && adToken.isReady) {
      // 有预加载好的广告，直接发送 show 指令给 App
      this.log(`[AdManager] 使用预加载广告: ${adToken.adUnitId}`);
      this.requestShowToApp(type, adToken.adUnitId);
    } else {
      // 没有预加载，先触发预加载
      this.log(`[AdManager] 没有预加载广告，先触发加载`);
      AdNet.GetInstance().loadAd(type);
      
      // 等待加载完成后再展示（通过 app_ad_preload_ok 事件触发）
      // 这里可以加一个超时逻辑
      setTimeout(() => {
        if (this.adStatus[type] === 'loading') {
          const error = { code: -3, message: '广告预加载超时' };
          this.handleAdError(type, error);
        }
      }, 10000);
    }

    Reporter.GetInstance().reportAdRequest(type);
  }

  /**
   * 向 App 发送消息请求展示广告
   * @param type 广告类型
   * @param adUnitId 广告位ID
   */
  private requestShowToApp(type: AdType, adUnitId: string): void {
    const messageData = {
      data: {
        action: 'show',
        type,
        adUnitId,
        userId: this.config.userId,
        extra: this.config.extra,
        timestamp: Date.now()
      }
    };

    this.log('[AdManager] Posting show message to App:', messageData);

    try {
      if (window.uni?.postMessage) {
        window.uni.postMessage(messageData);
      } else if (window.uni?.webView?.postMessage) {
        window.uni.webView.postMessage(messageData.data);
      } else {
        throw new Error('uni.postMessage 不可用');
      }

      EventBus.$emit(AD_EVENTS.AD_REQUEST, { type });
    } catch (error) {
      this.log('[AdManager] Failed to post message:', error);
      this.handleAdError(type, { 
        code: -3, 
        message: `发送消息失败: ${(error as Error).message}` 
      });
    }
  }

  /**
   * 检查 JSBridge 是否可用
   */
  private isBridgeAvailable(): boolean {
    return !!(window.uni?.postMessage || window.uni?.webView?.postMessage);
  }

  /**
   * 处理广告加载成功
   */
  private handleAdLoad(type: AdType): void {
    this.log(`[AdManager] Ad loaded: ${type}`);
    this.adStatus[type] = 'loaded';
    
    this.currentCallbacks[type]?.onLoad?.();
    EventBus.$emit(AD_EVENTS.AD_LOAD, { type });
    Reporter.GetInstance().reportAdLoad(type);
  }

  /**
   * 处理广告展示
   */
  private handleAdShow(type: AdType): void {
    this.log(`[AdManager] Ad shown: ${type}`);
    this.adStatus[type] = 'showing';
    
    this.currentCallbacks[type]?.onShow?.();
    EventBus.$emit(AD_EVENTS.AD_SHOW, { type });
    Reporter.GetInstance().reportAdShow(type);
  }

  /**
   * 处理广告错误
   */
  private handleAdError(type: AdType, error: AdError): void {
    this.log(`[AdManager] Ad error: ${type}`, error);
    this.adStatus[type] = 'error';
    
    this.currentCallbacks[type]?.onError?.(error);
    EventBus.$emit(AD_EVENTS.AD_ERROR, { type, error });
    Reporter.GetInstance().reportAdError(type, error);
    
    // 清理回调
    this.currentCallbacks[type] = null;
  }

  /**
   * 处理广告关闭
   */
  private handleAdClose(type: AdType, isEnded: boolean): void {
    this.log(`[AdManager] Ad closed: ${type}, isEnded: ${isEnded}`);
    this.adStatus[type] = 'closed';
    
    const result: AdCloseResult = { isEnded, adType: type };
    this.currentCallbacks[type]?.onClose?.(result);
    EventBus.$emit(AD_EVENTS.AD_CLOSE, { type, isEnded });
    Reporter.GetInstance().reportAdClose(type, isEnded);
    
    // 清理回调并重置状态
    this.currentCallbacks[type] = null;
    setTimeout(() => {
      if (this.adStatus[type] === 'closed') {
        this.adStatus[type] = 'idle';
      }
    }, 100);
  }

  /**
   * 获取广告状态
   */
  public getAdStatus(type: AdType): AdStatus {
    return this.adStatus[type];
  }

  /**
   * 获取所有广告状态
   */
  public getAllAdStatus(): Record<AdType, AdStatus> {
    return { ...this.adStatus };
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<AdConfig>): void {
    this.config = { ...this.config, ...config };
    this.log('[AdManager] Config updated:', this.config);
  }

  /**
   * 获取当前配置
   */
  public getConfig(): AdConfig {
    return { ...this.config };
  }

  /**
   * 调试日志
   */
  private log(...args: any[]): void {
    if (this.debug) {
      console.log(...args);
    }
  }
}
