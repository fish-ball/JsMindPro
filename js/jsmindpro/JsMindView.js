import 'jsmind'
import JsMind from './JsMind'
import JsMindUtil from './JsMindUtil'
import JsMindNodeView from './JsMindNodeView'

const logger = console

///////// Shortcut Functions /////////

let $t = function (n, t) {
  if (n.hasChildNodes()) {
    n.firstChild.nodeValue = t
  } else {
    n.appendChild(document.createTextNode(t))
  }
}

export default class JsMindView {
  constructor (jm, options) {
    this.opts = options
    /** @type JsMind */
    this.jm = jm

    this.container = null
    this.e_panel = null
    this.e_nodes = null
    this.e_canvas = null

    this.canvas_ctx = null
    this.size = {w: 0, h: 0}

    this.selected_node = null
    this.editing_node = null
  }

  /**
   * 初始化一个 view
   */
  init () {
    // https://stackoverflow.com/a/36894871/2544762
    this.container = (this.opts.container instanceof Element ||
      this.opts.container instanceof HTMLDocument) ? this.opts.container
      : document.getElementById(this.opts.container)
    if (!this.container) throw new Error('the options.view.container was not be found in dom')

    this.e_panel = document.createElement('div')
    this.e_canvas = document.createElement('canvas')
    this.e_nodes = document.createElement('jmnodes')
    this.e_editor = document.createElement('input')

    this.e_panel.className = 'jsmind-inner'
    this.e_panel.appendChild(this.e_canvas)
    this.e_panel.appendChild(this.e_nodes)

    this.e_editor.className = 'jsmind-editor'
    this.e_editor.type = 'text'

    this.actualZoom = 1
    this.zoomStep = 0.1
    this.minZoom = 0.5
    this.maxZoom = 2

    let v = this
    // 结束标记的事件，TODO: 为啥要写在这种地方？
    JsMindUtil.dom.add_event(this.e_editor, 'keydown', function (e) {
      let evt = e || event
      if (evt.keyCode === 13) {
        v.edit_node_end()
        evt.stopPropagation()
      }
    })
    JsMindUtil.dom.add_event(this.e_editor, 'blur', function (e) {
      v.edit_node_end()
    })

    // 挂载控件
    this.container.appendChild(this.e_panel)

    // 初始化画布
    this.canvas_ctx = this.e_canvas.getContext('2d')
  }

  /**
   * 在某个对象上调用添加某个事件的处理器
   * @param obj
   * @param eventName {String}
   * @param handler {Function}
   */
  add_event (obj, eventName, handler) {
    JsMindUtil.dom.add_event(this.e_nodes, eventName, function (e) {
      let evt = e || event
      handler.call(obj, evt)
    })
  }

  /**
   * 获取当前元素绑定的节点 nodeId，可以冒泡寻找父节点
   * @param element
   * @returns {Integer|null}
   */
  get_binded_nodeid (element) {
    if (!element) return null
    let tagName = element.tagName.toLowerCase()
    if (/^jmnodes|body|html$/.test(tagName)) return null
    if (/^jmnode|jmexpander$/.test(tagName)) return Number(element.getAttribute('nodeid'))
    // 冒泡查找父标签
    return this.get_binded_nodeid(element.parentElement)
  }

  /**
   * 重置一个 View
   */
  reset () {
    this.selected_node = null
    this.clear_lines()
    this.clear_nodes()
    this.reset_theme()
  }

  /**
   * 重设主题标记
   */
  reset_theme () {
    let theme_name = this.jm.options.theme
    this.e_nodes.className = theme_name ? 'theme-' + theme_name : ''
  }

  /**
   * 重设所有节点的自定义样式
   */
  reset_custom_style () {
    Object.keys(this.jm.mind.nodes).forEach(key => {
      this.jm.mind.nodes[key].reset_custom_style()
    })
  }

  load () {
    this.init_nodes()
  }

  /**
   * 展开到画布大小显示范围（缩放至显示全部）
   */
  expand_size () {
    let minSize = this.jm.layout.get_min_size()
    let minWidth = minSize.w + this.opts.hmargin * 2
    let minHeight = minSize.h + this.opts.vmargin * 2
    this.size.w = Math.max(this.e_panel.clientWidth, minWidth)
    this.size.h = Math.max(this.e_panel.clientHeight, minHeight)
  }

  /**
   * 初始化节点
   */
  init_nodes () {
    let nodes = this.jm.mind.nodes
    let fragment = document.createDocumentFragment()
    _.forEach(nodes, node => node.createElement(fragment, this.jm))
    this.e_nodes.appendChild(fragment)
    _.forEach(nodes, node => node.init_size())
  }

  /**
   * 添加一个 node
   * @param node {JsMindNode}
   */
  add_node (node) {
    node.createElement(this.e_nodes, this.jm)
    node.init_size()
  }

  remove_node (node) {
    if (this.selected_node != null && this.selected_node.id === node.id) {
      this.selected_node = null
    }
    if (this.editing_node != null && this.editing_node.id === node.id) {
      node._data.view.element.removeChild(this.e_editor)
      this.editing_node = null
    }
    let children = node.children
    let i = children.length
    while (i--) {
      this.remove_node(children[i])
    }
    if (node._data.view) {
      const element = node._data.view.element
      const expander = node._data.view.expander
      this.e_nodes.removeChild(element)
      this.e_nodes.removeChild(expander)
      node._data.view.element = null
      node._data.view.expander = null
    }
  }

  update_node (node) {
    let view_data = node._data.view
    let element = view_data.element
    if (!!node.topic) {
      if (this.opts.support_html) {
        element.innerHTML = node.topic
      } else {
        $t(element, node.topic)
      }
    }
    view_data.width = element.clientWidth
    view_data.height = element.clientHeight
  }

  /**
   * 选择一个节点
   * @param node {JsMindNode|node}
   */
  select_node (node) {
    if (node === this.selected_node) return
    if (this.selected_node) this.selected_node.deselect()
    if (node) {
      node.select()
      this.selected_node = node
    }
  }

  /**
   * 清除选中
   */
  select_clear () {
    this.select_node(null)
  }

  get_editing_node () {
    return this.editing_node
  }

  is_editing () {
    return (!!this.editing_node)
  }

  edit_node_begin (node) {
    if (!node.topic) {
      logger.warn("don't edit image nodes")
      return
    }
    if (this.editing_node != null) {
      this.edit_node_end()
    }
    this.editing_node = node
    let view_data = node._data.view
    let element = view_data.element
    let topic = node.topic
    let ncs = getComputedStyle(element)
    this.e_editor.value = topic
    this.e_editor.style.width = (element.clientWidth - parseInt(ncs.getPropertyValue('padding-left')) - parseInt(ncs.getPropertyValue('padding-right'))) + 'px'
    element.innerHTML = ''
    element.appendChild(this.e_editor)
    element.style.zIndex = 5
    this.e_editor.focus()
    this.e_editor.select()
  }

  edit_node_end () {
    if (this.editing_node != null) {
      let node = this.editing_node
      this.editing_node = null
      let view_data = node._data.view
      let element = view_data.element
      let topic = this.e_editor.value
      element.style.zIndex = 'auto'
      element.removeChild(this.e_editor)
      if (JsMindUtil.text.is_empty(topic) || node.topic === topic) {
        if (this.opts.support_html) {
          element.innerHTML = node.topic
        } else {
          $t(element, node.topic)
        }
      } else {
        this.jm.update_node(node.id, topic)
      }
    }
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

  zoomIn () {
    return this.setZoom(this.actualZoom + this.zoomStep)
  }

  zoomOut () {
    return this.setZoom(this.actualZoom - this.zoomStep)
  }

  setZoom (zoom) {
    if ((zoom < this.minZoom) || (zoom > this.maxZoom)) {
      return false
    }
    this.actualZoom = zoom
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

  save_location (node) {
    let vd = node._data.view
    vd._saved_location = {
      x: parseInt(vd.element.style.left) - this.e_panel.scrollLeft,
      y: parseInt(vd.element.style.top) - this.e_panel.scrollTop,
    }
  }

  restore_location (node) {
    let vd = node._data.view
    this.e_panel.scrollLeft = parseInt(vd.element.style.left) - vd._saved_location.x
    this.e_panel.scrollTop = parseInt(vd.element.style.top) - vd._saved_location.y
  }

  /**
   * 清理所有的 dom 节点
   */
  clear_nodes () {
    if (!this.jm.mind) return
    this.jm.mind.nodes.forEach(node => {
      node._data.view.element = null
      node._data.view.expander = null
    })
  }

  show_nodes () {
    let p = null
    let p_expander = null
    let expander_text = '-'
    let _offset = this.get_view_offset()
    Object.keys(this.jm.mind.nodes).forEach(key => {
      const node = this.jm.mind.nodes[key]
      const viewData = node._data.view
      const nodeElement = viewData.element
      const expander = viewData.expander
      // 不可见的话隐藏，完事
      if (!this.jm.layout.is_visible(node)) {
        nodeElement.style.display = 'none'
        expander.style.display = 'none'
        return
      }
      // 重置节点的自定义样式
      node.reset_node_custom_style()
      p = this.jm.layout.get_node_point(node)
      viewData.abs_x = _offset.x + p.x
      viewData.abs_y = _offset.y + p.y
      nodeElement.style.left = (_offset.x + p.x) + 'px'
      nodeElement.style.top = (_offset.y + p.y) + 'px'
      nodeElement.style.display = ''
      nodeElement.style.visibility = 'visible'
      if (!node.isroot && node.children.length > 0) {
        expander_text = node.expanded ? '-' : '+'
        p_expander = this.jm.layout.get_expander_point(node)
        expander.style.left = (_offset.x + p_expander.x) + 'px'
        expander.style.top = (_offset.y + p_expander.y) + 'px'
        expander.style.display = ''
        expander.style.visibility = 'visible'
        $t(expander, expander_text)
      }
      // hide expander while all children have been removed
      if (!node.isroot && node.children.length === 0) {
        expander.style.display = 'none'
        expander.style.visibility = 'hidden'
      }
    })
  }

  /**
   * 清除画布上的所有线条
   * @param canvasContext
   */
  clear_lines (canvasContext) {
    let ctx = canvasContext || this.canvas_ctx
    ctx.clearRect(0, 0, this.size.w, this.size.h)
  }

  /**
   * 绘制画布上的所有线条
   * @param canvasContext
   */
  show_lines (canvasContext) {
    this.clear_lines(canvasContext)
    let _offset = this.get_view_offset()
    Object.keys(this.jm.mind.nodes).forEach(key => {
      const node = this.jm.mind.nodes[key]
      // 根节点没有线
      if (node.isroot) return
      // 隐藏的节点没有线
      if (('visible' in node._data.layout) && !node._data.layout.visible) return
      // 获取布局的入点坐标
      const pin = this.jm.layout.get_node_point_in(node)
      // 获取父节点布局的出点坐标
      const pout = this.jm.layout.get_node_point_out(node.parent)
      // 画线
      this.draw_line(pout, pin, _offset, canvasContext)
    })
  }

  draw_line (pin, pout, offset, canvas_ctx) {
    let ctx = canvas_ctx || this.canvas_ctx
    ctx.strokeStyle = this.opts.line_color
    ctx.lineWidth = this.opts.line_width
    ctx.lineCap = 'round'

    JsMindUtil.canvas.bezierto(
      ctx,
      pin.x + offset.x,
      pin.y + offset.y,
      pout.x + offset.x,
      pout.y + offset.y)
  }

  //////// PRIVATE METHODS ////////

  /**
   * 定位到中心
   * @private
   */
  _center_root () {
    // center root node
    let outerW = this.e_panel.clientWidth
    let outerH = this.e_panel.clientHeight
    if (this.size.w > outerW) {
      const offset = this.get_view_offset()
      this.e_panel.scrollLeft = offset.x - outerW / 2
    }
    if (this.size.h > outerH) {
      this.e_panel.scrollTop = (this.size.h - outerH) / 2
    }
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
    this.show_nodes()
    this.show_lines()
    this.jm.invoke_event_handle(JsMind.event_type.resize, {data: []})
  }

}
