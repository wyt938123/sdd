/**
 * 网络请求封装类（WebView 环境适配版）
 * 支持 fetch API，兼容浏览器和 WebView 容器
 */
interface RequestConfig {
    baseURL: string;
    header?: Record<string, string>;
    timeout?: number;
}
interface RequestParams {
    uri: string;
    method: 'get' | 'post' | 'GET' | 'POST';
    data?: any;
    noReportResTime?: boolean;
    header?: Record<string, string>;
}
export default class Request {
    private baseURL;
    private header;
    private timeout;
    constructor(config: RequestConfig);
    /**
     * 发起网络请求
     * @param param 请求参数
     */
    request(param: RequestParams): Promise<any>;
    /**
     * 构建完整请求 URL
     */
    private buildUrl;
    /**
     * 上报接口耗时（可选，需要外部实现）
     */
    private reportInterfaceTime;
}
export {};
