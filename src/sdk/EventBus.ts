/**
 * 事件总线类
 * 负责 SDK 内部跨模块的消息发布与订阅
 */
class EventBus {
  /** 存储事件名及其对应回调函数数组的映射 */
  protected events: Map<string, Function[]> = new Map();

  /**
   * 触发事件
   * @param event 事件名称
   * @param data 传递给回调函数的数据
   */
  public $emit(event: string, data?: any): void {
    if (this.events.has(event)) {
      const callbacks = this.events.get(event);
      callbacks?.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
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
  public $on(event: string, callback: Function): void {
    if (this.events.has(event)) {
      this.events.set(event, this.events.get(event)!.concat(callback));
    } else {
      this.events.set(event, [callback]);
    }
  }

  /**
   * 取消订阅事件
   * @param event 事件名称
   * @param callback 要取消的特定回调函数（如果不传则取消该事件下的所有回调）
   */
  public $off(event: string, callback?: Function): void {
    if (this.events.has(event)) {
      if (callback) {
        this.events.set(
          event, 
          this.events.get(event)!.filter(cb => cb !== callback)
        );
      } else {
        this.events.delete(event);
      }
    }
  }

  /**
   * 订阅一次性事件（触发后自动取消订阅）
   * @param event 事件名称
   * @param callback 事件回调函数
   */
  public $once(event: string, callback: Function): void {
    const onceWrapper = (data?: any) => {
      callback(data);
      this.$off(event, onceWrapper);
    };
    this.$on(event, onceWrapper);
  }

  /**
   * 清空所有事件订阅
   */
  public $clear(): void {
    this.events.clear();
  }

  /**
   * 获取某个事件的订阅数量
   * @param event 事件名称
   */
  public getListenerCount(event: string): number {
    return this.events.get(event)?.length || 0;
  }
}

/** 导出单例实例 */
const eventBus = new EventBus();
export default eventBus;
