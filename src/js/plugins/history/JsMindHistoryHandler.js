export default class JsMindHistoryHandler {

  /** @type {string} 历史栈节点的动作类型 */
  action = ''

  constructor (plugin) {
    /** @type {JsMindPlugin} */
    this.plugin = plugin
  }

  /**
   * 初始化历史栈处理器，一般为注册事件钩子
   * @returns {Promise<void>}
   */
  async init () {
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
}
