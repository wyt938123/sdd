/**
 * 工具函数模块
 */
/**
 * 生成随机字符串
 * @param length 字符串长度
 */
export declare function generateRandomString(length: number): string;
/**
 * 获取格式化日期 (YYYY-MM-DD)
 */
export declare function getFormatDate(): string;
/**
 * 获取设备信息
 */
export declare function getDeviceInfo(): {
    screenWidth: number;
    screenHeight: number;
    platform: string;
    userAgent: string;
    isAndroid: boolean;
    isIOS: boolean;
};
/**
 * 生成唯一 ID
 */
export declare function generateUniqueId(): string;
/**
 * 安全的 JSON 解析
 */
export declare function safeJsonParse<T>(str: string, defaultValue: T): T;
/**
 * 防抖函数
 */
export declare function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void;
/**
 * 节流函数
 */
export declare function throttle<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void;
/**
 * 检测当前是否在 App WebView 环境
 */
export declare function isInAppWebView(): boolean;
/**
 * 本地存储封装
 */
export declare const storage: {
    get(key: string): string | null;
    set(key: string, value: string): boolean;
    remove(key: string): boolean;
    getJson<T>(key: string, defaultValue: T): T;
    setJson(key: string, value: any): boolean;
};
