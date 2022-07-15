import _ from 'lodash-es'

import JsMindUtil from './JsMindUtil'
import JsMindNode from './JsMindNode'
import JsMindModel from './JsMindModel'
import JsMindLayout from './JsMindLayout'
import JsMindView from './JsMindView'
import JsMindShortcut from './JsMindShortcut'

export const DIRECTION = {left: -1, center: 0, right: 1}

export const DEFAULT_OPTIONS = {
  container: void 0,        // (querySelector/id/Element) of the container
  mode: 'both',             // both or side
  editable: false,          // you can change it in your options
  theme: 'xmind',
  view: {
    hmargin: 100,           // 思维导图距容器外框的最小水平距离
    vmargin: 50,            // 思维导图距容器外框的最小垂直距离
    hspace: 20,             // 节点之间的水平间距
    vspace: 15,             // 节点之间的垂直间距
    pspace: 10,             // 节点与连接线之间的水平间距（用于容纳节点收缩/展开控制器）
    line_width: 1,          // 思维导图线条的粗细
    line_color: '#558ED5',  // 思维导图线条的颜色
    zoom: 1,
    zoom_step: 0.1,
    min_zoom: 0.5,
    max_zoom: 2,
    render_node: void 0     // functions (elNode, node) to render the node
  },
  shortcut: {
    enable: true,
    handlers: {},
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
  },
  // 插件扩展类的注册列表
  plugins: [],
  // 钩子注册表，key 为 hook_name，value 为对应该钩子的处理函数
  hooks: {}
}

export default class JsMind {
  static DIRECTION = DIRECTION

  // Subclass registration
  static util = JsMindUtil // TODO: 考虑清除引用废掉这层

  constructor (options) {
    this.options = _.defaultsDeep(options, DEFAULT_OPTIONS)

    // 初始属性
    this._initialized = false
    // 钩子注册表，key 为 hook_name，value 为对应该钩子的处理函数
    this._hooks = {}
    // 自动加载配置中的钩子处理函数
    _.forEach(this.options.hooks, (value, key) => {
      if (value instanceof Function) this.add_hook(key, value)
      else value.forEach(func => this.add_hook(key, func))
    })
    // 插件注册表
    this.plugins = {}
  }

  /**
   * 初始化 JsMind 控件
   * @returns {Promise<void>}
   */
  async init () {
    if (this._initialized) {
      throw new Error('JsMind 已经初始化，请勿重复初始化.')
    }

    // TODO: 职责引用解耦 Init layout
    this.layout = new JsMindLayout(this)

    // Init view
    this.view = new JsMindView(this)
    this.view.init()

    // Init shortcut
    this.shortcut = new JsMindShortcut(this, this.options.shortcut)

    // 注册所有 options.plugins 里面的插件
    await this._init_plugins()

    // 标记已初始化
    this._initialized = true
  }

  /**
   * 设置一个热键的处理器
   * @param key {string} 热键的字符串，例如 'Control+KeyA'
   * @param handler {Function|string|null} 处理函数/内置处理器名称/空取值为清除
   */
  set_key_map (key, handler) {
    return this.shortcut.set_key_map(key, handler)
  }

  /**
   * 返回当前是否有注册指定的钩子
   * @param name 钩子名称
   * @returns {*|boolean}
   */
  has_hook (name) {
    return (name in this._hooks) && this._hooks[name].length > 0
  }

  /**
   * 添加一个钩子处理函数
   * @param name {String} 钩子名称
   * @param func {Function} 钩子处理函数
   */
  add_hook (name, func) {
    if (!this._hooks[name]) this._hooks[name] = []
    const hooks = this._hooks[name]
    // 避免重复加入参数
    if (hooks.indexOf(func) > -1) return
    hooks.push(func)
  }

  /**
   * 应用一个钩子函数（异步）
   * @param name {String} 钩子名称
   * @param params {Object} 钩子参数
   * @param context {Object?} 上下文对象，用于传递参数
   * @returns {Promise<void>}
   */
  async apply_hook (name, params = {}, context = null) {
    // console.log('>>> apply_hook:', name)
    await Promise.all((this._hooks[name] || []).map(func => func.apply(this, [params, context])))
  }

  /**
   * 应用一个钩子函数（同步）
   * 将会顺序执行钩子上的所有处理函数，并且忽略所有 promise 的返回
   * @param name {String} 钩子名称
   * @param params {Object} 钩子参数
   * @param context {Object?} 上下文对象，用于传递参数
   */
  apply_hook_sync (name, params = {}, context = null) {
    // console.log('>>> apply_hook_sync:', name)
    for (const func of this._hooks[name] || []) func.apply(this, [params, context])
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
    await this.init()
    this.view.reset()
    this.layout.reset()
    await this.view.init_nodes()
    this.view.show(true)
    // 初始化
    await this.apply_hook('after_render', {jm: this})
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
   * 获取当前选中的节点集合
   * @returns {JsMindNode[]}
   */
  get_selected_nodes () {
    return this.model.selected_nodes
  }

  /**
   * 获取当前选中的节点
   * @returns {JsMindNode}
   */
  get_selected_node () {
    return this.model.selected_node
  }

  /**
   * 判断一个节点是否被选中
   * @param node {JsMindNode}
   * @returns {boolean}
   */
  is_node_selected (node) {
    return this.model.selected_nodes.includes(node)
  }

  /**
   * 批量选中节点
   * TODO: 交集部分的 UI 响应其实是多余的，可以考虑优化掉
   * @param nodes {JsMindNode[]}
   * @param focus {Boolean} 是否定位节点（最后一个），移动到屏幕显示区域中
   * @returns {Promise<void>}
   */
  async select_nodes (nodes, focus = false) {
    const idOld = {}
    const idNew = {}
    this.model.selected_nodes.forEach(node => {
      idOld[node.id] = true
    })
    nodes.forEach(node => {
      idNew[node.id] = true
      if (!(node.id in idOld)) node.select()
    })
    this.model.selected_nodes.forEach(node => {
      if (!(node.id in idNew)) node.deselect()
    })
    // 插入选择
    this.model.selected_nodes.splice(0, this.model.selected_nodes.length, ...nodes)
    // 如果要聚焦，那就焦点定位到最后一个
    if (focus) nodes[nodes.length - 1].scroll_into_view({
      block: 'nearest', inline: 'nearest'
    })
    // HOOK: 选中节点事件
    await this.apply_hook('select_changed', {nodes: this.get_selected_nodes()})
  }

  /**
   * 触发选中某个节点（兼容旧的调用）
   * @param node {JsMindNode} 待选中的节点
   * @param focus {Boolean} 是否定位节点，移动到屏幕显示区域中
   * @returns {Promise<void>}
   */
  async select_node (node, focus = true) {
    return node ? this.select_nodes([node], focus) : this.select_clear()
  }

  /**
   * 取消一个节点的选中（从选中集合中移除）
   * @param node {JsMindNode} 待选中的节点
   * @returns {Promise<void>}
   */
  async deselect_node (node) {
    return this.toggle_select_node(node, false)
  }

  /**
   * 切换一个节点的选中状态（原来没有选中的话加入选中，原来有选中的话取消选中）
   * @param node {JsMindNode} 待选中的节点
   * @param value {Boolean?} 如果指定为 true/false，则指定选中或者剔除选中
   * @returns {Promise<void>}
   */
  async toggle_select_node (node, value) {
    const oldValue = this.get_selected_nodes().includes(node)
    value = value === void 0 ? !oldValue : !!value
    if (value && !oldValue) {
      // 原来没选中，现在要选上
      node.select()
      this.model.selected_nodes.push(node)
    } else if (!value && oldValue) {
      // 原来有选中，现在要反选
      node.deselect()
      const index = this.model.selected_nodes.indexOf(node)
      this.model.selected_nodes.splice(index, 1)
    } else {
      // 没有变化的话什么也不做
      return
    }
    // 选择钩子
    await this.apply_hook('select_changed', {nodes: this.get_selected_nodes()})
  }

  /**
   * 触发清除选中
   * @returns {Promise<void>}
   */
  async select_clear () {
    // 原本没有的话，就直接不需要任何的处理了
    if (this.model.selected_nodes.length === 0) return
    // 清理所有原有的 node 选中样式
    for (const node of this.model.selected_nodes) node.deselect()
    // 逻辑清除选中节点
    this.model.selected_node = null
    // HOOK: 选择钩子
    await this.apply_hook('select_changed', {nodes: this.get_selected_nodes()})
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
    return this.set_zoom(this.options.view.zoom + this.options.view.zoom_step)
  }

  /**
   * 缩小一档
   * @returns {Boolean} 返回是否设置成功（超限返回 false）
   */
  zoom_out () {
    return this.set_zoom(this.options.view.zoom - this.options.view.zoom_step)
  }

  /**
   * 重新创建一个 node 的元素 * 会清除 view 对应的 DOM 并重新生成，渲染视图
   * 一般用于 node 数据被修改的情况下
   * @param node {JsMindNode}
   * @returns {Promise<void>}
   */
  async refresh_node (node) {
    await this.view.refresh_node(node)
    this.view.show(false)
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
    let depth = 0
    const direction = node.direction
    let nxt = null
    while (!node.is_root()) {
      let siblings = node.parent.children
      // 如果是一级节点，而且是两侧布局的话，过滤一下
      if (node.parent.is_root() && this.options.mode === 'both') {
        siblings = siblings.filter(x => x.direction === direction)
      }
      // 找同级别下一个，找到就匹配上
      const index = siblings.indexOf(node)
      if (index > 0) {
        nxt = siblings[index - 1]
        break
      }
      // 找不到的话，上溯一级
      depth += 1
      node = node.parent
    }
    // 没有匹配到的话，那就是已经最后一个了
    if (!nxt) return null
    // 曾经有上溯过的话，要拉回来
    while (depth > 0 && nxt.children.length > 0) {
      depth -= 1
      nxt = nxt.children[nxt.children.length - 1]
    }
    return nxt
  }

  /**
   * 返回指定节点的下一个节点（注意会穿越层级，也就是按↓键对应的节点）
   * @param node {JsMindNode}
   * @returns {JsMindNode}
   */
  find_node_after (node) {
    let depth = 0
    const direction = node.direction
    let nxt = null
    while (!node.is_root()) {
      let siblings = node.parent.children
      // 如果是一级节点，而且是两侧布局的话，过滤一下
      if (node.parent.is_root() && this.options.mode === 'both') {
        siblings = siblings.filter(x => x.direction === direction)
      }
      // 找同级别下一个，找到就匹配上
      const index = siblings.indexOf(node)
      if (index !== siblings.length - 1) {
        nxt = siblings[index + 1]
        break
      }
      // 找不到的话，上溯一级
      depth += 1
      node = node.parent
    }
    // 没有匹配到的话，那就是已经最后一个了
    if (!nxt) return null
    // 曾经有上溯过的话，要拉回来
    while (depth > 0 && nxt.children.length > 0) {
      depth -= 1
      nxt = nxt.children[0]
    }
    return nxt
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
  async begin_edit (node) {
    if (!this.can_edit()) return
    node = node || this.get_selected_node()
    if (!node) return
    await this.select_node(node)
    return this.view.edit_node_begin(node)
  }

  /**
   * 结束一个节点的编辑状态
   * @param cancel {Boolean} 取消操作（默认为 false 即提交修改）
   * @returns {Promise<void>}
   */
  async end_edit (cancel = false) {
    return this.view.edit_node_end(cancel)
  }

  /**
   * 修改一个节点的 id
   * @param oldId
   * @param newId
   */
  rename_node (oldId, newId) {
    if (!this.can_edit() || oldId === newId) return
    this.model.rename_node(oldId, newId)
  }

  /**
   * 修改一个节点的内容
   * @param node {JsMindNode} 节点ID
   * @param topic {String} 新的节点内容
   * @returns {Promise<void>}
   */
  async update_node (node, topic) {
    // if (!topic || !topic.trim()) throw new Error('topic can not be empty')
    if (!this.can_edit()) return
    if (!topic || !topic.trim()) topic = '<未命名>'
    if (node.topic === topic) {
      // 没有修改
      await this.view.update_node(node)
    } else {
      // HOOK: 更新节点前置钩子
      const context = {}
      await this.apply_hook('before_update_node', {node, topic}, context)
      // 有修改
      node.topic = topic
      await this.view.update_node(node)
      this.view.show(false)
      // HOOK: 更新节点后置钩子
      await this.apply_hook('after_update_node', {node}, context)
    }
  }

  /**
   * 根据输入值生成并添加一个节点
   * @param parentNode {JsMindNode} 父节点的 ID
   * @param nodeId {Number|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data {*}
   * @param index {Number} 插入的节点序号（插入后的目标序号），默认 -1 加到最后
   * @returns {Promise<JsMindNode|null>} 范围添加成功后的节点，操作失败返回 null
   */
  async add_node (parentNode, nodeId, topic, data = null, index = -1) {
    if (!this.can_edit()) return null
    // HOOK: 新增节点前置钩子
    const context = {}
    await this.apply_hook('before_add_node', {
      parent: parentNode, nodeId, topic, index
    }, context)
    const node = this.model.add_node(parentNode, nodeId, topic, data, index >= 0 ? index - 0.5 : -1)
    await this.view.add_node(node)
    // HOOK: 新增节点后置钩子，允许在钩子中修改 node 的值
    await this.apply_hook('process_add_node', {node}, context)
    // 需要刷新视图才能正常显示
    this.expand_node(parentNode)
    await this.refresh_node(node)
    // HOOK: 新增并渲染完成之后执行
    await this.apply_hook('after_add_node', {node}, context)
    return node
  }

  /**
   * 在指定的节点之前插入一个兄弟节点
   * @param nextNode {JsMindNode} 参照节点或其ID
   * @param nodeId {Number|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data
   * @returns {Promise<JsMindNode|null>}
   */
  async insert_node_before (nextNode, nodeId, topic, data) {
    return this.add_node(nextNode.parent, nodeId, topic, data, nextNode.index)
  }

  /**
   * 在指定的节点之后插入一个兄弟节点
   * 手段是插入一个 0.5 下标的元素，然后通过 add_node 的 _reindex 整理顺序
   * @param prevNode {JsMindNode} 参照节点或其ID
   * @param nodeId nodeId {Number|String} 加入节点的 ID
   * @param topic {String} 节点标题
   * @param data
   * @returns {Promise<JsMindNode|null>}
   */
  async insert_node_after (prevNode, nodeId, topic, data = null) {
    return this.add_node(prevNode.parent, nodeId, topic, data, prevNode.index + 1)
  }

  /**
   * 移除一个指定的节点
   * @param node {JsMindNode} 待移除节点
   * @returns {Promise<Boolean>}
   */
  async remove_node (node) {
    if (!this.can_edit()) return false
    if (node.is_root()) return false
    // HOOK: 删除节点前置钩子
    const context = {}
    await this.apply_hook('before_remove_node', {nodes: [node]}, context)
    // 选中的节点被级联删除了，应该调整焦点到（优先级：下一个兄弟/前一个兄弟/父节点）
    // 这个要先处理完再从逻辑层删除，否则会炸
    const selectedNode = this.get_selected_node()
    if (node.is_ancestor_of(selectedNode)) {
      const parent = node.parent
      const index = parent.children.indexOf(node)
      if (index < parent.children.length - 1) {
        await this.select_node(parent.children[index + 1])
      } else if (index > 0) {
        await this.select_node(parent.children[index - 1])
      } else {
        await this.select_node(parent)
      }
    }
    // 因为删除节点会导致布局突变，需要锚定 parent 的位置等布完之后恢复
    this.view.save_location(node.parent)
    // 视图层删除
    await this.view.remove_node(node)
    // 逻辑层删除
    this.model.remove_node(node)
    // 重新渲染回复定位
    await this.view.show(false)
    this.view.restore_location(node.parent)
    // HOOK: 删除节点后置钩子
    await this.apply_hook('after_remove_node', {nodes: [node]}, context)
    return true
  }

  /**
   * 批量移除指定的节点
   * @param nodes {JsMindNode[]} 待移除节点列表
   * @returns {Promise<Boolean>}
   */
  async remove_nodes (nodes) {
    if (!this.can_edit()) return false
    // 这里多选的情况下会产生一些冲突，例如一个节点和他的子节点都被选中，
    // 同时删除，结果子节点删除的时候被级联干掉了，会导致失败
    // 更好的处理应该事先逻辑剔除一些被覆盖的子节点再执行
    const nodesToDelete = []
    const nodeMap = {}
    // 将待删除的节点列表全部标记在集合中
    for (const node of nodes) nodeMap[node.id] = true
    // 然后每个节点上溯路径上，如果有被标记过的，则不删除
    for (const node of nodes) {
      if (node.is_root()) continue
      let nd = node
      while (!nd.parent.is_root() && !(nd.parent.id in nodeMap)) nd = nd.parent
      if (nd.parent.is_root()) nodesToDelete.push(node)
    }
    // 没有要删的就直接退出
    if (nodesToDelete.length === 0) return false
    // 如果单个删除，走回单个删除的路径
    if (nodesToDelete.length === 1) return this.remove_node(nodesToDelete[0])
    // 因为删除节点会导致布局突变，需要锚定 parent 的位置等布完之后恢复
    const parent = nodesToDelete[0].parent
    // HOOK: 删除节点（批量）前置钩子
    const context = {}
    await this.apply_hook('before_remove_node', {nodes}, context)
    this.view.save_location(parent)
    // 执行删除
    await Promise.all(nodesToDelete.map(async node => {
      if (node.is_root()) return
      // 视图层删除
      await this.view.remove_node(node)
      // 逻辑层删除
      this.model.remove_node(node)
    }))
    // 重新渲染回复定位
    await this.view.show(false)
    this.view.restore_location(parent)
    // HOOK: 删除节点（批量）后置钩子
    await this.apply_hook('after_remove_node', {nodes: nodesToDelete}, context)
    return true
  }

  /**
   * 移动一个节点
   * @param node {JsMindNode} 待移动节点
   * @param nextNode {JsMindNode} 移动到这个节点的前面，缺省为移动到最后
   * @param parent {JsMindNode} 目标位置的父节点
   * @param direction {Number} 如果目标位置是一级子节点，指定方向
   * @returns {Promise<void>}
   */
  async move_node (node, nextNode, parent, direction) {
    if (!this.can_edit()) return
    // 移动节点前置钩子
    const context = {}
    const targetIndex = parent.children.indexOf(nextNode)
    await this.apply_hook('before_move_node', {
      node, parent, index: targetIndex === -1 ? parent.children.length : targetIndex
    }, context)
    if (!this.model.move_node(node, nextNode, parent, direction)) return
    this.layout.expand_node(parent)
    await this.view.update_node(node)
    this.view.show(false)
    // 后置钩子
    await this.apply_hook('after_move_node', {node}, context)
  }

  // >>>>>>>> private methods >>>>>>>>

  /**
   * 初始化插件
   * @returns {Promise<void>}
   * @private
   */
  async _init_plugins () {
    await Promise.all(this.options.plugins.map(async pluginClass => {
      // 不重复实例化
      if (pluginClass.plugin_name in this.plugins) return
      const plugin = new pluginClass(this)
      this.plugins[pluginClass.plugin_name] = plugin
      await plugin.init()
    }))
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

}
