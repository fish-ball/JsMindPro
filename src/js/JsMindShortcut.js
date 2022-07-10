import _ from 'lodash-es'
import {DIRECTION} from './JsMind'
import JsMindUtil from './JsMindUtil'

// shortcut provider
// TODO: 热键防抖如何解决？
export default class JsMindShortcut {
  constructor (jm) {
    this.jm = jm
    // 绑定所有外置 handlers 处理函数
    this.handlers = {}
    _.forEach(this.jm.options.shortcut.handlers, (func, key) => {
      this.handlers[key] = func
    })
    // 绑定所有内置 handle 处理函数 handle_xxx 到 this.handlers.xxx
    Object.getOwnPropertyNames(Object.getPrototypeOf(this)).forEach(key => {
      if (!key.startsWith('handle_')) return
      const handle = key.replace(/^handle_/, '')
      this.handlers[handle] = this[key]
    })
    // 加入映射
    this._mapping = {}
    _.forEach(this.jm.options.shortcut.mapping, (handler, key) => {
      if (handler instanceof Function) {
        this._mapping[key] = handler
      } else if (handler in this.handlers) {
        this._mapping[key] = this.handlers[handler]
      }
    })
    // 绑定事件
    this.jm.view.e_panel.addEventListener('keydown', this.handler.bind(this))
  }

  enable_shortcut () {
    this.jm.options.shortcut.enable = true
  }

  disable_shortcut () {
    this.jm.options.shortcut.enable = false
  }

  /**
   * 调度器
   * @param e {KeyboardEvent}
   */
  handler (e) {
    // 编辑中状态不处理热键
    if (this.jm.view.is_editing()) return
    if (!this.jm.options.shortcut.enable) return
    // 纯控制键不响应
    if (/^Control|Shift|Alt|Meta$/.test(e.key)) return
    const keys = []
    if (e.ctrlKey) keys.push('Control')
    if (e.shiftKey) keys.push('Shift')
    if (e.altKey) keys.push('Alt')
    if (e.metaKey) keys.push('Meta')
    keys.push(e.code)
    const keyName = keys.join('+')
    if (keyName in this._mapping) {
      this._mapping[keyName].apply(this, [e])
      if (e) e.preventDefault()
    } else if ('default' in this.handlers) {
      this.handlers.default.apply(this, [e, keyName])
    }
  }

  /**
   * 处理添加一个子节点
   * @returns {Promise<void>}
   */
  async handle_addchild () {
    const jm = this.jm
    let selectedNode = jm.get_selected_node()
    if (!selectedNode) return
    // 在 await 之前先阻断默认事件
    // !! 注意这里在 insert_node_after 里面的 invoke_event_handle 可能会触发 node 本身的剧变
    // 如果因此导致 node 相关的引用丢失，会导致不可预期的效果，因此后续不做任何处理
    await jm.add_node(selectedNode, JsMindUtil.uuid.newid(), 'New Node')
    // TODO: 需要做插入之后的选中，由于异步的原因，暂时放在外部去做
  }

  /**
   * 处理添加一个兄弟节点
   * @returns {Promise<void>}
   */
  async handle_addbrother () {
    const jm = this.jm
    let selectedNode = jm.get_selected_node()
    if (!selectedNode) return
    if (selectedNode.is_root()) return this.handle_addchild()
    // 在 await 之前先阻断默认事件
    // !! 注意这里在 insert_node_after 里面的 invoke_event_handle 可能会触发 node 本身的剧变
    // 如果因此导致 node 相关的引用丢失，会导致不可预期的效果，因此后续不做任何处理
    await jm.insert_node_after(selectedNode, JsMindUtil.uuid.newid(), 'New Node')
    // TODO: 需要做插入之后的选中，由于异步的原因，暂时放在外部去做
  }

  /**
   * 触发编辑一个节点
   */
  async handle_editnode () {
    const jm = this.jm
    let selectedNode = jm.get_selected_node()
    if (selectedNode) await jm.begin_edit(selectedNode)
  }

  /**
   * 处理一个删除节点事件
   * @returns {Promise<void>}
   */
  async handle_delnode () {
    return this.jm.remove_nodes(this.jm.get_selected_nodes())
  }

  /**
   * 处理展开和折叠节点
   */
  handle_toggle () {
    const jm = this.jm
    for (const node of jm.get_selected_nodes()) {
      jm.toggle_node(node)
    }
  }

  /**
   * 处理↑按键
   */
  handle_up () {
    const jm = this.jm
    let selected_node = jm.get_selected_node()
    if (!selected_node || selected_node.is_root()) return
    let up_node = jm.find_node_before(selected_node)
    if (!up_node) {
      let np = jm.find_node_before(selected_node.parent)
      if (!!np && np.children.length > 0) {
        up_node = np.children[np.children.length - 1]
      }
    }
    if (up_node) jm.select_node(up_node)
  }

  /**
   * 处理↓键的响应
   */
  handle_down () {
    const jm = this.jm
    let selected_node = jm.get_selected_node()
    if (!selected_node || selected_node.is_root()) return
    let down_node = jm.find_node_after(selected_node)
    if (!down_node) {
      let np = jm.find_node_after(selected_node.parent)
      if (!!np && np.children.length > 0) {
        down_node = np.children[0]
      }
    }
    if (down_node) jm.select_node(down_node)
  }


  /**
   * 处理按键←的响应
   */
  handle_left () {
    this._handle_direction(DIRECTION.left)
  }

  /**
   * 处理按键右的响应
   */
  handle_right () {
    this._handle_direction(DIRECTION.right)
  }

  /**
   * 处理左或者右方向的按键响应
   * @param d {Number} 方向枚举值
   * @private
   */
  _handle_direction (d) {
    const jm = this.jm
    let selectedNode = jm.get_selected_node()
    if (!selectedNode) return
    let node = null
    if (selectedNode.is_root()) {
      // 跳到指定方向中间的那个节点
      const children = selectedNode.children.filter(c => c.direction === d)
      node = children[Math.floor((children.length - 1) / 2)]
    } else if (selectedNode.direction === d) {
      // 同方向的左右，找到中间的儿子节点
      const children = selectedNode.children
      node = children[Math.floor((children.length - 1) / 2)]
    } else {
      node = selectedNode.parent
    }
    if (node) jm.select_node(node)
  }
}
