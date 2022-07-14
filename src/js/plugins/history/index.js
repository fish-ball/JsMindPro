import _ from 'lodash-es'
import JsMindPlugin from '../../JsMindPlugin'
import * as default_handlers from './default_handlers'

export class JsMindHistoryHandler {
  /** @type {string} */
  static action

  constructor (plugin) {
    /** @type {JsMind} */
    this.plugin = plugin
  }

  /**
   * 初始化历史栈处理器，一般为注册事件钩子
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error('JsMindHistoryHandler.init() not implemented!')
  }

  /**
   * 撤销历史操作
   * @param payload
   * @returns {Promise<void>}
   */
  async undo (payload) {
    throw new Error('JsMindHistoryHandler.undo(payload) not implemented!')
  }

  /**
   * 恢复历史操作
   * @param payload
   * @returns {Promise<void>}
   */
  async redo (payload) {
    throw new Error('JsMindHistoryHandler.redo(payload) not implemented!')
  }

  /**
   * 构造一个 HistoryHandler 对象
   * @param jm {JsMind}
   * @param redo {Function}
   * @param undo {Function}
   */
  static build ({jm, redo, undo}) {
    const handler = new JsMindHistoryHandler(jm)
    handler.undo = undo
    handler.redo = redo
    return handler
  }
}

class JsMindPluginHistory extends JsMindPlugin {
  static plugin_name = 'history'

  constructor (jm) {
    super(jm)

    // 历史栈
    this._history = []
    // 历史栈指针
    this._history_index = -1
    // 历史处理函数，官方默认历史栈行为只有增删改和移动三种
    this._handlers = {}
  }

  /**
   * 初始化插件
   */
  init () {
  }

  /**
   * 添加一个处理器
   * @param action {string} 历史栈操作类型的关键字
   * @param handlerClass {JsMindHistoryHandler} 历史处理器对象
   */
  set_handler (action, handlerClass) {
    this._handlers[action] = new handlerClass(this)
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
   */
  history_push (action, payload) {
    this._history_index += 1
    // 裁切掉恢复的历史栈段落
    this._history.length = this._history_index
    this._history.push({action, payload})
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
    await handler.undo(payload)
    this._history_index -= 1
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
    await handler.redo(payload)
    this._history_index += 1
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
  async history_dump () {
    // 如果有定义钩子，使用钩子行为进行持久化存储
    if (this.jm.has_hook('history_dump')) {
      return this.jm.apply_hook('history_dump', {plugin: this})
    }
    // 没有的话，放在 localStorage
    localStorage.setItem(this.get_history_key(), JSON.dump({
      history: this._history, index: this._history_index
    }))
  }

  /**
   * 读取持久化的历史栈
   * @returns {Promise<void>}
   */
  async history_load () {
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

}
