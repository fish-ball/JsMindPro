import JsMind from '../JsMind'
import JsMindNode from '../JsMindNode'
import JsMindUtil from '../JsMindUtil'
import JsMindPlugin from '../JsMindPlugin'

let clear_selection = window.getSelection ? function () {
  window.getSelection().removeAllRanges()
} : function () {
  document.selection.empty()
}

let options = {
  line_width: 2,
  lookup_delay: 500,
  lookup_interval: 80
}

class JsMindExtensionDraggable {

  constructor (jm) {
    /** @type JsMind */
    this.jm = jm
    this.e_canvas = null
    this.canvas_ctx = null
    this.shadow = null
    this.shadow_w = 0
    this.shadow_h = 0
    this.active_node = null
    this.target_node = null
    this.target_direct = null
    this.client_w = 0
    this.client_h = 0
    this.offset_x = 0
    this.offset_y = 0
    this.hlookup_delay = 0
    this.hlookup_timer = 0
    this.capture = false
    this.moved = false
  }

  /**
   * 初始化插件
   */
  init () {
    this._create_canvas()
    this._create_shadow()
    this._event_bind()
  }

  resize () {
    this.jm.view.e_nodes.appendChild(this.shadow)
    this.e_canvas.width = this.jm.view.size.w
    this.e_canvas.height = this.jm.view.size.h
  }

  /**
   * 重设影子元素（复制指定节点的内容）
   * @param el
   */
  reset_shadow (el) {
    let s = this.shadow.style
    this.shadow.innerHTML = el.innerHTML
    s.left = el.style.left
    s.top = el.style.top
    s.width = el.style.width
    s.height = el.style.height
    s.backgroundImage = el.style.backgroundImage
    s.backgroundSize = el.style.backgroundSize
    s.transform = el.style.transform
    this.shadow_w = this.shadow.clientWidth
    this.shadow_h = this.shadow.clientHeight
  }

  /**
   * 显示影子元素
   */
  show_shadow () {
    if (!this.moved) this.shadow.style.visibility = 'visible'
  }

  /**
   * 隐藏影子元素
   */
  hide_shadow () {
    this.shadow.style.visibility = 'hidden'
  }

  /**
   * 触发查找最近节点，并渲染影子到该节点的连接线
   */
  lookup_close_node () {
    let node = this._lookup_close_node()
    if (!node) return
    this._magnet_shadow(node)
    this.target_node = node.node
    this.target_direct = node.direction
  }

  /**
   * 创建画布（用于绘制连接线）
   * @private
   */
  _create_canvas () {
    let c = document.createElement('canvas')
    this.jm.view.e_panel.appendChild(c)
    let ctx = c.getContext('2d')
    this.e_canvas = c
    this.canvas_ctx = ctx
  }

  /**
   * 创建拖动时的影子元素
   * @private
   */
  _create_shadow () {
    let s = document.createElement('jmnode')
    // 还没拖动，所以默认是隐藏的
    s.style.visibility = 'hidden'
    s.style.zIndex = '3'
    s.style.cursor = 'move'
    s.style.opacity = '0.7'
    this.shadow = s
  }

  /**
   * 绘制到影子到的目标节点连接线
   * @param node {JsMindNode} 目标节点
   * @private
   */
  _magnet_shadow (node) {
    if (!!node) {
      this.canvas_ctx.lineWidth = options.line_width
      this.canvas_ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      this.canvas_ctx.lineCap = 'round'
      this._clear_lines()
      this._canvas_lineto(node.sp.x, node.sp.y, node.np.x, node.np.y)
    }
  }

  /**
   *  清除画布（内的连接线）
   * @private
   */
  _clear_lines () {
    this.canvas_ctx.clearRect(0, 0, this.jm.view.size.w, this.jm.view.size.h)
  }

  /**
   * 在画布上绘制连接线（后面改成光滑曲线而不是直线）
   * @param x1
   * @param y1
   * @param x2
   * @param y2
   * @private
   */
  _canvas_lineto (x1, y1, x2, y2) {
    this.canvas_ctx.beginPath()
    this.canvas_ctx.moveTo(x1, y1)
    this.canvas_ctx.lineTo(x2, y2)
    this.canvas_ctx.stroke()
  }

  /**
   * 查找最近的节点
   * @returns {{node:*,direction:*,np:*,sp:*}|null}
   * @private
   */
  _lookup_close_node () {
    let root = this.jm.get_root()
    const {x: rx, y: ry} = root.get_location()
    const {w: rw, h: rh} = root.get_size()

    const sw = this.shadow_w
    const sh = this.shadow_h
    const sx = this.shadow.offsetLeft
    const sy = this.shadow.offsetTop
    // console.log(`
    // rw=${rw}, rh=${rh}, rx=${rx}, rootY=${ry}
    // sw=${sw}, sh=${sh}, sx=${sx}, sy=${sy}
    // `)

    // 影子在根节点的左边还是右边
    // 不左不右直接断链
    if (rx + rw > sx && sx > rx - sw) return null
    const direction = sx > rx + rw ? JsMind.direction.right : JsMind.direction.left
    let minDistance = Number.MAX_VALUE
    let distance = 0
    let closestNode = null
    let nodePoint = null
    let shadowPoint = null
    _.forEach(this.jm.mind.nodes, node => {
      let np, sp
      // 忽略另一边的节点
      if (!node.isroot && node.direction !== direction) return null
      // 不能移动到自己或自己的子节点
      for (let nd = node; nd; nd = nd.parent) {
        if (nd.id === this.active_node.id) return null
      }
      // 不能移动到隐藏的节点下面
      if (!this.jm.layout.is_visible(node)) return null
      const {w: nw, h: nh} = node.get_size()
      const {x: nx, y: ny} = node.get_location()
      if (direction === JsMind.direction.right) {
        if (sx < nx + nw) return null
        distance = Math.hypot(sx - nx - nw, sy + sh / 2 - ny - nh / 2)
        np = {x: nx + nw - options.line_width, y: ny + nh / 2}
        sp = {x: sx + options.line_width, y: sy + sh / 2}
      } else if (direction === JsMind.direction.left) {
        if (sx + sw > nx) return null
        console.log('left', node.topic)
        distance = Math.hypot(sx + sw - nx, sy + sh / 2 - ny - nh / 2)
        np = {x: nx + options.line_width, y: ny + nh / 2}
        sp = {x: sx + sw - options.line_width, y: sy + sh / 2}
      } else {
        throw new Error('方向错误')
      }
      if (distance < minDistance) {
        closestNode = node
        nodePoint = np
        shadowPoint = sp
        minDistance = distance
        console.log(minDistance, closestNode)
      }
    })
    if (!closestNode) return null
    return {
      node: closestNode,
      direction: direction,
      sp: shadowPoint,
      np: nodePoint
    }
  }

  _event_bind () {
    let jd = this
    let container = this.jm.view.container
    JsMindUtil.dom.add_event(container, 'mousedown', function (e) {
      let evt = e || event
      jd.dragstart.call(jd, evt)
    })
    JsMindUtil.dom.add_event(container, 'mousemove', function (e) {
      let evt = e || event
      jd.drag.call(jd, evt)
    })
    JsMindUtil.dom.add_event(container, 'mouseup', function (e) {
      let evt = e || event
      jd.dragend.call(jd, evt)
    })
    JsMindUtil.dom.add_event(container, 'touchstart', function (e) {
      let evt = e || event
      jd.dragstart.call(jd, evt)
    })
    JsMindUtil.dom.add_event(container, 'touchmove', function (e) {
      let evt = e || event
      jd.drag.call(jd, evt)
    })
    JsMindUtil.dom.add_event(container, 'touchend', function (e) {
      let evt = e || event
      jd.dragend.call(jd, evt)
    })
  }

  dragstart (e) {
    if (!this.jm.get_editable()) {
      return
    }
    if (this.capture) {
      return
    }
    this.active_node = null

    let jview = this.jm.view
    let el = e.target || event.srcElement
    if (el.tagName.toLowerCase() !== 'jmnode') {
      return
    }
    let nodeid = jview.get_binded_nodeid(el)
    if (!!nodeid) {
      let node = this.jm.get_node(nodeid)
      if (!node.isroot) {
        this.reset_shadow(el)
        this.active_node = node
        this.offset_x = (e.clientX || e.touches[0].clientX) / jview.actualZoom - el.offsetLeft
        this.offset_y = (e.clientY || e.touches[0].clientY) / jview.actualZoom - el.offsetTop
        this.client_hw = Math.floor(el.clientWidth / 2)
        this.client_hh = Math.floor(el.clientHeight / 2)
        if (this.hlookup_delay !== 0) {
          clearTimeout(this.hlookup_delay)
        }
        if (this.hlookup_timer !== 0) {
          clearInterval(this.hlookup_timer)
        }
        let jd = this
        this.hlookup_delay = setTimeout(function () {
          jd.hlookup_delay = 0
          jd.hlookup_timer = setInterval(function () {
            jd.lookup_close_node.call(jd)
          }, options.lookup_interval)
        }, options.lookup_delay)
        this.capture = true
      }
    }
  }

  drag (e) {
    if (!this.jm.get_editable()) {
      return
    }
    if (this.capture) {
      e.preventDefault()
      this.show_shadow()
      this.moved = true
      clear_selection()
      let jview = this.jm.view
      let px = (e.clientX || e.touches[0].clientX) / jview.actualZoom - this.offset_x
      let py = (e.clientY || e.touches[0].clientY) / jview.actualZoom - this.offset_y
      this.shadow.style.left = px + 'px'
      this.shadow.style.top = py + 'px'
      clear_selection()
    }
  }

  dragend (e) {
    if (!this.jm.get_editable()) {
      return
    }
    if (this.capture) {
      if (this.hlookup_delay !== 0) {
        clearTimeout(this.hlookup_delay)
        this.hlookup_delay = 0
        this._clear_lines()
      }
      if (this.hlookup_timer !== 0) {
        clearInterval(this.hlookup_timer)
        this.hlookup_timer = 0
        this._clear_lines()
      }
      if (this.moved) {
        let src_node = this.active_node
        let target_node = this.target_node
        let target_direct = this.target_direct
        this.move_node(src_node, target_node, target_direct)
      }
      this.hide_shadow()
    }
    this.moved = false
    this.capture = false
  }

  move_node (src_node, target_node, target_direct) {
    let shadow_h = this.shadow.offsetTop
    if (!!target_node && !!src_node && !JsMindNode.inherited(src_node, target_node)) {
      // lookup before_node
      let sibling_nodes = target_node.children
      let sc = sibling_nodes.length
      let node = null
      let delta_y = Number.MAX_VALUE
      let node_before = null
      let beforeid = '_last_'
      while (sc--) {
        node = sibling_nodes[sc]
        if (node.direction === target_direct && node.id !== src_node.id) {
          let dy = node.get_location().y - shadow_h
          if (dy > 0 && dy < delta_y) {
            delta_y = dy
            node_before = node
            beforeid = '_first_'
          }
        }
      }
      if (!!node_before) {
        beforeid = node_before.id
      }
      this.jm.move_node(src_node.id, beforeid, target_node.id, target_direct)
    }
    this.active_node = null
    this.target_node = null
    this.target_direct = null
  }

  jm_event_handle (type, data) {
    if (type === JsMind.event_type.resize) {
      this.resize()
    }
  }

}

(function () {
  if (JsMind.draggable !== void 0) return

  let draggable_plugin = new JsMindPlugin('draggable', function (jm) {
    let jd = new JsMindExtensionDraggable(jm)
    jd.init()
    jm.add_event_listener(function (type, data) {
      jd.jm_event_handle.call(jd, type, data)
    })
  })

  JsMind.register_plugin(draggable_plugin)

})()
