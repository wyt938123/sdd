/**
 * 数据上报模块
 * 负责广告行为埋点、错误日志等数据的上报
 */
import type { AdType, AdError, ReportEventData } from './types/index.d';
/** 上报配置 */
interface ReporterConfig {
    /** 上报接口地址 */
    reportUrl?: string;
    /** 应用标识 */
    appId?: string;
    /** 是否开启上报 */
    enabled?: boolean;
    /** 调试模式 */
    debug?: boolean;
}
/**
 * 数据上报类 - 单例模式
 */
export default class Reporter {
    private static instance;
    /** 上报配置 */
    private config;
    /** 全局上报数据 */
    private globalData;
    /** 待上报数据缓存队列 */
    private cacheQueue;
    /** 最大缓存数量 */
    private readonly MAX_CACHE_SIZE;
    /**
     * 获取单例实例
     */
    static GetInstance(): Reporter;
    /**
     * 初始化上报器
     * @param config 上报配置
     */
    init(config: ReporterConfig): void;
    /**
     * 设置全局上报数据
     * @param data 全局数据
     */
    setGlobalData(data: Record<string, any>): void;
    /**
     * 通用事件上报
     * @param eventData 事件数据
     */
    report(eventData: ReportEventData): void;
    /**
     * 上报广告请求事件
     */
    reportAdRequest(adType: AdType): void;
    /**
     * 上报广告加载成功事件
     */
    reportAdLoad(adType: AdType): void;
    /**
     * 上报广告展示事件
     */
    reportAdShow(adType: AdType): void;
    /**
     * 上报广告错误事件
     */
    reportAdError(adType: AdType, error: AdError): void;
    /**
     * 上报广告关闭事件
     */
    reportAdClose(adType: AdType, isEnded: boolean): void;
    /**
     * 上报广告点击事件
     */
    reportAdClick(adType: AdType): void;
    /**
     * 上报 SDK 初始化事件
     */
    reportSDKInit(): void;
    /**
     * 上报错误日志
     */
    reportError(error: Error | string, scene?: string): void;
    /**
     * 发送数据到服务器
     */
    private sendData;
    /**
     * 添加数据到缓存队列
     */
    private addToCache;
    /**
     * 获取缓存的上报数据
     */
    getCachedData(): ReportEventData[];
    /**
     * 清空缓存数据
     */
    clearCache(): void;
    /**
     * 批量发送缓存数据
     */
    flushCache(): void;
    /**
     * 更新配置
     */
    updateConfig(config: Partial<ReporterConfig>): void;
    /**
     * 调试日志
     */
    private log;
}
export {};
