/**
 * Startup 启动管理类（WebView 环境版）
 * 负责设备信息初始化、配置拉取、广告预加载等
 * 
 * 运行环境: App WebView 容器内的 H5 页面
 * 仿制自 dev-huaweinonnno/Startup.ts
 * 
 * 注意: H5 无法直接调用 window.qg 的原生 API，
 * 需要通过 JSBridge + EventBus 与 App 通信获取设备信息
 */
import Request from './Request';
import Reporter from './Reporter';
import AdNet from './AdNet';
import EventBus from './EventBus';
import { getFormatDate, getDeviceInfo, storage, generateRandomString } from './Util';
import type { SDKConfig } from './types/index.d';

/** 设备信息接口 */
interface DeviceInfoFromApp {
  deviceId?: string;
  oaid?: string;
  brand?: string;
  model?: string;
  system?: string;
  screenWidth?: number;
  screenHeight?: number;
  network?: string;
  ip?: string;
  city?: string;
  region?: string;
  platformVersionCode?: number;
}

export default class Startup {
  private static instance: Startup;
  private config: SDKConfig = {};
  /** 从 App 获取设备信息的超时时间 */
  private deviceInfoTimeout = 3000;

  public static GetInstance(): Startup {
    if (!this.instance) {
      this.instance = new Startup();
    }
    return this.instance;
  }

  /**
   * 初始化应用（主入口）
   * @param config SDK 配置
   */
  public async init(config: SDKConfig): Promise<void> {
    this.config = config;
    
    // 初始化全局数据（基础版）
    this.initGlobalData();
    
    // 并行获取各类信息（类似 dev-huaweinonnno 的 initData）
    await this.initData();
    
    // 初始化计数器（启动次数、日期等）
    this.initCounters();
    
    // 设置上报基础数据
    this.setupReportData();
    
    // 上报启动事件
    Reporter.GetInstance().report({
      event_id: 'sdk_startup',
      event_name: 'SDK启动',
      app_id: config.appId,
      channel_id: config.channelId,
    });

    // 拉取广告配置并初始化广告池
    await this.initAdConfig();
  }

  /* ============================================================
   * 数据初始化（并行获取各类信息）
   * 类似 dev-huaweinonnno/Startup.ts 的 initData()
   * ============================================================ */

  /**
   * 初始化数据（并行获取 IP、设备信息、网络等）
   */
  private async initData(): Promise<void> {
    console.log('[Startup] initData - 开始获取各类信息');
    
    const results = await Promise.all([
      this.getIp(),           // IP 地址（通过 API）
      this.getDeviceInfo(),   // 设备信息（URL参数/JSBridge）
      this.getNetworkType(),  // 网络类型（H5 API）
      this.getScreenInfo(),   // 屏幕信息（H5 API）
    ]);
    
    // 合并结果到全局
    const mergedInfo = Object.assign({}, ...results.filter(r => r !== null));
    if (typeof window !== 'undefined' && (window as any).$Global) {
      Object.assign((window as any).$Global, mergedInfo);
    }
    
    // 确保 deviceId 存在
    this.ensureDeviceId();
    
    console.log('[Startup] initData 完成:', mergedInfo);
  }

  /**
   * 获取 IP 地址（通过外部 API）
   * H5 可以直接调用，无需 JSBridge
   */
  private getIp(): Promise<Record<string, any> | null> {
    return new Promise((resolve) => {
      const xhr = new Request({
        baseURL: 'https://getip.muchcloud.com',
        header: { 'Content-Type': 'application/json' },
      });
      
      xhr.request({
        uri: '/',
        method: 'get',
        data: '',
        noReportResTime: true,
        isAbort: true,
      })
        .then((res: any) => {
          console.log('[Startup] getIp:', res);
          const data = typeof res === 'string' ? JSON.parse(res) : res;
          resolve({
            ip: data.ip || '',
            city: data.city || '',
            region: data.region || '',
            country: data.country || '',
          });
        })
        .catch((err: any) => {
          console.warn('[Startup] getIp 失败:', err);
          resolve(null);
        });
    });
  }

  /**
   * 获取网络类型（H5 可直接获取）
   * 使用 navigator.connection API（部分浏览器支持）
   */
  private getNetworkType(): Promise<Record<string, any> | null> {
    return new Promise((resolve) => {
      try {
        const connection = (navigator as any).connection || 
                           (navigator as any).mozConnection || 
                           (navigator as any).webkitConnection;
        
        if (connection) {
          // effectiveType: 'slow-2g', '2g', '3g', '4g'
          const networkType = connection.effectiveType || connection.type || 'unknown';
          console.log('[Startup] getNetworkType:', networkType);
          resolve({ network: networkType });
        } else {
          // 不支持的浏览器，默认 wifi
          resolve({ network: 'wifi' });
        }
      } catch (e) {
        resolve({ network: 'unknown' });
      }
    });
  }

  /**
   * 获取屏幕信息（H5 可直接获取）
   */
  private getScreenInfo(): Promise<Record<string, any> | null> {
    return new Promise((resolve) => {
      try {
        const screenWidth = window.screen?.width || window.innerWidth || 0;
        const screenHeight = window.screen?.height || window.innerHeight || 0;
        const pixelRatio = window.devicePixelRatio || 1;
        
        console.log('[Startup] getScreenInfo:', { screenWidth, screenHeight, pixelRatio });
        
        resolve({
          deviceInfo: {
            screenWidth,
            screenHeight,
            pixelRatio,
          },
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * 获取设备信息（URL参数 / JSBridge）
   * 优先从 URL 参数解析，否则通过 JSBridge 请求 App
   */
  private async getDeviceInfo(): Promise<Record<string, any> | null> {
    console.log('[Startup] getDeviceInfo');
    
    // 方式1: 从 URL 参数解析
    const urlParams = this.parseUrlParams();
    if (urlParams.deviceId || urlParams.oaid) {
      console.log('[Startup] 从 URL 参数获取设备信息');
      return this.formatDeviceInfo(urlParams);
    }
    
    // 方式2: 通过 JSBridge 请求 App
    try {
      const deviceInfo = await this.requestDeviceInfoFromApp();
      if (deviceInfo) {
        return this.formatDeviceInfo(deviceInfo);
      }
    } catch (error) {
      console.warn('[Startup] JSBridge 获取设备信息失败:', error);
    }
    
    // 方式3: 从 UserAgent 解析
    return this.parseUserAgent();
  }

  /**
   * 从 UserAgent 解析设备信息（兜底方案）
   */
  private parseUserAgent(): Record<string, any> | null {
    try {
      const ua = navigator.userAgent;
      let brand = 'unknown';
      let model = 'unknown';
      let system = 'unknown';
      
      // 解析品牌
      if (/HUAWEI/i.test(ua)) brand = 'HUAWEI';
      else if (/HONOR/i.test(ua)) brand = 'HONOR';
      else if (/Xiaomi|MI\s|Redmi/i.test(ua)) brand = 'Xiaomi';
      else if (/OPPO/i.test(ua)) brand = 'OPPO';
      else if (/vivo/i.test(ua)) brand = 'vivo';
      else if (/Samsung/i.test(ua)) brand = 'Samsung';
      
      // 解析系统版本
      const androidMatch = ua.match(/Android\s([\d.]+)/i);
      if (androidMatch) {
        system = 'Android ' + androidMatch[1];
      }
      
      console.log('[Startup] parseUserAgent:', { brand, model, system });
      
      return {
        deviceInfo: { brand, model, system },
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * 格式化设备信息
   */
  private formatDeviceInfo(info: DeviceInfoFromApp): Record<string, any> {
    return {
      deviceId: info.deviceId,
      oaid: info.oaid || info.deviceId,
      deviceInfo: {
        brand: info.brand,
        model: info.model,
        system: info.system,
        screenWidth: info.screenWidth,
        screenHeight: info.screenHeight,
        platformVersionCode: info.platformVersionCode,
      },
    };
  }

  /**
   * 解析 URL 参数
   */
  private parseUrlParams(): Partial<DeviceInfoFromApp> {
    if (typeof window === 'undefined') return {};
    
    try {
      const params = new URLSearchParams(window.location.search);
      return {
        deviceId: params.get('deviceId') || undefined,
        oaid: params.get('oaid') || undefined,
        brand: params.get('brand') || undefined,
        model: params.get('model') || undefined,
        network: params.get('network') || undefined,
        ip: params.get('ip') || undefined,
      };
    } catch (e) {
      return {};
    }
  }

  /**
   * 通过 JSBridge 请求 App 获取设备信息
   */
  private requestDeviceInfoFromApp(): Promise<DeviceInfoFromApp | null> {
    return new Promise((resolve) => {
      // 设置超时
      const timer = setTimeout(() => {
        console.warn('[Startup] 获取设备信息超时');
        EventBus.$off('app_device_info', handler);
        resolve(null);
      }, this.deviceInfoTimeout);
      
      // 监听 App 返回
      const handler = (data: DeviceInfoFromApp) => {
        clearTimeout(timer);
        EventBus.$off('app_device_info', handler);
        resolve(data);
      };
      EventBus.$on('app_device_info', handler);
      
      // 发送请求给 App
      this.postMessageToApp({ action: 'getDeviceInfo' });
    });
  }

  /**
   * 设置设备信息到全局
   */
  private setDeviceInfo(info: DeviceInfoFromApp): void {
    if (typeof window === 'undefined') return;
    
    const global = (window as any).$Global || {};
    Object.assign(global, {
      deviceId: info.deviceId || global.deviceId,
      oaid: info.oaid || info.deviceId || global.oaid,
      ip: info.ip || global.ip,
      city: info.city || global.city,
      region: info.region || global.region,
      network: info.network || global.network,
      deviceInfo: {
        ...(global.deviceInfo || {}),
        brand: info.brand,
        model: info.model,
        system: info.system,
        screenWidth: info.screenWidth,
        screenHeight: info.screenHeight,
        platformVersionCode: info.platformVersionCode,
      },
    });
    
    console.log('[Startup] setDeviceInfo:', info);
  }

  /**
   * 确保 deviceId 存在（本地缓存或生成）
   */
  private ensureDeviceId(): void {
    if (typeof window === 'undefined') return;
    
    const global = (window as any).$Global;
    if (global.deviceId) return;
    
    // 从本地缓存读取
    const cached = storage.getJson<{ deviceId: string; oaid: string } | null>('DeviceId', null);
    if (cached?.deviceId) {
      global.deviceId = cached.deviceId;
      global.oaid = cached.oaid || cached.deviceId;
      return;
    }
    
    // 生成新的 deviceId
    const newId = generateRandomString(10) + Date.now() + generateRandomString(8);
    global.deviceId = newId;
    global.oaid = newId;
    storage.setJson('DeviceId', { deviceId: newId, oaid: newId });
    console.log('[Startup] 生成新 deviceId:', newId);
  }

  /**
   * 发送消息给 App
   */
  private postMessageToApp(data: any): void {
    if (typeof window === 'undefined' || !window.uni) return;
    
    try {
      if (window.uni.postMessage) {
        window.uni.postMessage({ data });
      } else if (window.uni.webView?.postMessage) {
        window.uni.webView.postMessage(data);
      }
    } catch (error) {
      console.error('[Startup] postMessage failed:', error);
    }
  }

  /**
   * 设置上报基础数据
   */
  private setupReportData(): void {
    if (typeof window === 'undefined') return;
    
    const global = (window as any).$Global || {};
    const today = getFormatDate();
    const todayStCount = storage.getJson<Record<string, number>>('todaystcount', {});
    
    const reportData = {
      platform_code: global.deviceInfo?.platformVersionCode || 0,
      os: 'android',
      os_version: global.deviceInfo?.system || '',
      screen_width: (global.deviceInfo?.screenWidth || 0) | 0,
      screen_height: (global.deviceInfo?.screenHeight || 0) | 0,
      model: global.deviceInfo?.model || '',
      time_stamp: (Date.now() / 1000) | 0,
      device_id: global.deviceId || global.oaid || '',
      session_id: global.startId + '',
      network: global.network || '',
      ip: global.ip || '',
      city: global.city || '',
      province: global.region || '',
      first_qid: storage.get('first_qid') || '-1',
      first_lid: storage.get('first_lid') || '-1',
      ext_field_2: (todayStCount[today] || 1) + '',
      brand: (window as any).$GlobalBrand || '',
    };
    
    Reporter.GetInstance().setData(reportData);
    
    (window as any).setGlobalData({ reportData });
  }

  /**
   * 初始化广告配置并触发预加载
   */
  private async initAdConfig(): Promise<void> {
    console.log('[Startup] initAdConfig - 开始初始化广告配置');
    
    try {
      // 拉取应用配置（包含频控、广告位等）
      const appConfig = await this.getAppConfig();
      
      // 设置全局频控配置
      if (appConfig.adSpeciality && typeof window !== 'undefined') {
        (window as any).$Global.adSpeciality = appConfig.adSpeciality;
      }

      // 设置广告层级配置
      const adNet = AdNet.GetInstance();
      
      if (appConfig.storeyRVData) {
        adNet.setStoreyData(appConfig.storeyRVData, 1); // 激励视频
      }
      if (appConfig.storeyData) {
        adNet.setStoreyData(appConfig.storeyData, 2); // 原生/插屏
      }

      // 设置缓存池目标数量（可从配置中读取）
      if (appConfig.poolTarget) {
        adNet.setPoolTarget(appConfig.poolTarget);
      }

      // 标记初始化完成
      if (typeof window !== 'undefined') {
        (window as any).$Global.hasInitial = true;
      }

      // 初始化完成后立即触发全量广告预加载
      console.log('[Startup] initAdConfig - 触发全量广告预加载');
      adNet.loadAd(0);
      
    } catch (error) {
      console.error('[Startup] initAdConfig 失败:', error);
    }
  }

  /**
   * 初始化全局数据
   */
  private initGlobalData(): void {
    if (typeof window === 'undefined') return;

    (window as any).$Global = {
      hasInitial: false,
      config: this.config,
      deviceInfo: getDeviceInfo(),
      startId: Date.now(),
      adStatus: {
        reward: 'idle',
        inters: 'idle',
        fullScreen: 'idle',
      },
      isHide: false,
    };

    (window as any).setGlobalData = (nextState: any) => {
      Object.assign((window as any).$Global, nextState);
    };
  }

  /**
   * 初始化计数器
   */
  private initCounters(): void {
    const today = getFormatDate();
    
    // 启动次数计数
    const todayStCount = storage.getJson<Record<string, number>>('todaystcount', {});
    if (!todayStCount[today]) {
      todayStCount[today] = 1;
    } else {
      todayStCount[today] += 1;
    }
    storage.setJson('todaystcount', todayStCount);

    // 初始化广告计数器
    const adCounterKeys = [
      'DayJLtimes',        // 日激励次数
      'DayYSClicktimes',   // 日原生点击
      'DayJLRequesttimes', // 日激励请求
      'DayYSRequesttimes', // 日原生请求
    ];

    adCounterKeys.forEach(key => {
      const storeVal = storage.get(key);
      if (storeVal) {
        const [date, count] = storeVal.split(',');
        if (date !== today) {
          storage.set(key, `${today},0`);
        }
      } else {
        storage.set(key, `${today},0`);
      }
    });

    // 初始化 first_lid / first_qid
    if (!storage.get('first_lid')) {
      storage.set('first_lid', this.config.channelId || '-1');
    }
    if (!storage.get('first_qid')) {
      storage.set('first_qid', this.config.channelId || '-1');
    }
  }

  /**
   * 获取应用配置（可选，用于拉取后端配置）
   */
  public async getAppConfig(): Promise<any> {
    // 这里可以根据你的后端 API 进行调整
    // 简化版暂时返回默认配置
    return {
      // 频控配置
      adSpeciality: {
        CycleJLtimes: 10,          // 启动内激励上限
        DayJLtimes: 20,            // 日激励上限
        CysleYSRequesttimes: 20,   // 启动内原生请求上限
        DayYSRequesttimes: 50,     // 日原生请求上限
        CysleYSClicktimes: 10,     // 启动内原生点击上限
        CycleJLRequesttimes: 15,   // 启动内激励请求上限
        ClickInterval: 3000,       // 点击间隔（毫秒）
      },
      // 缓存池目标数量
      poolTarget: {
        reward: 1,      // 激励视频保持 1 个
        inters: 2,      // 插屏保持 2 个
        fullScreen: 1,  // 全屏保持 1 个
      },
      // 广告层级配置（示例，实际从后端获取）
      // storeyRVData: [{ platform_list: [{ adid_list: [...], rand_num: 1 }] }],
      // storeyData: [{ platform_list: [{ adid_list: [...], rand_num: 1 }] }],
    };
  }
}
