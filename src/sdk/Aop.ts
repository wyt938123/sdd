/**
 * AOP 应用切面处理（WebView 环境版）
 * 负责生命周期事件监听：前后台切换、错误捕获等
 * 
 * 运行环境: App WebView 容器内的 H5 页面
 * 仿制自 dev-huaweinonnno/Aop.ts
 */
import Reporter from './Reporter';
import EventBus from './EventBus';
import AdNet from './AdNet';

export default {
  /**
   * 初始化生命周期监听
   */
  init() {
    if (typeof window === 'undefined') return;

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.onHide();
      } else {
        this.onShow();
      }
    });

    // 监听窗口失去焦点/获得焦点
    window.addEventListener('blur', () => this.onHide());
    window.addEventListener('focus', () => this.onShow());

    // 全局错误捕获
    window.addEventListener('error', (event) => {
      this.onError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.onError({
        message: 'Unhandled Promise Rejection',
        reason: event.reason,
      });
    });

    // 初始化尝试展示广告的逻辑（监听场景加载）
    this.initTryShow();
  },

  /**
   * 初始化尝试展示广告的逻辑（监听场景加载）
   */
  initTryShow() {
    // 监听场景/页面加载完成事件
    EventBus.$on('sceneLoaderSuc', () => {
      console.log('[Aop] sceneLoaderSuc - 场景加载完成');
      // 可以在这里触发广告渲染逻辑
      EventBus.$emit('ad_render_ready');
    });

    // 监听路由变化事件（用于预加载）
    EventBus.$on('routeChange', (route: { path?: string; meta?: any }) => {
      console.log('[Aop] routeChange:', route?.path);
      // 根据路由 meta 决定是否预加载特定类型的广告
      if (route?.meta?.needRewardAd) {
        AdNet.GetInstance().loadAd('reward');
      }
      if (route?.meta?.needNativeAd) {
        AdNet.GetInstance().loadAd('inters');
      }
    });
  },

  /**
   * 应用切换到前台
   * 触发全量广告预加载，补充缓存池
   */
  onShow() {
    console.log('[Aop] onShow');
    
    if (typeof window !== 'undefined' && (window as any).setGlobalData) {
      (window as any).setGlobalData({ 
        isHide: false,
        isShowRV: false,  // 重置激励视频展示状态
      });
    }

    Reporter.GetInstance().report({
      event_id: 'app_back_cut_front',
      event_name: '应用后台切前台',
    });

    EventBus.$emit('app_show');
    EventBus.$emit('GameOnShow', 1);

    // 前台切换时触发全量广告预加载，补充缓存池
    AdNet.GetInstance().loadAd(0);
  },

  /**
   * 应用切换到后台
   */
  onHide() {
    console.log('[Aop] onHide');
    
    if (typeof window !== 'undefined' && (window as any).setGlobalData) {
      (window as any).setGlobalData({ isHide: true });
    }

    Reporter.GetInstance().report({
      event_id: 'app_front_cut_back',
      event_name: '应用前台切后台',
    });

    EventBus.$emit('app_hide');
    EventBus.$emit('GameOnHide', 1);

    // 可选：后台切换时尝试展示预加载的广告（挭留策略）
    // this.tryShowPreloadedAd();
  },

  /**
   * 全局错误处理
   */
  onError(error: any) {
    console.error('[Aop] onError:', error);
    
    Reporter.GetInstance().report({
      event_id: 'error_log',
      event_name: '系统异常',
      result: JSON.stringify(error),
      scene: '全局异常',
    });
  },

  /* ============================================================
   * [挭留策略 - 可选启用]
   * 当用户切换到后台时，尝试展示预加载的广告
   * ============================================================ */
  // tryShowPreloadedAd() {
  //   const global = (window as any).$Global || {};
  //   const initialize = global.initialize || {};
  //   
  //   // 检查是否开启挭留功能
  //   if (!initialize.ADpageSwitch || initialize.RecallTimes === '0') {
  //     return;
  //   }
  //   
  //   // 尝试展示激励视频或原生广告
  //   const adToken = AdNet.GetInstance().getAdToken('reward');
  //   if (adToken) {
  //     // 通知 App 展示广告
  //     EventBus.$emit('show_retention_ad', adToken);
  //   }
  // },
};
