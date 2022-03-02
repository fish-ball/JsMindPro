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

  static compare (node1, node2) {
    // '-1' is alwary the last
    let r = 0
    let i1 = node1.index
    let i2 = node2.index
    if (i1 >= 0 && i2 >= 0) {
      r = i1 - i2
    } else if (i1 === -1 && i2 === -1) {
      r = 0
    } else if (i1 === -1) {
      r = 1
    } else if (i2 === -1) {
      r = -1
    } else {
      r = 0
    }
    //logger.debug(i1+' <> '+i2+'  =  '+r)
    return r
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
