import _ from 'lodash-es'
import JsMindPlugin from '../../JsMindPlugin'
import {DIRECTION} from '../../JsMind'
import JsMindUtil from '../../JsMindUtil'

let options = {
  line_width: 1, stroke_style: 'rgba(0,0,0,0.3)', stroke_dash: [8, 4]
}

export default class JsMindPluginDraggable extends JsMindPlugin {

  static plugin_name = 'draggable'

  constructor (jm) {
    super(jm)
    this.canvas = null
    this.canvasContext = null
    this.shadowElement = null
    this.sourceElement = null
    this.sourceNode = null
    this.targetNode = null
    this.direction = DIRECTION.center
    // dragstart 的时候的起始点击位置偏离值
    this.offsetX = 0
    this.offsetY = 0
    // 用于节流 drag 函数的缓存值，否则拖动的时候 hover 不动也会不停触发
    this.lastX = 0
    this.lastY = 0

    this.active = false
  }

  /**
   * 初始化插件
   */
  async init () {
    this._event_bind()
    // 需要这样才能在区域内显示可放置图标
    this.jm.view.e_nodes.ondrop = e => false
    this.jm.view.e_nodes.ondragover = e => false
    await super.init()
  }

  /**
   * 隐藏影子元素
   */
  _hide_shadow () {
    if (this.shadowElement) this.shadowElement.parentElement.removeChild(this.shadowElement)
    this.shadowElement = null
  }

  /**
   * 触发查找最近节点，并渲染影子到该节点的连接线
   */
  _match_target () {
    this.targetNode = this._find_target()
    this._draw_magnet()
  }

  /**
   * 寻找影子匹配的目标节点
   * @private
   */
  _find_target () {
    if (!this.shadowElement) return
    const root = this.jm.get_root()

    // 根节点定位
    const {x: rx, y: ry} = root.get_location()
    const {w: rw, h: rh} = root.get_size()

    const sw = this.shadowElement.clientWidth
    const sh = this.shadowElement.clientHeight
    const sx = this.shadowElement.offsetLeft
    const sy = this.shadowElement.offsetTop

    // 影子在根节点的左边还是右边
    // 不左不右直接断链
    this.direction = sx > rx + rw ? DIRECTION.right : sx + sw < rx ? DIRECTION.left : DIRECTION.center
    // console.log(direction === DIRECTION.right ? 'right' : direction === DIRECTION.left ? 'left' : 'both')
    if (this.direction === DIRECTION.center) return null
    // 如果设置是有指定方向 options.mode=side，则不允许放到另一边
    const mode = this.jm.options.mode
    if (mode === 'side' && this.direction !== DIRECTION.right) return null

    // 算法说明：从根节点起，逐级寻找其下级节点，满足影子连接点在其内容覆盖范围内的最下级节点，即为所求
    // node 为可以吸附到的最细子节点
    let node = this.jm.get_root()
    // 当前节点深度上下界
    let lb = 0
    let hb = this.jm.view.size.h
    // hit: 是否命中一个更细的区域
    for (let hit = true; hit;) {
      const n = node.children.length
      hit = node.children.some((childNode, i) => {
        // 拦截深入，防止定位到自己的子节点
        if (childNode === this.sourceNode) return false
        // 方向不符，直接否決
        if (childNode.direction !== this.direction) return false
        // 获取当前级别子节点的定位
        const {x: cx, y: cy} = childNode.get_location()
        const {w: cw, h: ch} = childNode.get_size()
        // 过于靠内，直接否决
        if (this.direction === DIRECTION.right && sx < cx + cw
          || this.direction === DIRECTION.left && sx + sw > cx) return false
        // 纵向区间匹配
        const oh = childNode.meta.layout.outer_height + this.jm.options.view.vspace
        // 子节点的上下界
        const clb = (i === 0 || mode === 'both' && node === root && i === 1)
          ? lb : cy + ch / 2 - oh / 2
        const chb = (i === n - 1 || mode === 'both' && node === root && i === n - 2)
          ? hb : cy + ch / 2 + oh / 2
        if (clb <= sy + sh / 2 && sy + sh / 2 < chb) {
          lb = clb
          hb = chb
          node = childNode
          // DEBUG: 绘制匹配区域
          // this.canvasContext.fillStyle = 'yellow'
          // this.canvasContext.fillRect(cx + cw - (direction === DIRECTION.left ? 20 + cw : 0), clb, 20, chb - clb)
          return true
        }
      })
    }
    // DEBUG: 输出匹配节点
    // console.log(node.topic, node)
    return node
  }

  /**
   * 创建画布（用于绘制连接线）
   * @private
   */
  _create_canvas () {
    if (this.canvas) return
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.jm.view.size.w
    this.canvas.height = this.jm.view.size.h
    this.jm.view.e_panel.appendChild(this.canvas)
    this.canvas.className = 'canvas-draggable'
    this.canvasContext = this.canvas.getContext('2d')
  }

  /**
   * 销毁画布
   * @private
   */
  _destroy_canvas () {
    if (!this.canvas) return
    this.jm.view.e_panel.removeChild(this.canvas)
    this.canvas = null
    this.canvasContext = null
  }

  /**
   * 创建拖动时的影子元素
   * @private
   */
  _create_shadow () {
    if (this.shadowElement) return
    this.shadowElement = this.sourceElement.cloneNode(true)
    this.shadowElement.style.zIndex = '3'
    this.shadowElement.style.cursor = 'move'
    this.shadowElement.style.opacity = '0.5'
    this.shadowElement.style.display = 'none'
    this.shadowElement.classList.remove('selected')
    this.shadowElement.removeAttribute('draggable')
    this.jm.view.e_nodes.appendChild(this.shadowElement)
  }

  /**
   * 绘制到影子到的目标节点连接线
   */
  _draw_magnet () {
    this.canvasContext.clearRect(0, 0, this.jm.view.size.w, this.jm.view.size.h)
    if (!this.targetNode) return
    this.canvasContext.lineWidth = options.line_width
    this.canvasContext.strokeStyle = options.stroke_style
    this.canvasContext.setLineDash(options.stroke_dash)
    this.canvasContext.lineCap = 'round'
    let left = this.targetNode.meta.view.element
    let right = this.shadowElement
    if (this.direction === DIRECTION.left) [left, right] = [right, left]
    // 绘制连接线
    JsMindUtil.canvas.bezierto(
      this.canvasContext,
      left.offsetLeft + left.offsetWidth,
      left.offsetTop + left.offsetHeight / 2,
      right.offsetLeft,
      right.offsetTop + right.offsetHeight / 2
    )
  }

  /**
   * 绑定拖拽相关的的事件
   * @private
   */
  _event_bind () {
    const container = this.jm.view.container
    container.addEventListener('dragstart', this.drag_start.bind(this))
    container.addEventListener('drag', _.throttle(this.drag, 25).bind(this))
    // container.addEventListener('drag', this.drag.bind(this))
    container.addEventListener('dragend', this.drag_end.bind(this))
  }

  /**
   * 开始拖动
   * @param e {DragEvent}
   */
  drag_start (e) {
    // 有编辑权限才可以拖动，编辑过程不允许拖动
    if (!this.jm.can_edit() || this.jm.is_editing()) {
      e.preventDefault()
      return
    }
    // 定位节点
    const view = this.jm.view
    if (!e.target.classList.contains('jmnode')) return
    const node = view.get_node_by_element(e.target)
    if (!node || node.is_root()) return
    // 初始化画布
    this._create_canvas()
    // 启动捕捉监听，产生位移才开始进入 capture
    e.dataTransfer.effectAllowed = 'move'
    this.sourceElement = e.target
    this.sourceNode = node
    this._create_shadow()
    this.offsetX = e.offsetX
    this.offsetY = e.offsetY
    const dot = document.createElement('div')
    dot.style.width = '0'
    dot.style.height = '0'
    e.dataTransfer.setDragImage(dot, 0, 0)
  }

  /**
   * 触发拖动
   * @param e {DragEvent}
   */
  drag (e) {
    if (!this.sourceElement) return
    // 不动的时候避免处理
    if (e.offsetX === this.lastX && e.offsetY === this.lastY) return
    this.lastX = e.offsetX
    this.lastY = e.offsetY
    // 左键按下才作数，如果拖动期间点了其他按键就取消
    const style = window.getComputedStyle(this.sourceElement)
    this.shadowElement.style.display = style.display
    this.shadowElement.style.left = `${this.sourceElement.offsetLeft + e.offsetX - this.offsetX}px`
    this.shadowElement.style.top = `${this.sourceElement.offsetTop + e.offsetY - this.offsetY}px`
    // 触发目标吸附匹配
    this._match_target()
  }

  /**
   * 拖动结束的处理
   * @param e {MouseEvent}
   * @param cancel {Boolean} 是否取消操作
   */
  drag_end (e) {
    // 如果操作合法，执行操作
    if (this.jm.can_edit() && this.targetNode) this.move_node()
    // 清理所有
    this._destroy_canvas()
    this._hide_shadow()
    this.sourceElement = null
    this.sourceNode = null
    this.targetNode = null
  }

  /**
   * 执行逻辑节点移动
   */
  async move_node () {
    const shadowY = this.shadowElement.offsetTop + this.shadowElement.offsetHeight / 2
    // 在同级节点中找到第一个比影子节点靠后的节点 prevNode
    const siblings = this.targetNode.children || []
    let prevNode = void 0
    siblings.some(node => {
      if (node.direction !== this.direction) return
      if (shadowY < node.get_location().y + node.get_size().h / 2) {
        prevNode = node
        return true
      }
    })
    // 如果没有实际发生移动，则不进行任何操作
    const sourceIndex = siblings.indexOf(this.sourceNode)
    if (this.targetNode !== this.sourceNode.parent ||
      prevNode !== siblings[sourceIndex] && prevNode !== siblings[sourceIndex + 1]) {
      await this.jm.move_node(this.sourceNode, prevNode, this.targetNode, this.direction)
    }
  }

}
