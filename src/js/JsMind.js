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
  container: '',   // (querySelector/id/Element) of the container
  editable: false, // you can change it in your options
  theme: null,
  mode: 'both',     // both or side

  view: {
    hmargin: 100,
    vmargin: 50,
    line_width: 2,
    line_color: '#555',
    render_node: null, // functions (elNode, node) to render the node
    zoom: 1,
    zoom_step: 0.1,
    min_zoom: 0.5,
    max_zoom: 2
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

/**
 * [decorator] 要求 JsMind 处于可编辑状态
 * 参考：http://caibaojian.com/es6/decorator.html
 * @param target
 * @param name
 * @param descriptor
 */
function require_editable (target, name, descriptor) {
  const func = descriptor.value
  descriptor.value = async function () {
    if (this.can_edit()) return func.call(this, ...arguments)
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
      render_node: this.options.render_node,
      ...this.options.view
    })
    this.view.init()

    // Init shortcut
    this.shortcut = new JsMindShortcut(this, this.options.shortcut)

    JsMind.init_plugins(this)

    // 标记已初始化
    this._initialized = true
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
    this.invoke_event_handle(EVENT_TYPE.show, {data: [data]})
  }

  /**
   * 增量渲染数据，相当于在原本 Model 上面加上一些新的源数据内容，多用于批量插入
   * @param data
   * @returns {Promise<void>}
   */
  async append_data (data) {
    this.model.append_data(data)
    await this.view.maintain_nodes()
    this.view.show(false)
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
   * @param nodeId {Number|String|JsMindNode}
   * @returns {JsMindNode}
   */
  get_node (nodeId) {
    // 兼容写法
    if (nodeId instanceof JsMindNode) return nodeId
    return this.model.get_node(nodeId)
  }

  /**
   * 暴露接口让外部可以访问 nodes，但不直接访问 JsMindModel
   * @returns {{JsMindNode}}
   */
  get_nodes () {
    return this.model.nodes
  }

  /**
   * 获取当前选中的节点
   * @returns {JsMindNode}
   */
  get_selected_node () {
    return this.model.selected_node
  }

  /**
   * 触发选中某个节点
   * @param node {JsMindNode} 待选中的节点
   * @param focus {Boolean} 定位节点，移动到屏幕显示区域中
   */
  select_node (node, focus = true) {
    const lastNode = this.get_selected_node()
    if (node && !node.is_visible()) return
    if (lastNode) lastNode.deselect()
    this.model.selected_node = node
    if (node) node.select(focus)
    this.invoke_event_handle(EVENT_TYPE.select, {node})
  }

  /**
   * 触发清除选中
   */
  select_clear () {
    this.select_node(null)
  }

  /**
   * 返回当前的思维导图实例是否可编辑
   * @returns {boolean}
   */
  can_edit () {
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
   * 缩放到指定倍数
   * @param zoom
   * @returns {Boolean} 返回是否设置成功（超限返回 false）
   */
  set_zoom (zoom) {
    return this.view.set_zoom(zoom)
  }

  /**
   * 放大一档
   * @returns {Boolean} 返回是否设置成功（超限返回 false）
   */
  zoom_in () {
    return this.set_zoom(this.view.options.zoom + this.view.options.zoom_step)
  }

  /**
   * 缩小一档
   * @returns {Boolean} 返回是否设置成功（超限返回 false）
   */
  zoom_out () {
    return this.set_zoom(this.view.options.zoom - this.view.options.zoom_step)
  }

  /**
   * 重新创建一个 node 的元素 * 会清除 view 对应的 DOM 并重新生成，渲染视图
   * 一般用于 node 数据被修改的情况下
   * @param node {JsMindNode}
   * @returns {Promise<void>}
   */
  async refresh_node (node) {
    await this.view.refresh_node(node)
    // TODO: 为什么这个不充分要补这句？
    this.view.show(false)
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
   * 返回指定节点的上一个节点（注意会穿越层级，也就是按↑键对应的节点）
   * @param node {JsMindNode}
   * @returns {JsMindNode}
   */
  find_node_before (node) {
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
   * @param node {JsMindNode}
   * @returns {JsMindNode}
   */
  find_node_after (node) {
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
   * 切换一个节点的折叠/展开状态
   * @param node {JsMindNode|null}
   */
  toggle_node (node) {
    if (!node || node.is_root()) return
    this.view.save_location(node)
    this.layout.toggle_node(node)
    this.view.refresh()
    this.view.restore_location(node)
  }

  /**
   * 展开一个节点
   * @param node {JsMindNode}
   * @param deep {boolean} 是否级联展开到最底层
   */
  expand_node (node, deep = false) {
    if (node.is_root()) return
    this.view.save_location(node)
    this.layout.expand_node(node, deep)
    this.view.refresh()
    this.view.restore_location(node)
  }

  /**
   * 折叠一个节点
   * @param node {JsMindNode}
   */
  collapse_node (node) {
    if (node.is_root()) return
    this.view.save_location(node)
    this.layout.collapse_node(node)
    this.view.refresh()
    this.view.restore_location(node)
  }

  /**
   * 展开到指定的节点列表
   * 将指定的列表到根节点的路径全部打开，其余全部关闭
   * @param nodes {JsMindNode[]}
   * @param collapseOther {Boolean}
   */
  expand_to_nodes (nodes, collapseOther = true) {
    if (collapseOther) this.collapse_all()
    nodes.forEach(node => {
      node = node.parent
      while (node && !node.is_root() && !node.expanded) {
        this.layout.expand_node(node)
        node = node.parent
      }
    })
    this.view.refresh()
  }

  /**
   * 折叠除本节点外的其他节点
   * @param node {JsMindNode}
   */
  collapse_other (node) {
    this.view.save_location(node)
    // 从当前层级上溯，把所有其他兄弟节点折叠掉
    while (!node.is_root()) {
      node.parent.children.forEach(child => {
        if (child !== node) this.collapse_node(child)
      })
      node = node.parent
    }
    this.view.refresh()
    this.view.restore_location(node)
  }

  /**
   * 展开所有的节点
   */
  expand_all () {
    this.layout.expand_all()
    this.view.refresh()
  }

  /**
   * 折叠所有的节点
   */
  collapse_all () {
    this.layout.collapse_all()
    this.view.refresh()
  }

  /**
   * 展开到指定的层级
   * @param depth {Number} 层级
   */
  expand_to_depth (depth) {
    this.layout.expand_to_depth(depth)
    this.view.refresh()
  }

  /**
   * 返回 JsMind 是否处于编辑中的状态
   * @returns {boolean}
   */
  is_editing () {
    return this.view.is_editing()
  }

  /**
   * 开始编辑一个节点
   * @param node {JsMindNode}
   * @returns {Promise<void>}
   */
  @require_editable
  async begin_edit (node) {
    node = node || this.get_selected_node()
    if (!node) return
    this.select_node(node)
    return this.view.edit_node_begin(node)
  }

  /**
   * 结束一个节点的编辑状态
   * @param cancel {Boolean} 取消操作（默认为 false 即提交修改）
   * @returns {Promise<void>}
   */
  @require_editable
  async end_edit (cancel = false) {
    return this.view.edit_node_end(cancel)
  }

  /**
   * 修改一个节点的 id
   * @param oldId
   * @param newId
   */
  @require_editable
  rename_node (oldId, newId) {
    this.model.rename_node(oldId, newId)
  }

  /**
   * 修改一个节点的内容
   * @param node {JsMindNode} 节点ID
   * @param topic {String} 新的节点内容
   * @returns {Promise<void>}
   */
  @require_editable
  async update_node (node, topic) {
    // if (!topic || !topic.trim()) throw new Error('topic can not be empty')
    if (!topic || !topic.trim()) topic = '<未命名>'
    if (node.topic === topic) {
      // 没有修改
      await this.view.update_node(node)
    } else {
      // 有修改
      node.topic = topic
      await this.view.update_node(node)
      this.view.show(false)
      this.invoke_event_handle(EVENT_TYPE.edit, {evt: 'update_node', data: [node]})
    }
  }

  /**
   * 根据输入值生成并添加一个节点
   * @param parentNode {JsMindNode} 父节点的 ID
   * @param nodeId {Number|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data {*}
   * @returns {Promise<JsMindNode>} 范围添加成功后的节点，操作失败返回 null
   */
  @require_editable
  async add_node (parentNode, nodeId, topic, data = null) {
    let node = this.model.add_node(parentNode, nodeId, topic, data)
    await this.view.add_node(node)
    this.view.show(false)
    this.expand_node(parentNode)
    this.invoke_event_handle(EVENT_TYPE.edit, {evt: 'add_node', data: [node]})
    return node
  }

  /**
   * 在指定的节点之前插入一个兄弟节点
   * @param nextNode {JsMindNode} 参照节点或其ID
   * @param nodeId {Number|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data
   * @returns {Promise<JsMindNode>}
   */
  @require_editable
  async insert_node_before (nextNode, nodeId, topic, data) {
    const node = this.model.insert_node_before(nextNode, nodeId, topic, data)
    await this.view.add_node(node)
    await this.view.show(false)
    this.invoke_event_handle(EVENT_TYPE.edit, {
      evt: 'insert_node_before',
      data: [node, nextNode]
    })
    return node
  }

  /**
   * 在指定的节点之后插入一个兄弟节点
   * 手段是插入一个 0.5 下标的元素，然后通过 add_node 的 _reindex 整理顺序
   * @param prevNode {JsMindNode} 参照节点或其ID
   * @param nodeId nodeId {Number|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data
   * @returns {Promise<JsMindNode>}
   */
  @require_editable
  async insert_node_after (prevNode, nodeId, topic, data) {
    const node = this.model.insert_node_after(prevNode, nodeId, topic, data)
    await this.view.add_node(node)
    this.invoke_event_handle(EVENT_TYPE.edit, {
      evt: 'insert_node_after',
      data: [node, prevNode]
    })
    return node
  }

  /**
   * 移除一个指定的节点
   * @param node {JsMindNode} 待移除节点或者 ID
   * @returns {Promise<Boolean>}
   */
  @require_editable
  async remove_node (node) {
    if (node.is_root()) return false
    // 选中的节点被级联删除了，应该调整焦点到（优先级：下一个兄弟/前一个兄弟/父节点）
    // 这个要先处理完再从逻辑层删除，否则会炸
    const selectedNode = this.get_selected_node()
    if (node.is_ancestor_of(selectedNode)) {
      const parent = node.parent
      const index = parent.children.indexOf(node)
      if (index < parent.children.length - 1) {
        this.select_node(parent.children[index + 1])
      } else if (index > 0) {
        this.select_node(parent.children[index - 1])
      } else {
        this.select_node(parent)
      }
    }
    // 因为删除节点会导致布局突变，需要锚定 parent 的位置等布完之后恢复
    this.view.save_location(node.parent)
    // 视图层删除
    await this.view.remove_node(node)
    // 逻辑层删除
    this.model.remove_node(node)
    // 抛出被删除事件
    this.invoke_event_handle(EVENT_TYPE.edit, {evt: 'remove_node', data: [node]})
    // 重新渲染回复定位
    await this.view.show(false)
    this.view.restore_location(node.parent)
    return true
  }

  /**
   * 移动一个节点
   * @param node {JsMindNode} 待移动节点
   * @param prevNode {JsMindNode} 移动到这个节点的前面
   * @param parent {JsMindNode}
   * @param direction {Number} 如果目标位置是一级子节点，指定方向
   * @returns {Promise<void>}
   */
  @require_editable
  async move_node (node, prevNode, parent, direction) {
    node = this.model.move_node(node, prevNode, parent, direction)
    this.layout.expand_node(parent)
    await this.view.update_node(node)
    this.view.show(false)
    this.invoke_event_handle(EVENT_TYPE.edit, {
      evt: 'move_node',
      data: [node, parent, prevNode]
    })
  }

  // >>>>>>>> private methods >>>>>>>>

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



