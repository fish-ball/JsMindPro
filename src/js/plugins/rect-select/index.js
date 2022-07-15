import _ from 'lodash-es'
import {DIRECTION} from '../../JsMind'
import JsMindPlugin from '../../JsMindPlugin'

let options = {
  line_width: 1, stroke_style: 'rgba(83,83,167,0.5)', fill_style: 'rgba(223,223,224,0.5)'
}

export default class JsMindPluginRectSelect extends JsMindPlugin {

  static plugin_name = 'rect-select'

  constructor (jm) {
    super(jm)
    this.canvas = null
    this.canvasContext = null
    this.rectX = 0
    this.rectY = 0
    this.rectW = 0
    this.rectH = 0
    this.offsetX = 0
    this.offsetY = 0
    this.active = false
    this.dragHandler = null
    this.applySelectNodes = null
  }

  /**
   * 初始化插件
   */
  async init () {
    this._event_bind()
    this.dragHandler = this.drag.bind(this)
  }

  /**
   * 绑定拖拽相关的的事件
   * @private
   */
  _event_bind () {
    const container = this.jm.view.container
    container.addEventListener('mousedown', this.drag_start.bind(this))
    container.addEventListener('mouseup', this.drag_end.bind(this))
  }

  /**
   * 创建画布（用于绘制框选框）
   * @private
   */
  _create_canvas () {
    if (this.canvas) return
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.jm.view.size.w
    this.canvas.height = this.jm.view.size.h
    this.jm.view.e_panel.appendChild(this.canvas)
    this.canvas.style.position = 'relative'
    this.canvas.style.zIndex = '2'
    this.canvas.className = 'canvas-rect-select'
    this.canvasContext = this.canvas.getContext('2d')
  }

  /**
   * 在 canvas 中画出一个框选框
   * @private
   */
  _draw_rect () {
    this.canvasContext.clearRect(0, 0, this.jm.view.size.w, this.jm.view.size.h)
    this.canvasContext.lineWidth = options.line_width
    this.canvasContext.strokeStyle = options.stroke_style
    this.canvasContext.beginPath()
    this.canvasContext.rect(this.rectX + 0.5, this.rectY + 0.5, this.rectW, this.rectH)
    this.canvasContext.stroke()
    this.canvasContext.fillStyle = options.fill_style
    this.canvasContext.fillRect(this.rectX + 0.5, this.rectY + 0.5, this.rectW, this.rectH)
  }

  /**
   * 选择框选范围内容的节点内容
   * @private
   */
  _select_nodes () {
    // 这里主要要考虑到 rectW 和 rectH 为负数的时候的行为
    const rx = this.rectW < 0 ? this.rectX + this.rectW : this.rectX
    const ry = this.rectH < 0 ? this.rectY + this.rectH : this.rectY
    const rw = Math.abs(this.rectW)
    const rh = Math.abs(this.rectH)
    const hspace = this.jm.options.view.hspace
    const selectedNodes = []
    // 递归根据 layout 进行树区域的快速圈定
    const selectFromNode = node => {
      const {x, y} = node.get_location()
      const {w, h} = node.get_size()
      // 节点自身被选中
      if (!(x > rx + rw || x + w < rx || y > ry + rh || y + h < ry)) {
        selectedNodes.push(node)
      }
      if (!node.expanded && !node.is_root()) return
      // 右边
      const rightHeight = node.is_root() ? node.meta.layout.outer_height_right
        : node.direction === DIRECTION.right ? node.meta.layout.outer_height : 0
      if (rightHeight > 0) {
        const y0 = y + h / 2 - rightHeight / 2
        const y1 = y + h / 2 + rightHeight / 2
        if (!(y0 > ry + rh || y1 < ry || x + w + hspace > rx + rw)) {
          // this.canvasContext.fillStyle = 'yellow'
          // this.canvasContext.fillRect(x + w, y0, 20, y1 - y0)
          // this.canvasContext.fillStyle = options.fill_style
          for (const child of node.children) selectFromNode(child)
        }
      }
      // 左边
      const leftHeight = node.is_root() ? node.meta.layout.outer_height_left
        : node.direction === DIRECTION.left ? node.meta.layout.outer_height : 0
      if (leftHeight > 0) {
        const y0 = y + h / 2 - leftHeight / 2
        const y1 = y + h / 2 + leftHeight / 2
        if (!(y0 > ry + rh || y1 < ry || x - hspace < rx)) {
          // this.canvasContext.fillStyle = 'yellow'
          // this.canvasContext.fillRect(x, y0, 20, y1 - y0)
          // this.canvasContext.fillStyle = options.fill_style
          for (const child of node.children) selectFromNode(child)
        }
      }
    }
    selectFromNode(this.jm.get_root())
    // 执行选中
    this.jm.select_nodes(selectedNodes).catch(() => 0)
    // >>> DEPRECATED: 暴力算法，节点多了会死人的
    // this.jm.select_nodes(_.filter(this.jm.get_nodes(), node => {
    //   const {x, y} = node.get_location()
    //   const {w, h} = node.get_size()
    //   return !(x > rx + rw || x + w < rx || y > ry + rh || y + h < ry)
    // }))
    // <<<
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
   * 开始拖动
   * @param e {MouseEvent}
   */
  drag_start (e) {
    const el = this.jm.view.container.getElementsByClassName('jsmind-inner')[0]
    // 必须是单按右键，并且点在空白地方才生效
    if (e.button === 0 && e.buttons === 1 && e.target.parentElement === el) {
      this.target = e.target
      this.rectX = e.offsetX
      this.rectY = e.offsetY
      this.offsetX = e.offsetX
      this.offsetY = e.offsetY
      this.jm.view.container.addEventListener('mousemove', this.dragHandler)
      // TODO: 权宜之计，核心还是在于优化 DOM
      // 计算节点匹配的动作非常重，加个防抖函数减少一些调用次数
      const nodeCount = Object.keys(this.jm.get_nodes()).length
      if (nodeCount < 100) {
        this.applySelectNodes = this._select_nodes.bind(this)
      } else {
        // 每一百个节点增加20ms的防抖
        const interval = nodeCount * 0.2
        this.applySelectNodes = _.debounce(this._select_nodes, interval).bind(this)
      }
      e.stopPropagation()
    } else {
      this.drag_end(e)
    }
  }

  /**
   * 触发拖动
   * @param e {MouseEvent}
   */
  drag (e) {
    if (!(e.button === 0 && e.buttons === 1)) return this.drag_end(e)
    if (e.target && !this.active) {
      // 初始触发的处理，禁用掉右键菜单，免得拖拽结束的时候触发
      this.target.addEventListener('contextmenu', this.disable_event)
      this.active = true
    }
    this.rectW = e.offsetX - this.offsetX
    this.rectH = e.offsetY - this.offsetY
    // 绘制框选框
    if (!this.canvas) this._create_canvas()
    this._draw_rect()
    // 选中节点
    this.applySelectNodes()
  }

  /**
   * 结束拖动
   * @param e {MouseEvent}
   */
  drag_end (e) {
    this.jm.view.container.removeEventListener('mousemove', this.dragHandler)
    this._destroy_canvas()
    setTimeout(() => {
      if (this.target) {
        // 恢复右键菜单响应
        this.target.removeEventListener('contextmenu', this.disable_event)
        this.target = null
      }
      this.active = false
    }, 0)
  }

  /**
   * 禁用事件的处理方法，用于禁用 contextmenu
   * @param e
   */
  disable_event (e) {
    e.preventDefault()
    e.stopPropagation()
  }

}
