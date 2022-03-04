const logger = console

export default class JsMindNode {
  constructor (sId, iIndex, sTopic, oData, bIsRoot, oParent, eDirection, bExpanded) {
    if (!sId) {
      logger.error('invalid nodeid')
      return
    }
    if (typeof iIndex !== 'number') {
      logger.error('invalid node index')
      return
    }
    if (typeof bExpanded === 'undefined') {
      bExpanded = true
    }
    this.id = sId
    this.index = iIndex
    this.topic = sTopic
    this.data = oData || {}
    this.isroot = bIsRoot
    this.parent = oParent
    this.direction = eDirection
    this.expanded = !!bExpanded
    this.children = []
    this._data = {}
  }

  /**
   * 对节点进行排序的函数，仅参考当前的 index 大小排序
   * 原序号为 -1 的，靠后放
   * @param node1 {JsMindNode}
   * @param node2 {JsMindNode}
   * @returns {number}
   */
  static compare (node1, node2) {
    if (node1.index === node2.index) return 0
    if (node1.index === -1) return 1
    if (node2.index === -1) return -1
    return node1.index - node2.index
  }

  static inherited (pnode, node) {
    if (!!pnode && !!node) {
      if (pnode.id === node.id) {
        return true
      }
      if (pnode.isroot) {
        return true
      }
      let pid = pnode.id
      let p = node
      while (!p.isroot) {
        p = p.parent
        if (p.id === pid) {
          return true
        }
      }
    }
    return false
  }

}
