/**
 * AdNet 逻辑广告池（WebView 环境版）
 * 负责通过 adUnitId + 状态管理广告，不直接实例化原生广告
 * 真实广告实例由 App 端管理，H5 只做策略 + 频控 + 状态同步
 */
import type { AdType } from './types/index.d';
/** 逻辑广告槽位 */
interface LogicalAdSlot {
    adUnitId: string;
    type: AdType;
    isReady: boolean;
    lastLoadTime: number;
    lastShowTime?: number;
    price?: number;
}
/** 广告层级配置 */
interface StoreyConfig {
    platform_list: Array<{
        adid_list: Array<{
            adUnitId: string;
            ad_type: 1 | 2;
            price?: string;
        }>;
        rand_num: number;
        platform: string;
    }>;
}
/**
 * WebView 环境下的广告网络管理器
 */
export default class AdNet {
    private static instance;
    /** 激励视频逻辑池 */
    private rewardPool;
    /** 插屏/原生广告逻辑池 */
    private intersPool;
    /** 全屏视频逻辑池 */
    private fullScreenPool;
    /** 广告层级配置 */
    private storeyRVData;
    private storeyData;
    /** 请求状态 */
    private isRequestLoadReward;
    private isRequestLoadInters;
    /** 请求计数 */
    private loadRewardCount;
    private loadIntersCount;
    /** 启动内计数 */
    private cycleRewardShowCount;
    private cycleIntersClickCount;
    static GetInstance(): AdNet;
    constructor();
    /**
     * 设置广告层级配置
     * @param config 广告位配置
     * @param type 1:激励视频  2:原生/插屏
     */
    setStoreyData(config: StoreyConfig[], type: 1 | 2): void;
    /**
     * 检查请求频次是否超限
     * @param type 广告类型
     */
    getReqAdCountLack(type: AdType): boolean;
    /**
     * 获取当日广告计数
     */
    private getDayAdCount;
    /**
     * 增加当日计数
     */
    private incrementDayCount;
    /**
     * 加载广告（选择广告位并通知 App 预加载）
     * @param type 广告类型
     */
    loadAd(type: AdType): Promise<void>;
    /**
     * 从层级配置中选择一个广告位
     */
    private selectAdUnit;
    /**
     * 发送消息给 App
     */
    private requestPreloadToApp;
    /**
     * 监听 App 返回的广告事件
     */
    private setupAppMessageListener;
    /**
     * 处理预加载成功
     */
    private handlePreloadSuccess;
    /**
     * 处理预加载失败
     */
    private handlePreloadError;
    /**
     * 处理广告关闭
     */
    private handleShowClose;
    /**
     * 获取一个可用的广告 token
     */
    getAdToken(type: AdType): LogicalAdSlot | null;
    /**
     * 获取对应类型的池子
     */
    private getPool;
}
export {};
