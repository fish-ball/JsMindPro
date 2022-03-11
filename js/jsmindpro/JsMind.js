/*
 * Released under BSD License
 * Copyright (c) 2014-2016 hizzgdev@163.com
 *
 * Project Home:
 *   https://github.com/hizzgdev/jsmind/
 */
import JsMindPlugin from './JsMindPlugin'
import JsMindUtil from './JsMindUtil'
import JsMindNode from './JsMindNode'
import JsMindMind from './JsMindMind'
import JsMindData from './JsMindData'
import JsMindLayout from './JsMindLayout'
import JsMindView from './JsMindView'
import JsMindShortcut from './JsMindShortcut'
import JsMindFormat from './JsMindFormat'

const __version__ = 0.5

let DEFAULT_OPTIONS = {
  container: '',   // id of the container
  editable: false, // you can change it in your options
  theme: null,
  mode: 'full',     // full or side
  support_html: true,

  view: {
    hmargin: 100,
    vmargin: 50,
    line_width: 2,
    line_color: '#555'
  },
  layout: {
    hspace: 30,
    vspace: 20,
    pspace: 13,
    direction: 'right' // left/right/both
  },
  default_event_handle: {
    enable_mousedown_handle: true,
    enable_click_handle: true,
    enable_dblclick_handle: true
  },
  shortcut: {
    enable: true,
    handles: {},
    mapping: {
      addchild: 45, // Insert
      addbrother: 13, // Enter
      editnode: 113,// F2
      delnode: 46, // Delete
      toggle: 32, // Space
      left: 37, // Left
      up: 38, // Up
      right: 39, // Right
      down: 40, // Down
    }
  }
}

export default class JsMind {
  static direction = {left: -1, center: 0, right: 1}
  static event_type = {show: 1, resize: 2, edit: 3, select: 4}

  // Subclass registration
  static plugin = JsMindPlugin
  static util = JsMindUtil
  static node = JsMindNode
  static format = JsMindFormat

  static plugins = []

  constructor (options) {
    this.version = __version__
    let opts = {}
    JsMindUtil.json.merge(opts, DEFAULT_OPTIONS)
    JsMindUtil.json.merge(opts, options)

    if (!opts.container) {
      throw new Error('the options.container should not be null or empty.')
    }
    this.options = opts
    this.inited = false
    /**
     * @type {JsMindMind|null}
     */
    this.mind = null
    this.event_handles = []
  }

  /**
   * 初始化 JsMind 控件
   */
  init () {
    if (this.inited) return
    this.inited = true

    let opts = this.options

    // create instance of function provider
    this.data = new JsMindData(this)
    this.data.init()

    // Init layout
    this.layout = new JsMindLayout(this, {
      mode: opts.mode,
      hspace: opts.layout.hspace,
      vspace: opts.layout.vspace,
      pspace: opts.layout.pspace
    })
    this.layout.init()

    // Init view
    this.view = new JsMindView(this, {
      container: opts.container,
      support_html: opts.support_html,
      hmargin: opts.view.hmargin,
      vmargin: opts.view.vmargin,
      line_width: opts.view.line_width,
      line_color: opts.view.line_color
    })
    this.view.init()

    // Init shortcut
    this.shortcut = new JsMindShortcut(this, opts.shortcut)
    this.shortcut.init()

    this._event_bind()

    JsMind.init_plugins(this)
  }

  /**
   * 配置启用编辑
   */
  enable_edit () {
    this.options.editable = true
  }

  /**
   * 配置禁用编辑
   */
  disable_edit () {
    this.options.editable = false
  }

  /**
   * 配置启用某个事件
   * 例如 call enable_event_handle('dblclick')
   * @param eventName {String} options are 'mousedown', 'click', 'dblclick'
   */
  enable_event_handle (eventName) {
    this.options.default_event_handle['enable_' + eventName + '_handle'] = true
  }

  /**
   * 配置禁用某个事件
   * 例如 call disable_event_handle('dblclick')
   * @param eventName {String} options are 'mousedown', 'click', 'dblclick'
   */
  disable_event_handle (eventName) {
    this.options.default_event_handle['enable_' + eventName + '_handle'] = false
  }

  /**
   * 返回当前的思维导图实例是否可编辑
   * @returns {boolean}
   */
  get_editable () {
    return !!this.options.editable
  }

  /**
   * 设置当前思维导图实例的主题
   * @param theme {String}
   */
  set_theme (theme) {
    let theme_old = this.options.theme
    this.options.theme = (!!theme) ? theme : null
    if (theme_old !== this.options.theme) {
      this.view.reset_theme()
      this.view.reset_custom_style()
    }
  }

  /**
   * 处理鼠标按下事件
   * @param e {Event}
   */
  mousedown_handle (e) {
    if (!this.options.default_event_handle['enable_mousedown_handle']) return
    let element = e.target || event.srcElement
    let nodeId = this.view.get_binded_nodeid(element)
    if (!!nodeId) {
      this.select_node(nodeId)
    } else {
      this.select_clear()
    }
  }

  /**
   * 点击事件处理器
   * @param e {Event}
   */
  click_handle (e) {
    if (!this.options.default_event_handle['enable_click_handle']) return
    let element = e.target || event.srcElement
    let isExpander = element.tagName.toLowerCase() === 'jmexpander'
    // 仅处理展开器
    if (!isExpander) return
    let nodeId = this.view.get_binded_nodeid(element)
    if (!!nodeId) {
      this.toggle_node(nodeId)
    }
  }

  /**
   * 双击事件处理器
   * @param e {Event}
   */
  dblclick_handle (e) {
    if (!this.options.default_event_handle['enable_dblclick_handle']) return
    if (this.get_editable()) {
      let element = e.target || event.srcElement
      let nodeid = this.view.get_binded_nodeid(element)
      if (!!nodeid) {
        this.begin_edit(nodeid)
      }
    }
  }

  /**
   * 开始编辑一个节点
   * @param node {JsMindNode|Integer|String}
   */
  begin_edit (node) {
    node = this._sanitize_node(node)
    this._require_editable()
    this.view.edit_node_begin(node)
  }

  /**
   * 结束一个节点的编辑状态
   */
  end_edit () {
    this.view.edit_node_end()
  }

  /**
   * 切换一个节点的折叠/展开状态
   * @param node {JsMindNode|Integer|String}
   */
  toggle_node (node) {
    node = this._sanitize_node(node)
    if (node.isroot) return
    this.view.save_location(node)
    this.layout.toggle_node(node)
    this.view.relayout()
    this.view.restore_location(node)
  }

  /**
   * 展开一个节点
   * @param node {JsMindNode|Integer|String}
   */
  expand_node (node) {
    node = this._sanitize_node(node)
    if (node.isroot) return
    this.view.save_location(node)
    this.layout.expand_node(node)
    this.view.relayout()
    this.view.restore_location(node)
  }

  /**
   * 折叠一个节点
   * @param node {JsMindNode|Integer|String}
   */
  collapse_node (node) {
    node = this._sanitize_node(node)
    if (node.isroot) return
    this.view.save_location(node)
    this.layout.collapse_node(node)
    this.view.relayout()
    this.view.restore_location(node)
  }

  /**
   * 展开所有的节点
   */
  expand_all () {
    this.layout.expand_all()
    this.view.relayout()
  }

  /**
   * 折叠所有的节点
   */
  collapse_all () {
    this.layout.collapse_all()
    this.view.relayout()
  }

  /**
   * 展开到指定的层级
   * @param depth {Integer} 层级
   */
  expand_to_depth (depth) {
    this.layout.expand_to_depth(depth)
    this.view.relayout()
  }

  /**
   * 渲染一个数据，相当于重置之后再渲染
   * @param mind {Object} 加载的思维导图数据
   */
  show (mind) {
    this.init()
    this._reset()
    this._show(mind)
  }

  /**
   * 获取元信息
   * @returns {{name: String|null, author: String|null, version: String|null}}
   */
  get_meta () {
    return {
      name: this.mind.name,
      author: this.mind.author,
      version: this.mind.version
    }
  }

  /**
   * 获取数据集
   * @param data_format
   * @returns {*}
   */
  get_data (data_format) {
    return this.data.get_data(data_format || 'node_tree')
  }

  /**
   * 获取根节点
   * @returns {JsMindNode}
   */
  get_root () {
    return this.mind.root
  }

  /**
   * 在当前图内获取指定 id 的 node
   * @param nodeId {Integer}
   * @returns {JsMindNode}
   */
  get_node (nodeId) {
    return this.mind.get_node(nodeId)
  }

  /**
   * 修改一个节点的 id
   * @param oldId
   * @param newId
   */
  rename_node (oldId, newId) {
    this.mind.rename_node(oldId, newId)
  }

  /**
   * 根据输入值生成并添加一个节点
   * @param parentNode {JsMindNode|Integer|String} 父节点的 ID
   * @param nodeId {Integer|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data {*}
   * @returns {JsMindNode} 范围添加成功后的节点，操作失败返回 null
   */
  add_node (parentNode, nodeId, topic, data = null) {
    this._require_editable()
    let node = this.mind.add_node(parentNode, nodeId, topic, data)
    this.view.add_node(node)
    this.layout.layout()
    this.view.show(false)
    node.reset_node_custom_style()
    this.expand_node(parentNode)
    this.invoke_event_handle(JsMind.event_type.edit, {
      evt: 'add_node',
      data: [parentNode.id, nodeId, topic, data],
      node: nodeId
    })
    return node
  }

  /**
   * 在指定的节点之前插入一个兄弟节点
   * @param nodeBefore {JsMindNode|Integer|String} 参照节点或其ID
   * @param nodeId {Integer|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data
   * @returns {JsMindNode}
   */
  insert_node_before (nodeBefore, nodeId, topic, data) {
    this._require_editable()
    let node = this.mind.insert_node_before(nodeBefore, nodeId, topic, data)
    this.view.add_node(node)
    this.layout.layout()
    this.view.show(false)
    this.invoke_event_handle(JsMind.event_type.edit, {
      evt: 'insert_node_before',
      data: [JsMindUtil.to_node_id(nodeBefore), nodeId, topic, data],
      node: nodeId
    })
    return node
  }

  /**
   * 在指定的节点之后插入一个兄弟节点
   * 手段是插入一个 0.5 下标的元素，然后通过 add_node 的 _reindex 整理顺序
   * @param nodeAfter {JsMindNode|Integer|String} 参照节点或其ID
   * @param nodeId nodeId {Integer|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data
   * @returns {JsMindNode}
   */
  insert_node_after (nodeAfter, nodeId, topic, data) {
    this._require_editable()
    let node = this.mind.insert_node_after(nodeAfter, nodeId, topic, data)
    this.view.add_node(node)
    this.layout.layout()
    this.view.show(false)
    this.invoke_event_handle(JsMind.event_type.edit, {
      evt: 'insert_node_after',
      data: [JsMindUtil.to_node_id(nodeAfter), nodeId, topic, data],
      node: nodeId
    })
    return node
  }

  /**
   * 移除一个指定的节点
   * @param node {JsMindNode|Integer|String} 待移除节点或者 ID
   */
  remove_node (node) {
    node = this._sanitize_node(node)
    this._require_editable()
    if (node.isroot) throw new Error('Can not remove root node')
    let nodeId = node.id
    let parentId = node.parent.id
    let parent = this.get_node(parentId)
    this.view.save_location(parent)
    this.view.remove_node(node)
    this.mind.remove_node(node)
    this.layout.layout()
    this.view.show(false)
    this.view.restore_location(parent)
    this.invoke_event_handle(JsMind.event_type.edit, {
      evt: 'remove_node', data: [nodeId], node: parentId
    })
    return true
  }

  /**
   * 修改一个节点的内容
   * @param nodeId {Integer|String} 节点ID
   * @param topic {String} 新的节点内容
   */
  update_node (nodeId, topic) {
    this._require_editable()
    if (JsMindUtil.text.is_empty(topic)) throw new Error('topic can not be empty')
    let node = this.get_node(nodeId)
    // 没有修改
    if (node.topic === topic) return this.view.update_node(node)
    // 有修改
    node.topic = topic
    this.view.update_node(node)
    this.layout.layout()
    this.view.show(false)
    this.invoke_event_handle(JsMind.event_type.edit, {
      evt: 'update_node', data: [nodeId, topic], node: nodeId
    })
  }

  /**
   * 移动一个节点
   * @param node {JsMindNode|Integer|String} 待移动节点
   * @param nodeBefore {JsMindNode|Integer|String}
   *        移动到目的节点的前面，接受对象或者节点 id 传入，填入 _first_ 或 _last_ 可调整到开头或末尾
   * @param parent {JsMindNode|Integer|String}
   * @param direction {Integer} 如果目标位置是一级子节点，指定方向
   */
  move_node (node, nodeBefore, parent, direction) {
    this._require_editable()
    parent = this._sanitize_node(parent)
    node = this.mind.move_node(node, nodeBefore, parent, direction)
    this.layout.expand_node(parent)
    this.view.update_node(node)
    this.layout.layout()
    this.view.show(false)
    this.invoke_event_handle(JsMind.event_type.edit, {
      evt: 'move_node',
      data: [node, nodeBefore, parent, direction],
      node: node
    })
  }

  /**
   * 触发选中某个节点
   * @param node {JsMindNode|Integer|String} 待选中的节点
   */
  select_node (node) {
    node = this._sanitize_node(node)
    if (!node.is_visible()) return
    this.mind.selected = node
    this.view.select_node(node)
  }

  /**
   * 获取当前选中的节点
   * @returns {JsMindNode}
   */
  get_selected_node () {
    return this.mind.selected
  }

  /**
   * 清除节点的选中状态
   */
  select_clear () {
    this.mind.selected = null
    this.view.select_clear()
  }

  /**
   * 返回指定节点的上一个节点（注意会穿越层级，也就是按↑键对应的节点）
   * @param node {JsMindNode|Integer|String}
   * @returns {JsMindNode}
   */
  find_node_before (node) {
    node = this._sanitize_node(node)
    if (node.isroot) return null
    // 非一级子节点好搞，直接上一个
    if (!node.parent.is_root) return this.mind.get_node_before(node)
    // 如果是一级子节点，则要考虑方向的问题
    let idx = node.parent.children.indexOf(node) - 1
    while (idx > -1) {
      if (node.parent.children[idx].direction === node.direction) break
      idx -= 1
    }
    return idx > -1 ? node.parent.children[idx] : null
  }

  /**
   * 返回指定节点的下一个节点（注意会穿越层级，也就是按↓键对应的节点）
   * @param node {JsMindNode|Integer|String}
   * @returns {JsMindNode}
   */
  find_node_after (node) {
    node = this._sanitize_node(node)
    if (node.isroot) return null
    // 非一级子节点好搞，直接上一个
    if (!node.parent.is_root) return this.mind.get_node_after(node)
    // 如果是一级子节点，则要考虑方向的问题
    let idx = node.parent.children.indexOf(node) + 1
    while (idx < node.parent.children.length) {
      if (node.parent.children[idx].direction === node.direction) break
      idx += 1
    }
    return idx > -1 ? node.parent.children[idx] : null
  }

  /**
   * 设置某个指定 id 节点的颜色
   * @param nodeId {Integer|String} 节点Id
   * @param bgColor {String} 背景色
   * @param fgColor {String} 前景色
   */
  set_node_color (nodeId, bgColor, fgColor) {
    if (!this.get_editable()) throw new Error('This mind map is not editable')
    let node = this.mind.get_node(nodeId)
    if (bgColor) node.data['background-color'] = bgColor
    if (fgColor) node.data['foreground-color'] = fgColor
    node.reset_node_custom_style()
  }

  /**
   * 设置某个节点的字体样式
   * @param nodeId {Integer|String}
   * @param size {String}
   * @param weight {String}
   * @param style
   */
  set_node_font_style (nodeId, size, weight, style) {
    if (!this.get_editable()) throw new Error('This mind map is not editable')
    let node = this.mind.get_node(nodeId)
    if (size) node.data['font-size'] = size
    if (weight) node.data['font-weight'] = weight
    if (style) node.data['font-style'] = style
    node.reset_node_custom_style()
    this.view.update_node(node)
    this.layout.layout()
    this.view.show(false)
  }

  /**
   * 设置某个节点的背景图
   * @param nodeId {Integer|String}
   * @param image {String}
   * @param width
   * @param height
   * @param rotation
   */
  set_node_background_image (nodeId, image, width, height, rotation) {
    if (!this.get_editable()) throw new Error('This mind map is not editable')
    let node = this.mind.get_node(nodeId)
    if (image) node.data['background-image'] = image
    if (width) node.data['width'] = width
    if (height) node.data['height'] = height
    if (rotation) node.data['background-rotation'] = rotation
    node.reset_node_custom_style()
    this.view.update_node(node)
    this.layout.layout()
    this.view.show(false)
  }

  /**
   * 设置背景旋转
   * @param nodeId {Integer}
   * @param rotation {String}
   */
  set_node_background_rotation (nodeId, rotation) {
    if (!this.get_editable()) throw new Error('This mind map is not editable')
    let node = this.mind.get_node(nodeId)
    if (!node.data['background-image']) {
      throw new Error('Can only change rotation angle of node with background image')
    }
    node.data['background-rotation'] = rotation
    node.reset_node_custom_style()
    this.view.update_node(node)
    this.layout.layout()
    this.view.show(false)
  }

  /**
   * 重设大小
   */
  resize () {
    return this.view.resize()
  }

  /**
   * 添加一个事件处理器
   * callback(type ,data)
   * @param callback {Function}
   */
  add_event_listener (callback) {
    this.event_handles.push(callback)
  }

  /**
   * 触发一个事件处理
   * @param type
   * @param data
   */
  invoke_event_handle (type, data) {
    this.event_handles.forEach(handler => handler(type, data))
  }

  // >>>>>>>> static methods >>>>>>>>

  /**
   * 绑定思维导图的主要事件（鼠标按下、点击、双击）
   * @private
   */
  _event_bind () {
    this.view.add_event(this, 'mousedown', this.mousedown_handle)
    this.view.add_event(this, 'click', this.click_handle)
    this.view.add_event(this, 'dblclick', this.dblclick_handle)
  }

  /**
   * 全部重置
   * @private
   */
  _reset () {
    this.view.reset()
    this.layout.reset()
    this.data.reset()
  }

  /**
   * 展示一个思维导图
   * @param mind {Object} 加载的思维导图数据
   * @private
   */
  _show (mind) {
    // m 是数据
    let m = mind || JsMind.format.node_array.example
    this.mind = this.data.load(m)
    this.view.load()
    this.layout.layout()
    this.view.show(true)
    this.invoke_event_handle(JsMind.event_type.show, {
      data: [mind]
    })
  }

  /**
   * 要求有 editable 状态，否则抛错
   * @private
   */
  _require_editable () {
    if (!this.get_editable()) throw new Error('This mind map is not editable')
  }

  /**
   * 返回一个 node 实例：
   * + 如果传入 nodeId，则返回对应的节点集内的 node，找不到返回 null
   * + 如果传入的是 node 实例，则查找是否在节点集内并一致，一致返回节点本身，否则返回 null
   * @param node {JsMindNode|Integer}
   * @returns {JsMindNode}
   * @private
   */
  _sanitize_node (node) {
    if (!JsMindUtil.is_node(node)) return this.get_node(node)
    if (this.mind.nodes[node.id] === node) return node
    throw new Error('The node is not defined inside the current tree.')
  }

  // >>>>>>>> static methods >>>>>>>>

  /**
   * 快捷工厂方法，传入参数，创建一个 JSMind 实例。
   * @param options {Object} JSMind 选项
   * @param mind {Object} JSMind 内容数据
   * @returns {JsMind}
   */
  static show (options, mind) {
    let jm = new JsMind(options)
    jm.show(mind)
    return jm
  }

  /**
   * 注册一个插件
   * @param plugin {JsMindPlugin}
   */
  static register_plugin (plugin) {
    JsMind.plugins.push(plugin)
  }

  /**
   * 初始化插件
   * @param sender
   */
  static init_plugins (sender) {
    JsMind.plugins.forEach(plugin => {
      plugin.init(sender)
    })
  }

}



