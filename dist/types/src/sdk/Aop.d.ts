declare const _default: {
    /**
     * 初始化生命周期监听
     */
    init(): void;
    /**
     * 应用切换到前台
     */
    onShow(): void;
    /**
     * 应用切换到后台
     */
    onHide(): void;
    /**
     * 全局错误处理
     */
    onError(error: any): void;
};
export default _default;
