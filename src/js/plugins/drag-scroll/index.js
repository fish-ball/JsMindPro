import JsMindPlugin from '../../JsMindPlugin'

export default class JsMindPluginDragScroll extends JsMindPlugin {

  static plugin_name = 'drag-scroll'

  constructor (jm) {
    super(jm)
    this.target = null
    this.startX = 0
    this.startY = 0
    this.dragHandler = null
    this.active = false
  }

  /**
   * 初始化插件
   */
  init () {
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
   * 开始拖动
   * @param e {MouseEvent}
   */
  drag_start (e) {
    const el = this.jm.view.container.getElementsByClassName('jsmind-inner')[0]
    // 必须是单按右键，并且点在空白地方才生效
    if (e.button === 2 && e.buttons === 2 && e.target.parentElement === el) {
      this.target = e.target
      this.startX = e.clientX
      this.startY = e.clientY
      this.scrollX = el.scrollLeft
      this.scrollY = el.scrollTop
      this.jm.view.container.addEventListener('mousemove', this.dragHandler)
    } else {
      this.drag_end(e)
    }
  }

  /**
   * 触发拖动
   * @param e {MouseEvent}
   */
  drag (e) {
    if (!(e.button === 0 && e.buttons === 2)) return this.drag_end(e)
    const el = this.jm.view.container.getElementsByClassName('jsmind-inner')[0]
    el.scrollLeft = this.scrollX - e.clientX + this.startX
    el.scrollTop = this.scrollY - e.clientY + this.startY
    if (e.target && !this.active) {
      // 禁用掉右键菜单，免得拖拽结束的时候触发
      this.target.addEventListener('contextmenu', this.disable_event)
      this.active = true
    }
  }

  /**
   * 结束拖动
   * @param e {MouseEvent}
   */
  drag_end (e) {
    this.jm.view.container.removeEventListener('mousemove', this.dragHandler)
    setTimeout(() => {
      if (this.target) {
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
