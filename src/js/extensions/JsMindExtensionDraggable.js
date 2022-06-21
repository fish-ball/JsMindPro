import _ from 'lodash-es'
import JsMind from '../JsMind'
import {DIRECTION, EVENT_TYPE} from '../JsMind'
import JsMindNode from '../JsMindNode'
import JsMindUtil from '../JsMindUtil'
import JsMindPlugin from '../JsMindPlugin'

let options = {
  line_width: 1,
  stroke_style: 'rgba(0,0,0,0.3)',
  stroke_dash: [8, 4]
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
    this.target = null
    this.active_node = null
    this.target_node = null
    this.target_direct = null
    this.offset_x = 0
    this.offset_y = 0
    this.capture = false

    this.drag_handler = null
    this.active = false
  }

  /**
   * 初始化插件
   */
  init () {
    this._create_canvas()
    this._create_shadow()
    this._event_bind()
    this.drag_handler = _.debounce(this.drag).bind(this)
  }

  /**
   * 重设大小
   */
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
    this.shadow.style.visibility = 'visible'
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
    if (!node) {
      this.target_node = null
      this.target_direct = null
      this._clear_lines()
      return
    }
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
    c.className = 'canvas-draggable'
    this.jm.view.e_panel.appendChild(c)
    let ctx = c.getContext('2d')
    this.e_canvas = c
    this.canvas_ctx = ctx
  }

  /**
   * 创建拖动时的影子元素
   * TODO: 这里的影子是写死的，自由拖动的时候会有区别
   * @private
   */
  _create_shadow () {
    const s = document.createElement('div')
    s.className = 'jmnode'
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
   * @param direction {Number} 方向
   * @param sp {{x, y}} ShadowPoint 连接点坐标
   * @param np {{x, y}} NodePoint 连接点坐标
   * @private
   */
  _magnet_shadow ({node, direction, sp, np}) {
    this._clear_lines()
    this.canvas_ctx.lineWidth = options.line_width
    this.canvas_ctx.strokeStyle = options.stroke_style
    this.canvas_ctx.setLineDash(options.stroke_dash)
    this.canvas_ctx.lineCap = 'round'
    // 绘制连接线
    JsMindUtil.canvas.bezierto(this.canvas_ctx, sp.x, sp.y, np.x, np.y)
  }

  /**
   *  清除画布（内的连接线）
   * @private
   */
  _clear_lines () {
    this.canvas_ctx.clearRect(0, 0, this.jm.view.size.w, this.jm.view.size.h)
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
    const direction = sx > rx + rw ? DIRECTION.right : DIRECTION.left
    // 如果设置是有指定方向 options.mode=side，则不允许放到另一边
    if (this.jm.options.mode === 'side' && direction !== DIRECTION.right) {
      return null
    }
    let minDistance = Number.MAX_VALUE
    let distance = 0
    let closestNode = null
    let nodePoint = null
    let shadowPoint = null
    _.forEach(this.jm.model.nodes, node => {
      let np, sp
      // 忽略另一边的节点
      if (!node.is_root() && node.direction !== direction) return null
      // 不能移动到自己或自己的子节点
      for (let nd = node; nd; nd = nd.parent) {
        if (nd.id === this.active_node.id) return null
      }
      // 不能移动到隐藏的节点下面
      if (!node.is_visible()) return null
      const {w: nw, h: nh} = node.get_size()
      const {x: nx, y: ny} = node.get_location()
      if (direction === DIRECTION.right) {
        if (sx < nx + nw) return null
        distance = Math.hypot(sx - nx - nw, sy + sh / 2 - ny - nh / 2)
        np = {x: nx + nw - options.line_width, y: ny + nh / 2}
        sp = {x: sx + options.line_width, y: sy + sh / 2}
      } else if (direction === DIRECTION.left) {
        if (sx + sw > nx) return null
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

  /**
   * 绑定拖拽相关的的事件
   * @private
   */
  _event_bind () {
    let ext = this
    let container = this.jm.view.container
    JsMindUtil.dom.add_event(container, 'mousedown', function (e) {
      ext.drag_start(e)
    })
    JsMindUtil.dom.add_event(container, 'mouseup', function (e) {
      ext.drag_end(e)
    })
  }

  /**
   * 开始拖动
   * @param e {MouseEvent}
   */
  drag_start (e) {
    // 单独按下左键才作数
    if (e.button === 0 && e.buttons === 1 && this.jm.can_edit()) {
      const view = this.jm.view
      const el = e.target
      if (!el.classList.contains('jmnode')) return
      const node = view.get_node_by_element(el)
      if (!node || node.is_root()) return
      // 启动捕捉监听，产生位移才开始进入 capture
      this.capture = false
      this.target = el
      this.active_node = node
      this.jm.view.container.addEventListener('mousemove', this.drag_handler)
    } else {
      // 否则取消操作
      this.drag_end(e, true)
    }
  }

  /**
   * 触发拖动
   * @param e {MouseEvent}
   */
  drag (e) {
    // 左键按下才作数，如果拖动期间点了其他按键就取消
    if (e.button === 0 && e.buttons === 1 && this.target && this.jm.can_edit()) {
      const view = this.jm.view
      if (!this.capture) {
        this.reset_shadow(this.target)
        this.offset_x = e.clientX / view.options.zoom - this.target.offsetLeft
        this.offset_y = e.clientY / view.options.zoom - this.target.offsetTop
        this.capture = true
      }
      e.preventDefault()
      this.show_shadow()
      let px = e.clientX / view.options.zoom - this.offset_x
      let py = e.clientY / view.options.zoom - this.offset_y
      this.shadow.style.left = px + 'px'
      this.shadow.style.top = py + 'px'
      // 触发磁力线计算
      this.lookup_close_node()
    } else {
      // 否则取消操作
      this.drag_end(e, true)
    }
  }

  /**
   * 拖动结束的处理
   * @param e {MouseEvent}
   * @param cancel {Boolean} 是否取消操作
   */
  drag_end (e, cancel = false) {
    // 如果操作合法，执行操作
    if (this.jm.can_edit() && !cancel && this.capture) {
      this.move_node(this.active_node, this.target_node, this.target_direct)
    }
    // 清理所有
    this.jm.view.container.removeEventListener('mousemove', this.drag_handler)
    this._clear_lines()
    this.hide_shadow()
    this.capture = false
    this.target = null
    this.active_node = null
    this.target_node = null
    this.target_direct = null
  }

  /**
   * 执行逻辑节点移动
   * @param srcNode
   * @param targetNode
   * @param targetDirection
   */
  move_node (srcNode, targetNode, targetDirection) {
    let shadowH = this.shadow.offsetTop
    // 不允许移动到自己的子节点，否则会引起循环
    if (!targetNode || !srcNode || srcNode.is_ancestor_of(targetNode)) return
    // lookup before_node
    let siblings = targetNode.children
    let node = null
    let deltaY = Number.MAX_VALUE
    let prevNode = null
    for (let sc = siblings.length; sc--;) {
      node = siblings[sc]
      if (node.direction === targetDirection && node.id !== srcNode.id) {
        let dy = node.get_location().y - shadowH
        if (dy > 0 && dy < deltaY) {
          deltaY = dy
          prevNode = node
        }
      }
    }
    // 如果没有实际发生移动，则不进行任何操作
    if (node.parent !== targetNode || (prevNode ? prevNode.index : siblings.length) !== srcNode.index + 1) {
      this.jm.move_node(srcNode, prevNode, targetNode, targetDirection)
    }
  }

  /**
   * 处理 jm 时间注入入口
   * @param type
   * @param data
   */
  jm_event_handle (type, data) {
    if (type === EVENT_TYPE.resize) this.resize()
  }

}

(function () {
  if (JsMind.draggable !== void 0) return

  let draggable_plugin = new JsMindPlugin('draggable', function (jm) {
    let jd = new JsMindExtensionDraggable(jm)
    jd.init()
    jm.add_event_listener(function (type, data) {
      jd.jm_event_handle(type, data)
    })
  })

  JsMind.register_plugin(draggable_plugin)

})()
