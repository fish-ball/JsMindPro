import JsMindUtil from './JsMindUtil'

// shortcut provider
export default class JsMindShortcut {
  constructor (jm, options) {
    this.jm = jm
    this.opts = options
    this.mapping = options.mapping
    this.handles = options.handles
    this._mapping = {}
  }

  init () {
    JsMindUtil.dom.add_event(document, 'keydown', this.handler.bind(this))

    this.handles['addchild'] = this.handle_addchild
    this.handles['addbrother'] = this.handle_addbrother
    this.handles['editnode'] = this.handle_editnode
    this.handles['delnode'] = this.handle_delnode
    this.handles['toggle'] = this.handle_toggle
    this.handles['up'] = this.handle_up
    this.handles['down'] = this.handle_down
    this.handles['left'] = this.handle_left
    this.handles['right'] = this.handle_right

    for (let handle in this.mapping) {
      if (!!this.mapping[handle] && (handle in this.handles)) {
        this._mapping[this.mapping[handle]] = this.handles[handle]
      }
    }
  }

  enable_shortcut () {
    this.opts.enable = true
  }

  disable_shortcut () {
    this.opts.enable = false
  }

  handler (e) {
    if (this.jm.view.is_editing()) {
      return
    }
    let evt = e || event
    if (!this.opts.enable) {
      return true
    }
    let kc = evt.keyCode
    if (kc in this._mapping) {
      this._mapping[kc].call(this, this.jm, e)
    }
  }

  /**
   * 处理添加一个子节点
   * @param jm {JsMind} JsMind 实例
   * @param e {Event}
   * @returns {Promise<void>}
   */
  async handle_addchild (jm, e) {
    let selectedNode = jm.get_selected_node()
    if (!!selectedNode) {
      let nodeid = JsMindUtil.uuid.newid()
      let node = await jm.add_node(selectedNode, nodeid, 'New Node')
      if (!!node) {
        await jm.select_node(nodeid)
        await jm.begin_edit(nodeid)
      }
    }
  }

  /**
   * 处理添加一个兄弟节点
   * @param jm {JsMind} JsMind 实例
   * @param e {Event}
   * @returns {Promise<void>}
   */
  async handle_addbrother (jm, e) {
    let selectedNode = jm.get_selected_node()
    if (!selectedNode) return
    if (selectedNode.isroot) return this.handle_addchild(jm, e)
    let nodeId = JsMindUtil.uuid.newid()
    let node = await jm.insert_node_after(selectedNode, nodeId, 'New Node')
    await jm.select_node(node.id)
    await jm.begin_edit(node.id)
    e.preventDefault()
  }

  handle_editnode (_jm, e) {
    let selected_node = _jm.get_selected_node()
    if (!!selected_node) {
      _jm.begin_edit(selected_node)
    }
  }

  /**
   * 处理一个删除节点事件
   * @param jm {JsMind}
   * @param e {Event}
   * @returns {Promise<void>}
   */
  async handle_delnode (jm, e) {
    let selected_node = jm.get_selected_node()
    if (!selected_node) return
    if (selected_node.isroot) throw new Error('Cannot delete root node.')
    await jm.select_node(selected_node.parent)
    await jm.remove_node(selected_node)
  }

  handle_toggle (_jm, e) {
    let evt = e || event
    let selected_node = _jm.get_selected_node()
    if (!!selected_node) {
      _jm.toggle_node(selected_node.id)
      evt.stopPropagation()
      evt.preventDefault()
    }
  }

  handle_up (_jm, e) {
    let evt = e || event
    let selected_node = _jm.get_selected_node()
    if (!!selected_node) {
      let up_node = _jm.find_node_before(selected_node)
      if (!up_node) {
        let np = _jm.find_node_before(selected_node.parent)
        if (!!np && np.children.length > 0) {
          up_node = np.children[np.children.length - 1]
        }
      }
      if (!!up_node) {
        _jm.select_node(up_node)
      }
      evt.stopPropagation()
      evt.preventDefault()
    }
  }

  handle_down (_jm, e) {
    let evt = e || event
    let selected_node = _jm.get_selected_node()
    if (!!selected_node) {
      let down_node = _jm.find_node_after(selected_node)
      if (!down_node) {
        let np = _jm.find_node_after(selected_node.parent)
        if (!!np && np.children.length > 0) {
          down_node = np.children[0]
        }
      }
      if (!!down_node) {
        _jm.select_node(down_node)
      }
      evt.stopPropagation()
      evt.preventDefault()
    }
  }

  handle_left (_jm, e) {
    this._handle_direction(_jm, e, JsMind.direction.left)
  }

  handle_right (_jm, e) {
    this._handle_direction(_jm, e, JsMind.direction.right)
  }

  _handle_direction (_jm, e, d) {
    let evt = e || event
    let selected_node = _jm.get_selected_node()
    let node = null
    if (!!selected_node) {
      if (selected_node.isroot) {
        let c = selected_node.children
        let children = []
        for (let i = 0; i < c.length; i++) {
          if (c[i].direction === d) {
            children.push(i)
          }
        }
        node = c[children[Math.floor((children.length - 1) / 2)]]
      }
      else if (selected_node.direction === d) {
        let children = selected_node.children
        let childrencount = children.length
        if (childrencount > 0) {
          node = children[Math.floor((childrencount - 1) / 2)]
        }
      } else {
        node = selected_node.parent
      }
      if (!!node) {
        _jm.select_node(node)
      }
      evt.stopPropagation()
      evt.preventDefault()
    }
  }
}
