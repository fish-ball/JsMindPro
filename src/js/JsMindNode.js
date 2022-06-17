import JsMindNodeMeta from './JsMindNodeMeta'
import {DIRECTION} from './JsMind'

export default class JsMindNode {
  /**
   * 构造一个 JsMind 节点
   * @param id {Number|String}
   * @param index {Number}
   * @param topic {String}
   * @param data {{}}
   * @param parent {JsMindNode}
   * @param direction {Number}
   * @param expanded {Boolean}
   */
  constructor (id, index, topic, data, parent = null,
               direction = DIRECTION.center, expanded = true) {
    if (!id) throw new Error('Invalid node id')
    if (typeof index !== 'number') throw new Error('Invalid node index')
    this.id = id
    this.index = index
    this.topic = topic
    this.data = data || {}
    this.parent = parent
    this.direction = direction
    this.expanded = expanded
    this.children = []
    /** @type {JsMindNodeMeta} */
    this.meta = new JsMindNodeMeta()
  }

  /**
   * 转换为串行化的节点 Object
   * @returns {Object}
   */
  serialize () {
    return {
      id: this.id,
      topic: this.topic,
      parentid: this.parent && this.parent.id,
      data: JSON.parse(JSON.stringify(this.data))
    }
  }

  /**
   * 返回一个节点是否根节点
   * @returns {boolean}
   */
  is_root () {
    return !this.parent
  }

  /**
   * 修改当前节点的名字
   * @param newId
   */
  rename (newId) {
    this.id = newId
    if (this.meta.view.element) this.meta.view.element.setAttribute('nodeid', newId)
    if (this.meta.view.expander) this.meta.view.expander.setAttribute('nodeid', newId)
  }

  /**
   * 加载元素的宽高，回写到 meta.view 对象中
   */
  init_size () {
    let view = this.meta.view
    view.width = view.element.offsetWidth
    view.height = view.element.offsetHeight
  }

  /**
   * 为当前的 node 对象创建一个 DOM 节点，挂载到 elParent 中
   * @param elParent {Node}
   * @param view {JsMindView}
   * @returns {Promise<void>}
   */
  async create_element (elParent, view) {
    // 添加 Node 的 DOM 元素
    const elNode = document.createElement('div')
    elNode.className = 'jmnode'
    elNode.setAttribute('nodeid', this.id)
    // elNode.style.visibility = 'hidden'
    elParent.appendChild(elNode)
    this.meta.view.element = elNode
    // 添加折叠器 DOM
    if (this.is_root()) {
      elNode.classList.add('root')
    } else {
      // 为父元素创建一个 expander
      const elExpander = document.createElement('div')
      elExpander.className = 'jmexpander'
      elExpander.innerText = '-'
      elExpander.setAttribute('nodeid', this.id)
      elParent.appendChild(elExpander)
      this.meta.view.expander = elExpander
    }
    // 刷新渲染状态
    await view.update_node(this)
  }

  /**
   * 在 view 中销毁这个节点的元素
   */
  destroy () {
    if (this.meta.view.element) {
      this.meta.view.element.parentElement.removeChild(this.meta.view.element)
      this.meta.view.element = null
    }
    if (this.meta.view.expander) {
      this.meta.view.expander.parentElement.removeChild(this.meta.view.expander)
      this.meta.view.expander = null
    }
  }

  /**
   * 返回当前节点是否可见
   * @returns {Boolean}
   */
  is_visible () {
    return this.meta.layout.visible
  }

  /**
   * 选中一个节点（更新其 css class）
   * @param focus {Boolean} 选定后是否定位到焦点
   */
  select (focus = true) {
    if (this.meta.view.element) {
      this.meta.view.element.classList.add('selected')
      if (focus) {
        this.meta.view.element.scrollIntoView({
          behavior: 'smooth', // auto(default)/smooth
          block: 'nearest', // Vertical: start(default)/center/end/nearest
          inline: 'nearest' // Horizontal: start/center/end/nearest(default)
        })
      }
    }
  }

  /**
   * 取消选中一个节点（更新其 css class）
   */
  deselect () {
    if (this.meta.view.element) {
      this.meta.view.element.classList.remove('selected')
    }
  }

  /**
   * 获取当前节点的 view 坐标值
   * @returns {{x: Number, y: Number}}
   */
  get_location () {
    return {
      x: this.meta.view.abs_x,
      y: this.meta.view.abs_y
    }
  }

  /**
   * 将节点移动到屏幕显示区域中
   */
  scroll_into_view (options = {behavior: 'smooth', block: 'center', inline: 'center'}) {
    this.meta.view.element.scrollIntoView(options)
  }

  /**
   * 获取当前节点的 view 尺寸（宽高）
   * @returns {{w: Number, h: Number}}
   */
  get_size () {
    return {
      w: this.meta.view.width,
      h: this.meta.view.height
    }
  }

  /**
   * 判断当前节点是否为另一个节点的祖先（或其本身）
   * @param node {JsMindNode}
   * @returns {boolean}
   */
  is_ancestor_of (node) {
    return !!node && (node === this || this.is_ancestor_of(node.parent))
  }

  /**
   * 获取当前节点在布局中的偏移量（等于上级连接线到当前节点的进入点）
   * 实际就是从父节点的偏移量按路径累加
   * @returns {{x: number, y: number}}
   */
  get_layout_offset () {
    const layout = this.meta.layout
    // TODO: 缓存事实上未实装
    if (layout.offset_cache) return layout.offset_cache
    const x = layout.offset_x
    const y = layout.offset_y
    if (this.is_root()) return {x, y}
    const {x: dx, y: dy} = this.parent.get_layout_offset()
    return {x: x + dx, y: y + dy}
  }

  /**
   * 获取当前节点连接到下级节点的连接线起点（等于当前节点折叠器的外侧位置）
   * 实际就是从父节点的偏移量按路径累加
   * @returns {{x: number, y: number}}
   */
  get_layout_offset_out () {
    const layout = this.meta.layout
    const view = this.meta.view
    if (this.is_root()) return {x: 0, y: 0}
    const {x, y} = this.get_layout_offset()
    // TODO: 如何注入配置？
    const pspace = 10
    return {x: x + (view.width + pspace) * layout.direction, y}
  }

  /**
   * 获取节点的坐标（左上角）
   * @returns {{x: Number, y: Number}}
   */
  get_layout_offset_top_left () {
    const offset = this.get_layout_offset()
    return {
      x: offset.x + this.meta.view.width * (this.meta.layout.direction - 1) / 2,
      y: offset.y - this.meta.view.height / 2
    }
  }

  /**
   * 获取节点的折叠器位置坐标
   * @returns {{x: Number, y: Number}}
   */
  get_layout_offset_expander () {
    // TODO: 如何注入配置
    const pspace = 10
    const {x, y} = this.get_layout_offset_out()
    return {
      x: x - pspace * (this.direction + 1) / 2, // 仅当 right 的时候向左移动一个折叠器宽度
      y: y - pspace / 2
    }
  }

}
