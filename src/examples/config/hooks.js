/**
 * 钩子机制
 * 本文件定义了所有可以注入的钩子，实际注入时：
 * const jm = JsMind()
 * jm.add_hook(<hook_name>, <async function(params)>, <priority>)
 *
 * 定义钩子时（在 JsMind 的实现中）：
 * await jm.apply_hook(<hook_name>, <params>)
 * params 一般输入一个 Object 对象
 * 如果钩子支持，可以通过修改 params.field，来变更内部流程的参数
 */

export default {
  /**
   * 添加节点前置钩子，一般后台数据插入在这个节点进行
   * 这时候实际的 JsMindNode 节点尚未生成，如果这个阶段被 reject，将不会产生节点
   * @param parent {JsMindNode} 父节点的 ID
   * @param nodeId {Number|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param index {Number} 待插入节点的目标顺序号，缺省为移动到最后
   * @param context {Object} 上下文对象，用于传递参数
   * @returns {Promise<JsMindNode>} 范围添加成功后的节点，操作失败返回 null
   */
  async before_add_node ({parent, nodeId, topic, index}, context) {
  },

  /**
   * 添加节点过程钩子，一般是后台数据已经插入（暂存 context）
   * 然后需要根据后台数据处理 JsMind 逻辑层的操作（改ID、写数据之类）
   * 这个步骤过后，才会处理视图层的 JsMindNode 渲染
   * @param node {JsMindNode} 修改完成之后的节点，topic 已经被修改过了
   * @param context {Object} 上下文对象，用于传递参数
   */
  async process_update_node ({node}, context) {
  },

  /**
   * 添加节点后置钩子，在 JsMindNode 渲染完成之后触发
   * 一些视图层的后置动作需要在这一步才能加入，例如节点添加完成之后触发编辑等
   * @param node {JsMindNode} 刚刚已经加入的节点
   * @param context {Object} 上下文对象，用于传递参数
   * @returns {Promise<void>}
   */
  async after_add_node ({node}, context) {
  },

  /**
   * @param node {JsMindNode} 需要移动的节点
   * @param parent {JsMindNode} 移动到的目标位置的父节点
   * @param index {Number} 目标位置的顺序号，缺省为移动到最后
   * @param context {Object} 上下文对象，用于传递参数
   * @returns {Promise<void>}
   */
  async before_move_node ({node, parent, index}, context) {
  },

  /**
   * @param node {JsMindNode} 已经移动完成的节点对象
   * @param context {Object} 上下文对象，用于传递参数
   * @returns {Promise<void>}
   */
  async after_move_node ({node}, context) {
  },

  /**
   * 更新节点前置钩子
   * @param node {JsMindNode} 待修改的节点，原始状态
   * @param topic {String} 修改的标题
   * @param context {Object} 上下文对象，用于传递参数
   * @returns {Promise<void>}
   */
  async before_update_node ({node, topic}, context) {
  },

  /**
   * 更新节点后置钩子
   * @param node {JsMindNode} 修改完成之后的节点，topic 已经被修改过了
   * @param context {Object} 上下文对象，用于传递参数
   */
  async after_update_node ({node}, context) {
  },

  /**
   * 删除节点前置钩子
   * @param nodes {JsMindNode[]} 待删除的节点列表
   * @param context {Object} 上下文对象，用于传递参数
   */
  async before_remove_node ({nodes}, context) {
  },

  /**
   * 删除节点后置钩子
   * @param nodes {JsMindNode[]} 被删除的节点对象
   * @param context {Object} 上下文对象，用于传递参数
   */
  async after_remove_node ({nodes}, context) {
  },

  /**
   * 【同步钩子】在画布被缩放之后触发的钩子
   * @param jm {JsMind}
   */
  after_zoom ({jm}) {
  },

  /**
   * 在画布被重新渲染之后触发的钩子
   * @param jm {JsMind}
   * @param context {Object} 上下文对象，用于传递参数
   */
  async after_rerender ({jm}) {
  },

  /**
   * 选中节点变化的时候触发
   * @param nodes {JsMindNode[]} 选中的节点集合（支持多选）
   * @returns {Promise<void>}
   */
  async select_changed ({nodes = []}) {
  },

  /**
   * 热键触发前置钩子，可以用于一些特殊的拦截
   * @param keyName {string} 按键名称，例如 'Control+Shift+KeyA'
   * @param isDefault {boolean} 是否属于未注册按键处理，并进入已定义的默认处理器的情况
   * @return {Promise<void>}
   */
  async before_key_shortcut_trigger ({keyName, isDefault}) {
  }

}
