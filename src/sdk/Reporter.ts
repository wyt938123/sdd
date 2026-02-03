/**
 * 数据上报 SDK，负责行为追踪、广告埋点等数据的异步上报
 * 运行环境: App WebView 容器内的 H5 页面
 * 仿制自 dev-huaweinonnno/ReportSdk.ts
 */
import Request from "./Request";
import md5 from "md5";

/* ============================================================
 * [原实现 - 基于 sendBeacon/fetch]
 * 以下为原 sdd 中的实现，已替换为 Request + XMLHttpRequest 方式
 * ============================================================
 * 
 * import type { AdType, AdError, ReportEventData } from './types/index.d';
 * 
 * interface ReporterConfig {
 *   reportUrl?: string;
 *   appId?: string;
 *   enabled?: boolean;
 *   debug?: boolean;
 * }
 * 
 * private config: ReporterConfig = {
 *   reportUrl: '',
 *   enabled: true,
 *   debug: false
 * };
 * 
 * private globalData: Record<string, any> = {
 *   platform: 'h5_webapp',
 *   sdk_version: '1.0.0'
 * };
 * 
 * private cacheQueue: ReportEventData[] = [];
 * private readonly MAX_CACHE_SIZE = 50;
 * 
 * // 原 init 方法
 * public init(config: ReporterConfig): void {
 *   this.config = { ...this.config, ...config };
 *   this.log('[Reporter] Initialized');
 * }
 * 
 * // 原 setGlobalData 方法
 * public setGlobalData(data: Record<string, any>): void {
 *   Object.assign(this.globalData, data);
 * }
 * 
 * // 原 report 方法
 * public report(eventData: ReportEventData): void {
 *   if (!this.config.enabled) {
 *     this.log('[Reporter] Reporting disabled, skipped:', eventData.event_id);
 *     return;
 *   }
 *   const data: ReportEventData = {
 *     ...this.globalData,
 *     ...eventData,
 *     timestamp: Date.now()
 *   };
 *   this.log('[Reporter] Report event:', data);
 *   if (this.config.reportUrl) {
 *     this.sendData(data);
 *   } else {
 *     this.addToCache(data);
 *   }
 * }
 * 
 * // 原 reportAdRequest 方法
 * public reportAdRequest(adType: AdType): void {
 *   this.report({
 *     event_id: 'ad_request',
 *     event_name: '广告请求',
 *     ad_type: adType,
 *     result: 'pending'
 *   });
 * }
 * 
 * // 原 reportAdLoad 方法
 * public reportAdLoad(adType: AdType): void {
 *   this.report({
 *     event_id: 'ad_load',
 *     event_name: '广告加载成功',
 *     ad_type: adType,
 *     result: 'success'
 *   });
 * }
 * 
 * // 原 reportAdShow 方法（简化版）
 * public reportAdShow(adType: AdType): void {
 *   this.report({
 *     event_id: 'ad_show',
 *     event_name: '广告展示',
 *     ad_type: adType,
 *     result: 'success'
 *   });
 * }
 * 
 * // 原 reportAdError 方法
 * public reportAdError(adType: AdType, error: AdError): void {
 *   this.report({
 *     event_id: 'ad_error',
 *     event_name: '广告错误',
 *     ad_type: adType,
 *     result: 'fail',
 *     error_code: error.code,
 *     error_msg: error.message
 *   });
 * }
 * 
 * // 原 reportAdClose 方法
 * public reportAdClose(adType: AdType, isEnded: boolean): void {
 *   this.report({
 *     event_id: 'ad_close',
 *     event_name: '广告关闭',
 *     ad_type: adType,
 *     result: isEnded ? 'completed' : 'skipped',
 *     is_ended: isEnded
 *   });
 * }
 * 
 * // 原 reportAdClick 方法（简化版）
 * public reportAdClick(adType: AdType): void {
 *   this.report({
 *     event_id: 'ad_click',
 *     event_name: '广告点击',
 *     ad_type: adType,
 *     result: 'success'
 *   });
 * }
 * 
 * // 原 reportSDKInit 方法
 * public reportSDKInit(): void {
 *   this.report({
 *     event_id: 'sdk_init',
 *     event_name: 'SDK初始化',
 *     result: 'success'
 *   });
 * }
 * 
 * // 原 reportError 方法
 * public reportError(error: Error | string, scene?: string): void {
 *   this.report({
 *     event_id: 'error_log',
 *     event_name: '错误日志',
 *     result: 'error',
 *     error_msg: typeof error === 'string' ? error : error.message,
 *     scene: scene || 'unknown'
 *   });
 * }
 * 
 * // 原 sendData 方法 - 使用 sendBeacon/fetch
 * private sendData(data: ReportEventData): void {
 *   if (!this.config.reportUrl) return;
 *   try {
 *     if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
 *       navigator.sendBeacon(this.config.reportUrl, JSON.stringify(data));
 *     } else {
 *       fetch(this.config.reportUrl, {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify(data),
 *         keepalive: true
 *       }).catch(err => { this.log('[Reporter] Send failed:', err); });
 *     }
 *   } catch (error) {
 *     this.log('[Reporter] Send error:', error);
 *   }
 * }
 * 
 * // 原 addToCache 方法
 * private addToCache(data: ReportEventData): void {
 *   if (this.cacheQueue.length >= this.MAX_CACHE_SIZE) {
 *     this.cacheQueue.shift();
 *   }
 *   this.cacheQueue.push(data);
 * }
 * 
 * // 原 getCachedData 方法
 * public getCachedData(): ReportEventData[] {
 *   return [...this.cacheQueue];
 * }
 * 
 * // 原 clearCache 方法
 * public clearCache(): void {
 *   this.cacheQueue = [];
 * }
 * 
 * // 原 flushCache 方法
 * public flushCache(): void {
 *   if (!this.config.reportUrl || this.cacheQueue.length === 0) return;
 *   const dataToSend = [...this.cacheQueue];
 *   this.cacheQueue = [];
 *   dataToSend.forEach(data => { this.sendData(data); });
 *   this.log('[Reporter] Flushed cache, count:', dataToSend.length);
 * }
 * 
 * // 原 updateConfig 方法
 * public updateConfig(config: Partial<ReporterConfig>): void {
 *   this.config = { ...this.config, ...config };
 * }
 * 
 * // 原 log 方法
 * private log(...args: any[]): void {
 *   if (this.config.debug) {
 *     console.log(...args);
 *   }
 * }
 * ============================================================ */

/**
 * 数据上报类 - 单例模式
 */
export default class Reporter {
  private static instance: Reporter;
  // 全局上报参数
  private globalDatas: Record<string, any> = {
    platform: "Quickgame",
    brand: (window as any).$GlobalBrand || '',
  };
  // 缓存队列：当 ext_field_14 未设置时暂存上报数据
  private cacheReportArr: any[] = [];
  // 内部请求实例，用于发送上报数据
  private request = new Request({
    baseURL: "https://fastgame-logs.yunyihudong.com", //'https://fastgame-logs.yunyihudong.com', //'https://devdata.muchcloud.com:8082', //'https://fastgame-logs.yunyihudong.com',
    header: {
      "content-type": "application/json; charset=utf-8",
      "accept-language": "zh-CN",
    },
  });

  /**
   * 获取单例
   */
  public static GetInstance() {
    if (!this.instance) {
      this.instance = new Reporter();
    }
    return this.instance;
  }

  /**
   * 设置全局上报参数（如设备信息、平台信息等）
   * @param config 配置对象
   */
  public setData(config: Record<string, any> = {}) {
    Object.assign(this.globalDatas, config);
  }

  /**
   * 通用事件上报入口
   * 当 ext_field_14 未设置时会缓存数据，设置后统一发送
   * @param config 事件配置，包含 event_id, event_name 等
   */
  public report(config: Record<string, any>) {
    // 检查是否已设置 ext_field_14（用户标识等关键字段）
    if(!this.globalDatas.ext_field_14) {
      this.cacheReportArr.push(config);
      return;
    }
    // 发送缓存中的数据
    if(this.cacheReportArr.length) {
      this.cacheReportArr.forEach(el => {
        this.reportData(el);
      });
      this.cacheReportArr = [];
    }
    this.reportData(config);
  }

  /**
   * 内部执行数据上报的具体逻辑
   * @param config 经过合并后的完整上报对象
   */
  private reportData(config: Record<string, any>) {
    let now = Date.now();
    // 合并全局数据与事件数据，添加时间戳
    let json: Record<string, any> = Object.assign({}, this.globalDatas, config, {
      time_stamp: (now / 1000) | 0,
      time_stamp_millis: now,
    });
    // 生成签名时间戳
    let Xts = Math.round(Date.now() / 1000);
    console.log("[reportEvent_id]", json.event_id);
    // 获取上报路径
    let uri = json.cdnReferer || json.referer;
    // 需要回传的事件列表
    let backEventList = [
      "hap",
      "ad_click",
      "ad_conversion_node",
      "player_start_playing",
      "player_playing",
      "ad_show",
      "ad_play_successful",
    ];
    // 合并配置中的自定义回传事件
    const configBackEventList =
      (window as any).Global?.$config?.backEventListConfig || [];
    if (configBackEventList && configBackEventList?.length) {
      backEventList = Array.from(
        new Set([...backEventList, ...configBackEventList])
      );
    }
    // 标记是否为回传事件
    if (backEventList.indexOf(json.event_id) != -1) {
      json.ext_field_26 = "1";
      // console.log('[backEventList]',json.event_id,json.ext_field_26,json.ext_field_10)
    } else {
      json.ext_field_26 = "0";
      json.ext_field_10 = "";
    }
    // 特殊处理 ad_show 和 ad_click 事件
    if (
      ["ad_show", "ad_click"].indexOf(json.event_id) != -1 &&
      json.cdnReferer
    ) {
      json.ext_field_10 = json.page_type + "";
    }
    // 清理 cdnReferer 字段（仅用于路由，不上报）
    if (json.cdnReferer) {
      delete json.cdnReferer;
    }
    // 通过 Request 实例发送上报数据
    this.request.request({
      uri: "/" + uri,
      method: "post",
      data: JSON.stringify(json),
      noReportResTime: true,
      header: {
        Xts,
        Xsign: md5("/yunyousj@2021" + Xts),
      },
    });
  }

  /**
   * 上报广告曝光成功事件（仿制版 - 完整字段）
   * @param adItem 广告对象信息
   * @param data 额外的上报参数
   */
  public reportAdShowDetail(adItem: Record<string, any>, data: Record<string, any> = {}) {
    let json = {
      event_id: 'ad_show',
      event_name: '广告曝光',
      ad_id: adItem.adUnitId + '',
      ext_field_1: adItem.uniqueId || '',
      ad_network: 7,
      ad_type: adItem.ad_type == 1 ? '1' : '9',
      page_url: (adItem.controlId || '') + '',
      ext_field_11: (adItem.queueType || '') + '',
      ad_style: (adItem.storey || '') + '',
      scene: (adItem.ECPMPrice || adItem.price || '') + '',
      page_type: (adItem.price_type || '') + '',
      element_name: '',
      ...data,
    };
    this.report(json);
    
    // 同时上报至 adnet 监听通道
    this.report({
      ...json,
      event_name: '广告曝光监听',
      ext_field_16: (adItem.controllerQueueId || '') + '',
      ext_field_15: (adItem.hitStrategyId || '') + '',
      cdnReferer: 'com.fg.adnet',
      pay_amount: adItem.price_type == 7 ? adItem.originECPM : 0,
      ext_field_5: ((window as any).Global?.deviceInfo?.benchmarkLevel || "") + '',
    });
    console.log('[reportAdShow][pay_amount]', adItem.price_type == 7 ? adItem.originECPM : 0);
  }

  /**
   * 上报广告展示失败事件
   * @param adItem 广告对象信息
   * @param data 额外的上报参数
   */
  public reportAdShowFail(adItem: Record<string, any>, data: Record<string, any> = {}) {
    this.report({
      event_id: 'ad_load_failure',
      event_name: '广告渲染失败',
      page_url: (adItem.controlId || '') + '',
      ad_id: adItem.adUnitId + '',
      ext_field_1: adItem.uniqueId || '',
      ad_network: 7,
      ad_type: adItem.ad_type == 1 ? '1' : '9',
      ext_field_11: (adItem.queueType || '') + '',
      ad_style: (adItem.storey || '') + '',
      scene: (adItem.ECPMPrice || adItem.price) + '',
      ad_position: (window as any).Global?.referer == 'ym01' ? '1' : '2',
      ...data,
    });
  }

  /**
   * 上报广告预加载/预渲染事件
   * @param adItem 广告对象信息
   * @param data 额外的上报参数
   */
  public reportAdPreShow(adItem: Record<string, any>, data: Record<string, any> = {}) {
    this.report({
      event_id: 'ad_preloading',
      event_name: '广告预渲染',
      ad_id: adItem.adUnitId + '',
      ext_field_1: adItem.uniqueId || '',
      ad_network: 7,
      ad_type: adItem.ad_type == 1 ? '1' : '9',
      page_url: (adItem.controlId || '') + '',
      ext_field_11: (adItem.queueType || '') + '',
      ad_style: (adItem.storey || '') + '',
      scene: (adItem.ECPMPrice || adItem.price || '') + '',
      page_type: (adItem.price_type || '') + '',
      element_name: '',
      ...data,
    });
  }

  /**
   * 上报激励视频播放成功/进度事件
   * @param adItem 广告对象信息
   * @param data 额外的上报参数
   */
  public reportAdClick(adItem: Record<string, any>, data: Record<string, any> = {}) {
    this.report({
      event_id: 'ad_play_successful',
      event_name: '视频广告播放进度',
      ad_id: adItem.adUnitId + '',
      ad_network: 7,
      page_url: (adItem.controlId || '') + '',
      scene: (adItem.ECPMPrice || adItem.price) + '',
      page_type: (adItem.price_type || '') + '',
      element_name: '',
      ext_field_5: ((window as any).Global?.deviceInfo?.benchmarkLevel || "") + '',
      ...data,
    });
  }

  /**
   * 上报广告点击事件（如点击下载、查看详情等）
   * @param adItem 广告对象信息
   * @param data 额外的上报参数
   */
  public reportAdsAdClick(adItem: Record<string, any>, data: Record<string, any> = {}) {
    let json = {
      event_id: 'ad_click_app',
      event_name: '广告点击',
      ad_id: adItem.adUnitId + '',
      ext_field_1: adItem.adId || '',
      ad_network: 7,
      ad_type: '1',
      page_url: adItem.controlId + '',
      ext_field_11: adItem.queueType + '',
      ad_style: adItem.storey + '',
      scene: (adItem.ECPMPrice || adItem.price) + '',
      element_name: '',
      page_name: data.page_name || '8',
      ...data,
    };
    this.report(json);
    // 同时上报至 adnet 通道
    this.report({
      ...json,
      event_id: 'ad_click',
      ext_field_16: adItem.controllerQueueId + '',
      ext_field_15: adItem.hitStrategyId + '',
      cdnReferer: 'com.fg.adnet',
      pay_amount: adItem.price_type == 7 ? adItem.originECPM : 0,
    });
  }

  /**
   * 上报广告请求结果事件
   * @param adItem 广告对象信息
   * @param failRes 失败时的错误原因
   */
  public reportAdReqResult(adItem: Record<string, any> | null, failRes: string = '') {
    if(!adItem) return;
    let trackData = {
      event_id: 'app_ad_request',
      event_name: '应用端广告请求结果',
      ad_id: adItem.adUnitId || '',
      ext_field_1: adItem.uniqueId || '',
      ad_network: 7,
      ad_type: adItem.ad_type == 1 ? '1' : '9',
      page_url: (adItem.controlId || '') || '',
      ext_field_11: (adItem.queueType || '') || '',
      ad_style: (adItem.storey || '') || '',
      scene: (adItem.ECPMPrice || adItem.price || '') + '',
      page_type: (adItem.price_type || '') + '',
      result: adItem.uniqueId ? '1' : '2',
      page_name: (adItem.loadAdCount || '') || '',
      element_name: '',
      ad_position: (window as any).Global?.referer == 'ym01' ? '1' : '2',
    };
    this.report(trackData);
    // 同时上报至 adnet 通道
    this.report({
      ...trackData,
      event_id: 'ad_request',
      event_name: '广告请求结果',
      ext_field_16: (adItem.controllerQueueId || '') || '',
      ext_field_15: (adItem.hitStrategyId || '') || '',
      cdnReferer: 'com.fg.adnet',
      pay_amount: adItem.price_type == 7 ? (adItem.originECPM || 0) : 0,
      result: adItem.uniqueId ? '有广告' : '无广告' + failRes
    });
  }

  /* ============================================================
   * [兼容方法] 以下为原 sdd 简化版上报方法，保留供 AdNet.ts 等模块调用
   * ============================================================ */

  /**
   * 上报广告请求事件（兼容方法）
   * @param adType 广告类型
   */
  public reportAdRequest(adType: string): void {
    this.report({
      event_id: 'ad_request',
      event_name: '广告请求',
      ad_type: adType,
      result: 'pending'
    });
  }

  /**
   * 上报广告加载成功事件（兼容方法）
   * @param adType 广告类型
   */
  public reportAdLoad(adType: string): void {
    this.report({
      event_id: 'ad_load',
      event_name: '广告加载成功',
      ad_type: adType,
      result: 'success'
    });
  }

  /**
   * 上报广告错误事件（兼容方法）
   * @param adType 广告类型
   * @param error 错误信息
   */
  public reportAdError(adType: string, error: { code?: number; message?: string } | any): void {
    this.report({
      event_id: 'ad_error',
      event_name: '广告错误',
      ad_type: adType,
      result: 'fail',
      error_code: error?.code || 0,
      error_msg: error?.message || String(error)
    });
  }

  /**
   * 上报广告关闭事件（兼容方法）
   * @param adType 广告类型
   * @param isEnded 是否完整播放
   */
  public reportAdClose(adType: string, isEnded: boolean): void {
    this.report({
      event_id: 'ad_close',
      event_name: '广告关闭',
      ad_type: adType,
      result: isEnded ? 'completed' : 'skipped',
      is_ended: isEnded
    });
  }

  /**
   * 上报广告展示事件（兼容方法 - 简化版）
   * @param adType 广告类型
   */
  public reportAdShow(adType: string): void {
    this.report({
      event_id: 'ad_show',
      event_name: '广告展示',
      ad_type: adType,
      result: 'success'
    });
  }

  /**
   * 初始化上报器（兼容方法）
   * @param config 配置对象
   */
  public init(config: { appId?: string; debug?: boolean; enabled?: boolean; reportUrl?: string } = {}): void {
    // 将配置合并到 globalDatas
    if (config.appId) {
      this.globalDatas.app_id = config.appId;
    }
    console.log('[Reporter] Initialized with config:', config);
  }

  /**
   * 设置全局上报数据（兼容方法）
   * @param data 全局数据
   */
  public setGlobalData(data: Record<string, any>): void {
    Object.assign(this.globalDatas, data);
  }

  /**
   * 上报 SDK 初始化事件（兼容方法）
   */
  public reportSDKInit(): void {
    this.report({
      event_id: 'sdk_init',
      event_name: 'SDK初始化',
      result: 'success'
    });
  }
}
