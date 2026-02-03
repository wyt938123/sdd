/**
 * 事件总线类
 * 负责 SDK 内部跨模块的消息发布与订阅
 */
declare class EventBus {
    /** 存储事件名及其对应回调函数数组的映射 */
    protected events: Map<string, Function[]>;
    /**
     * 触发事件
     * @param event 事件名称
     * @param data 传递给回调函数的数据
     */
    $emit(event: string, data?: any): void;
    /**
     * 订阅事件
     * @param event 事件名称
     * @param callback 事件回调函数
     */
    $on(event: string, callback: Function): void;
    /**
     * 取消订阅事件
     * @param event 事件名称
     * @param callback 要取消的特定回调函数（如果不传则取消该事件下的所有回调）
     */
    $off(event: string, callback?: Function): void;
    /**
     * 订阅一次性事件（触发后自动取消订阅）
     * @param event 事件名称
     * @param callback 事件回调函数
     */
    $once(event: string, callback: Function): void;
    /**
     * 清空所有事件订阅
     */
    $clear(): void;
    /**
     * 获取某个事件的订阅数量
     * @param event 事件名称
     */
    getListenerCount(event: string): number;
}
/** 导出单例实例 */
declare const eventBus: EventBus;
export default eventBus;
