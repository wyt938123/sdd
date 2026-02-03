/**
 * 工具函数模块
 */

/**
 * 生成随机字符串
 * @param length 字符串长度
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 获取格式化日期 (YYYY-MM-DD)
 */
export function getFormatDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取设备信息
 */
export function getDeviceInfo() {
  const ua = navigator.userAgent;
  return {
    screenWidth: window.screen?.width || window.innerWidth,
    screenHeight: window.screen?.height || window.innerHeight,
    platform: navigator.platform || 'unknown',
    userAgent: ua,
    isAndroid: /android/i.test(ua),
    isIOS: /iphone|ipad|ipod/i.test(ua)
  };
}

/**
 * 生成唯一 ID
 */
export function generateUniqueId(): string {
  return Date.now().toString(36) + generateRandomString(8);
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse<T>(str: string, defaultValue: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function(this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  return function(this: any, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      fn.apply(this, args);
      lastTime = now;
    }
  };
}

/**
 * 检测当前是否在 App WebView 环境
 */
export function isInAppWebView(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  // 检测常见的 WebView 标识
  return (
    ua.includes('uni-app') ||
    ua.includes('hbuilder') ||
    // Android WebView
    ua.includes('wv') ||
    // iOS WebView
    (ua.includes('iphone') && !ua.includes('safari')) ||
    // 检测 uni 对象是否存在
    typeof window.uni !== 'undefined'
  );
}

/**
 * 本地存储封装
 */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
  getJson<T>(key: string, defaultValue: T): T {
    const str = this.get(key);
    if (!str) return defaultValue;
    return safeJsonParse(str, defaultValue);
  },
  setJson(key: string, value: any): boolean {
    try {
      return this.set(key, JSON.stringify(value));
    } catch {
      return false;
    }
  }
};
