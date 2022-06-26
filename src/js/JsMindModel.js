/**
 * TODO: direction 的处理还是有问题
 */
import JsMindNode from './JsMindNode'
import JsMindFormat from './JsMindFormat'
import {DIRECTION} from './JsMind'

export default class JsMindModel {

  /** 构造一个 JsMindModel 对象
   * @param format {String} 暂时只支持 node_array
   * @param options {Object} mode: both/side
   */
  constructor (format, options = {mode: 'both'}) {
    /**
     * 根节点
     * @type {JsMindNode|null}
     */
    this.root = null
    /**
     * 包含所有节点的字典，维护从 id 到 node 的映射
     * Contains the id -> node mapping relations for all nodes
     * @type {{JsMindNode}}
     */
    this.nodes = {}
    /**
     * 当前逻辑上选中的节点
     * @type {JsMindNode[]}
     */
    this.selected_nodes = []
    /**
     * 获取对应格式的 JsMindFormat 对象
     */
    this.formatter = JsMindFormat[format]
    if (!this.formatter) throw new Error(`Format not supported: ${format}.`)
    /**
     * 带入所有的配置项
     */
    this.options = options
  }

  /**
   * Getter 获取某一个指定的节点，如果有多个选中，则返回最后一个
   * 兼容原有的单节点实现
   */
  get selected_node () {
    return this.selected_nodes.length ? this.selected_nodes[this.selected_nodes.length - 1] : null
  }

  /**
   * 设置一个当前选定的节点
   * @param node {JsMindNode|null}
   */
  set selected_node (node) {
    this.selected_nodes.splice(0, this.selected_nodes.length, ...(node ? [node] : []))
  }

  /**
   * 自动加载一个 model 的配置数据（包含格式）
   * @param data {Object}
   * @returns {JsMindModel}
   */
  load (data) {
    return this.formatter.load(this, data)
  }

  /**
   * 追加数据
   * @param data {Object}
   * @returns {JsMindModel}
   */
  append_data (data) {
    return this.formatter.append_data(this, data)
  }

  /**
   * 返回
   * @param data_format
   * @returns {*}
   */
  get_data (data_format) {
    return this.formatter.get_data(this)
  }

  /**
   * 返回一个指定 id 的节点 Node 对象
   * Returns a node with given id.
   * @param nodeId {Number}
   * @returns {JsMindNode}
   */
  get_node (nodeId) {
    return this.nodes[nodeId] || null
  }

  /**
   * 修改一个节点的 id
   * @param oldId
   * @param newId
   */
  rename_node (oldId, newId) {
    if (!(oldId) in this.nodes) return
    const node = this.nodes[oldId]
    this.nodes[newId] = node
    delete this.nodes[oldId]
    node.rename(newId)
  }

  /**
   * 重新整理整个 mind 的 node 数据
   * 包括更新 index 以及 direction
   */
  arrange (node = null) {
    node = node || this.root
    // 先重排下标
    node.children.forEach((child, i) => {
      child.direction = node.is_root() ? {
        both: [DIRECTION.right, DIRECTION.left][i % 2], side: DIRECTION.right
      }[this.options.mode || 'both'] : node.direction
      child.index = i
      this.arrange(child)
    })
  }

  /**
   * 根据输入值生成并添加一个节点
   * @param parentNode {JsMindNode} 父节点
   * @param nodeId {Number|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data {*}
   * @param idx {Number} 节点序号，默认放最后
   * @returns {JsMindNode} 范围添加成功后的节点，操作失败返回 null
   */
  add_node (parentNode, nodeId, topic, data, idx = -1) {
    // 不传入位置的话，放在末尾
    if (idx < 0) idx = parentNode.children.length
    // 创建并置入节点
    const node = new JsMindNode(nodeId, idx, topic, data, parentNode, parentNode.direction)
    this._put_node(node)
    parentNode.children.push(node)
    // 尝试将创建好的节点置入，如果 id 冲突的话事实上是会失败的
    this._reindex(parentNode)
    // 父亲为根节点的话，重整方向
    if (parentNode.is_root()) this.arrange()
    return node
  }

  /**
   * 在指定的节点之前插入一个兄弟节点
   * 手段是插入一个 0.5 下标的元素，然后通过 add_node 的 _reindex 整理顺序
   * @param nextNode {JsMindNode} 节点
   * @param nodeId nodeId {Number|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data
   * @returns {JsMindNode}
   */
  insert_node_before (nextNode, nodeId, topic, data) {
    return this.add_node(nextNode.parent, nodeId, topic, data, nextNode.index - 0.5)
  }

  /**
   * 获取指定节点的前一个兄弟节点
   * @param node {JsMindNode}
   * @returns {JsMindNode}
   */
  get_node_before (node) {
    if (node.is_root()) return null
    let idx = node.index - 1
    return idx > -1 ? node.parent.children[idx] : null
  }

  /**
   * 在指定的节点之后插入一个兄弟节点
   * 手段是插入一个 0.5 下标的元素，然后通过 add_node 的 _reindex 整理顺序
   * @param prevNode {JsMindNode} 参照节点或其ID
   * @param nodeId nodeId {Number|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data
   * @returns {JsMindNode}
   */
  insert_node_after (prevNode, nodeId, topic, data) {
    return this.add_node(prevNode.parent, nodeId, topic, data, prevNode.index + 0.5)
  }

  /**
   * 获取指定节点的后一个节点
   * @param node {JsMindNode}
   * @returns {JsMindNode}
   */
  get_node_after (node) {
    let idx = node.index + 1
    return idx < node.parent.children.length ? node.parent.children[idx] : null
  }

  /**
   * 移动一个节点
   * @param node {JsMindNode} 待移动节点
   * @param nextNode {JsMindNode} 目标位置的后一个节点
   * @param parent {JsMindNode}
   * @param direction {Number} 如果目标位置是一级子节点，指定方向
   * @returns {JsMindNode}
   */
  move_node (node, nextNode, parent, direction) {
    return this._move_node(node, nextNode, parent || node.parent.id, direction)
  }

  /**
   * 移除一个节点
   * @param node {JsMindNode} 待移除的节点
   */
  remove_node (node) {
    if (node.is_root()) return
    // 后序遍历，先递归清理所有子树节点
    let children = node.children
    node.children = []
    children.forEach(node => this.remove_node(node))
    // 从父节点的 children 中剔除当前节点
    node.parent.children.splice(node.parent.children.indexOf(node), 1)
    // 节点集合中清除
    delete this.nodes[node.id]
  }

  /**
   * 执行实质移动一个节点
   * @param node {JsMindNode} 待移动节点
   * @param nextNode {JsMindNode} 目标位置的后一个节点
   * @param parent {JsMindNode}
   * @param direction {Number} 如果目标位置是一级子节点，指定方向
   * @returns {JsMindNode}
   * @private
   */
  _move_node (node, nextNode, parent, direction = DIRECTION.right) {
    if (!node || !parent) return null
    // 跨父节点移动
    if (node.parent !== parent) {
      // 从父节点中删除
      node.parent.children.splice(node.parent.children.indexOf(node), 1)
      this._reindex(node.parent)
      // 加入新的父节点
      parent.children.push(node)
      node.parent = parent
    }
    // 根节点
    node.direction = node.parent.is_root() ? direction : node.parent.direction
    // 同一个父节点内部移动
    this._move_node_internal(node, nextNode)
    this._flow_node_direction(node)
    return node
  }

  /**
   * 递归修改某个节点的方向（递归修改子节点的方向）
   * @param node {JsMindNode|Number|String} 目标节点
   * @param direction {Number} 需要改变的方向，缺省则为跟从当前的方向
   * @private
   */
  _flow_node_direction (node, direction = void 0) {
    if (direction !== void 0) node.direction = direction
    node.children.forEach(nd => this._flow_node_direction(nd, node.direction))
  }

  /**
   * 在同一个父节点内部移动一个节点
   * @param node
   * @param nextNode {JsMindNode} 目标位置的后一个节点
   * @returns {JsMindNode|null}
   * @private
   */
  _move_node_internal (node, nextNode) {
    if (node.parent.is_root() && this.options.mode === 'both') {
      // TODO: 这里如果使用 both 布局的话，index 是有特殊指定意义的，为了避免布局反复横跳是需要做特殊处理的
      // >>> 需要重写
      if (!nextNode) {
        node.index = node.parent.children.length
      } else {
        if (node.parent !== nextNode.parent) return null
        node.index = nextNode.index - 0.5
      }
      // <<<
    } else {
      if (!nextNode) {
        node.index = node.parent.children.length
      } else {
        if (node.parent !== nextNode.parent) return null
        node.index = nextNode.index - 0.5
      }
    }
    this._reindex(node.parent)
    return node
  }

  /**
   * 将某个节点置入节点集，并返回是否成功
   * 如果节点集已存在指定 id 的节点，则返回 false 并忽略操作
   * @param node
   * @private
   */
  _put_node (node) {
    if (node.id in this.nodes) {
      throw new Error(`The nodeid '${node.id}' has been already exist.`)
    }
    this.nodes[node.id] = node
  }

  /**
   * 重整某个节点下的子节点的序号
   * @param node {JsMindNode}
   * @private
   */
  _reindex (node) {
    node.children.sort((a, b) => a.index - b.index)
    for (let i = 0; i < node.children.length; i++) {
      node.children[i].index = i
    }
  }
}
