import JsMind from '../JsMind'
import JsMindUtil from '../JsMindUtil'

let clear_selection = window.getSelection ? function () {
  window.getSelection().removeAllRanges()
} : function () {
  document.selection.empty()
}

let options = {
  line_width: 5,
  lookup_delay: 500,
  lookup_interval: 80
}

class JsMindExtensionDraggable {

  constructor (jm) {
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

  _create_canvas () {
    let c = $d.createElement('canvas')
    this.jm.view.e_panel.appendChild(c)
    let ctx = c.getContext('2d')
    this.e_canvas = c
    this.canvas_ctx = ctx
  }

  _create_shadow () {
    let s = $d.createElement('jmnode')
    s.style.visibility = 'hidden'
    s.style.zIndex = '3'
    s.style.cursor = 'move'
    s.style.opacity = '0.7'
    this.shadow = s
  }

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

  show_shadow () {
    if (!this.moved) {
      this.shadow.style.visibility = 'visible'
    }
  }

  hide_shadow () {
    this.shadow.style.visibility = 'hidden'
  }

  _magnet_shadow (node) {
    if (!!node) {
      this.canvas_ctx.lineWidth = options.line_width
      this.canvas_ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      this.canvas_ctx.lineCap = 'round'
      this._clear_lines()
      this._canvas_lineto(node.sp.x, node.sp.y, node.np.x, node.np.y)
    }
  }

  _clear_lines () {
    this.canvas_ctx.clearRect(0, 0, this.jm.view.size.w, this.jm.view.size.h)
  }

  _canvas_lineto (x1, y1, x2, y2) {
    this.canvas_ctx.beginPath()
    this.canvas_ctx.moveTo(x1, y1)
    this.canvas_ctx.lineTo(x2, y2)
    this.canvas_ctx.stroke()
  }

  _lookup_close_node () {
    let root = this.jm.get_root()
    let root_location = root.get_location()
    let root_size = root.get_size()
    let root_x = root_location.x + root_size.w / 2

    let sw = this.shadow_w
    let sh = this.shadow_h
    let sx = this.shadow.offsetLeft
    let sy = this.shadow.offsetTop

    let ns, nl

    let direct = (sx + sw / 2) >= root_x ?
      JsMind.direction.right : JsMind.direction.left
    let nodes = this.jm.mind.nodes
    let node = null
    let layout = this.jm.layout
    let min_distance = Number.MAX_VALUE
    let distance = 0
    let closest_node = null
    let closest_p = null
    let shadow_p = null
    for (let nodeid in nodes) {
      let np, sp
      node = nodes[nodeid]
      if (node.isroot || node.direction == direct) {
        if (node.id == this.active_node.id) {
          continue
        }
        if (!layout.is_visible(node)) {
          continue
        }
        ns = node.get_size()
        nl = node.get_location()
        if (direct == JsMind.direction.right) {
          if (sx - nl.x - ns.w <= 0) {
            continue
          }
          distance = Math.abs(sx - nl.x - ns.w) + Math.abs(sy + sh / 2 - nl.y - ns.h / 2)
          np = {x: nl.x + ns.w - options.line_width, y: nl.y + ns.h / 2}
          sp = {x: sx + options.line_width, y: sy + sh / 2}
        } else {
          if (nl.x - sx - sw <= 0) {
            continue
          }
          distance = Math.abs(sx + sw - nl.x) + Math.abs(sy + sh / 2 - nl.y - ns.h / 2)
          np = {x: nl.x + options.line_width, y: nl.y + ns.h / 2}
          sp = {x: sx + sw - options.line_width, y: sy + sh / 2}
        }
        if (distance < min_distance) {
          closest_node = node
          closest_p = np
          shadow_p = sp
          min_distance = distance
        }
      }
    }
    let result_node = null
    if (!!closest_node) {
      result_node = {
        node: closest_node,
        direction: direct,
        sp: shadow_p,
        np: closest_p
      }
    }
    return result_node
  }

  lookup_close_node () {
    let node_data = this._lookup_close_node()
    if (!!node_data) {
      this._magnet_shadow(node_data)
      this.target_node = node_data.node
      this.target_direct = node_data.direction
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
    if (el.tagName.toLowerCase() != 'jmnode') {
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
        if (this.hlookup_delay != 0) {
          $w.clearTimeout(this.hlookup_delay)
        }
        if (this.hlookup_timer != 0) {
          $w.clearInterval(this.hlookup_timer)
        }
        let jd = this
        this.hlookup_delay = $w.setTimeout(function () {
          jd.hlookup_delay = 0
          jd.hlookup_timer = $w.setInterval(function () {
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
      if (this.hlookup_delay != 0) {
        $w.clearTimeout(this.hlookup_delay)
        this.hlookup_delay = 0
        this._clear_lines()
      }
      if (this.hlookup_timer != 0) {
        $w.clearInterval(this.hlookup_timer)
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
    if (!!target_node && !!src_node && !JsMind.node.inherited(src_node, target_node)) {
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

  if (typeof JsMind.draggable !== void 0) return

  let draggable_plugin = new JsMind.plugin('draggable', function (jm) {
    let jd = new JsMindExtensionDraggable(jm)
    jd.init()
    jm.add_event_listener(function (type, data) {
      jd.jm_event_handle.call(jd, type, data)
    })
  })

  JsMind.register_plugin(draggable_plugin)

})()
