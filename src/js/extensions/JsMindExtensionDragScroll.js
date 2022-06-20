import _ from 'lodash-es'
import JsMind from '../JsMind'
import {DIRECTION, EVENT_TYPE} from '../JsMind'
import JsMindNode from '../JsMindNode'
import JsMindUtil from '../JsMindUtil'
import JsMindPlugin from '../JsMindPlugin'

class JsMindExtensionDragScroll {

  constructor (jm) {
    /** @type JsMind */
    this.jm = jm
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
    // this.dragHandler = _.debounce(this.drag).bind(this)
    this.dragHandler = this.drag.bind(this)
  }

  /**
   * 绑定拖拽相关的的事件
   * @private
   */
  _event_bind () {
    let ext = this
    let container = this.jm.view.container
    JsMindUtil.dom.add_event(container, 'mousedown', function (e) {
      ext.drag_start.call(ext, e)
    })
    // JsMindUtil.dom.add_event(container, 'mousemove', function (e) {
    //   _.debounce(ext.drag).call(ext, e)
    // })
    JsMindUtil.dom.add_event(container, 'mouseup', function (e) {
      ext.drag_end.call(ext, e)
    })
    JsMindUtil.dom.add_event(container, 'touchstart', function (e) {
      ext.drag_start.call(ext, e)
    })
    // JsMindUtil.dom.add_event(container, 'touchmove', function (e) {
    //   _.debounce(ext.drag).call(ext, e || event)
    // })
    JsMindUtil.dom.add_event(container, 'touchend', function (e) {
      if (!ext.jm.options.editable) return // 必须支持编辑才响应
      ext.drag_end.call(ext, e || event)
    })
  }

  /**
   * 开始拖动
   * @param e {MouseEvent|TouchEvent}
   */
  drag_start (e) {
    const el = this.jm.view.container.getElementsByClassName('jsmind-inner')[0]
    // 必须是单按右键，并且点在空白地方才生效
    if (e.button === 2 && e.buttons === 2 && e.target.parentElement === el) {
      // 禁用掉右键菜单，免得拖拽结束的时候触发
      this.target = e.target
      this.startX = e.screenX
      this.startY = e.screenY
      this.scrollX = el.scrollLeft
      this.scrollY = el.scrollTop
      this.jm.view.container.addEventListener('mousemove', this.dragHandler)
      this.jm.view.container.addEventListener('touchmove', this.dragHandler)
    } else {
      this.drag_end(e)
    }
  }

  /**
   * 触发拖动
   * @param e {MouseEvent|TouchEvent}
   */
  drag (e) {
    const el = this.jm.view.container.getElementsByClassName('jsmind-inner')[0]
    el.scrollLeft = this.scrollX - e.screenX + this.startX
    el.scrollTop = this.scrollY - e.screenY + this.startY
    if (e.target && !this.active) {
      this.target.addEventListener('contextmenu', this.disable_event)
      this.active = true
    }
  }

  /**
   * 结束拖动
   * @param e {MouseEvent|TouchEvent}
   */
  drag_end (e) {
    if (this.target) {
      this.jm.view.container.removeEventListener('mousemove', this.dragHandler)
      this.jm.view.container.removeEventListener('touchmove', this.dragHandler)
      setTimeout(() => {
        this.target.removeEventListener('contextmenu', this.disable_event)
        this.target = null
      }, 0)
    }
    this.active = false
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

(function () {
  if (JsMind.drag_scroll !== void 0) return

  const plugin = new JsMindPlugin('drag_scroll', function (jm) {
    const ext = new JsMindExtensionDragScroll(jm)
    ext.init()
  })

  JsMind.register_plugin(plugin)
})()
