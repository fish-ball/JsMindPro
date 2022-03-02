import JsMind from './JsMind'
import JsMindNode from './JsMindNode'
import JsMindUtil from './JsMindUtil'

const logger = console

export default class JsMindMind {
  constructor () {
    this.name = null
    this.author = null
    this.version = null
    this.root = null
    this.selected = null
    this.nodes = {}
  }

  get_node (nodeid) {
    if (nodeid in this.nodes) {
      return this.nodes[nodeid]
    } else {
      logger.warn('the node[id=' + nodeid + '] can not be found')
      return null
    }
  }

  set_root (nodeid, topic, data) {
    if (this.root == null) {
      this.root = new JsMindNode(nodeid, 0, topic, data, true)
      this._put_node(this.root)
    } else {
      logger.error('root node is already exist')
    }
  }

  add_node (parent_node, nodeid, topic, data, idx, direction, expanded) {
    if (!JsMindUtil.is_node(parent_node)) {
      let the_parent_node = this.get_node(parent_node)
      if (!the_parent_node) {
        logger.error('the parent_node[id=' + parent_node + '] can not be found.')
        return null
      } else {
        return this.add_node(the_parent_node, nodeid, topic, data, idx, direction, expanded)
      }
    }
    let nodeindex = idx || -1
    let node = null
    if (parent_node.isroot) {
      let d = JsMind.direction.right
      if (isNaN(direction)) {
        let children = parent_node.children
        let children_len = children.length
        let r = 0
        for (let i = 0; i < children_len; i++) {
          if (children[i].direction === JsMind.direction.left) {
            r--
          } else {
            r++
          }
        }
        d = (children_len > 1 && r > 0) ? JsMind.direction.left : JsMind.direction.right
      } else {
        d = (direction != JsMind.direction.left) ? JsMind.direction.right : JsMind.direction.left
      }
      node = new JsMindNode(nodeid, nodeindex, topic, data, false, parent_node, d, expanded)
    } else {
      node = new JsMindNode(nodeid, nodeindex, topic, data, false, parent_node, parent_node.direction, expanded)
    }
    if (this._put_node(node)) {
      parent_node.children.push(node)
      this._reindex(parent_node)
    } else {
      logger.error('fail, the nodeid \'' + node.id + '\' has been already exist.')
      node = null
    }
    return node
  }

  insert_node_before (node_before, nodeid, topic, data) {
    if (!JsMindUtil.is_node(node_before)) {
      let the_node_before = this.get_node(node_before)
      if (!the_node_before) {
        logger.error('the node_before[id=' + node_before + '] can not be found.')
        return null
      } else {
        return this.insert_node_before(the_node_before, nodeid, topic, data)
      }
    }
    let node_index = node_before.index - 0.5
    return this.add_node(node_before.parent, nodeid, topic, data, node_index)
  }

  get_node_before (node) {
    if (!JsMindUtil.is_node(node)) {
      let the_node = this.get_node(node)
      if (!the_node) {
        logger.error('the node[id=' + node + '] can not be found.')
        return null
      } else {
        return this.get_node_before(the_node)
      }
    }
    if (node.isroot) {
      return null
    }
    let idx = node.index - 2
    if (idx >= 0) {
      return node.parent.children[idx]
    } else {
      return null
    }
  }

  insert_node_after (node_after, nodeid, topic, data) {
    if (!JsMindUtil.is_node(node_after)) {
      let the_node_after = this.get_node(node_before)
      if (!the_node_after) {
        logger.error('the node_after[id=' + node_after + '] can not be found.')
        return null
      } else {
        return this.insert_node_after(the_node_after, nodeid, topic, data)
      }
    }
    let node_index = node_after.index + 0.5
    return this.add_node(node_after.parent, nodeid, topic, data, node_index)
  }

  get_node_after (node) {
    if (!JsMindUtil.is_node(node)) {
      let the_node = this.get_node(node)
      if (!the_node) {
        logger.error('the node[id=' + node + '] can not be found.')
        return null
      } else {
        return this.get_node_after(the_node)
      }
    }
    if (node.isroot) {
      return null
    }
    let idx = node.index
    let brothers = node.parent.children
    if (brothers.length >= idx) {
      return node.parent.children[idx]
    } else {
      return null
    }
  }

  move_node (node, beforeid, parentid, direction) {
    if (!JsMindUtil.is_node(node)) {
      let the_node = this.get_node(node)
      if (!the_node) {
        logger.error('the node[id=' + node + '] can not be found.')
        return null
      } else {
        return this.move_node(the_node, beforeid, parentid, direction)
      }
    }
    if (!parentid) {
      parentid = node.parent.id
    }
    return this._move_node(node, beforeid, parentid, direction)
  }

  _flow_node_direction (node, direction) {
    if (typeof direction === 'undefined') {
      direction = node.direction
    } else {
      node.direction = direction
    }
    let len = node.children.length
    while (len--) {
      this._flow_node_direction(node.children[len], direction)
    }
  }

  _move_node_internal (node, beforeid) {
    if (!!node && !!beforeid) {
      if (beforeid == '_last_') {
        node.index = -1
        this._reindex(node.parent)
      } else if (beforeid == '_first_') {
        node.index = 0
        this._reindex(node.parent)
      } else {
        let node_before = (!!beforeid) ? this.get_node(beforeid) : null
        if (node_before != null && node_before.parent != null && node_before.parent.id == node.parent.id) {
          node.index = node_before.index - 0.5
          this._reindex(node.parent)
        }
      }
    }
    return node
  }

  _move_node (node, beforeid, parentid, direction) {
    if (!!node && !!parentid) {
      if (node.parent.id != parentid) {
        // remove from parent's children
        let sibling = node.parent.children
        let si = sibling.length
        while (si--) {
          if (sibling[si].id == node.id) {
            sibling.splice(si, 1)
            break
          }
        }
        node.parent = this.get_node(parentid)
        node.parent.children.push(node)
      }

      if (node.parent.isroot) {
        if (direction == JsMind.direction.left) {
          node.direction = direction
        } else {
          node.direction = JsMind.direction.right
        }
      } else {
        node.direction = node.parent.direction
      }
      this._move_node_internal(node, beforeid)
      this._flow_node_direction(node)
    }
    return node
  }

  remove_node (node) {
    if (!jm.util.is_node(node)) {
      let the_node = this.get_node(node)
      if (!the_node) {
        logger.error('the node[id=' + node + '] can not be found.')
        return false
      } else {
        return this.remove_node(the_node)
      }
    }
    if (!node) {
      logger.error('fail, the node can not be found')
      return false
    }
    if (node.isroot) {
      logger.error('fail, can not remove root node')
      return false
    }
    if (this.selected != null && this.selected.id == node.id) {
      this.selected = null
    }
    // clean all subordinate nodes
    let children = node.children
    let ci = children.length
    while (ci--) {
      this.remove_node(children[ci])
    }
    // clean all children
    children.length = 0
    // remove from parent's children
    let sibling = node.parent.children
    let si = sibling.length
    while (si--) {
      if (sibling[si].id == node.id) {
        sibling.splice(si, 1)
        break
      }
    }
    // remove from global nodes
    delete this.nodes[node.id]
    // clean all properties
    for (let k in node) {
      delete node[k]
    }
    // remove it's self
    node = null
    //delete node
    return true
  }

  _put_node (node) {
    if (node.id in this.nodes) {
      logger.warn('the nodeid \'' + node.id + '\' has been already exist.')
      return false
    } else {
      this.nodes[node.id] = node
      return true
    }
  }

  _reindex (node) {
    if (node instanceof JsMindNode) {
      node.children.sort(JsMindNode.compare)
      for (let i = 0; i < node.children.length; i++) {
        node.children[i].index = i + 1
      }
    }
  }
}
