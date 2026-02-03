/**
 * AdNet 逻辑广告池（WebView 环境版）
 * 负责通过 adUnitId + 状态管理广告，不直接实例化原生广告
 * 真实广告实例由 App 端管理，H5 只做策略 + 频控 + 状态同步
 * 
 * 加载策略: 分层并发 + 层内串行
 * - parallelLoad: 各层级并发执行
 * - serialLoad: 层内广告位串行请求，成功即停
 * 
 * 运行环境: App WebView 容器内的 H5 页面
 * 仿制自 dev-huaweinonnno/AdNet.ts
 */
import type { AdType } from './types/index.d';
import Reporter from './Reporter';
import EventBus from './EventBus';
import { storage, generateRandomString } from './Util';

/** 广告位配置项 */
interface AdUnitConfig {
  adUnitId: string;
  ad_type: 1 | 2;  // 1:原生  2:激励视频
  price?: string;
  controlId?: string;
  storey?: number;
  queueType?: string;
}

/** 逻辑广告槽位 */
interface LogicalAdSlot {
  adUnitId: string;      // 广告位ID
  type: AdType;          // 广告类型
  isReady: boolean;      // App 端是否已预加载好
  lastLoadTime: number;  // 上次预加载时间
  lastShowTime?: number; // 上次展示时间
  price?: number;        // 广告价格（用于策略）
  uniqueId?: string;     // 广告唯一标识
}

/** 广告层级配置 */
interface StoreyConfig {
  platform_list: Array<{
    adid_list: AdUnitConfig[];
    rand_num: number;
    platform: string;
  }>;
}

/** 单次加载请求的结果 */
interface LoadResult {
  success: boolean;
  adUnitId: string;
  uniqueId?: string;
  error?: any;
}

/** 缓存池目标数量配置 */
interface PoolTargetConfig {
  reward: number;      // 激励视频缓存池目标数量
  inters: number;      // 插屏广告缓存池目标数量
  fullScreen: number;  // 全屏视频缓存池目标数量
}

/**
 * WebView 环境下的广告网络管理器
 */
export default class AdNet {
  private static instance: AdNet;

  /** 激励视频逻辑池 */
  private rewardPool: LogicalAdSlot[] = [];
  
  /** 插屏/原生广告逻辑池 */
  private intersPool: LogicalAdSlot[] = [];
  
  /** 全屏视频逻辑池 */
  private fullScreenPool: LogicalAdSlot[] = [];

  /** 广告层级配置 */
  private storeyRVData: StoreyConfig[] = [];  // 激励视频队列
  private storeyData: StoreyConfig[] = [];     // 原生/插屏队列

  /** 广告位ID锁定池（防止重复请求） */
  private adUnitIdLockList: Map<string, number> = new Map();

  /** 请求状态 */
  private isRequestLoadReward = false;
  private isRequestLoadInters = false;

  /** 请求计数 */
  private loadRewardCount = 0;
  private loadIntersCount = 0;
  private loadAdCount = 0;  // 总请求次数
  private nowLoadModeCount = 1;  // 当前请求轮次

  /** 启动内计数 */
  private cycleRewardShowCount = 0;
  private cycleIntersClickCount = 0;

  /** 加载超时时间（毫秒） */
  private loadTimeout = 10000;

  /** 待处理的加载 Promise Map */
  private pendingLoads: Map<string, { resolve: (result: LoadResult) => void; timer: any }> = new Map();

  /** 缓存池目标数量配置 */
  private poolTarget: PoolTargetConfig = {
    reward: 1,      // 激励视频保持 1 个缓存
    inters: 2,      // 插屏保持 2 个缓存
    fullScreen: 1,  // 全屏保持 1 个缓存
  };

  /** 应用是否在后台 */
  private get isHide(): boolean {
    return (typeof window !== 'undefined' && (window as any).$Global?.isHide) || false;
  }

  public static GetInstance(): AdNet {
    if (!this.instance) {
      this.instance = new AdNet();
    }
    return this.instance;
  }

  constructor() {
    this.setupAppMessageListener();
  }

  /**
   * 设置缓存池目标数量
   * @param config 目标数量配置
   */
  public setPoolTarget(config: Partial<PoolTargetConfig>): void {
    this.poolTarget = { ...this.poolTarget, ...config };
    console.log('[AdNet] setPoolTarget:', this.poolTarget);
  }

  /**
   * 设置广告层级配置
   * @param config 广告位配置
   * @param type 1:激励视频  2:原生/插屏
   */
  public setStoreyData(config: StoreyConfig[], type: 1 | 2): void {
    if (type === 1) {
      this.storeyRVData = config;
    } else {
      this.storeyData = config;
    }
    console.log(`[AdNet] setStoreyData type=${type}, layers=${config.length}`);
  }

  /**
   * 检查请求频次是否超限
   * @param type 广告类型
   */
  public getReqAdCountLack(type: AdType): boolean {
    const global = (typeof window !== 'undefined' && (window as any).$Global) || {};
    const adSpec = global.adSpeciality || {};

    if (type === 'reward') {
      const dayCount = this.getDayAdCount('DayJLRequesttimes');
      return (
        this.loadRewardCount >= (adSpec.CycleJLRequesttimes || 15) ||
        dayCount >= (adSpec.DayJLRequesttimes || 20)
      );
    } else {
      const dayCount = this.getDayAdCount('DayYSRequesttimes');
      return (
        this.loadIntersCount >= (adSpec.CysleYSRequesttimes || 20) ||
        dayCount >= (adSpec.DayYSRequesttimes || 50)
      );
    }
  }

  /**
   * 获取当日广告计数
   */
  private getDayAdCount(key: string): number {
    const val = storage.get(key);
    if (!val) return 0;
    const [, count] = val.split(',');
    return parseInt(count) || 0;
  }

  /**
   * 增加当日计数
   */
  private incrementDayCount(key: string): void {
    const val = storage.get(key);
    if (!val) return;
    const [date, count] = val.split(',');
    storage.set(key, `${date},${parseInt(count) + 1}`);
  }

  /**
   * 加载广告（入口方法）
   * @param type 广告类型: 0-全量, 'reward'-激励, 'inters'-插屏, 'fullScreen'-全屏
   */
  public async loadAd(type: AdType | 0): Promise<void> {
    // type=0 表示全量预加载（同时加载所有类型）
    if (type === 0) {
      console.log('[AdNet] loadAd(0) - 触发全量预加载');
      await Promise.all([
        this.loadAdByType('reward'),
        this.loadAdByType('inters'),
      ]);
      return;
    }
    
    await this.loadAdByType(type);
  }

  /**
   * 按类型加载广告
   * 使用分层并发策略
   */
  private async loadAdByType(type: AdType): Promise<void> {
    console.log(`[AdNet] loadAdByType type=${type}`);

    // 应用在后台不请求
    if (this.isHide) {
      console.log('[AdNet] 应用在后台，跳过加载');
      return;
    }

    // 检查配置是否为空
    const storeyData = type === 'reward' ? this.storeyRVData : this.storeyData;
    if (!storeyData.length) {
      console.log(`[AdNet] 没有广告配置: ${type}`);
      return;
    }

    // 检查频控
    if (this.getReqAdCountLack(type)) {
      console.log(`[AdNet] 请求次数已达上限: ${type}`);
      return;
    }

    // 检查是否正在请求
    if (type === 'reward' && this.isRequestLoadReward) return;
    if (type !== 'reward' && this.isRequestLoadInters) return;

    // 检查缓存池是否已达到目标数量
    const pool = this.getPool(type);
    const targetCount = this.poolTarget[type] || 1;
    if (pool.length >= targetCount) {
      console.log(`[AdNet] 缓存池已达目标: ${type}, current=${pool.length}, target=${targetCount}`);
      return;
    }

    // 激励视频已有实例时不再请求
    if (type === 'reward' && pool.length > 0) {
      console.log('[AdNet] 激励视频已有实例，跳过');
      return;
    }

    // 标记请求中
    if (type === 'reward') {
      this.isRequestLoadReward = true;
    } else {
      this.isRequestLoadInters = true;
    }

    // 使用分层并发策略加载
    await this.parallelLoad(type).catch(err => {
      console.error('[AdNet] parallelLoad error:', err);
    });

    console.log(`[AdNet] loadAdByType result: pool=${this.getPool(type).length}`);

    // 重置请求状态
    if (type === 'reward') {
      this.isRequestLoadReward = false;
    } else {
      this.isRequestLoadInters = false;
    }

    this.nowLoadModeCount++;

    // 缓存池为空且未达频控，继续尝试
    if (type !== 'reward' && !this.getPool(type).length && !this.getReqAdCountLack(type)) {
      console.log(`[AdNet] 缓存池为空，继续加载: ${type}`);
      this.loadAdByType(type);
    }
  }

  /* ============================================================
   * 分层并发 + 层内串行 加载策略
   * ============================================================ */

  /**
   * 并行加载（层间并发）
   * 每一层并发执行，层内串行
   * @param type 广告类型
   */
  private async parallelLoad(type: AdType): Promise<boolean> {
    console.log('[AdNet] parallelLoad start');
    
    const key = type === 'reward' ? 'storeyRVData' : 'storeyData';
    const storeyData = this[key] as StoreyConfig[];
    
    // 构建每层的广告位队列（过滤已锁定的）
    const adQueue: AdUnitConfig[][] = storeyData.map((layer, layerIndex) => {
      let queue: AdUnitConfig[] = [];
      
      layer.platform_list.forEach(platform => {
        // 过滤已锁定的广告位
        const available = platform.adid_list.filter(
          ad => !this.adUnitIdLockList.has(ad.adUnitId)
        );
        // 随机打乱
        available.sort(() => Math.random() - 0.5);
        // 取 rand_num 个
        const selected = available.slice(0, platform.rand_num || 1);
        // 标记层级
        selected.forEach(ad => {
          ad.storey = layerIndex + 1;
        });
        queue = queue.concat(selected);
      });
      
      return queue;
    });

    console.log(`[AdNet] parallelLoad adQueue layers=${adQueue.length}`);

    // 各层并发执行，层内串行
    return new Promise((resolve, reject) => {
      Promise.all(
        adQueue.map(layerQueue => this.serialLoad(layerQueue, type))
      )
        .then(() => resolve(true))
        .catch(err => reject(err));
    });
  }

  /**
   * 串行加载（层内串行）
   * 依次请求广告位，成功即停止
   * @param queue 广告位队列
   * @param type 广告类型
   */
  private async serialLoad(queue: AdUnitConfig[], type: AdType): Promise<boolean> {
    const context = { hasSuccess: false };
    
    for (const adItem of queue) {
      if (!adItem) break;
      if (context.hasSuccess) break;  // 已有成功的，停止
      
      // 检查频控
      if (this.getReqAdCountLack(type)) break;
      
      // 检查应用是否在后台
      if (this.isHide) break;

      try {
        const result = await this.loadSingleAd(adItem, type, context);
        if (result || context.hasSuccess) {
          break;  // 成功即停止
        }
      } catch (err) {
        console.log('[AdNet] serialLoad error:', err);
      }
    }
    
    return context.hasSuccess;
  }

  /**
   * 加载单个广告位
   * @param adItem 广告位配置
   * @param type 广告类型
   * @param context 上下文（用于跨请求通信）
   */
  private loadSingleAd(
    adItem: AdUnitConfig, 
    type: AdType, 
    context: { hasSuccess: boolean }
  ): Promise<boolean> {
    // 应用在后台或激励视频已有缓存
    if (this.isHide) return Promise.resolve(false);
    if (type === 'reward' && this.rewardPool.length > 0) return Promise.resolve(false);

    const { adUnitId } = adItem;
    console.log(`[AdNet] loadSingleAd: ${adUnitId}`);

    // 增加计数
    this.loadAdCount++;
    if (type === 'reward') {
      this.loadRewardCount++;
      this.incrementDayCount('DayJLRequesttimes');
    } else {
      this.loadIntersCount++;
      this.incrementDayCount('DayYSRequesttimes');
    }

    // 检查频控
    if (this.getReqAdCountLack(type)) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      // 锁定广告位
      this.adUnitIdLockList.set(adUnitId, Date.now());

      // 设置超时
      const timer = setTimeout(() => {
        console.log(`[AdNet] loadSingleAd timeout: ${adUnitId}`);
        this.pendingLoads.delete(adUnitId);
        this.unLockAdUnitId(adUnitId);
        resolve(false);
      }, this.loadTimeout);

      // 注册等待回调
      this.pendingLoads.set(adUnitId, {
        resolve: (result: LoadResult) => {
          clearTimeout(timer);
          this.pendingLoads.delete(adUnitId);
          
          if (result.success) {
            context.hasSuccess = true;
            // 入池
            this.enterThePool({
              ...adItem,
              type,
              uniqueId: result.uniqueId || generateRandomString(16),
            });
            Reporter.GetInstance().reportAdLoad(type);
          } else {
            this.unLockAdUnitId(adUnitId);
            Reporter.GetInstance().reportAdError(type, result.error);
          }
          
          resolve(result.success);
        },
        timer,
      });

      // 发送预加载请求给 App
      this.requestPreloadToApp({
        action: 'preload',
        type,
        adUnitId,
        price: adItem.price,
        storey: adItem.storey,
      });

      // 上报请求事件
      Reporter.GetInstance().reportAdRequest(type);
    });
  }

  /**
   * 入池（将加载成功的广告存入缓存池）
   */
  private enterThePool(adObj: any): void {
    const pool = this.getPool(adObj.type);
    pool.push({
      adUnitId: adObj.adUnitId,
      type: adObj.type,
      isReady: true,
      lastLoadTime: Date.now(),
      price: parseFloat(adObj.price) || 0,
      uniqueId: adObj.uniqueId,
    });
    console.log(`[AdNet] enterThePool: ${adObj.type}, pool=${pool.length}`);
  }

  /**
   * 解锁广告位ID（从锁定池中移除，允许下次请求）
   * @param adUnitId 广告位ID
   */
  public unLockAdUnitId(adUnitId: string): void {
    this.adUnitIdLockList.delete(adUnitId);
    console.log(`[AdNet] unLockAdUnitId: ${adUnitId}`);
  }

  /**
   * 发送消息给 App
   */
  private requestPreloadToApp(data: any): void {
    if (typeof window === 'undefined' || !window.uni) return;

    console.log('[AdNet] postMessage to App:', data);
    
    try {
      if (window.uni.postMessage) {
        window.uni.postMessage({ data });
      } else if (window.uni.webView?.postMessage) {
        window.uni.webView.postMessage(data);
      }
    } catch (error) {
      console.error('[AdNet] postMessage failed:', error);
    }
  }

  /**
   * 监听 App 返回的广告事件
   */
  private setupAppMessageListener(): void {
    // 预加载成功
    EventBus.$on('app_ad_preload_ok', (data: { type: AdType; adUnitId: string; uniqueId?: string }) => {
      this.handlePreloadSuccess(data);
    });

    // 预加载失败
    EventBus.$on('app_ad_preload_error', (data: { type: AdType; adUnitId: string; error: any }) => {
      this.handlePreloadError(data);
    });

    // 广告展示结束
    EventBus.$on('app_ad_show_close', (data: { type: AdType; adUnitId: string; isEnded: boolean }) => {
      this.handleShowClose(data);
    });
  }

  /**
   * 处理预加载成功
   * 通知 pending Promise 并检查是否需要继续补池
   */
  private handlePreloadSuccess(data: { type: AdType; adUnitId: string; uniqueId?: string }): void {
    console.log('[AdNet] 预加载成功:', data);

    // 处理 pending 的 Promise
    const pending = this.pendingLoads.get(data.adUnitId);
    if (pending) {
      pending.resolve({
        success: true,
        adUnitId: data.adUnitId,
        uniqueId: data.uniqueId,
      });
      return;  // serialLoad 中已处理入池
    }

    // 兜底：直接入池（非分层并发调用时）
    const pool = this.getPool(data.type);
    pool.push({
      adUnitId: data.adUnitId,
      type: data.type,
      isReady: true,
      lastLoadTime: Date.now(),
      uniqueId: data.uniqueId || generateRandomString(16),
    });

    Reporter.GetInstance().reportAdLoad(data.type);

    // 检查是否需要继续补池
    const targetCount = this.poolTarget[data.type] || 1;
    if (pool.length < targetCount && !this.getReqAdCountLack(data.type)) {
      console.log(`[AdNet] 缓存池未满，继续补池: ${data.type}`);
      setTimeout(() => this.loadAdByType(data.type), 500);
    }
  }

  /**
   * 处理预加载失败
   * 通知 pending Promise 并尝试重新加载
   */
  private handlePreloadError(data: { type: AdType; adUnitId: string; error: any }): void {
    console.log('[AdNet] 预加载失败:', data);

    // 处理 pending 的 Promise
    const pending = this.pendingLoads.get(data.adUnitId);
    if (pending) {
      pending.resolve({
        success: false,
        adUnitId: data.adUnitId,
        error: data.error,
      });
      return;  // serialLoad 中已处理解锁
    }

    // 兜底：直接解锁
    this.unLockAdUnitId(data.adUnitId);
    Reporter.GetInstance().reportAdError(data.type, data.error);

    // 缓存池为空时尝试重新加载
    const pool = this.getPool(data.type);
    if (pool.length === 0 && !this.getReqAdCountLack(data.type)) {
      setTimeout(() => this.loadAdByType(data.type), 1000);
    }
  }

  /**
   * 处理广告关闭
   * 关闭后解锁广告位并立即触发补池
   */
  private handleShowClose(data: { type: AdType; adUnitId: string; isEnded: boolean }): void {
    console.log('[AdNet] 广告关闭:', data);

    // 从池子中移除
    const pool = this.getPool(data.type);
    const index = pool.findIndex(slot => slot.adUnitId === data.adUnitId);
    if (index !== -1) {
      pool.splice(index, 1);
    }

    // 解锁广告位
    this.unLockAdUnitId(data.adUnitId);

    // 计数
    if (data.type === 'reward') {
      this.cycleRewardShowCount++;
      this.incrementDayCount('DayJLtimes');
    } else {
      this.cycleIntersClickCount++;
      this.incrementDayCount('DayYSClicktimes');
    }

    Reporter.GetInstance().reportAdClose(data.type, data.isEnded);

    // 广告消耗后立即触发补池
    console.log(`[AdNet] 广告消耗后触发补池: ${data.type}`);
    this.loadAdByType(data.type);
  }

  /**
   * 出池（获取一个可用的广告）
   */
  public getAd(type: AdType): LogicalAdSlot | null {
    const pool = this.getPool(type);
    if (pool.length === 0) return null;
    // 取出第一个
    return pool.shift() || null;
  }

  /**
   * 获取一个可用的广告 token（不出池，仅查看）
   */
  public getAdToken(type: AdType): LogicalAdSlot | null {
    const pool = this.getPool(type);
    if (pool.length === 0) return null;
    // 取第一个 ready 的
    const slot = pool.find(s => s.isReady);
    return slot || null;
  }

  /**
   * 获取对应类型的池子
   */
  private getPool(type: AdType): LogicalAdSlot[] {
    if (type === 'reward') return this.rewardPool;
    if (type === 'inters') return this.intersPool;
    return this.fullScreenPool;
  }

  /**
   * 获取缓存池状态（调试用）
   */
  public getPoolStatus(): Record<string, number> {
    return {
      reward: this.rewardPool.length,
      inters: this.intersPool.length,
      fullScreen: this.fullScreenPool.length,
    };
  }
}
