import JsMindNodeMeta from './JsMindNodeMeta'
import {DIRECTION} from './JsMind'

export default class JsMindNode {
  /**
   * 构造一个 JsMind 节点
   * @param id {Number|String}
   * @param index {Number}
   * @param topic {String}
   * @param data {{}}
   * @param isroot {Boolean}
   * @param parent {JsMindNode}
   * @param direction {Number}
   * @param expanded {Boolean}
   */
  constructor (id, index, topic, data, isroot, parent = null,
               direction = DIRECTION.center, expanded = true) {
    if (!id) throw new Error('Invalid node id')
    if (typeof index !== 'number') throw new Error('Invalid node index')
    this.id = id
    this.index = index
    this.topic = topic
    this.data = data || {}
    this.isroot = isroot
    this.parent = parent
    this.direction = direction
    this.expanded = expanded
    this.children = []
    /** @type {JsMindNodeMeta} */
    this.meta = new JsMindNodeMeta()
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
   * @param jm {JsMind}
   * @returns {Promise<void>}
   */
  async create_element (elParent, jm) {
    // 添加 Node 的 DOM 元素
    const elNode = document.createElement('div')
    elNode.className = 'jmnode'
    elNode.setAttribute('nodeid', this.id)
    // elNode.style.visibility = 'hidden'
    elParent.appendChild(elNode)
    this.meta.view.element = elNode
    // 添加折叠器 DOM
    if (this.isroot) {
      elNode.classList.add('root')
    } else {
      // 为父元素创建一个 expander
      const elExpander = document.createElement('div')
      elExpander.className = 'jmexpander'
      // $t(elExpander, '-')
      elExpander.innerText = '-'
      elExpander.setAttribute('nodeid', this.id)
      // elExpander.style.visibility = 'hidden'
      elParent.appendChild(elExpander)
      this.meta.view.expander = elExpander
    }
    // 刷新渲染状态
    await jm.view.update_node(this)
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
   */
  select () {
    if (this.meta.view.element) {
      this.meta.view.element.classList.add('selected')
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

}
