import JsMind from './JsMind'
import JsMindUtil from './JsMindUtil'

const logger = console

// detect isElement
let $i = function (el) {
  return !!el &&
    (typeof el === 'object') &&
    (el.nodeType === 1) &&
    (typeof el.style === 'object') &&
    (typeof el.ownerDocument === 'object')
}

let $t = function (n, t) {
  if (n.hasChildNodes()) {
    n.firstChild.nodeValue = t
  } else {
    n.appendChild(document.createTextNode(t))
  }
}

// view provider
export default class JsMindViewProvider {
  constructor (jm, options) {
    this.opts = options
    this.jm = jm
    this.layout = jm.layout

    this.container = null
    this.e_panel = null
    this.e_nodes = null
    this.e_canvas = null

    this.canvas_ctx = null
    this.size = {w: 0, h: 0}

    this.selected_node = null
    this.editing_node = null
  }

  init () {
    logger.debug('view.init')

    this.container = $i(this.opts.container) ? this.opts.container : $g(this.opts.container)
    if (!this.container) {
      logger.error('the options.view.container was not be found in dom')
      return
    }
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
    JsMindUtil.dom.add_event(this.e_editor, 'keydown', function (e) {
      let evt = e || event
      if (evt.keyCode == 13) {
        v.edit_node_end()
        evt.stopPropagation()
      }
    })
    JsMindUtil.dom.add_event(this.e_editor, 'blur', function (e) {
      v.edit_node_end()
    })

    this.container.appendChild(this.e_panel)

    this.init_canvas()
  }

  add_event (obj, event_name, event_handle) {
    JsMindUtil.dom.add_event(this.e_nodes, event_name, function (e) {
      let evt = e || event
      event_handle.call(obj, evt)
    })
  }

  get_binded_nodeid (element) {
    if (element == null) {
      return null
    }
    let tagName = element.tagName.toLowerCase()
    if (tagName == 'jmnodes' || tagName == 'body' || tagName == 'html') {
      return null
    }
    if (tagName == 'jmnode' || tagName == 'jmexpander') {
      return element.getAttribute('nodeid')
    } else {
      return this.get_binded_nodeid(element.parentElement)
    }
  }

  is_expander (element) {
    return (element.tagName.toLowerCase() == 'jmexpander')
  }

  reset () {
    logger.debug('view.reset')
    this.selected_node = null
    this.clear_lines()
    this.clear_nodes()
    this.reset_theme()
  }

  reset_theme () {
    let theme_name = this.jm.options.theme
    if (!!theme_name) {
      this.e_nodes.className = 'theme-' + theme_name
    } else {
      this.e_nodes.className = ''
    }
  }

  reset_custom_style () {
    let nodes = this.jm.mind.nodes
    for (let nodeid in nodes) {
      this.reset_node_custom_style(nodes[nodeid])
    }
  }

  load () {
    logger.debug('view.load')
    this.init_nodes()
  }

  expand_size () {
    let min_size = this.layout.get_min_size()
    let min_width = min_size.w + this.opts.hmargin * 2
    let min_height = min_size.h + this.opts.vmargin * 2
    let client_w = this.e_panel.clientWidth
    let client_h = this.e_panel.clientHeight
    if (client_w < min_width) {
      client_w = min_width
    }
    if (client_h < min_height) {
      client_h = min_height
    }
    this.size.w = client_w
    this.size.h = client_h
  }

  init_canvas () {
    let ctx = this.e_canvas.getContext('2d')
    this.canvas_ctx = ctx
  }

  init_nodes_size (node) {
    let view_data = node._data.view
    view_data.width = view_data.element.clientWidth
    view_data.height = view_data.element.clientHeight
  }

  init_nodes () {
    let nodes = this.jm.mind.nodes
    let doc_frag = document.createDocumentFragment()
    for (let nodeid in nodes) {
      this.create_node_element(nodes[nodeid], doc_frag)
    }
    this.e_nodes.appendChild(doc_frag)
    for (let nodeid in nodes) {
      this.init_nodes_size(nodes[nodeid])
    }
  }

  add_node (node) {
    this.create_node_element(node, this.e_nodes)
    this.init_nodes_size(node)
  }

  create_node_element (node, parent_node) {
    let view_data = null
    if ('view' in node._data) {
      view_data = node._data.view
    } else {
      view_data = {}
      node._data.view = view_data
    }

    let d = document.createElement('jmnode')
    if (node.isroot) {
      d.className = 'root'
    } else {
      let d_e = document.createElement('jmexpander')
      $t(d_e, '-')
      d_e.setAttribute('nodeid', node.id)
      d_e.style.visibility = 'hidden'
      parent_node.appendChild(d_e)
      view_data.expander = d_e
    }
    if (!!node.topic) {
      if (this.opts.support_html) {
        d.innerHTML = node.topic
      } else {
        $t(d, node.topic)
      }
    }
    d.setAttribute('nodeid', node.id)
    d.style.visibility = 'hidden'
    this._reset_node_custom_style(d, node.data)

    parent_node.appendChild(d)
    view_data.element = d
  }

  remove_node (node) {
    if (this.selected_node != null && this.selected_node.id == node.id) {
      this.selected_node = null
    }
    if (this.editing_node != null && this.editing_node.id == node.id) {
      node._data.view.element.removeChild(this.e_editor)
      this.editing_node = null
    }
    let children = node.children
    let i = children.length
    while (i--) {
      this.remove_node(children[i])
    }
    if (node._data.view) {
      let element = node._data.view.element
      let expander = node._data.view.expander
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

  select_node (node) {
    if (!!this.selected_node) {
      this.selected_node._data.view.element.className =
        this.selected_node._data.view.element.className.replace(/\s*selected\b/i, '')
      this.reset_node_custom_style(this.selected_node)
    }
    if (!!node) {
      this.selected_node = node
      node._data.view.element.className += ' selected'
      this.clear_node_custom_style(node)
    }
  }

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

  get_view_offset () {
    let bounds = this.layout.bounds
    let _x = (this.size.w - bounds.e - bounds.w) / 2
    let _y = this.size.h / 2
    return {x: _x, y: _y}
  }

  resize () {
    this.e_canvas.width = 1
    this.e_canvas.height = 1
    this.e_nodes.style.width = '1px'
    this.e_nodes.style.height = '1px'

    this.expand_size()
    this._show()
  }

  _show () {
    this.e_canvas.width = this.size.w
    this.e_canvas.height = this.size.h
    this.e_nodes.style.width = this.size.w + 'px'
    this.e_nodes.style.height = this.size.h + 'px'
    this.show_nodes()
    this.show_lines()
    //this.layout.cache_valid = true
    this.jm.invoke_event_handle(JsMind.event_type.resize, {data: []})
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

  _center_root () {
    // center root node
    let outer_w = this.e_panel.clientWidth
    let outer_h = this.e_panel.clientHeight
    if (this.size.w > outer_w) {
      let _offset = this.get_view_offset()
      this.e_panel.scrollLeft = _offset.x - outer_w / 2
    }
    if (this.size.h > outer_h) {
      this.e_panel.scrollTop = (this.size.h - outer_h) / 2
    }
  }

  show (keep_center) {
    logger.debug('view.show')
    this.expand_size()
    this._show()
    if (!!keep_center) {
      this._center_root()
    }
  }

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

  clear_nodes () {
    let mind = this.jm.mind
    if (mind == null) {
      return
    }
    let nodes = mind.nodes
    let node = null
    for (let nodeid in nodes) {
      node = nodes[nodeid]
      node._data.view.element = null
      node._data.view.expander = null
    }
    this.e_nodes.innerHTML = ''
  }

  show_nodes () {
    let nodes = this.jm.mind.nodes
    let node = null
    let node_element = null
    let expander = null
    let p = null
    let p_expander = null
    let expander_text = '-'
    let view_data = null
    let _offset = this.get_view_offset()
    for (let nodeid in nodes) {
      node = nodes[nodeid]
      view_data = node._data.view
      node_element = view_data.element
      expander = view_data.expander
      if (!this.layout.is_visible(node)) {
        node_element.style.display = 'none'
        expander.style.display = 'none'
        continue
      }
      this.reset_node_custom_style(node)
      p = this.layout.get_node_point(node)
      view_data.abs_x = _offset.x + p.x
      view_data.abs_y = _offset.y + p.y
      node_element.style.left = (_offset.x + p.x) + 'px'
      node_element.style.top = (_offset.y + p.y) + 'px'
      node_element.style.display = ''
      node_element.style.visibility = 'visible'
      if (!node.isroot && node.children.length > 0) {
        expander_text = node.expanded ? '-' : '+'
        p_expander = this.layout.get_expander_point(node)
        expander.style.left = (_offset.x + p_expander.x) + 'px'
        expander.style.top = (_offset.y + p_expander.y) + 'px'
        expander.style.display = ''
        expander.style.visibility = 'visible'
        $t(expander, expander_text)
      }
      // hide expander while all children have been removed
      if (!node.isroot && node.children.length == 0) {
        expander.style.display = 'none'
        expander.style.visibility = 'hidden'
      }
    }
  }

  reset_node_custom_style (node) {
    this._reset_node_custom_style(node._data.view.element, node.data)
  }

  _reset_node_custom_style (node_element, node_data) {
    if ('background-color' in node_data) {
      node_element.style.backgroundColor = node_data['background-color']
    }
    if ('foreground-color' in node_data) {
      node_element.style.color = node_data['foreground-color']
    }
    if ('width' in node_data) {
      node_element.style.width = node_data['width'] + 'px'
    }
    if ('height' in node_data) {
      node_element.style.height = node_data['height'] + 'px'
    }
    if ('font-size' in node_data) {
      node_element.style.fontSize = node_data['font-size'] + 'px'
    }
    if ('font-weight' in node_data) {
      node_element.style.fontWeight = node_data['font-weight']
    }
    if ('font-style' in node_data) {
      node_element.style.fontStyle = node_data['font-style']
    }
    if ('background-image' in node_data) {
      let backgroundImage = node_data['background-image']
      if (backgroundImage.startsWith('data') && node_data['width'] && node_data['height']) {
        let img = new Image()

        img.onload = function () {
          let c = document.createElement('canvas')
          c.width = node_element.clientWidth
          c.height = node_element.clientHeight
          let img = this
          if (c.getContext) {
            let ctx = c.getContext('2d')
            ctx.drawImage(img, 2, 2, node_element.clientWidth, node_element.clientHeight)
            let scaledImageData = c.toDataURL()
            node_element.style.backgroundImage = 'url(' + scaledImageData + ')'
          }
        }
        img.src = backgroundImage

      } else {
        node_element.style.backgroundImage = 'url(' + backgroundImage + ')'
      }
      node_element.style.backgroundSize = '99%'

      if ('background-rotation' in node_data) {
        node_element.style.transform = 'rotate(' + node_data['background-rotation'] + 'deg)'
      }

    }
  }

  clear_node_custom_style (node) {
    let node_element = node._data.view.element
    node_element.style.backgroundColor = ""
    node_element.style.color = ""
  }

  clear_lines (canvas_ctx) {
    let ctx = canvas_ctx || this.canvas_ctx
    JsMindUtil.canvas.clear(ctx, 0, 0, this.size.w, this.size.h)
  }

  show_lines (canvas_ctx) {
    this.clear_lines(canvas_ctx)
    let nodes = this.jm.mind.nodes
    let node = null
    let pin = null
    let pout = null
    let _offset = this.get_view_offset()
    for (let nodeid in nodes) {
      node = nodes[nodeid]
      if (!!node.isroot) {
        continue
      }
      if (('visible' in node._data.layout) && !node._data.layout.visible) {
        continue
      }
      pin = this.layout.get_node_point_in(node)
      pout = this.layout.get_node_point_out(node.parent)
      this.draw_line(pout, pin, _offset, canvas_ctx)
    }
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
}
