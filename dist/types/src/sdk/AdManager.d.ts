/**
 * 广告管理器（结合 AdNet 逻辑池）
 * 负责通过 uni.postMessage 与 App 通信，触发广告展示
 * 运行环境: App WebView 容器内的 H5 页面
 */
import type { AdType, AdCallbacks, AdConfig, AdStatus } from './types/index.d';
/** 广告事件名称常量 */
export declare const AD_EVENTS: {
    readonly AD_REQUEST: "ad_request";
    readonly AD_LOAD: "ad_load";
    readonly AD_ERROR: "ad_error";
    readonly AD_SHOW: "ad_show";
    readonly AD_CLOSE: "ad_close";
    readonly AD_CLICK: "ad_click";
};
export default class AdManager {
    private static instance;
    private config;
    private adStatus;
    private currentCallbacks;
    private bridgeReady;
    private debug;
    static GetInstance(): AdManager;
    init(config: AdConfig): void;
    /**
     * 设置 AdNet 广告位配置
     */
    private setupAdNetConfig;
    private setupBridge;
    private setupMessageListener;
    /**
     * 展示广告（结合 AdNet 逻辑池）
     * @param type 广告类型
     * @param callbacks 广告回调
     */
    showAd(type: AdType, callbacks?: AdCallbacks): void;
    /**
     * 向 App 发送消息请求展示广告
     * @param type 广告类型
     * @param adUnitId 广告位ID
     */
    private requestShowToApp;
    /**
     * 检查 JSBridge 是否可用
     */
    private isBridgeAvailable;
    /**
     * 处理广告加载成功
     */
    private handleAdLoad;
    /**
     * 处理广告展示
     */
    private handleAdShow;
    /**
     * 处理广告错误
     */
    private handleAdError;
    /**
     * 处理广告关闭
     */
    private handleAdClose;
    /**
     * 获取广告状态
     */
    getAdStatus(type: AdType): AdStatus;
    /**
     * 获取所有广告状态
     */
    getAllAdStatus(): Record<AdType, AdStatus>;
    /**
     * 更新配置
     */
    updateConfig(config: Partial<AdConfig>): void;
    /**
     * 获取当前配置
     */
    getConfig(): AdConfig;
    /**
     * 调试日志
     */
    private log;
}
