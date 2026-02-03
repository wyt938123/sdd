(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.adServe = {}));
})(this, (function (exports) { 'use strict';

    /**
     * 事件总线类
     * 负责 SDK 内部跨模块的消息发布与订阅
     */
    class EventBus {
        constructor() {
            /** 存储事件名及其对应回调函数数组的映射 */
            this.events = new Map();
        }
        /**
         * 触发事件
         * @param event 事件名称
         * @param data 传递给回调函数的数据
         */
        $emit(event, data) {
            if (this.events.has(event)) {
                const callbacks = this.events.get(event);
                callbacks === null || callbacks === void 0 ? void 0 : callbacks.forEach(callback => {
                    try {
                        callback(data);
                    }
                    catch (error) {
                        console.error(`[EventBus] Error in event handler for "${event}":`, error);
                    }
                });
            }
        }
        /**
         * 订阅事件
         * @param event 事件名称
         * @param callback 事件回调函数
         */
        $on(event, callback) {
            if (this.events.has(event)) {
                this.events.set(event, this.events.get(event).concat(callback));
            }
            else {
                this.events.set(event, [callback]);
            }
        }
        /**
         * 取消订阅事件
         * @param event 事件名称
         * @param callback 要取消的特定回调函数（如果不传则取消该事件下的所有回调）
         */
        $off(event, callback) {
            if (this.events.has(event)) {
                if (callback) {
                    this.events.set(event, this.events.get(event).filter(cb => cb !== callback));
                }
                else {
                    this.events.delete(event);
                }
            }
        }
        /**
         * 订阅一次性事件（触发后自动取消订阅）
         * @param event 事件名称
         * @param callback 事件回调函数
         */
        $once(event, callback) {
            const onceWrapper = (data) => {
                callback(data);
                this.$off(event, onceWrapper);
            };
            this.$on(event, onceWrapper);
        }
        /**
         * 清空所有事件订阅
         */
        $clear() {
            this.events.clear();
        }
        /**
         * 获取某个事件的订阅数量
         * @param event 事件名称
         */
        getListenerCount(event) {
            var _a;
            return ((_a = this.events.get(event)) === null || _a === void 0 ? void 0 : _a.length) || 0;
        }
    }
    /** 导出单例实例 */
    const eventBus = new EventBus();

    /**
     * 数据上报类 - 单例模式
     */
    class Reporter {
        constructor() {
            /** 上报配置 */
            this.config = {
                reportUrl: '',
                enabled: true,
                debug: false
            };
            /** 全局上报数据 */
            this.globalData = {
                platform: 'h5_webapp',
                sdk_version: '1.0.0'
            };
            /** 待上报数据缓存队列 */
            this.cacheQueue = [];
            /** 最大缓存数量 */
            this.MAX_CACHE_SIZE = 50;
        }
        /**
         * 获取单例实例
         */
        static GetInstance() {
            if (!Reporter.instance) {
                Reporter.instance = new Reporter();
            }
            return Reporter.instance;
        }
        /**
         * 初始化上报器
         * @param config 上报配置
         */
        init(config) {
            this.config = Object.assign(Object.assign({}, this.config), config);
            this.log('[Reporter] Initialized');
        }
        /**
         * 设置全局上报数据
         * @param data 全局数据
         */
        setGlobalData(data) {
            Object.assign(this.globalData, data);
        }
        /**
         * 通用事件上报
         * @param eventData 事件数据
         */
        report(eventData) {
            if (!this.config.enabled) {
                this.log('[Reporter] Reporting disabled, skipped:', eventData.event_id);
                return;
            }
            const data = Object.assign(Object.assign(Object.assign({}, this.globalData), eventData), { timestamp: Date.now() });
            this.log('[Reporter] Report event:', data);
            // 如果配置了上报地址，发送数据
            if (this.config.reportUrl) {
                this.sendData(data);
            }
            else {
                // 否则缓存数据
                this.addToCache(data);
            }
        }
        /**
         * 上报广告请求事件
         */
        reportAdRequest(adType) {
            this.report({
                event_id: 'ad_request',
                event_name: '广告请求',
                ad_type: adType,
                result: 'pending'
            });
        }
        /**
         * 上报广告加载成功事件
         */
        reportAdLoad(adType) {
            this.report({
                event_id: 'ad_load',
                event_name: '广告加载成功',
                ad_type: adType,
                result: 'success'
            });
        }
        /**
         * 上报广告展示事件
         */
        reportAdShow(adType) {
            this.report({
                event_id: 'ad_show',
                event_name: '广告展示',
                ad_type: adType,
                result: 'success'
            });
        }
        /**
         * 上报广告错误事件
         */
        reportAdError(adType, error) {
            this.report({
                event_id: 'ad_error',
                event_name: '广告错误',
                ad_type: adType,
                result: 'fail',
                error_code: error.code,
                error_msg: error.message
            });
        }
        /**
         * 上报广告关闭事件
         */
        reportAdClose(adType, isEnded) {
            this.report({
                event_id: 'ad_close',
                event_name: '广告关闭',
                ad_type: adType,
                result: isEnded ? 'completed' : 'skipped',
                is_ended: isEnded
            });
        }
        /**
         * 上报广告点击事件
         */
        reportAdClick(adType) {
            this.report({
                event_id: 'ad_click',
                event_name: '广告点击',
                ad_type: adType,
                result: 'success'
            });
        }
        /**
         * 上报 SDK 初始化事件
         */
        reportSDKInit() {
            this.report({
                event_id: 'sdk_init',
                event_name: 'SDK初始化',
                result: 'success'
            });
        }
        /**
         * 上报错误日志
         */
        reportError(error, scene) {
            this.report({
                event_id: 'error_log',
                event_name: '错误日志',
                result: 'error',
                error_msg: typeof error === 'string' ? error : error.message,
                scene: scene || 'unknown'
            });
        }
        /**
         * 发送数据到服务器
         */
        sendData(data) {
            if (!this.config.reportUrl)
                return;
            try {
                // 使用 navigator.sendBeacon 进行上报 (不阻塞页面)
                if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
                    navigator.sendBeacon(this.config.reportUrl, JSON.stringify(data));
                }
                else {
                    // 降级使用 fetch
                    fetch(this.config.reportUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data),
                        keepalive: true
                    }).catch(err => {
                        this.log('[Reporter] Send failed:', err);
                    });
                }
            }
            catch (error) {
                this.log('[Reporter] Send error:', error);
            }
        }
        /**
         * 添加数据到缓存队列
         */
        addToCache(data) {
            if (this.cacheQueue.length >= this.MAX_CACHE_SIZE) {
                this.cacheQueue.shift(); // 移除最早的数据
            }
            this.cacheQueue.push(data);
        }
        /**
         * 获取缓存的上报数据
         */
        getCachedData() {
            return [...this.cacheQueue];
        }
        /**
         * 清空缓存数据
         */
        clearCache() {
            this.cacheQueue = [];
        }
        /**
         * 批量发送缓存数据
         */
        flushCache() {
            if (!this.config.reportUrl || this.cacheQueue.length === 0)
                return;
            const dataToSend = [...this.cacheQueue];
            this.cacheQueue = [];
            dataToSend.forEach(data => {
                this.sendData(data);
            });
            this.log('[Reporter] Flushed cache, count:', dataToSend.length);
        }
        /**
         * 更新配置
         */
        updateConfig(config) {
            this.config = Object.assign(Object.assign({}, this.config), config);
        }
        /**
         * 调试日志
         */
        log(...args) {
            if (this.config.debug) {
                console.log(...args);
            }
        }
    }

    /**
     * 工具函数模块
     */
    /**
     * 生成随机字符串
     * @param length 字符串长度
     */
    function generateRandomString(length) {
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
    function getFormatDate() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    /**
     * 获取设备信息
     */
    function getDeviceInfo() {
        var _a, _b;
        const ua = navigator.userAgent;
        return {
            screenWidth: ((_a = window.screen) === null || _a === void 0 ? void 0 : _a.width) || window.innerWidth,
            screenHeight: ((_b = window.screen) === null || _b === void 0 ? void 0 : _b.height) || window.innerHeight,
            platform: navigator.platform || 'unknown',
            userAgent: ua,
            isAndroid: /android/i.test(ua),
            isIOS: /iphone|ipad|ipod/i.test(ua)
        };
    }
    /**
     * 生成唯一 ID
     */
    function generateUniqueId() {
        return Date.now().toString(36) + generateRandomString(8);
    }
    /**
     * 安全的 JSON 解析
     */
    function safeJsonParse(str, defaultValue) {
        try {
            return JSON.parse(str);
        }
        catch (_a) {
            return defaultValue;
        }
    }
    /**
     * 防抖函数
     */
    function debounce(fn, delay) {
        let timer = null;
        return function (...args) {
            if (timer)
                clearTimeout(timer);
            timer = setTimeout(() => {
                fn.apply(this, args);
                timer = null;
            }, delay);
        };
    }
    /**
     * 节流函数
     */
    function throttle(fn, delay) {
        let lastTime = 0;
        return function (...args) {
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
    function isInAppWebView() {
        const ua = navigator.userAgent.toLowerCase();
        // 检测常见的 WebView 标识
        return (ua.includes('uni-app') ||
            ua.includes('hbuilder') ||
            // Android WebView
            ua.includes('wv') ||
            // iOS WebView
            (ua.includes('iphone') && !ua.includes('safari')) ||
            // 检测 uni 对象是否存在
            typeof window.uni !== 'undefined');
    }
    /**
     * 本地存储封装
     */
    const storage = {
        get(key) {
            try {
                return localStorage.getItem(key);
            }
            catch (_a) {
                return null;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            }
            catch (_a) {
                return false;
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            }
            catch (_a) {
                return false;
            }
        },
        getJson(key, defaultValue) {
            const str = this.get(key);
            if (!str)
                return defaultValue;
            return safeJsonParse(str, defaultValue);
        },
        setJson(key, value) {
            try {
                return this.set(key, JSON.stringify(value));
            }
            catch (_a) {
                return false;
            }
        }
    };

    var Util = /*#__PURE__*/Object.freeze({
        __proto__: null,
        debounce: debounce,
        generateRandomString: generateRandomString,
        generateUniqueId: generateUniqueId,
        getDeviceInfo: getDeviceInfo,
        getFormatDate: getFormatDate,
        isInAppWebView: isInAppWebView,
        safeJsonParse: safeJsonParse,
        storage: storage,
        throttle: throttle
    });

    /**
     * WebView 环境下的广告网络管理器
     */
    class AdNet {
        static GetInstance() {
            if (!this.instance) {
                this.instance = new AdNet();
            }
            return this.instance;
        }
        constructor() {
            /** 激励视频逻辑池 */
            this.rewardPool = [];
            /** 插屏/原生广告逻辑池 */
            this.intersPool = [];
            /** 全屏视频逻辑池 */
            this.fullScreenPool = [];
            /** 广告层级配置 */
            this.storeyRVData = []; // 激励视频队列
            this.storeyData = []; // 原生/插屏队列
            /** 请求状态 */
            this.isRequestLoadReward = false;
            this.isRequestLoadInters = false;
            /** 请求计数 */
            this.loadRewardCount = 0;
            this.loadIntersCount = 0;
            /** 启动内计数 */
            this.cycleRewardShowCount = 0;
            this.cycleIntersClickCount = 0;
            this.setupAppMessageListener();
        }
        /**
         * 设置广告层级配置
         * @param config 广告位配置
         * @param type 1:激励视频  2:原生/插屏
         */
        setStoreyData(config, type) {
            if (type === 1) {
                this.storeyRVData = config;
            }
            else {
                this.storeyData = config;
            }
            console.log(`[AdNet] setStoreyData type=${type}, layers=${config.length}`);
        }
        /**
         * 检查请求频次是否超限
         * @param type 广告类型
         */
        getReqAdCountLack(type) {
            const global = (typeof window !== 'undefined' && window.$Global) || {};
            const adSpec = global.adSpeciality || {};
            if (type === 'reward') {
                const dayCount = this.getDayAdCount('DayJLRequesttimes');
                return (this.loadRewardCount >= (adSpec.CycleJLRequesttimes || 15) ||
                    dayCount >= (adSpec.DayJLRequesttimes || 20));
            }
            else {
                const dayCount = this.getDayAdCount('DayYSRequesttimes');
                return (this.loadIntersCount >= (adSpec.CysleYSRequesttimes || 20) ||
                    dayCount >= (adSpec.DayYSRequesttimes || 50));
            }
        }
        /**
         * 获取当日广告计数
         */
        getDayAdCount(key) {
            const val = storage.get(key);
            if (!val)
                return 0;
            const [, count] = val.split(',');
            return parseInt(count) || 0;
        }
        /**
         * 增加当日计数
         */
        incrementDayCount(key) {
            const val = storage.get(key);
            if (!val)
                return;
            const [date, count] = val.split(',');
            storage.set(key, `${date},${parseInt(count) + 1}`);
        }
        /**
         * 加载广告（选择广告位并通知 App 预加载）
         * @param type 广告类型
         */
        async loadAd(type) {
            console.log(`[AdNet] loadAd type=${type}`);
            // 检查频控
            if (this.getReqAdCountLack(type)) {
                console.log(`[AdNet] 请求次数已达上限: ${type}`);
                return;
            }
            // 检查是否正在请求
            if (type === 'reward' && this.isRequestLoadReward)
                return;
            if (type !== 'reward' && this.isRequestLoadInters)
                return;
            // 检查池子是否已满
            const pool = this.getPool(type);
            if (pool.length > 0) {
                console.log(`[AdNet] 池子已有广告: ${type}, count=${pool.length}`);
                return;
            }
            // 选择广告位
            const adUnit = this.selectAdUnit(type);
            if (!adUnit) {
                console.log(`[AdNet] 没有可用的广告位: ${type}`);
                return;
            }
            // 标记请求中
            if (type === 'reward') {
                this.isRequestLoadReward = true;
                this.loadRewardCount++;
                this.incrementDayCount('DayJLRequesttimes');
            }
            else {
                this.isRequestLoadInters = true;
                this.loadIntersCount++;
                this.incrementDayCount('DayYSRequesttimes');
            }
            // 发送消息给 App，请求预加载
            this.requestPreloadToApp({
                action: 'preload',
                type,
                adUnitId: adUnit.adUnitId,
                price: adUnit.price,
            });
            // 上报请求事件
            Reporter.GetInstance().reportAdRequest(type);
        }
        /**
         * 从层级配置中选择一个广告位
         */
        selectAdUnit(type) {
            var _a;
            const storeyData = type === 'reward' ? this.storeyRVData : this.storeyData;
            if (!storeyData.length)
                return null;
            // 简化版：只从第一层第一个 platform 随机取一个
            const firstLayer = storeyData[0];
            if (!((_a = firstLayer === null || firstLayer === void 0 ? void 0 : firstLayer.platform_list) === null || _a === void 0 ? void 0 : _a.length))
                return null;
            const platform = firstLayer.platform_list[0];
            const adList = platform.adid_list || [];
            if (!adList.length)
                return null;
            // 随机选一个
            const randomIndex = Math.floor(Math.random() * Math.min(adList.length, platform.rand_num || 1));
            return adList[randomIndex];
        }
        /**
         * 发送消息给 App
         */
        requestPreloadToApp(data) {
            var _a;
            if (typeof window === 'undefined' || !window.uni)
                return;
            console.log('[AdNet] postMessage to App:', data);
            try {
                if (window.uni.postMessage) {
                    window.uni.postMessage({ data });
                }
                else if ((_a = window.uni.webView) === null || _a === void 0 ? void 0 : _a.postMessage) {
                    window.uni.webView.postMessage(data);
                }
            }
            catch (error) {
                console.error('[AdNet] postMessage failed:', error);
            }
        }
        /**
         * 监听 App 返回的广告事件
         */
        setupAppMessageListener() {
            // 预加载成功
            eventBus.$on('app_ad_preload_ok', (data) => {
                this.handlePreloadSuccess(data);
            });
            // 预加载失败
            eventBus.$on('app_ad_preload_error', (data) => {
                this.handlePreloadError(data);
            });
            // 广告展示结束
            eventBus.$on('app_ad_show_close', (data) => {
                this.handleShowClose(data);
            });
        }
        /**
         * 处理预加载成功
         */
        handlePreloadSuccess(data) {
            console.log('[AdNet] 预加载成功:', data);
            const pool = this.getPool(data.type);
            pool.push({
                adUnitId: data.adUnitId,
                type: data.type,
                isReady: true,
                lastLoadTime: Date.now(),
            });
            // 重置请求状态
            if (data.type === 'reward') {
                this.isRequestLoadReward = false;
            }
            else {
                this.isRequestLoadInters = false;
            }
            Reporter.GetInstance().reportAdLoad(data.type);
        }
        /**
         * 处理预加载失败
         */
        handlePreloadError(data) {
            console.log('[AdNet] 预加载失败:', data);
            // 重置请求状态
            if (data.type === 'reward') {
                this.isRequestLoadReward = false;
            }
            else {
                this.isRequestLoadInters = false;
            }
            Reporter.GetInstance().reportAdError(data.type, data.error);
        }
        /**
         * 处理广告关闭
         */
        handleShowClose(data) {
            console.log('[AdNet] 广告关闭:', data);
            // 从池子中移除
            const pool = this.getPool(data.type);
            const index = pool.findIndex(slot => slot.adUnitId === data.adUnitId);
            if (index !== -1) {
                pool.splice(index, 1);
            }
            // 计数
            if (data.type === 'reward') {
                this.cycleRewardShowCount++;
                this.incrementDayCount('DayJLtimes');
            }
            else {
                this.cycleIntersClickCount++;
                this.incrementDayCount('DayYSClicktimes');
            }
            Reporter.GetInstance().reportAdClose(data.type, data.isEnded);
        }
        /**
         * 获取一个可用的广告 token
         */
        getAdToken(type) {
            const pool = this.getPool(type);
            if (pool.length === 0)
                return null;
            // 取第一个 ready 的
            const slot = pool.find(s => s.isReady);
            return slot || null;
        }
        /**
         * 获取对应类型的池子
         */
        getPool(type) {
            if (type === 'reward')
                return this.rewardPool;
            if (type === 'inters')
                return this.intersPool;
            return this.fullScreenPool;
        }
    }

    /** 广告事件名称常量 */
    const AD_EVENTS = {
        AD_REQUEST: 'ad_request',
        AD_LOAD: 'ad_load',
        AD_ERROR: 'ad_error',
        AD_SHOW: 'ad_show',
        AD_CLOSE: 'ad_close'};
    class AdManager {
        constructor() {
            this.config = {};
            this.adStatus = {
                reward: 'idle',
                inters: 'idle',
                fullScreen: 'idle'
            };
            this.currentCallbacks = {
                reward: null,
                inters: null,
                fullScreen: null
            };
            this.bridgeReady = false;
            this.debug = false;
        }
        static GetInstance() {
            if (!AdManager.instance) {
                AdManager.instance = new AdManager();
            }
            return AdManager.instance;
        }
        init(config) {
            this.config = Object.assign(Object.assign({}, this.config), config);
            this.debug = config.debug || false;
            this.setupBridge();
            // 初始化 AdNet 的广告位配置（这里使用测试 ID）
            this.setupAdNetConfig();
            this.log('[AdManager] Initialized with config:', this.config);
        }
        /**
         * 设置 AdNet 广告位配置
         */
        setupAdNetConfig() {
            // 激励视频配置（使用测试 ID 1013000002）
            const rewardConfig = [{
                    platform_list: [{
                            adid_list: [
                                { adUnitId: this.config.rewardAdUnitId || '1013000002', ad_type: 2, price: '100' }
                            ],
                            rand_num: 1,
                            platform: 'shenshiad'
                        }]
                }];
            // 插屏配置
            const intersConfig = [{
                    platform_list: [{
                            adid_list: [
                                { adUnitId: this.config.interstitialAdUnitId || '1013000002', ad_type: 1, price: '50' }
                            ],
                            rand_num: 1,
                            platform: 'shenshiad'
                        }]
                }];
            AdNet.GetInstance().setStoreyData(rewardConfig, 1);
            AdNet.GetInstance().setStoreyData(intersConfig, 2);
        }
        setupBridge() {
            if (this.bridgeReady)
                return;
            this.setupMessageListener();
            this.bridgeReady = true;
            this.log('[AdManager] Bridge setup completed');
        }
        setupMessageListener() {
            // 监听 App 端预加载成功
            eventBus.$on('app_ad_preload_ok', (data) => {
                this.handleAdLoad(data.type);
            });
            // 监听 App 端错误
            eventBus.$on('app_ad_preload_error', (data) => {
                this.handleAdError(data.type, data.error);
            });
            // 监听 App 端广告关闭
            eventBus.$on('app_ad_show_close', (data) => {
                this.handleAdClose(data.type, data.isEnded);
            });
            // 监听 App 端展示
            eventBus.$on('app_ad_show', (data) => {
                this.handleAdShow(data.type);
            });
        }
        /**
         * 展示广告（结合 AdNet 逻辑池）
         * @param type 广告类型
         * @param callbacks 广告回调
         */
        showAd(type, callbacks) {
            var _a, _b;
            this.log(`[AdManager] Request to show ad: ${type}`);
            // 检查状态
            if (this.adStatus[type] === 'loading' || this.adStatus[type] === 'showing') {
                this.log(`[AdManager] Ad ${type} is busy`);
                (_a = callbacks === null || callbacks === void 0 ? void 0 : callbacks.onError) === null || _a === void 0 ? void 0 : _a.call(callbacks, { code: -1, message: `广告正在加载或展示中` });
                return;
            }
            // 检查 JSBridge
            if (!this.isBridgeAvailable()) {
                const error = { code: -2, message: 'JSBridge 未就绪' };
                (_b = callbacks === null || callbacks === void 0 ? void 0 : callbacks.onError) === null || _b === void 0 ? void 0 : _b.call(callbacks, error);
                Reporter.GetInstance().reportAdError(type, error);
                return;
            }
            // 保存回调
            this.currentCallbacks[type] = callbacks || null;
            this.adStatus[type] = 'loading';
            // 先尝试从 AdNet 逻辑池取已预加载好的广告 token
            const adToken = AdNet.GetInstance().getAdToken(type);
            if (adToken && adToken.isReady) {
                // 有预加载好的广告，直接发送 show 指令给 App
                this.log(`[AdManager] 使用预加载广告: ${adToken.adUnitId}`);
                this.requestShowToApp(type, adToken.adUnitId);
            }
            else {
                // 没有预加载，先触发预加载
                this.log(`[AdManager] 没有预加载广告，先触发加载`);
                AdNet.GetInstance().loadAd(type);
                // 等待加载完成后再展示（通过 app_ad_preload_ok 事件触发）
                // 这里可以加一个超时逻辑
                setTimeout(() => {
                    if (this.adStatus[type] === 'loading') {
                        const error = { code: -3, message: '广告预加载超时' };
                        this.handleAdError(type, error);
                    }
                }, 10000);
            }
            Reporter.GetInstance().reportAdRequest(type);
        }
        /**
         * 向 App 发送消息请求展示广告
         * @param type 广告类型
         * @param adUnitId 广告位ID
         */
        requestShowToApp(type, adUnitId) {
            var _a, _b, _c;
            const messageData = {
                data: {
                    action: 'show',
                    type,
                    adUnitId,
                    userId: this.config.userId,
                    extra: this.config.extra,
                    timestamp: Date.now()
                }
            };
            this.log('[AdManager] Posting show message to App:', messageData);
            try {
                if ((_a = window.uni) === null || _a === void 0 ? void 0 : _a.postMessage) {
                    window.uni.postMessage(messageData);
                }
                else if ((_c = (_b = window.uni) === null || _b === void 0 ? void 0 : _b.webView) === null || _c === void 0 ? void 0 : _c.postMessage) {
                    window.uni.webView.postMessage(messageData.data);
                }
                else {
                    throw new Error('uni.postMessage 不可用');
                }
                eventBus.$emit(AD_EVENTS.AD_REQUEST, { type });
            }
            catch (error) {
                this.log('[AdManager] Failed to post message:', error);
                this.handleAdError(type, {
                    code: -3,
                    message: `发送消息失败: ${error.message}`
                });
            }
        }
        /**
         * 检查 JSBridge 是否可用
         */
        isBridgeAvailable() {
            var _a, _b, _c;
            return !!(((_a = window.uni) === null || _a === void 0 ? void 0 : _a.postMessage) || ((_c = (_b = window.uni) === null || _b === void 0 ? void 0 : _b.webView) === null || _c === void 0 ? void 0 : _c.postMessage));
        }
        /**
         * 处理广告加载成功
         */
        handleAdLoad(type) {
            var _a, _b;
            this.log(`[AdManager] Ad loaded: ${type}`);
            this.adStatus[type] = 'loaded';
            (_b = (_a = this.currentCallbacks[type]) === null || _a === void 0 ? void 0 : _a.onLoad) === null || _b === void 0 ? void 0 : _b.call(_a);
            eventBus.$emit(AD_EVENTS.AD_LOAD, { type });
            Reporter.GetInstance().reportAdLoad(type);
        }
        /**
         * 处理广告展示
         */
        handleAdShow(type) {
            var _a, _b;
            this.log(`[AdManager] Ad shown: ${type}`);
            this.adStatus[type] = 'showing';
            (_b = (_a = this.currentCallbacks[type]) === null || _a === void 0 ? void 0 : _a.onShow) === null || _b === void 0 ? void 0 : _b.call(_a);
            eventBus.$emit(AD_EVENTS.AD_SHOW, { type });
            Reporter.GetInstance().reportAdShow(type);
        }
        /**
         * 处理广告错误
         */
        handleAdError(type, error) {
            var _a, _b;
            this.log(`[AdManager] Ad error: ${type}`, error);
            this.adStatus[type] = 'error';
            (_b = (_a = this.currentCallbacks[type]) === null || _a === void 0 ? void 0 : _a.onError) === null || _b === void 0 ? void 0 : _b.call(_a, error);
            eventBus.$emit(AD_EVENTS.AD_ERROR, { type, error });
            Reporter.GetInstance().reportAdError(type, error);
            // 清理回调
            this.currentCallbacks[type] = null;
        }
        /**
         * 处理广告关闭
         */
        handleAdClose(type, isEnded) {
            var _a, _b;
            this.log(`[AdManager] Ad closed: ${type}, isEnded: ${isEnded}`);
            this.adStatus[type] = 'closed';
            const result = { isEnded, adType: type };
            (_b = (_a = this.currentCallbacks[type]) === null || _a === void 0 ? void 0 : _a.onClose) === null || _b === void 0 ? void 0 : _b.call(_a, result);
            eventBus.$emit(AD_EVENTS.AD_CLOSE, { type, isEnded });
            Reporter.GetInstance().reportAdClose(type, isEnded);
            // 清理回调并重置状态
            this.currentCallbacks[type] = null;
            setTimeout(() => {
                if (this.adStatus[type] === 'closed') {
                    this.adStatus[type] = 'idle';
                }
            }, 100);
        }
        /**
         * 获取广告状态
         */
        getAdStatus(type) {
            return this.adStatus[type];
        }
        /**
         * 获取所有广告状态
         */
        getAllAdStatus() {
            return Object.assign({}, this.adStatus);
        }
        /**
         * 更新配置
         */
        updateConfig(config) {
            this.config = Object.assign(Object.assign({}, this.config), config);
            this.log('[AdManager] Config updated:', this.config);
        }
        /**
         * 获取当前配置
         */
        getConfig() {
            return Object.assign({}, this.config);
        }
        /**
         * 调试日志
         */
        log(...args) {
            if (this.debug) {
                console.log(...args);
            }
        }
    }

    class Startup {
        constructor() {
            this.config = {};
        }
        static GetInstance() {
            if (!this.instance) {
                this.instance = new Startup();
            }
            return this.instance;
        }
        /**
         * 初始化应用
         * @param config SDK 配置
         */
        async init(config) {
            this.config = config;
            // 初始化全局数据
            this.initGlobalData();
            // 初始化计数器（启动次数、日期等）
            this.initCounters();
            // 上报启动事件
            Reporter.GetInstance().report({
                event_id: 'sdk_startup',
                event_name: 'SDK启动',
                app_id: config.appId,
                channel_id: config.channelId,
            });
        }
        /**
         * 初始化全局数据
         */
        initGlobalData() {
            if (typeof window === 'undefined')
                return;
            window.$Global = {
                hasInitial: false,
                config: this.config,
                deviceInfo: getDeviceInfo(),
                startId: Date.now(),
                adStatus: {
                    reward: 'idle',
                    inters: 'idle',
                    fullScreen: 'idle',
                },
                isHide: false,
            };
            window.setGlobalData = (nextState) => {
                Object.assign(window.$Global, nextState);
            };
        }
        /**
         * 初始化计数器
         */
        initCounters() {
            const today = getFormatDate();
            // 启动次数计数
            const todayStCount = storage.getJson('todaystcount', {});
            if (!todayStCount[today]) {
                todayStCount[today] = 1;
            }
            else {
                todayStCount[today] += 1;
            }
            storage.setJson('todaystcount', todayStCount);
            // 初始化广告计数器
            const adCounterKeys = [
                'DayJLtimes', // 日激励次数
                'DayYSClicktimes', // 日原生点击
                'DayJLRequesttimes', // 日激励请求
                'DayYSRequesttimes', // 日原生请求
            ];
            adCounterKeys.forEach(key => {
                const storeVal = storage.get(key);
                if (storeVal) {
                    const [date] = storeVal.split(',');
                    if (date !== today) {
                        storage.set(key, `${today},0`);
                    }
                }
                else {
                    storage.set(key, `${today},0`);
                }
            });
            // 初始化 first_lid / first_qid
            if (!storage.get('first_lid')) {
                storage.set('first_lid', this.config.channelId || '-1');
            }
            if (!storage.get('first_qid')) {
                storage.set('first_qid', this.config.channelId || '-1');
            }
        }
        /**
         * 获取应用配置（可选，用于拉取后端配置）
         */
        async getAppConfig() {
            // 这里可以根据你的后端 API 进行调整
            // 简化版暂时返回默认配置
            return {
                adSpeciality: {
                    CycleJLtimes: 10, // 启动内激励上限
                    DayJLtimes: 20, // 日激励上限
                    CysleYSRequesttimes: 20, // 启动内原生请求上限
                    DayYSRequesttimes: 50, // 日原生请求上限
                    CysleYSClicktimes: 10, // 启动内原生点击上限
                    CycleJLRequesttimes: 15, // 启动内激励请求上限
                    ClickInterval: 3000, // 点击间隔（毫秒）
                }
            };
        }
    }

    /**
     * AOP 应用切面处理（WebView 环境版）
     * 负责生命周期事件监听：前后台切换、错误捕获等
     */
    var Aop = {
        /**
         * 初始化生命周期监听
         */
        init() {
            if (typeof window === 'undefined')
                return;
            // 监听页面可见性变化
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.onHide();
                }
                else {
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
        },
        /**
         * 应用切换到前台
         */
        onShow() {
            console.log('[Aop] onShow');
            if (typeof window !== 'undefined' && window.setGlobalData) {
                window.setGlobalData({ isHide: false });
            }
            Reporter.GetInstance().report({
                event_id: 'app_back_cut_front',
                event_name: '应用后台切前台',
            });
            eventBus.$emit('app_show');
        },
        /**
         * 应用切换到后台
         */
        onHide() {
            console.log('[Aop] onHide');
            if (typeof window !== 'undefined' && window.setGlobalData) {
                window.setGlobalData({ isHide: true });
            }
            Reporter.GetInstance().report({
                event_id: 'app_front_cut_back',
                event_name: '应用前台切后台',
            });
            eventBus.$emit('app_hide');
        },
        /**
         * 全局错误处理
         */
        onError(error) {
            console.error('[Aop] onError:', error);
            Reporter.GetInstance().report({
                event_id: 'error_log',
                event_name: '系统异常',
                result: JSON.stringify(error),
                scene: '全局异常',
            });
        },
    };

    /**
     * 网络请求封装类（WebView 环境适配版）
     * 支持 fetch API，兼容浏览器和 WebView 容器
     */
    class Request {
        constructor(config) {
            this.baseURL = config.baseURL;
            this.header = config.header || {};
            this.timeout = config.timeout || 5000;
        }
        /**
         * 发起网络请求
         * @param param 请求参数
         */
        async request(param) {
            const url = this.buildUrl(param);
            const headers = Object.assign(Object.assign({}, this.header), (param.header || {}));
            const startTime = Date.now();
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);
                const response = await fetch(url, {
                    method: param.method.toUpperCase(),
                    headers,
                    body: param.method.toLowerCase() === 'post' ?
                        (typeof param.data === 'string' ? param.data : JSON.stringify(param.data)) :
                        undefined,
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                const diffTime = Date.now() - startTime;
                if (diffTime > 2000 && !param.noReportResTime) {
                    this.reportInterfaceTime({
                        event_id: 'interface_time',
                        event_name: '接口响应时长',
                        ext_field_1: diffTime,
                        page_url: url,
                    });
                }
                const text = await response.text();
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                try {
                    return JSON.parse(text);
                }
                catch (_a) {
                    return text;
                }
            }
            catch (error) {
                if (error.name === 'AbortError') {
                    throw { DESC: 'timeout', message: '请求超时' };
                }
                throw error;
            }
        }
        /**
         * 构建完整请求 URL
         */
        buildUrl(param) {
            let url = this.baseURL + param.uri;
            if (param.method.toLowerCase() === 'get' && param.data) {
                const queryString = Object.entries(param.data)
                    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
                    .join('&');
                url += (url.indexOf('?') === -1 ? '?' : '&') + queryString;
            }
            return url;
        }
        /**
         * 上报接口耗时（可选，需要外部实现）
         */
        reportInterfaceTime(data) {
            if (typeof window !== 'undefined' && window.$Reporter) {
                window.$Reporter.report(data);
            }
        }
    }

    /**
     * 神蓍广告 SDK 入口文件
     * 运行环境: App WebView 容器内的 H5 页面 (通过 HBuilderX 打包的 App)
     *
     * 使用方式:
     * 1. H5 端引入此 SDK
     * 2. 调用 $initSDK 初始化
     * 3. 调用 $showAd 触发广告展示
     * 4. App 端通过 web-view 的 @message 事件接收消息并调用广告
     */
    /** SDK 版本 */
    const SDK_VERSION = '1.0.0';
    /** SDK 品牌标识 */
    const SDK_BRAND = 'shenshiad';
    /**
     * 初始化全局数据
     */
    function initGlobalData() {
        window.$Global = {
            hasInitial: false,
            config: {},
            deviceInfo: getDeviceInfo(),
            startId: Date.now(),
            adStatus: {
                reward: 'idle',
                inters: 'idle',
                fullScreen: 'idle'
            }
        };
        window.$GlobalBrand = SDK_BRAND;
    }
    /**
     * 设置全局数据
     * @param nextState 要更新的状态
     */
    function setGlobalData(nextState) {
        Object.assign(window.$Global, nextState);
    }
    /**
     * SDK 初始化主函数
     * @param config SDK 配置
     * @param callback 初始化完成回调
     */
    async function initSDK(config, callback) {
        var _a;
        console.log(`[ShenShiAd SDK] v${SDK_VERSION} initializing...`);
        // 检查是否已初始化
        if ((_a = window.$Global) === null || _a === void 0 ? void 0 : _a.hasInitial) {
            console.log('[ShenShiAd SDK] Already initialized');
            callback === null || callback === void 0 ? void 0 : callback();
            return;
        }
        // 初始化全局数据
        initGlobalData();
        // 合并配置
        const finalConfig = Object.assign({ debug: false }, config);
        setGlobalData({ config: finalConfig });
        // 初始化上报器
        Reporter.GetInstance().init({
            appId: finalConfig.appId,
            debug: finalConfig.debug,
            enabled: true
        });
        Reporter.GetInstance().setGlobalData({
            app_id: finalConfig.appId,
            channel_id: finalConfig.channelId,
            sdk_version: SDK_VERSION,
            platform: 'h5_webapp',
            device_info: window.$Global.deviceInfo
        });
        // 初始化广告管理器
        AdManager.GetInstance().init({
            rewardAdUnitId: finalConfig.rewardAdUnitId,
            interstitialAdUnitId: finalConfig.interstitialAdUnitId,
            fullScreenAdUnitId: finalConfig.fullScreenAdUnitId,
            userId: finalConfig.userId,
            extra: finalConfig.extra,
            debug: finalConfig.debug
        });
        // 监听 UniAppJSBridgeReady 事件
        setupBridgeListener();
        // 标记初始化完成
        setGlobalData({ hasInitial: true });
        // 上报初始化事件
        Reporter.GetInstance().reportSDKInit();
        console.log('[ShenShiAd SDK] Initialized successfully');
        console.log('[ShenShiAd SDK] Running in App WebView container');
        callback === null || callback === void 0 ? void 0 : callback();
    }
    /**
     * 设置 JSBridge 监听器
     */
    function setupBridgeListener() {
        // 监听 UniAppJSBridgeReady 事件 (表示 uni.postMessage 可用)
        document.addEventListener('UniAppJSBridgeReady', () => {
            console.log('[ShenShiAd SDK] UniAppJSBridgeReady');
            eventBus.$emit('bridge_ready');
        });
    }
    /**
     * 展示广告
     * @param type 广告类型: 'reward' | 'inters' | 'fullScreen'
     * @param callbacks 广告回调
     */
    function showAd(type, callbacks) {
        var _a, _b;
        if (!((_a = window.$Global) === null || _a === void 0 ? void 0 : _a.hasInitial)) {
            console.warn('[ShenShiAd SDK] SDK not initialized, please call $initSDK first');
            (_b = callbacks === null || callbacks === void 0 ? void 0 : callbacks.onError) === null || _b === void 0 ? void 0 : _b.call(callbacks, { code: -100, message: 'SDK 未初始化' });
            return;
        }
        AdManager.GetInstance().showAd(type, callbacks);
    }
    /**
     * 展示激励视频广告
     * @param callbacks 广告回调
     */
    function showRewardAd(callbacks) {
        showAd('reward', callbacks);
    }
    /**
     * 展示插屏广告
     * @param callbacks 广告回调
     */
    function showInterstitialAd(callbacks) {
        showAd('inters', callbacks);
    }
    /**
     * 展示全屏视频广告
     * @param callbacks 广告回调
     */
    function showFullScreenAd(callbacks) {
        showAd('fullScreen', callbacks);
    }
    // ============== 挂载到全局 ==============
    window.$GlobalBrand = SDK_BRAND;
    window.$AdManager = AdManager.GetInstance();
    window.$Evt = eventBus;
    window.$Reporter = Reporter.GetInstance();
    window.$initSDK = initSDK;
    window.$showAd = showAd;

    exports.AdManager = AdManager;
    exports.AdNet = AdNet;
    exports.Aop = Aop;
    exports.EventBus = eventBus;
    exports.Reporter = Reporter;
    exports.Request = Request;
    exports.SDK_BRAND = SDK_BRAND;
    exports.SDK_VERSION = SDK_VERSION;
    exports.Startup = Startup;
    exports.Util = Util;
    exports.initSDK = initSDK;
    exports.showAd = showAd;
    exports.showFullScreenAd = showFullScreenAd;
    exports.showInterstitialAd = showInterstitialAd;
    exports.showRewardAd = showRewardAd;

}));
//# sourceMappingURL=sdk.umd.js.map
