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
import JsMindModel from './JsMindModel'
import JsMindLayout from './JsMindLayout'
import JsMindView from './JsMindView'
import JsMindShortcut from './JsMindShortcut'

export const DIRECTION = {left: -1, center: 0, right: 1}
export const EVENT_TYPE = {show: 1, resize: 2, edit: 3, select: 4}

export const DEFAULT_OPTIONS = {
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
      Tab: 'addchild',
      Enter: 'addbrother',
      NumpadEnter: 'addbrother',
      F2: 'editnode',
      Delete: 'delnode',
      Space: 'toggle',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down'
    }
  }
}

/**
 * [decorator] 要求 JsMind 对象被正确初始化
 * 参考：http://caibaojian.com/es6/decorator.html
 * @param target
 * @param name
 * @param descriptor
 */
function require_init (target, name, descriptor) {
  const func = descriptor.value
  descriptor.value = async function () {
    if (!this._initialized) throw new Error('JsMind 对象尚未初始化。')
    return func.call(this, ...arguments)
  }
  return descriptor
}


export default class JsMind {
  static EVENT_TYPE = EVENT_TYPE
  static DIRECTION = DIRECTION

  // Subclass registration
  static plugin = JsMindPlugin
  static util = JsMindUtil
  static node = JsMindNode

  static plugins = []

  constructor (options) {
    this.options = {}
    Object.assign(this.options, DEFAULT_OPTIONS)
    Object.assign(this.options, options)

    if (!this.options.container) {
      throw new Error('the options.container should not be null or empty.')
    }

    // 初始属性
    this._initialized = false
    this._event_handlers = []
  }

  /**
   * 初始化 JsMind 控件
   */
  init () {
    if (this._initialized) {
      throw new Error('JsMind 已经初始化，请勿重复初始化.')
    }

    // TODO: 职责引用解耦 Init layout
    this.layout = new JsMindLayout(this, {
      mode: this.options.mode,
      hspace: this.options.layout.hspace,
      vspace: this.options.layout.vspace,
      pspace: this.options.layout.pspace
    })

    // Init view
    this.view = new JsMindView(this, {
      container: this.options.container,
      support_html: this.options.support_html,
      render_node: this.options.render_node,
      ...this.options.view
    })
    this.view.init()

    // Init shortcut
    this.shortcut = new JsMindShortcut(this, this.options.shortcut)

    this._event_bind()

    JsMind.init_plugins(this)

    // 标记已初始化
    this._initialized = true
  }

  /**
   * 返回当前的思维导图实例是否可编辑
   * @returns {boolean}
   */
  get_editable () {
    return this.options.editable
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
   * 暴露接口让外部可以访问 nodes，但不直接访问 JsMindModel
   * @returns {{JsMindNode}}
   */
  get_nodes () {
    return this.model.nodes
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
   * 设置当前思维导图实例的主题
   * @param theme {String}
   */
  set_theme (theme) {
    let theme_old = this.options.theme
    this.options.theme = (!!theme) ? theme : null
    if (theme_old !== this.options.theme) {
      this.view.reset_theme()
    }
  }

  /**
   * 开始编辑一个节点
   * @param node {JsMindNode|Number|String}
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
   * @param node {JsMindNode|Number|String}
   */
  toggle_node (node) {
    node = this._sanitize_node(node)
    if (node.is_root()) return
    this.view.save_location(node)
    this.layout.toggle_node(node)
    this.view.relayout()
    this.view.restore_location(node)
  }

  /**
   * 展开一个节点
   * @param node {JsMindNode|Number|String}
   * @param deep {boolean} 是否级联展开到最底层
   */
  expand_node (node, deep = false) {
    node = this._sanitize_node(node)
    if (node.is_root()) return
    this.view.save_location(node)
    this.layout.expand_node(node, deep)
    this.view.relayout()
    this.view.restore_location(node)
  }

  /**
   * 折叠一个节点
   * @param node {JsMindNode|Number|String}
   */
  collapse_node (node) {
    node = this._sanitize_node(node)
    if (node.is_root()) return
    this.view.save_location(node)
    this.layout.collapse_node(node)
    this.view.relayout()
    this.view.restore_location(node)
  }

  /**
   * 展开到指定的节点列表
   * 将指定的列表到根节点的路径全部打开，其余全部关闭
   * @param nodes {JsMindNode[]|Number[]|String[]}
   */
  expand_to_nodes (nodes) {
    this.collapse_all()
    nodes.forEach(node => {
      node = this._sanitize_node(node).parent
      while (node && !node.is_root() && !node.expanded) {
        this.layout.expand_node(node)
        node = node.parent
      }
    })
    this.view.relayout()
  }

  /**
   * 折叠除本节点外的其他节点
   * @param node {JsMindNode|Number|String}
   */
  collapse_other (node) {
    node = this._sanitize_node(node)
    this.view.save_location(node)
    // 从当前层级上溯，把所有其他兄弟节点折叠掉
    while (!node.is_root()) {
      node.parent.children.forEach(child => {
        if (child !== node) this.collapse_node(child)
      })
      node = node.parent
    }
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
   * @param depth {Number} 层级
   */
  expand_to_depth (depth) {
    this.layout.expand_to_depth(depth)
    this.view.relayout()
  }

  /**
   * 渲染一个数据，相当于重置之后再渲染
   * @param format {String} 数据格式：node_array|node_tree|freemind
   * @param data {Object} 加载的思维导图数据
   * @returns {Promise<void>}
   */
  async render (format, data) {
    // 执行初始化（）
    this._initialized = false
    // 加载数据以及 JsMindModel 模型
    this.model = new JsMindModel(format, this.options)
    this.model.load(data)
    this.init()
    this.view.reset()
    this.layout.reset()
    await this.view.init_nodes()
    this.view.show(true)
    this.invoke_event_handle(EVENT_TYPE.show, {
      data: [data]
    })
  }

  /**
   * 获取数据集
   * @param data_format
   * @returns {*}
   */
  get_data (data_format) {
    return this.model.get_data(data_format || 'node_tree')
  }

  /**
   * 获取根节点
   * @returns {JsMindNode}
   */
  get_root () {
    return this.model.root
  }

  /**
   * 在当前图内获取指定 id 的 node
   * @param nodeId {Number}
   * @returns {JsMindNode}
   */
  get_node (nodeId) {
    return this.model.get_node(nodeId)
  }

  /**
   * 修改一个节点的 id
   * @param oldId
   * @param newId
   */
  rename_node (oldId, newId) {
    this.model.rename_node(oldId, newId)
  }

  /**
   * 根据输入值生成并添加一个节点
   * @param parentNode {JsMindNode|Number|String} 父节点的 ID
   * @param nodeId {Number|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data {*}
   * @returns {Promise<JsMindNode>} 范围添加成功后的节点，操作失败返回 null
   */
  async add_node (parentNode, nodeId, topic, data = null) {
    this._require_editable()
    let node = this.model.add_node(parentNode, nodeId, topic, data)
    await this.view.add_node(node)
    this.view.show(false)
    this.expand_node(parentNode)
    this.invoke_event_handle(EVENT_TYPE.edit, {
      evt: 'add_node',
      data: [parentNode.id, nodeId, topic, data],
      node: nodeId
    })
    return node
  }

  /**
   * 在指定的节点之前插入一个兄弟节点
   * @param nodeBefore {JsMindNode|Number|String} 参照节点或其ID
   * @param nodeId {Number|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data
   * @returns {Promise<JsMindNode>}
   */
  async insert_node_before (nodeBefore, nodeId, topic, data) {
    this._require_editable()
    let node = this.model.insert_node_before(nodeBefore, nodeId, topic, data)
    await this.view.add_node(node)
    await this.view.show(false)
    this.invoke_event_handle(EVENT_TYPE.edit, {
      evt: 'insert_node_before',
      data: [JsMindUtil.to_node_id(nodeBefore), nodeId, topic, data],
      node: nodeId
    })
    return node
  }

  /**
   * 在指定的节点之后插入一个兄弟节点
   * 手段是插入一个 0.5 下标的元素，然后通过 add_node 的 _reindex 整理顺序
   * @param nodeAfter {JsMindNode|Number|String} 参照节点或其ID
   * @param nodeId nodeId {Number|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data
   * @returns {Promise<JsMindNode>}
   */
  async insert_node_after (nodeAfter, nodeId, topic, data) {
    this._require_editable()
    let node = this.model.insert_node_after(nodeAfter, nodeId, topic, data)
    await this.view.add_node(node)
    this.invoke_event_handle(EVENT_TYPE.edit, {
      evt: 'insert_node_after',
      data: [JsMindUtil.to_node_id(nodeAfter), nodeId, topic, data],
      node: nodeId
    })
    return node
  }

  /**
   * 移除一个指定的节点
   * @param node {JsMindNode|Number|String} 待移除节点或者 ID
   * @returns {Promise<Boolean>}
   */
  async remove_node (node) {
    node = this._sanitize_node(node)
    this._require_editable()
    if (node.is_root()) throw new Error('Can not remove root node')
    let nodeId = node.id
    let parentId = node.parent.id
    let parent = this.get_node(parentId)
    // 因为删除节点会导致布局突变，需要锚定 parent 的位置等布完之后恢复
    this.view.save_location(parent)
    await this.view.remove_node(node)
    this.model.remove_node(node)
    await this.view.show(false)
    this.view.restore_location(parent)
    this.invoke_event_handle(EVENT_TYPE.edit, {
      evt: 'remove_node', data: [nodeId], node: parentId
    })
    return true
  }

  /**
   * 修改一个节点的内容
   * @param nodeId {Number|String} 节点ID
   * @param topic {String} 新的节点内容
   * @returns {Promise<void>}
   */
  async update_node (nodeId, topic) {
    this._require_editable()
    // if (!topic || !topic.trim()) throw new Error('topic can not be empty')
    if (!topic || !topic.trim()) topic = '<未命名>'
    let node = this.get_node(nodeId)
    if (node.topic === topic) {
      // 没有修改
      await this.view.update_node(node)
    } else {
      // 有修改
      node.topic = topic
      await this.view.update_node(node)
      this.view.show(false)
      this.invoke_event_handle(EVENT_TYPE.edit, {
        evt: 'update_node', data: [nodeId, topic], node: nodeId
      })
    }
    this.view.e_panel.focus()
  }

  /**
   * 移动一个节点
   * @param node {JsMindNode|Number|String} 待移动节点
   * @param nodeBefore {JsMindNode|Number|String}
   *        移动到目的节点的前面，接受对象或者节点 id 传入，填入 _first_ 或 _last_ 可调整到开头或末尾
   * @param parent {JsMindNode|Number|String}
   * @param direction {Number} 如果目标位置是一级子节点，指定方向
   * @returns {Promise<void>}
   */
  async move_node (node, nodeBefore, parent, direction) {
    this._require_editable()
    parent = this._sanitize_node(parent)
    node = this.model.move_node(node, nodeBefore, parent, direction)
    this.layout.expand_node(parent)
    await this.view.update_node(node)
    this.view.show(false)
    this.invoke_event_handle(EVENT_TYPE.edit, {
      evt: 'move_node',
      data: [node, nodeBefore, parent, direction],
      node: node
    })
  }

  /**
   * 触发选中某个节点
   * @param node {JsMindNode|Number|String} 待选中的节点
   */
  select_node (node) {
    node = this._sanitize_node(node)
    if (!node.is_visible()) return
    this.view.select_node(node)
  }

  /**
   * 触发清除选中
   */
  select_clear () {
    this.view.select_clear()
  }

  /**
   * 获取当前选中的节点
   * @returns {JsMindNode}
   */
  get_selected_node () {
    return this.model.selected_node
  }

  /**
   * 返回指定节点的上一个节点（注意会穿越层级，也就是按↑键对应的节点）
   * @param node {JsMindNode|Number|String}
   * @returns {JsMindNode}
   */
  find_node_before (node) {
    node = this._sanitize_node(node)
    if (node.is_root()) return null
    // 非一级子节点好搞，直接上一个
    if (!node.parent.is_root) return this.model.get_node_before(node)
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
   * @param node {JsMindNode|Number|String}
   * @returns {JsMindNode}
   */
  find_node_after (node) {
    node = this._sanitize_node(node)
    if (node.is_root()) return null
    // 非一级子节点好搞，直接上一个
    if (!node.parent.is_root) return this.model.get_node_after(node)
    // 如果是一级子节点，则要考虑方向的问题
    let idx = node.parent.children.indexOf(node) + 1
    while (idx < node.parent.children.length) {
      if (node.parent.children[idx].direction === node.direction) break
      idx += 1
    }
    return idx > -1 ? node.parent.children[idx] : null
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
    this._event_handlers.push(callback)
  }

  /**
   * 触发一个事件处理
   * TODO: event_handle 相关的都属于外部注入钩子，需要改成 async
   * @param type
   * @param data
   */
  invoke_event_handle (type, data) {
    this._event_handlers.forEach(handler => handler(type, data))
  }

  // >>>>>>>> private methods >>>>>>>>

  /**
   * 绑定思维导图的主要事件（鼠标按下、点击、双击）
   * @private
   */
  _event_bind () {
    this.view.add_event(this, 'mousedown', this._mousedown_handle)
    this.view.add_event(this, 'click', this._click_handle)
    this.view.add_event(this, 'dblclick', this._dblclick_handle)
  }

  /**
   * 处理鼠标按下事件
   * @param e {Event}
   */
  _mousedown_handle (e) {
    if (!this.options.default_event_handle['enable_mousedown_handle']) return
    let element = e.target || event.srcElement
    let nodeId = this.view.get_binded_nodeid(element)
    if (!!nodeId) {
      this.select_node(nodeId)
    } else {
      this.view.select_clear()
    }
  }

  /**
   * 点击事件处理器
   * @param e {Event}
   */
  _click_handle (e) {
    if (!this.options.default_event_handle['enable_click_handle']) return
    let element = e.target || event.srcElement
    let isExpander = element.classList.contains('jmexpander')
    // 仅处理展开器
    if (!isExpander) return
    let nodeId = this.view.get_binded_nodeid(element)
    if (nodeId) this.toggle_node(nodeId)
  }

  /**
   * 双击事件处理器
   * @param e {Event}
   */
  _dblclick_handle (e) {
    if (!this.options.default_event_handle['enable_dblclick_handle']) return
    if (this.get_editable()) {
      let element = e.target || event.srcElement
      let nodeId = this.view.get_binded_nodeid(element)
      if (nodeId) this.begin_edit(nodeId)
    }
  }


  /**
   * 要求有 editable 状态，否则抛错
   * @private
   */
  _require_editable () {
    if (!this.get_editable()) throw new Error('This model map is not editable')
  }

  /**
   * 返回一个 node 实例：
   * + 如果传入 nodeId，则返回对应的节点集内的 node，找不到返回 null
   * + 如果传入的是 node 实例，则查找是否在节点集内并一致，一致返回节点本身，否则返回 null
   * @param node {JsMindNode|Number}
   * @returns {JsMindNode}
   * @private
   */
  _sanitize_node (node) {
    if (!JsMindUtil.is_node(node)) return this.get_node(node)
    if (this.model.nodes[node.id] === node) return node
    throw new Error('The node is not defined inside the current tree.')
  }

  // >>>>>>>> static methods >>>>>>>>

  /**
   * 快捷工厂方法，传入参数，创建一个 JSMind 实例。
   * @param options {Object} JSMind 选项
   * @param format {String} 格式枚举值：node_array|node_tree|freemind
   * @param data {Object} JSMind 内容数据
   * @returns {JsMind}
   */
  static async show (options, format, data) {
    let jm = new JsMind(options)
    await jm.render(format, data)
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



