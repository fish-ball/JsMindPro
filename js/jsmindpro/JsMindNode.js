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
   * 清除节点的自定义样式
   */
  clear_custom_style () {
    let el = this.meta.view.element
    el.style.backgroundColor = ''
    el.style.color = ''
  }

  /**
   * 加载元素的宽高，回写到 meta.view 对象中
   */
  init_size () {
    let view = this.meta.view
    view.width = view.element.clientWidth
    view.height = view.element.clientHeight
  }

  /**
   * 为当前的 node 对象创建一个 DOM 节点，挂载到 elParent 中
   * @param elParent {HTMLElement}
   * @param jm {JsMind}
   */
  createElement (elParent, jm) {
    // 创建 DOM 元素
    const elNode = document.createElement('jmnode')
    if (this.isroot) {
      elNode.className = 'root'
    } else {
      // 为父元素创建一个 expander
      const elExpander = document.createElement('jmexpander')
      // $t(elExpander, '-')
      elExpander.innerText = '-'
      elExpander.setAttribute('nodeid', this.id)
      elExpander.style.visibility = 'hidden'
      elParent.appendChild(elExpander)
      this.meta.view.expander = elExpander
    }
    if (this.topic) {
      if (jm.options.renderNode instanceof Function) {
        // jm.options.renderNode.call(jm, elNode, node)
        jm.options.renderNode(elNode, this)
        // elNode.innerHTML = ''
        // elNode.appendChild(jm.options.renderNode(document.createElement, this))
      } else if (jm.options.support_html) {
        elNode.innerHTML = this.topic
      } else {
        elNode.innerText = this.topic
        // $t(elNode, this.topic)
      }
    }
    elNode.setAttribute('nodeid', this.id)
    elNode.style.visibility = 'hidden'
    this.reset_node_custom_style()
    elParent.appendChild(elNode)
    this.meta.view.element = elNode
  }

  /**
   * 选中一个节点
   */
  select () {
    this.meta.view.element.className += ' selected'
    this.clear_custom_style()
  }

  /**
   * 取消选中一个节点
   */
  deselect () {
    this.meta.view.element.className =
      this.meta.view.element.className.replace(/\s*selected\b/i, '')
    this.reset_node_custom_style()
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
   */
  reset_node_custom_style () {
    const nodeElement = this.meta.view.element
    const nodeData = this.data
    if ('background-color' in nodeData) {
      nodeElement.style.backgroundColor = nodeData['background-color']
    }
    if ('foreground-color' in nodeData) {
      nodeElement.style.color = nodeData['foreground-color']
    }
    if ('width' in nodeData) {
      nodeElement.style.width = nodeData['width'] + 'px'
    }
    if ('height' in nodeData) {
      nodeElement.style.height = nodeData['height'] + 'px'
    }
    if ('font-size' in nodeData) {
      nodeElement.style.fontSize = nodeData['font-size'] + 'px'
    }
    if ('font-weight' in nodeData) {
      nodeElement.style.fontWeight = nodeData['font-weight']
    }
    if ('font-style' in nodeData) {
      nodeElement.style.fontStyle = nodeData['font-style']
    }
    if ('background-image' in nodeData) {
      let backgroundImage = nodeData['background-image']
      if (backgroundImage.startsWith('data') && nodeData['width'] && nodeData['height']) {
        let img = new Image()
        img.onload = function () {
          let c = document.createElement('canvas')
          c.width = nodeElement.clientWidth
          c.height = nodeElement.clientHeight
          if (c.getContext) {
            let ctx = c.getContext('2d')
            ctx.drawImage(this, 2, 2, nodeElement.clientWidth, nodeElement.clientHeight)
            let scaledImageData = c.toDataURL()
            nodeElement.style.backgroundImage = 'url(' + scaledImageData + ')'
          }
        }
        img.src = backgroundImage
      } else {
        nodeElement.style.backgroundImage = 'url(' + backgroundImage + ')'
      }
      nodeElement.style.backgroundSize = '99%'

      if ('background-rotation' in nodeData) {
        nodeElement.style.transform = 'rotate(' + nodeData['background-rotation'] + 'deg)'
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
