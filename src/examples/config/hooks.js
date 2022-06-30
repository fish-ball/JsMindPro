/**
 * 钩子机制
 * 本文件定义了所有可以注入的钩子，实际注入时：
 * const jm = JsMind()
 * jm.add_hook(<hook_name>, <async function(params)>, <priority>)
 *
 *
 * 定义钩子时（在 JsMind 的实现中）：
 * await jm.apply_hook(<hook_name>, <params>)
 */

export default {
  /**
   *
   * @param parentNode {JsMindNode} 父节点的 ID
   * @param nodeId {Number|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data {*}
   * @returns {Promise<JsMindNode>} 范围添加成功后的节点，操作失败返回 null
   */
  async before_add_node (parentNode, nodeId, topic, data) {
  }
}
