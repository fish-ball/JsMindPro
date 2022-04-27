import _ from 'lodash-es'
import JsMindUtil from './JsMindUtil'
import {EVENT_TYPE} from './JsMind'

///////// Shortcut Functions /////////

export default class JsMindView {
  constructor (jm, options) {
    this.options = Object.assign({
      container: null,
      hmargin: 100,
      vmargin: 50,
      line_width: 2,
      line_color: '#555555',
      zoom: 1,
      zoom_step: 0.1,
      min_zoom: 0.5,
      max_zoom: 2
    }, options)

    /** @type JsMind */
    this.jm = jm
    /** * @type HTMLElement */
    this.container = null
    /** * @type HTMLElement */
    this.e_panel = null
    /** * @type HTMLElement */
    this.e_nodes = null
    /** * @type HTMLCanvasElement */
    this.e_canvas = null
    /** * @type CanvasRenderingContext2D */
    this.canvas_ctx = null

    this.size = {w: 0, h: 0}

    /**
     * 当前正在编辑的节点
     * @type {JsMindNode}
     * @private
     */
    this._editing_node = null
  }

  /**
   * 初始化一个 view
   */
  init () {
    // https://stackoverflow.com/a/36894871/2544762
    this.container = this.options.container instanceof Element ? this.options.container :
      document.querySelector(this.options.container) || document.getElementById(this.options.container)
    if (!this.container) throw new Error('the options.view.container was not be found in dom')

    // 初始化画布
    this.e_canvas = document.createElement('canvas')
    this.canvas_ctx = this.e_canvas.getContext('2d')

    // 初始化节点容器
    this.e_nodes = document.createElement('div')
    this.e_nodes.className = 'jmnodes'

    // panel 面板容器
    this.e_panel = document.createElement('div')
    this.e_panel.className = 'jsmind-inner'
    this.e_panel.tabIndex = 0
    this.e_panel.appendChild(this.e_canvas)
    this.e_panel.appendChild(this.e_nodes)
    this.container.appendChild(this.e_panel)

    // 编辑框控件，默认不挂载到 DOM，进入编辑模式的时候才挂载
    this.e_editor = document.createElement('textarea')
    this.e_editor.className = 'jsmind-editor'
    this.e_editor.wrap = 'hard'
    // 根据内容自适应宽度
    this.e_editor.addEventListener('input', e => {
      // 用 canvas 计算实际编辑框宽度 https://stackoverflow.com/a/58705306/2544762
      if (!this._editing_node) return
      const element = this._editing_node.meta.view.element
      element.style.overflow = 'visible'
      const elMeasure = element.cloneNode(false)
      elMeasure.style.left = '0'
      elMeasure.style.top = '0'
      elMeasure.style.whitespace = 'pre'
      let measureText = this.e_editor.value
      if (!measureText || measureText.endsWith('\n')) measureText += ' '
      elMeasure.innerText = measureText
      elMeasure.visibility = 'none'
      element.parentNode.appendChild(elMeasure)
      const style = getComputedStyle(elMeasure)
      this.e_editor.style.padding = style.padding
      this.e_editor.style.width = `${elMeasure.clientWidth + 4}px`
      this.e_editor.style.height = `${elMeasure.clientHeight}px`
      elMeasure.parentNode.removeChild(elMeasure)
      e.stopPropagation()
    })

    // 结束标记的事件，TODO: 为啥要写在这种地方？
    JsMindUtil.dom.add_event(this.e_editor, 'keydown', async e => {
      e.stopPropagation()
      const node = this._editing_node
      if (/^Enter|Tab$/.test(e.key)) {
        if (e.ctrlKey || e.altKey) {
          const start = e.target.selectionStart
          const end = e.target.selectionEnd
          e.target.value = e.target.value.substr(0, start) + '\n' + e.target.value.substr(end)
          e.target.setSelectionRange(start + 1, start + 1)
          e.target.dispatchEvent(new Event('input'))
        } else {
          e.preventDefault()
          await this.edit_node_end()
          this.jm.select_node(node)
        }
      } else if (e.key === 'Escape') {
        await this.edit_node_end(true)
        // 编辑完成重新获得焦点
        this.jm.select_node(node)
      }
    })

    // 编辑框失去焦点处理：保存并结束编辑
    JsMindUtil.dom.add_event(this.e_editor, 'blur', async e => {
      await this.edit_node_end()
    })

    // 绑定 view 上面的事件
    this._event_bind()
  }

  /**
   * 在某个对象上调用添加某个事件的处理器
   * @param obj
   * @param eventName {String}
   * @param handler {Function}
   */
  add_event (obj, eventName, handler) {
    JsMindUtil.dom.add_event(this.e_nodes, eventName, function (e) {
      handler.call(obj, e)
    })
  }

  /**
   * 获取当前元素绑定的节点 nodeId，可以冒泡寻找父节点
   * @param element {HTMLElement}
   * @returns {JsMindNode}
   */
  get_node_by_element (element) {
    const el = element.closest('.jmnode,.jmexpander')
    if (!el) return null
    const nodeId = element.getAttribute('nodeid')
    return this.jm.get_node(/^\d+$/.test(nodeId) ? Number(nodeId) : nodeId)
  }

  /**
   * 返回视图是否处于正在编辑的状态
   * @returns {boolean}
   */
  is_editing () {
    return !!this._editing_node
  }

  /**
   * 重置一个 View
   */
  reset () {
    this._clear_lines()
    this._clear_nodes()
    this.reset_theme()
  }

  /**
   * 重设主题标记
   */
  reset_theme () {
    let themeName = this.jm.options.theme
    const themeClass = _.find(this.e_nodes.classList, x => /^theme-/.test(x))
    if (themeClass !== 'theme-' + themeName) {
      this.e_nodes.classList.remove(themeClass)
      this.e_nodes.classList.add('theme-' + themeName)
    }
  }

  /**
   * 展开到画布大小显示范围（缩放至显示全部）
   */
  expand_size () {
    let minSize = this.jm.layout.get_min_size()
    let minWidth = minSize.w + this.options.hmargin * 2
    let minHeight = minSize.h + this.options.vmargin * 2
    this.size.w = Math.max(this.e_panel.clientWidth, minWidth)
    this.size.h = Math.max(this.e_panel.clientHeight, minHeight)
  }

  /**
   * 添加一个 node
   * @param node {JsMindNode}
   * @returns {Promise<void>}
   */
  async add_node (node) {
    await node.create_element(this.e_nodes, this)
    node.init_size()
  }

  /**
   * 视图上删除一个节点
   * @param node {JsMindNode}
   * @returns {Promise<void>}
   */
  async remove_node (node) {
    // 正在编辑的话，关一下
    if (this._editing_node) await this.edit_node_end()
    // 后序遍历，先递归删除所有子节点
    await Promise.all(node.children.map(child => this.remove_node(child)))
    // 再销毁自身
    node.destroy()
  }

  /**
   * !! IMPORTANT !! 单节点渲染处理
   * 更新一个节点的显示
   * @param node {JsMindNode}
   * @returns {Promise<void>}
   */
  async update_node (node) {
    const view = node.meta.view
    let elNode = view.element
    if ('render_node' in this.options && this.options.render_node instanceof Function) {
      // 注意在 render_node 实现里面，需要把原来的 el attributes 回填进去
      elNode = await this.options.render_node(elNode, node)
      node.meta.view.element = elNode
    } else {
      elNode.innerText = node.topic
    }
    node.init_size()
  }

  /**
   * 触发开始编辑
   * @param node {JsMindNode}
   * @returns {Promise<void>}
   */
  async edit_node_begin (node) {
    // 如果正在编辑另一个，先结束编辑
    if (this._editing_node) await this.edit_node_end()
    this._editing_node = node
    let element = node.meta.view.element
    this.e_editor.value = node.topic
    this.e_editor.dispatchEvent(new Event('input'))
    // element.innerHTML = ''
    element.appendChild(this.e_editor)
    element.style.zIndex = 5
    this.e_editor.focus()
    this.e_editor.select()
  }

  /**
   * 触发节点编辑完成的
   * @param cancel {Boolean} 取消操作
   * @returns {Promise<void>}
   */
  async edit_node_end (cancel = false) {
    // 如果不是正在编辑，退出
    if (!this._editing_node) return
    // 逻辑切换编辑状态
    let node = this._editing_node
    this._editing_node = null
    // 还原 element 的显示
    let element = node.meta.view.element
    let topic = this.e_editor.value
    element.style.zIndex = 'auto'
    element.removeChild(this.e_editor)
    this.e_panel.focus()
    // 正式保存
    if (cancel || !topic) {
      await this.jm.update_node(node, node.topic)
    } else {
      await this.jm.update_node(node, topic)
    }
    // 选中这个节点
    this.jm.select_node(node)
  }

  /**
   * 获取当前视图的偏移量
   * @returns {{x: number, y: number}}
   */
  get_view_offset () {
    let bounds = this.jm.layout.bounds
    const x = (this.size.w - bounds.e - bounds.w) / 2
    const y = this.size.h / 2
    return {x, y}
  }

  /**
   * 执行一次重新调整大小
   */
  resize () {
    this.e_canvas.width = 1
    this.e_canvas.height = 1
    this.e_nodes.style.width = '1px'
    this.e_nodes.style.height = '1px'
    this.expand_size()
    this._show()
  }

  /**
   * 缩放到指定倍数
   * @param zoom {Number} 缩放倍数值
   * @returns {boolean} 返回是否设置成功（超限会返回 false）
   */
  set_zoom (zoom = 1) {
    if ((zoom < this.options.min_zoom) || (zoom > this.options.max_zoom)) return false
    this.options.zoom = zoom
    for (let i = 0; i < this.e_panel.children.length; i++) {
      this.e_panel.children[i].style.transform = 'scale(' + zoom + ')'
    }
    this.show(true)
    return true
  }

  /**
   * 渲染视图
   * @param keepCenter {Boolean} 是否定位到中心
   */
  show (keepCenter) {
    this.jm.layout.layout()
    this.expand_size()
    this._show()
    if (keepCenter) this._center_root()
  }

  /**
   * 重设布局
   */
  relayout () {
    this.expand_size()
    this._show()
  }

  /**
   * 保存当前的滚动位置
   * @param node
   */
  save_location (node) {
    const view = node.meta.view
    view.save_location(parseInt(view.element.style.left) - this.e_panel.scrollLeft, parseInt(view.element.style.top) - this.e_panel.scrollTop)
  }

  /**
   * 恢复当前的滚动位置
   * @param node
   */
  restore_location (node) {
    const view = node.meta.view
    const {x, y} = view.restore_location()
    this.e_panel.scrollLeft = parseInt(view.element.style.left) - x
    this.e_panel.scrollTop = parseInt(view.element.style.top) - y
  }

  /**
   * 初始化节点
   * @returns {Promise<void>}
   */
  async init_nodes () {
    const nodes = this.jm.model.nodes
    await Promise.all(_.map(nodes, node => node.create_element(this.e_nodes, this)))
    // _.forEach(nodes, node => node.init_size())
  }

  /**
   * 重新创建一个 node 的元素 * 会清除 view 对应的 DOM 并重新生成，渲染视图
   * 一般用于 node 数据被修改的情况下
   * @param node {JsMindNode}
   * @returns {Promise<void>}
   */
  async refresh_node (node) {
    node.destroy()
    await node.create_element(this.e_nodes, this)
    node.init_size()
  }

  //////// PRIVATE METHODS ////////

  /**
   * 绑定思维导图的主要事件（鼠标按下、点击、双击）
   * @private
   */
  _event_bind () {
    this.add_event(this, 'mousedown', this._mousedown_handle)
    this.add_event(this, 'click', this._click_handle)
    this.add_event(this, 'dblclick', this._dblclick_handle)
  }

  /**
   * 处理鼠标按下事件
   * @param e {Event}
   */
  _mousedown_handle (e) {
    if (!this.jm.options.default_event_handle['enable_mousedown_handle']) return
    this.jm.select_node(this.get_node_by_element(e.target))
  }

  /**
   * 点击事件处理器
   * @param e {Event}
   */
  _click_handle (e) {
    if (!this.jm.options.default_event_handle['enable_click_handle']) return
    // 仅处理展开器
    if (!e.target.classList.contains('jmexpander')) return
    this.jm.toggle_node(this.get_node_by_element(e.target))
  }

  /**
   * 双击事件处理器
   * @param e {Event}
   * @returns {Promise<void>}
   * @private
   */
  async _dblclick_handle (e) {
    if (!this.jm.options.default_event_handle['enable_dblclick_handle']) return
    return this.jm.begin_edit(this.get_node_by_element(e.target))
  }

  /**
   * 定位到中心
   * @private
   */
  _center_root () {
    // center root node
    let outerW = this.e_panel.offsetWidth
    let outerH = this.e_panel.offsetHeight
    if (this.size.w > outerW) {
      const offset = this.get_view_offset()
      this.e_panel.scrollLeft = offset.x - outerW / 2
    }
    if (this.size.h > outerH) {
      this.e_panel.scrollTop = (this.size.h - outerH) / 2
    }
  }

  /**
   * 清除画布上的所有线条
   * @param canvasContext
   * @private
   */
  _clear_lines (canvasContext) {
    let ctx = canvasContext || this.canvas_ctx
    ctx.clearRect(0, 0, this.size.w, this.size.h)
  }

  /**
   * 画一条连接线
   * @param pin {{x,y}} 入点坐标
   * @param pout {{x,y}} 出点坐标
   * @param offset {{x,y}} 偏移量
   * @param canvasCtx Canvas 对象
   * @private
   */
  _draw_line (pin, pout, offset, canvasCtx) {
    let ctx = canvasCtx || this.canvas_ctx
    ctx.strokeStyle = this.options.line_color
    ctx.lineWidth = this.options.line_width
    ctx.lineCap = 'round'

    JsMindUtil.canvas.bezierto(ctx, pin.x + offset.x, pin.y + offset.y, pout.x + offset.x, pout.y + offset.y)
  }

  /**
   * 绘制画布上的所有线条
   * @param canvasContext
   * @private
   */
  _show_lines (canvasContext) {
    this._clear_lines(canvasContext)
    let _offset = this.get_view_offset()
    Object.keys(this.jm.model.nodes).forEach(key => {
      const node = this.jm.model.nodes[key]
      // 根节点没有线
      if (node.is_root()) return
      // 隐藏的节点没有线
      if (('visible' in node.meta.layout) && !node.meta.layout.visible) return
      // 获取布局的入点坐标
      const pin = this.jm.layout.get_node_point_in(node)
      // 获取父节点布局的出点坐标
      const pout = this.jm.layout.get_node_point_out(node.parent)
      // 画线
      this._draw_line(pout, pin, _offset, canvasContext)
    })
  }

  /**
   * 清理所有的 dom 节点
   */
  _clear_nodes () {
    if (!this.jm.model) return
    _.forEach(this.jm.model.nodes, node => {
      node.destroy()
    })
  }

  /**
   * !! IMPORTANT !! 渲染所有节点
   * 主要的渲染同步逻辑在这里
   * @private
   */
  _show_nodes () {
    let p = null
    let expanderPoint = null
    let expanderText = '-'
    let offset = this.get_view_offset()
    _.forEach(this.jm.model.nodes, node => {
      const view = node.meta.view
      const elNode = view.element
      const elExpander = view.expander
      // 不可见的话隐藏，完事
      if (!node.is_visible()) {
        elNode.style.display = 'none'
        elExpander.style.display = 'none'
        return
      }
      // 计算坐标点并渲染到 DOM
      p = this.jm.layout.get_node_point(node)
      view.abs_x = offset.x + p.x
      view.abs_y = offset.y + p.y
      elNode.style.left = (offset.x + p.x) + 'px'
      elNode.style.top = (offset.y + p.y) + 'px'
      elNode.style.display = ''
      elNode.style.visibility = 'visible'
      if (!node.is_root() && node.children.length > 0) {
        expanderText = node.expanded ? '-' : '+'
        expanderPoint = this.jm.layout.get_expander_point(node)
        elExpander.style.left = (offset.x + expanderPoint.x) + 'px'
        elExpander.style.top = (offset.y + expanderPoint.y) + 'px'
        elExpander.style.display = ''
        elExpander.style.visibility = 'visible'
        elExpander.innerText = expanderText
      }
      // hide expander while all children have been removed
      if (!node.is_root() && node.children.length === 0) {
        elExpander.style.display = 'none'
        elExpander.style.visibility = 'hidden'
      }
      // set select class display
      if (node === this.jm.get_selected_node()) {
        node.select()
      }
    })
  }

  /**
   * 执行一次渲染
   * @private
   */
  _show () {
    this.e_canvas.width = this.size.w
    this.e_canvas.height = this.size.h
    this.e_nodes.style.width = this.size.w + 'px'
    this.e_nodes.style.height = this.size.h + 'px'
    this._show_nodes()
    this._show_lines()
    this.jm.invoke_event_handle(EVENT_TYPE.resize, {data: []})
  }

}
