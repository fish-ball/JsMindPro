import _ from 'lodash'
import JsMind from './JsMind'
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

    _.forEach(this.mapping, (key, handle) => {
      if (handle in this.mapping && handle in this.handles) {
        this._mapping[key] = this.handles[handle]
      }
    })
  }

  enable_shortcut () {
    this.opts.enable = true
  }

  disable_shortcut () {
    this.opts.enable = false
  }

  /**
   * 调度器
   * @param e {KeyboardEvent}
   */
  handler (e) {
    // 编辑中状态不处理热键
    if (this.jm.view.is_editing()) return
    let evt = e || event
    if (!this.opts.enable) return
    let kc = evt.keyCode
    if (kc in this._mapping) {
      this._mapping[kc].call(this, e)
      e.preventDefault()
    }
  }

  /**
   * 处理添加一个子节点
   * @param e {KeyboardEvent}
   */
  handle_addchild (e) {
    const jm = this.jm
    let selectedNode = jm.get_selected_node()
    if (!selectedNode) return
    let node = jm.add_node(selectedNode, JsMindUtil.uuid.newid(), 'New Node')
    jm.select_node(node)
    jm.begin_edit(node)
    e.preventDefault()
  }

  /**
   * 处理添加一个兄弟节点
   * @param e {KeyboardEvent}
   */
  handle_addbrother (e) {
    const jm = this.jm
    let selectedNode = jm.get_selected_node()
    if (!selectedNode) return
    if (selectedNode.isroot) return this.handle_addchild(e)
    let node = jm.insert_node_after(selectedNode, JsMindUtil.uuid.newid(), 'New Node')
    jm.select_node(node)
    jm.begin_edit(node)
    e.preventDefault()
  }

  /**
   * 触发编辑一个节点
   * @param e {KeyboardEvent}
   */
  handle_editnode (e) {
    const jm = this.jm
    let selected_node = jm.get_selected_node()
    if (selected_node) jm.begin_edit(selected_node)
  }

  /**
   * 处理一个删除节点事件
   * @param e {KeyboardEvent}
   */
  handle_delnode (e) {
    const jm = this.jm
    let selected_node = jm.get_selected_node()
    if (!selected_node) return
    if (selected_node.isroot) throw new Error('Cannot delete root node.')
    jm.select_node(selected_node.parent)
    jm.remove_node(selected_node)
  }

  /**
   * 处理展开和折叠节点
   * @param e {KeyboardEvent}
   */
  handle_toggle (e) {
    const jm = this.jm
    let evt = e || event
    let selected_node = jm.get_selected_node()
    if (!!selected_node) {
      jm.toggle_node(selected_node.id)
      evt.stopPropagation()
      evt.preventDefault()
    }
  }

  /**
   * 处理↑按键
   * @param e {KeyboardEvent}
   */
  handle_up (e) {
    const jm = this.jm
    let evt = e || event
    let selected_node = jm.get_selected_node()
    if (!selected_node || selected_node.isroot) return
    let up_node = jm.find_node_before(selected_node)
    if (!up_node) {
      let np = jm.find_node_before(selected_node.parent)
      if (!!np && np.children.length > 0) {
        up_node = np.children[np.children.length - 1]
      }
    }
    if (up_node) jm.select_node(up_node)
    evt.stopPropagation()
    evt.preventDefault()
  }

  /**
   * 处理↓键的响应
   * @param e {KeyboardEvent}
   */
  handle_down (e) {
    const jm = this.jm
    let evt = e || event
    let selected_node = jm.get_selected_node()
    if (!selected_node || selected_node.isroot) return
    let down_node = jm.find_node_after(selected_node)
    if (!down_node) {
      let np = jm.find_node_after(selected_node.parent)
      if (!!np && np.children.length > 0) {
        down_node = np.children[0]
      }
    }
    if (down_node) jm.select_node(down_node)
    evt.stopPropagation()
    evt.preventDefault()
  }


  /**
   * 处理按键←的响应
   * @param e {KeyboardEvent}
   */
  handle_left (e) {
    this._handle_direction(e, JsMind.direction.left)
  }

  /**
   * 处理按键右的响应
   * @param e {KeyboardEvent}
   */
  handle_right (e) {
    this._handle_direction(e, JsMind.direction.right)
  }

  /**
   * 处理左或者右方向的按键响应
   * @param e {KeyboardEvent}
   * @param d {Number} 方向枚举值
   * @private
   */
  _handle_direction (e, d) {
    const jm = this.jm
    let evt = e || event
    let selected_node = jm.get_selected_node()
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
      if (node) jm.select_node(node)
      evt.stopPropagation()
      evt.preventDefault()
    }
  }
}
