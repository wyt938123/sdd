import type { SDKConfig } from './types/index.d';
export default class Startup {
    private static instance;
    private config;
    static GetInstance(): Startup;
    /**
     * 初始化应用
     * @param config SDK 配置
     */
    init(config: SDKConfig): Promise<void>;
    /**
     * 初始化全局数据
     */
    private initGlobalData;
    /**
     * 初始化计数器
     */
    private initCounters;
    /**
     * 获取应用配置（可选，用于拉取后端配置）
     */
    getAppConfig(): Promise<any>;
}
