import JsMind from './JsMind'
import JsMindNodeView from './JsMindNodeView'
import JsMindNodeMeta from './JsMindNodeMeta'

export default class JsMindNode {
  /**
   * 构造一个 JsMind 节点
   * @param id {Integer|String}
   * @param index {Integer}
   * @param topic {String}
   * @param data {{}}
   * @param isroot {Boolean}
   * @param parent {JsMindNode}
   * @param direction {Integer}
   * @param expanded {Boolean}
   */
  constructor (id, index, topic, data, isroot, parent = null,
               direction = JsMind.direction.center, expanded = true) {
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
   * @param elParent {HTMLElement}
   * @param jm {JsMind}
   */
  createElement (elParent, jm) {
    // 添加 Node 的 DOM 元素
    const elNode = document.createElement('div')
    elNode.className = 'jmnode'
    elNode.setAttribute('nodeid', this.id)
    elNode.style.visibility = 'hidden'
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
      elExpander.style.visibility = 'hidden'
      elParent.appendChild(elExpander)
      this.meta.view.expander = elExpander
    }
    // 刷新渲染状态
    jm.view.update_node(this)
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
   * 选中一个节点
   */
  select () {
    if (this.meta.view.element) {
      this.meta.view.element.classList.add('selected')
    }
  }

  /**
   * 取消选中一个节点
   */
  deselect () {
    if (this.meta.view.element) {
      this.meta.view.element.classList.remove('selected')
    }
  }

  /**
   * 获取当前节点的 view 坐标值
   * @returns {{x: *, y: *}}
   */
  get_location () {
    return {
      x: this.meta.view.abs_x,
      y: this.meta.view.abs_y
    }
  }

  /**
   * 获取当前节点的 view 尺寸（宽高）
   * @returns {{w: number, h: number}}
   */
  get_size () {
    return {
      w: this.meta.view.width,
      h: this.meta.view.height
    }
  }

  /**
   * 重置节点的自定义样式
   * TODO: 这个 API 又长又臭呢，还把 node.data 这么重要的生态位占了，没影响的话删掉算逑了
   */
  reset_node_custom_style () {
    const elNode = this.meta.view.element
    const nodeData = this.data
    if ('background-color' in nodeData) {
      elNode.style.backgroundColor = nodeData['background-color']
    }
    if ('foreground-color' in nodeData) {
      elNode.style.color = nodeData['foreground-color']
    }
    if ('width' in nodeData) {
      elNode.style.width = nodeData['width'] + 'px'
    }
    if ('height' in nodeData) {
      elNode.style.height = nodeData['height'] + 'px'
    }
    if ('font-size' in nodeData) {
      elNode.style.fontSize = nodeData['font-size'] + 'px'
    }
    if ('font-weight' in nodeData) {
      elNode.style.fontWeight = nodeData['font-weight']
    }
    if ('font-style' in nodeData) {
      elNode.style.fontStyle = nodeData['font-style']
    }
    if ('background-image' in nodeData) {
      let backgroundImage = nodeData['background-image']
      if (backgroundImage.startsWith('data') && nodeData['width'] && nodeData['height']) {
        let img = new Image()
        img.onload = function () {
          let c = document.createElement('canvas')
          c.width = elNode.clientWidth
          c.height = elNode.clientHeight
          if (c.getContext) {
            let ctx = c.getContext('2d')
            ctx.drawImage(this, 2, 2, elNode.clientWidth, elNode.clientHeight)
            let scaledImageData = c.toDataURL()
            elNode.style.backgroundImage = 'url(' + scaledImageData + ')'
          }
        }
        img.src = backgroundImage
      } else {
        elNode.style.backgroundImage = 'url(' + backgroundImage + ')'
      }
      elNode.style.backgroundSize = '99%'

      if ('background-rotation' in nodeData) {
        elNode.style.transform = 'rotate(' + nodeData['background-rotation'] + 'deg)'
      }
    }
  }

  //////// STATIC METHODS ////

  static inherited (pnode, node) {
    if (!!pnode && !!node) {
      if (pnode.id === node.id) {
        return true
      }
      if (pnode.isroot) {
        return true
      }
      let pid = pnode.id
      let p = node
      while (!p.isroot) {
        p = p.parent
        if (p.id === pid) {
          return true
        }
      }
    }
    return false
  }

}
