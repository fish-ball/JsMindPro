/**
 * TODO: direction 的处理还是有问题
 */
import JsMind from './JsMind'
import JsMindNode from './JsMindNode'
import JsMindUtil from './JsMindUtil'

const logger = console

export default class JsMindMind {
  constructor () {
    this.name = null
    this.author = null
    this.version = null
    /**
     * 根节点
     * @type {JsMindNode|null}
     */
    this.root = null
    this.selected = null
    /**
     * 包含所有节点的字典，维护从 id 到 node 的映射
     * Contains the id -> node mapping relations for all nodes
     * @type {{Integer: JsMindNode}}
     */
    this.nodes = {}
  }

  /**
   * 返回一个指定 id 的节点 Node 对象
   * Returns a node with given id.
   * @param nodeId {Integer|String}
   * @returns {JsMindNode|null} 找不到返回 null
   */
  get_node (nodeId) {
    return this.nodes[nodeId] || null
  }

  /**
   * 根据输入的节点信息生成并设置根节点，只能执行一次，第二次忽略
   * @param nodeId {Integer|String}
   * @param topic {String}
   * @param data {*}
   */
  set_root (nodeId, topic, data) {
    if (!this.root) {
      this.root = new JsMindNode(nodeId, 0, topic, data, true)
      this._put_node(this.root)
    }
  }

  /**
   * 根据输入值生成并添加一个节点
   * @param parentNode {JsMindNode|Integer|String} 父节点的 ID
   * @param nodeId {Integer|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data {*}
   * @param idx {Integer} 节点序号
   * @param direction {Integer}
   * @param expanded {Boolean}
   * @returns {JsMindNode|null} 范围添加成功后的节点，操作失败返回 null
   */
  add_node (parentNode, nodeId, topic, data, idx,
            direction = JsMind.direction.right, expanded = false) {
    // 如果传入对象并非 JsMindNode，查找并返回这个 node
    parentNode = this._sanitize_node(parentNode)
    if (!parentNode) return null
    idx = idx || -1
    let node = null
    // 父亲为根节点的话，还要看方向
    if (parentNode.isroot) {
      // 如果入参未指定方向，则按照实际计算方向较少那边平衡补位
      // TODO: 此处行为是否合理？或者应该可以配置？
      if (isNaN(direction)) {
        let children = parentNode.children
        let r = 0
        for (let i = 0; i < children.length; i++) {
          if (children[i].direction === JsMind.direction.left) {
            r--
          } else {
            r++
          }
        }
        direction = (children.length > 1 && r > 0) ? JsMind.direction.left : JsMind.direction.right
      }
      node = new JsMindNode(nodeId, idx, topic, data, false, parentNode, direction, expanded)
    } else {
      // 非一级节点方向从父
      node = new JsMindNode(nodeId, idx, topic, data, false, parentNode, parentNode.direction, expanded)
    }
    // 尝试将创建好的节点置入，如果 id 冲突的话事实上是会失败的e
    if (this._put_node(node)) {
      parentNode.children.push(node)
      this._reindex(parentNode)
    } else {
      logger.error('fail, the nodeid \'' + node.id + '\' has been already exist.')
      node = null
    }
    return node
  }

  /**
   * 在指定的节点之前插入一个兄弟节点
   * 手段是插入一个 0.5 下标的元素，然后通过 add_node 的 _reindex 整理顺序
   * @param nodeBefore {JsMindNode|Integer|String} 参照节点或其ID
   * @param nodeId nodeId {Integer|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data
   * @returns {JsMindNode|null}
   */
  insert_node_before (nodeBefore, nodeId, topic, data) {
    nodeBefore = this._sanitize_node(nodeBefore)
    if (!nodeBefore) return null
    return this.add_node(nodeBefore.parent, nodeId, topic, data, nodeBefore.index - 0.5)
  }

  /**
   * 获取指定节点的前一个节点
   * @param node {JsMindNode|Integer|String}
   * @returns {JsMindNode|null}
   */
  get_node_before (node) {
    node = this._sanitize_node(node)
    if (!node || node.isroot) return null
    let idx = node.index - 2 // TODO: 奇怪这里为什么减的是 2 而不是 1？
    return idx >= 0 ? node.parent.children[idx] : null
  }

  /**
   * 在指定的节点之后插入一个兄弟节点
   * 手段是插入一个 0.5 下标的元素，然后通过 add_node 的 _reindex 整理顺序
   * @param nodeAfter {JsMindNode|Integer|String} 参照节点或其ID
   * @param nodeId nodeId {Integer|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data
   * @returns {JsMindNode|null}
   */
  insert_node_after (nodeAfter, nodeId, topic, data) {
    nodeAfter = this._sanitize_node(nodeAfter)
    if (!nodeAfter) return null
    return this.add_node(nodeAfter.parent, nodeId, topic, data, nodeAfter.index + 0.5)
  }

  /**
   * 获取指定节点的后一个节点
   * @param node {JsMindNode|Integer|String}
   * @returns {JsMindNode|null}
   */
  get_node_after (node) {
    node = this._sanitize_node(node)
    if (!node || node.isroot) return null
    let idx = node.index
    let brothers = node.parent.children
    return brothers.length >= idx ? node.parent.children[idx] : null
  }

  /**
   * 移动一个节点
   * @param node {JsMindNode|Integer|String} 待移动节点
   * @param nodeBefore {JsMindNode|Integer|String}
   *        移动到目的节点的前面，接受对象或者节点 id 传入，填入 _first_ 或 _last_ 可调整到开头或末尾
   * @param parent {JsMindNode|Integer|String}
   * @param direction {Integer} 如果目标位置是一级子节点，指定方向
   * @returns {JsMindNode|null}
   * @returns {JsMindNode|null}
   */
  move_node (node, nodeBefore, parent, direction) {
    node = this._sanitize_node(node)
    if (!node) return null
    return this._move_node(node, nodeBefore, parent || node.parent.id, direction)
  }

  /**
   * 移除一个节点
   * @param node {JsMindNode|Integer|String} 待移除的节点
   * @returns {Boolean}
   */
  remove_node (node) {
    node = this._sanitize_node(node)
    if (!node) return false
    if (node.isroot) {
      logger.error('fail, can not remove root node')
      return false
    }
    // 如果删除的是当前选中节点，则置空选取
    if (this.selected != null && this.selected.id === node.id) {
      this.selected = null
    }
    let children = node.children
    node.children = []
    // 后序遍历，先递归删除内部节点
    children.forEach(node => {
      this.remove_node(node)
    })
    // 从父节点的 children 中剔除当前节点
    node.parent.children.splice(node.parent.children.indexOf(node))
    // 节点集合中清除
    delete this.nodes[node.id]

    return true
  }

  /**
   * 返回一个 node 实例：
   * + 如果传入 nodeId，则返回对应的节点集内的 node，找不到返回 null
   * + 如果传入的是 node 实例，则查找是否在节点集内并一致，一致返回节点本身，否则返回 null
   * @param node {JsMindNode|Integer}
   * @returns {JsMindNode|null}
   * @private
   */
  _sanitize_node (node) {
    if (JsMindUtil.is_node(node)) {
      return this.nodes[node.id] === node ? node : null
    }
    return this.get_node(node)
  }

  /**
   * 执行实质移动一个节点
   * @param node {JsMindNode|Integer|String} 待移动节点
   * @param nodeBefore {JsMindNode|Integer|String}
   *        移动到目的节点的前面，接受对象或者节点 id 传入，填入 _first_ 或 _last_ 可调整到开头或末尾
   * @param parent {JsMindNode|Integer|String}
   * @param direction {Integer} 如果目标位置是一级子节点，指定方向
   * @returns {JsMindNode|null}
   * @private
   */
  _move_node (node, nodeBefore, parent, direction = JsMind.direction.right) {
    node = this._sanitize_node(node)
    parent = this._sanitize_node(parent)
    if (!node || !parent) return null
    // 跨父节点移动
    if (node.parent !== parent) {
      // 从父节点中删除
      node.parent.children.splice(node.parent.children.indexOf(node), 1)
      // 加入新的父节点
      parent.children.push(node)
      node.parent = parent
    }
    // 根节点
    node.direction = node.parent.is_root ? direction : node.parent.direction
    // 同一个父节点内部移动
    this._move_node_internal(node, nodeBefore)
    this._flow_node_direction(node)
    return node
  }

  /**
   * 递归修改某个节点的方向（递归修改子节点的方向）
   * @param node {JsMindNode|Integer|String} 目标节点
   * @param direction {Integer} 需要改变的方向，缺省则为跟从当前的方向
   * @private
   */
  _flow_node_direction (node, direction) {
    if (direction !== void 0) node.direction = direction
    node.children.forEach(nd => {
      this._flow_node_direction(nd, node.direction)
    })
  }

  /**
   * 在同一个父节点内部移动一个节点
   * @param node
   * @param nodeBefore {JsMindNode|Integer|String}
   *        移动到目的节点的前面，接受对象或者节点 id 传入，填入 _first_ 或 _last_ 可调整到开头或末尾
   * @returns {JsMindNode|null}
   * @private
   */
  _move_node_internal (node, nodeBefore) {
    node = this._sanitize_node(node)
    if (!node || !nodeBefore) return null
    if (nodeBefore === '_last_') {
      node.index = -1
    } else if (nodeBefore === '_first_') {
      node.index = 0
    } else {
      nodeBefore = this._sanitize_node(nodeBefore)
      if (!nodeBefore) return null
      if (node.parent !== nodeBefore.parent) return null
      node.index = nodeBefore.index - 0.5
    }
    this._reindex(node.parent)
    return node
  }


  /**
   * 将某个节点置入节点集，并返回是否成功
   * 如果节点集已存在指定 id 的节点，则返回 false 并忽略操作
   * @param node
   * @returns {boolean}
   * @private
   */
  _put_node (node) {
    if (node.id in this.nodes) {
      logger.warn('the nodeid \'' + node.id + '\' has been already exist.')
      return false
    }
    this.nodes[node.id] = node
    return true
  }

  /**
   * 重整某个节点下的子节点的序号
   * @param node
   * @private
   */
  _reindex (node) {
    if (node instanceof JsMindNode) {
      node.children.sort(JsMindNode.compare)
      for (let i = 0; i < node.children.length; i++) {
        node.children[i].index = i + 1
      }
    }
  }
}
