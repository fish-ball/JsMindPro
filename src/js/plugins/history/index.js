import _ from 'lodash-es'
import JsMindPlugin from '../../JsMindPlugin'
import * as default_handlers from './default_handlers'

export default class JsMindPluginHistory extends JsMindPlugin {
  static plugin_name = 'history'

  constructor (jm) {
    super(jm)

    // 历史栈
    this._history = []
    // 历史栈指针
    this._history_index = -1
    // 历史处理函数，官方默认历史栈行为只有增删改和移动三种
    this._handlers = {}
    // 处于撤销和恢复的过程中，锁定不要进行 history_push
    this._lock = false
  }

  /**
   * 初始化插件
   */
  async init () {
    // 注册热键
    this.jm.set_key_map('Control+KeyZ', () => this.history_undo())
    this.jm.set_key_map('Control+Shift+KeyZ', () => this.history_undo())
    this.jm.set_key_map('Control+KeyY', () => this.history_redo())
    // 先读取历史栈
    await this._history_load()
    // 加载所有的历史栈处理器
    Object.values(default_handlers).forEach(handler => {
      this.setup_handler(handler)
    })
  }

  /**
   * 安装一个处理器
   * @param handlerClass {JsMindHistoryHandler.prototype} 历史处理器对象
   */
  setup_handler (handlerClass) {
    const handler = new handlerClass(this)
    this._handlers[handler.action] = handler
    handler.init()
  }

  /**
   * 移除一个动作的处理器
   * @param action {string} 历史栈操作类型的关键字
   */
  remove_handler (action) {
    delete this._handlers[action]
  }

  /**
   * 历史栈推入操作
   * @param action {string} 历史栈节点的动作名称
   * @param payload {string} 历史栈的内容载荷
   * @returns {Promise<void>}
   */
  async history_push (action, payload) {
    // 锁定中不进行 history_push
    if (this._lock) return
    this._history_index += 1
    // 裁切掉恢复的历史栈段落
    this._history.length = this._history_index
    this._history.push({action, payload})
    console.log('>> history_push', action, payload)
    // 每次发生变动都持久化一下
    await this._history_dump()
  }

  /**
   * 历史栈是否可以撤销
   * @returns {boolean}
   */
  can_undo () {
    return this._history_index >= 0
  }

  /**
   * 历史栈是否可以恢复
   * @returns {boolean}
   */
  can_redo () {
    return this._history_index + 1 < this._history.length
  }

  /**
   * 执行一步历史栈撤销操作
   * @returns {Promise<boolean>} 返回是否操作成功
   */
  async history_undo () {
    // 已经无可撤销
    if (!this.can_undo()) return false
    const {action, payload} = this._history[this._history_index]
    const handler = this._handlers[action]
    if (!handler) throw new Error(`尚未注册历史栈操作类型为 ${action} 的 handler 处理器`)
    // 开启锁定
    this._lock = true
    // 尝试处理，但是拦截错误
    const success = await handler.undo(payload).then(() => true, async () => {
      await this.jm.apply_hook('history_undo_failed', {plugin: this, handler})
      return false
    })
    // 关闭锁定
    this._lock = false
    // 处理失败的话，清空历史栈并返回失败
    if (!success) {
      console.warn('>> history_undo failed!', handler.action)
      await this._history_reset()
      return false
    }
    this._history_index -= 1
    // 每次发生变动都持久化一下
    await this._history_dump()
    return true
  }

  /**
   * 执行一步历史栈恢复操作
   * @returns {Promise<boolean>} 返回是否操作成功
   */
  async history_redo () {
    // 已经无可恢复
    if (!this.can_redo()) return false
    const {action, payload} = this._history[this._history_index + 1]
    const handler = this._handlers[action]
    if (!handler) throw new Error(`尚未注册历史栈操作类型为 ${action} 的 handler 处理器`)
    // 开启锁定
    this._lock = true
    // 尝试处理，但是拦截错误
    const success = await handler.redo(payload).then(() => true, async () => {
      await this.jm.apply_hook('history_redo_failed', {plugin: this, handler})
      return false
    })
    // 关闭锁定
    this._lock = false
    // 处理失败的话，清空历史栈并返回失败
    if (!success) {
      console.warn('>> history_redo failed!', handler.action)
      await this._history_reset()
      return false
    }
    this._history_index += 1
    // 每次发生变动都持久化一下
    await this._history_dump()
    return true
  }

  /**
   * 获取持久化保存历史栈的关键字
   */
  get_history_key () {
    if (this.jm.has_hook('get_history_key')) {
      return this.jm.apply_hook_sync('get_history_key')
    }
    return `__jsmind_history_${this.jm.get_root().id || 'general'}__`
  }

  /**
   * 存储持久化的历史栈
   * @returns {Promise<void>}
   */
  async _history_dump () {
    // 如果有定义钩子，使用钩子行为进行持久化存储
    if (this.jm.has_hook('history_dump')) {
      return this.jm.apply_hook('history_dump', {plugin: this})
    }
    // 没有的话，放在 localStorage
    const payload = JSON.stringify({
      history: this._history, index: this._history_index
    })
    localStorage.setItem(this.get_history_key(), payload)
  }

  /**
   * 读取持久化的历史栈
   * @returns {Promise<void>}
   */
  async _history_load () {
    // 如果有定义钩子，使用钩子行为进行持久化存储
    if (this.jm.has_hook('history_load')) {
      return this.jm.apply_hook('history_load', {plugin: this})
    }
    // 没有的话，读取 localStorage 的存储
    const payload = localStorage.getItem(this.get_history_key())
    if (!payload) return
    const {history, index} = JSON.parse(payload)
    this._history = history
    this._history_index = index
  }

  /**
   * 清空持久化的历史栈
   * @return {Promise<void>}
   * @private
   */
  async _history_reset () {
    // 如果有定义钩子，使用钩子行为进行持久化存储
    if (this.jm.has_hook('history_reset')) {
      return this.jm.apply_hook('history_reset', {plugin: this})
    }
    // 没有的话，清空 localStorage 的存储
    this._history = []
    this._history_index = -1
    localStorage.removeItem(this.get_history_key())
  }

}
