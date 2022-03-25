import JsMind from './JsMind'
import JsMindNodeLayout from './JsMindNodeLayout'


export default class JsMindLayout {
  constructor (jm, options) {
    this.opts = options
    this.jm = jm
    this.isside = this.opts.mode === 'side'
    /** 布局的边界坐标值 North/South/West/East
     * @type {{n: number, s: number, w: number, e: number}}
     */
    this.bounds = {n: 0, s: 0, w: 0, e: 0}

    this.cache_valid = false
  }

  reset () {
    this.bounds = {n: 0, s: 0, w: 0, e: 0}
  }

  /**
   * 计算所有节点的界面布局位置，存放到 layout 逻辑对象中
   * 暂时不渲染到 DOM
   * 前置条件: node.meta.view 的宽度和高度已经被正确计算
   */
  layout () {
    this._layout_direction_root()
    this._layout_offset()
  }

  /**
   * 获取某个节点的偏移量
   * @param node {JsMindNode}
   * @returns {{x: number, y: number}}
   */
  get_node_offset (node) {
    const layout = node.meta.layout
    if (('offset' in layout) && this.cache_valid) return layout.offset
    let x = layout.offset_x
    let y = layout.offset_y
    if (!node.isroot) {
      const {x: dx, y: dy} = this.get_node_offset(node.parent)
      x += dx
      y += dy
    }
    return {x, y}
  }

  /**
   * 获取节点的坐标
   * @param node
   * @returns {{x: Number, y: Number}}
   */
  get_node_point (node) {
    let offset = this.get_node_offset(node)
    return {
      x: offset.x + node.meta.view.width * (node.meta.layout.direction - 1) / 2,
      y: offset.y - node.meta.view.height / 2
    }
  }

  /**
   * 获取某个节点的进入点（父节点连过来的线的连接点）
   * @param node {JsMindNode}
   * @returns {{x: number, y: number}|*}
   */
  get_node_point_in (node) {
    return this.get_node_offset(node)
  }

  /**
   * 获取某个节点的退出点（父节点连过来的线的连接点）
   * @param node {JsMindNode}
   * @returns {{x: number, y: number}|null}
   */
  get_node_point_out (node) {
    const layoutData = node.meta.layout
    const viewData = node.meta.view
    let poutCache = null
    if (('_pout_' in layoutData) && this.cache_valid) {
      poutCache = layoutData._pout_
    } else {
      poutCache = {x: -1, y: -1}
      layoutData._pout_ = poutCache
    }
    if (poutCache.x === -1 || poutCache.y === -1) {
      if (node.isroot) {
        poutCache.x = 0
        poutCache.y = 0
      } else {
        const offset = this.get_node_offset(node)
        poutCache.x = offset.x + (viewData.width + this.opts.pspace) * layoutData.direction
        poutCache.y = offset.y
      }
    }
    return poutCache
  }

  /**
   * 计算折叠点空间的坐标
   * @param node {JsMindNode}
   */
  get_expander_point (node) {
    console.log('get_expander_point', node.data.name)
    let p = this.get_node_point_out(node)
    let ex_p = {}
    if (node.meta.layout.direction === JsMind.direction.right) {
      ex_p.x = p.x - this.opts.pspace
    } else {
      ex_p.x = p.x
    }
    ex_p.y = p.y - node.meta.view.expander.offsetHeight / 2
    return ex_p
  }

  /**
   * 获取当前画布的包裹大小
   * @returns {{w: number, h: number}}
   */
  get_min_size () {
    _.forEach(this.jm.mind.nodes, node => {
      const pout = this.get_node_point_out(node)
      this.bounds.e = Math.max(pout.x, this.bounds.e)
      this.bounds.w = Math.min(pout.x, this.bounds.w)
    })
    return {
      w: this.bounds.e - this.bounds.w,
      h: this.bounds.s - this.bounds.n
    }
  }

  /**
   * 切换节点的展开和折叠状态
   * @param node {JsMindNode}
   */
  toggle_node (node) {
    // 根节点不允许折叠
    if (node.isroot) return
    if (node.expanded) {
      this.collapse_node(node)
    } else {
      this.expand_node(node)
    }
  }

  /**
   * 展开节点
   * @param node {JsMindNode}
   * @param deep {Boolean} 是否级联展开
   */
  expand_node (node, deep = false) {
    node.expanded = true
    this.part_layout(node)
    this.set_visible(node.children, true)
    // 级联展开的操作
    if (deep) {
      node.children.forEach(child => {
        this.expand_node(child, true)
      })
    }
  }

  /**
   * 折叠节点
   * @param node {JsMindNode}
   */
  collapse_node (node) {
    node.expanded = false
    this.part_layout(node)
    this.set_visible(node.children, false)
  }

  expand_all () {
    let nodes = this.jm.mind.nodes
    let c = 0
    let node
    for (let nodeid in nodes) {
      node = nodes[nodeid]
      if (!node.expanded) {
        node.expanded = true
        c++
      }
    }
    if (c > 0) {
      let root = this.jm.mind.root
      this.part_layout(root)
      this.set_visible(root.children, true)
    }
  }

  collapse_all () {
    let nodes = this.jm.mind.nodes
    let c = 0
    let node
    for (let nodeid in nodes) {
      node = nodes[nodeid]
      if (node.expanded && !node.isroot) {
        node.expanded = false
        c++
      }
    }
    if (c > 0) {
      let root = this.jm.mind.root
      this.part_layout(root)
      this.set_visible(root.children, true)
    }
  }

  /**
   * 将某个子节点展开到指定深度
   * @param targetDepth
   * @param nodes
   * @param depth
   */
  expand_to_depth (targetDepth, nodes = null, depth = 1) {
    if (targetDepth < 1) return
    nodes = nodes || this.jm.mind.root.children
    nodes.forEach(node => {
      if (depth < targetDepth) {
        if (!node.expanded) this.expand_node(node)
        this.expand_to_depth(targetDepth, node.children, depth + 1)
      } else if (depth === targetDepth) {
        if (node.expanded) this.collapse_node(node)
      }
    })
  }

  /**
   * 局部布局一个节点
   * @param node {JsMindNode}
   */
  part_layout (node) {
    let root = this.jm.mind.root
    let rootLayout = root.meta.layout
    if (node.isroot) {
      rootLayout.outer_height_right =
        this._layout_offset_subnodes_height(rootLayout.right_nodes)
      rootLayout.outer_height_left =
        this._layout_offset_subnodes_height(rootLayout.left_nodes)
    } else if (node.meta.layout.direction === JsMind.direction.right) {
      rootLayout.outer_height_right =
        this._layout_offset_subnodes_height(rootLayout.right_nodes)
    } else {
      rootLayout.outer_height_left =
        this._layout_offset_subnodes_height(rootLayout.left_nodes)
    }
    this.bounds.s = Math.max(rootLayout.outer_height_left, rootLayout.outer_height_right)
    this.cache_valid = false
  }

  /**
   * 递归设置某批节点可见或者不可见
   * @param nodes {JsMindNode[]}
   * @param visible {Boolean}
   */
  set_visible (nodes, visible) {
    nodes.forEach(node => {
      if (node.expanded) {
        this.set_visible(node.children, visible)
      } else {
        this.set_visible(node.children, false)
      }
      if (!node.isroot) node.meta.layout.visible = visible
    })
  }

  /**
   * 纯粹递归计算所有节点的 layout.direction 方向，
   * 以及 side_index 分边序号
   * @private
   */
  _layout_direction_root () {
    let root = this.jm.mind.root
    // logger.debug(node)
    root.meta.layout.direction = JsMind.direction.center
    root.meta.layout.side_index = 0
    if (this.isside) {
      // 纯右侧布局的处理
      root.children.forEach((node, i) => {
        this._layout_direction_side(node, JsMind.direction.right, i)
      })
    } else {
      // 双侧布局的处理
      let leftCount = 0
      let rightCount = 0
      root.children.forEach(node => {
        if (node.direction === JsMind.direction.left) {
          this._layout_direction_side(node, JsMind.direction.left, leftCount)
          leftCount += 1
        } else {
          this._layout_direction_side(node, JsMind.direction.right, rightCount)
          rightCount += 1
        }
      })
    }
  }

  /**
   * 布局一个节点到指定的方向
   * @param node {JsMindNode} 节点
   * @param direction {Number} 这个节点的布局方向
   * @param sideIndex {Number} 这个节点在指定方向的序号
   * @private
   */
  _layout_direction_side (node, direction, sideIndex) {
    node.meta.layout.direction = direction
    node.meta.layout.side_index = sideIndex
    node.children.forEach((child, i) => {
      this._layout_direction_side(child, direction, i)
    })
  }

  /**
   * 调整全部节点的布局定位
   * @private
   */
  _layout_offset () {
    let root = this.jm.mind.root
    const layout = root.meta.layout
    layout.offset_x = 0
    layout.offset_y = 0
    layout.outer_height = 0
    layout.left_nodes = []
    layout.right_nodes = []
    root.children.forEach(child => {
      if (child.meta.layout.direction === JsMind.direction.right) {
        layout.right_nodes.push(child)
      } else {
        layout.left_nodes.push(child)
      }
    })
    layout.outer_height_left = this._layout_offset_subnodes(layout.left_nodes)
    layout.outer_height_right = this._layout_offset_subnodes(layout.right_nodes)
    // 计算整个布局的东南西北边界
    this.bounds.e = root.meta.view.width / 2
    this.bounds.w = 0 - this.bounds.e
    this.bounds.n = 0
    this.bounds.s = Math.max(layout.outer_height_left, layout.outer_height_right)
  }

  /**
   * 调整一系列子节点的布局定位
   * @param nodes {JsMindNode[]}
   * @private
   */
  _layout_offset_subnodes (nodes) {
    let totalHeight = 0
    let baseY = 0
    nodes.forEach(node => {
      const layout = node.meta.layout
      layout.outer_height = this._layout_offset_subnodes(node.children)
      if (!node.expanded) {
        layout.outer_height = 0
        this.set_visible(node.children, false)
      }
      layout.outer_height = Math.max(node.meta.view.height, layout.outer_height)
      layout.offset_y = baseY + layout.outer_height / 2
      layout.offset_x = this.opts.hspace * node.direction +
        node.parent.meta.view.width * (node.parent.direction + node.direction) / 2
      if (!node.parent.isroot) layout.offset_x += this.opts.pspace * node.direction
      baseY = baseY + layout.outer_height + this.opts.vspace
      totalHeight += layout.outer_height
    })
    totalHeight += this.opts.vspace * (nodes.length - 1)
    nodes.forEach(node => {
      node.meta.layout.offset_y -= totalHeight / 2
    })
    return totalHeight
  }

  // layout the y axis only, for collapse/expand a node
  /**
   * 布局一组 nodes（应该为某个节点的所有 children，根节点左右分布除外）
   * 并返回布局的高度
   * @param nodes
   * @returns {number}
   * @private
   */
  _layout_offset_subnodes_height (nodes) {
    let totalHeight = 0
    let base_y = 0
    nodes.forEach(node => {
      let outerHeight = this._layout_offset_subnodes_height(node.children)
      if (!node.expanded) outerHeight = 0
      outerHeight = Math.max(node.meta.view.height, outerHeight)

      node.meta.layout.outer_height = outerHeight
      node.meta.layout.offset_y = base_y - outerHeight / 2
      base_y = base_y - outerHeight - this.opts.vspace
      totalHeight += outerHeight
    })
    if (nodes.length > 1) {
      totalHeight += this.opts.vspace * (nodes.length - 1)
    }
    nodes.forEach(node => {
      node.meta.layout.offset_y += totalHeight / 2
    })
    //logger.debug(node.topic)
    //logger.debug(node.meta.layout.offset_y)
    return totalHeight
  }

}
