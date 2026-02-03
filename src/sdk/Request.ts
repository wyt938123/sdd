/**
 * 网络请求封装类
 * 使用 XMLHttpRequest 实现，适配 App WebView 容器环境
 * 仿制自 dev-huaweinonnno/Request.ts
 */
import md5 from "md5";

/**
 * 请求参数接口
 */
interface Params {
  uri: string;
  method: string;
  data: any;
  noReportResTime?: boolean;
  isAbort?: boolean;
  header?: Record<string, any>;
}

/* ============================================================
 * [原实现 - 基于 fetch API]
 * 以下为原 sdd 中的实现，已替换为 XMLHttpRequest 方式
 * ============================================================
 * 
 * interface RequestConfig {
 *   baseURL: string;
 *   header?: Record<string, string>;
 *   timeout?: number;
 * }
 * 
 * interface RequestParams {
 *   uri: string;
 *   method: 'get' | 'post' | 'GET' | 'POST';
 *   data?: any;
 *   noReportResTime?: boolean;
 *   header?: Record<string, string>;
 * }
 * 
 * // 原 request 方法 - 使用 fetch API
 * async request(param: RequestParams): Promise<any> {
 *   const url = this.buildUrl(param);
 *   const headers = { ...this.header, ...(param.header || {}) };
 *   const startTime = Date.now();
 * 
 *   try {
 *     const controller = new AbortController();
 *     const timeoutId = setTimeout(() => controller.abort(), this.timeout);
 * 
 *     const response = await fetch(url, {
 *       method: param.method.toUpperCase(),
 *       headers,
 *       body: param.method.toLowerCase() === 'post' ? 
 *         (typeof param.data === 'string' ? param.data : JSON.stringify(param.data)) : 
 *         undefined,
 *       signal: controller.signal,
 *     });
 * 
 *     clearTimeout(timeoutId);
 * 
 *     const diffTime = Date.now() - startTime;
 *     if (diffTime > 2000 && !param.noReportResTime) {
 *       this.reportInterfaceTime({
 *         event_id: 'interface_time',
 *         event_name: '接口响应时长',
 *         ext_field_1: diffTime,
 *         page_url: url,
 *       });
 *     }
 * 
 *     const text = await response.text();
 *     
 *     if (!response.ok) {
 *       throw new Error(`HTTP ${response.status}: ${response.statusText}`);
 *     }
 * 
 *     try {
 *       return JSON.parse(text);
 *     } catch {
 *       return text;
 *     }
 *   } catch (error) {
 *     if ((error as Error).name === 'AbortError') {
 *       throw { DESC: 'timeout', message: '请求超时' };
 *     }
 *     throw error;
 *   }
 * }
 * 
 * // 原 buildUrl 方法
 * private buildUrl(param: RequestParams): string {
 *   let url = this.baseURL + param.uri;
 *   if (param.method.toLowerCase() === 'get' && param.data) {
 *     const queryString = Object.entries(param.data)
 *       .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
 *       .join('&');
 *     url += (url.indexOf('?') === -1 ? '?' : '&') + queryString;
 *   }
 *   return url;
 * }
 * 
 * // 原 reportInterfaceTime - 委托外部 $Reporter
 * private reportInterfaceTime(data: any) {
 *   if (typeof window !== 'undefined' && (window as any).$Reporter) {
 *     (window as any).$Reporter.report(data);
 *   }
 * }
 * ============================================================ */

/**
 * 网络请求封装类
 * 使用 XMLHttpRequest 实现，适配 App WebView 容器环境
 */
export default class Request {
  baseURL: string;
  header: Record<string, any>;
  timeout = 5000;

  /**
   * 构造函数
   * @param config 基础配置，包含 baseURL 和 header
   */
  constructor(config: { baseURL: string; header?: Record<string, any> }) {
    this.baseURL = config.baseURL;
    this.header = config.header || {};
  }

  /**
   * 设置 XMLHttpRequest 的请求头
   * @param xhr XMLHttpRequest 实例
   * @param header 需要额外设置的请求头对象
   */
  setRequestHeader(xhr: XMLHttpRequest, header: Record<string, any> = {}) {
    // 合并默认请求头与自定义请求头
    let nextHeader = Object.assign({}, this.header, header);
    for (let key of Object.getOwnPropertyNames(nextHeader)) {
      xhr.setRequestHeader(key, nextHeader[key]);
    }
    // console.log('[setRequestHeader]')
  }

  /**
   * 发起网络请求
   * @param param 请求参数，包含 uri, method, data 等
   * @returns 返回 Promise 对象
   */
  request(param: Params): Promise<any> {
    return new Promise((resolve, reject) => {
      let xhr: XMLHttpRequest | null = new XMLHttpRequest();
      // 提取自定义请求头
      let header: Record<string, any> | undefined;
      if (param?.header) {
        header = param?.header;
        delete param.header;
      }
      // 构建完整 URL
      let url = this.baseURL + param.uri;
      // GET 请求拼接查询参数
      if (
        url.indexOf("?") == -1 &&
        param.data &&
        param.method.toLocaleLowerCase() === "get"
      ) {
        url += "?";
        for (let i in param.data) {
          url += i + "=" + param.data[i] + "&";
        }
        url = url.substr(0, url.length - 1);
      }
      // console.log('[xhr][url]', url)
      // console.log('[xhr][method]', param.method)
      // console.log('[xhr][data]', JSON.stringify(param.data))
      
      let startTime = Date.now();
      let timer: ReturnType<typeof setTimeout> | null = null;
      let isRes = false;
      
      // 打开连接并设置请求头
      xhr.open(param.method, url, true);
      this.setRequestHeader(xhr, header);
      // 发送请求数据
      xhr.send(
        (param.method.toLocaleLowerCase() === "post" && param.data) || null
      );
      
      // 超时处理：超时后主动中止请求
      timer = setTimeout(() => {
        if (!isRes && (!param.noReportResTime || param.isAbort)) {
          console.log("[xhr][abort]");
          reject({ DESC: "timeout" });
          xhr && xhr.abort();
          xhr = null;
        }
        timer = null;
      }, this.timeout);
      
      // 监听请求状态变化
      xhr.onreadystatechange = () => {
        if (xhr && xhr.readyState === 4 && !isRes) {
          isRes = true;
          if (timer) clearTimeout(timer);
          // console.log('[onreadystatechange]', xhr.readyState, '-', xhr.status)
          
          // 上报接口耗时（超过 2 秒时上报）
          let diffTime = Date.now() - startTime;
          if (diffTime > 2000 && !param.noReportResTime) {
            this.reportInterfaceTime({
              event_id: "interface_time",
              event_name: "接口响应时长",
              ext_field_1: diffTime,
              page_url: url,
            });
          }
          // 处理响应结果
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.responseText);
          } else {
            reject({ status: xhr.status, statusText: xhr.statusText });
          }
          xhr = null;
        }
      };
      // 错误处理
      xhr.onerror = () => {
        if (xhr) {
          reject({ status: xhr.status, statusText: xhr.statusText });
        }
      };
    });
  }

  /**
   * 上报接口响应时长
   * 直接通过 XMLHttpRequest 发送上报数据，带 md5 签名
   * @param data 包含事件ID、名称及耗时等信息的对象
   */
  reportInterfaceTime(data: Record<string, any>) {
    // 合并全局上报数据
    let datas: Record<string, any> = {
      ...((window as any)?.Global?.reportData || {}),
      ...data,
      platform: "Quickgame",
      brand: (window as any).$GlobalBrand || '',
    };
    let xhr = new XMLHttpRequest();
    // 上报地址
    let url =
      "https://.com/" +
      (datas.cdnReferer || datas.referer);
    xhr.open("post", url, true);
    // 生成签名：Xts(时间戳) + Xsign(md5签名)
    let Xts = Math.round(Date.now() / 1000);
    let header: Record<string, any> = {
      "content-type": "application/json; charset=utf-8",
      "accept-language": "zh-CN",
      Xts,
      Xsign: md5("/1" + Xts),
    };
    for (let key of Object.getOwnPropertyNames(header)) {
      xhr.setRequestHeader(key, header[key]);
    }
    xhr.send(JSON.stringify(datas));
    xhr.onreadystatechange = () => {
      // xhr = null
    };
  }
}
