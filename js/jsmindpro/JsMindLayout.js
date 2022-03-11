import JsMind from './JsMind'
import JsMindNodeLayout from './JsMindNodeLayout'

const logger = console


export default class JsMindLayout {
  constructor (jm, options) {
    this.opts = options
    this.jm = jm
    this.isside = this.opts.mode === 'side'
    this.bounds = null

    this.cache_valid = false
  }

  init () {
    logger.debug('layout.init')
  }

  reset () {
    logger.debug('layout.reset')
    this.bounds = {n: 0, s: 0, w: 0, e: 0}
  }

  layout () {
    this._layout_direction_root()
    this._layout_offset()
  }

  /**
   *
   * @private
   */
  _layout_direction_root () {
    let node = this.jm.mind.root
    // logger.debug(node)
    let children = node.children
    node.meta.layout.direction = JsMind.direction.center
    node.meta.layout.side_index = 0
    if (this.isside) {
      let i = node.children.length
      while (i--) {
        this._layout_direction_side(children[i], JsMind.direction.right, i)
      }
    } else {
      let i = node.children.length
      let subnode = null
      let leftCount = 0
      let rightCount = 0
      while (i--) {
        subnode = children[i]
        if (subnode.direction === JsMind.direction.left) {
          this._layout_direction_side(subnode, JsMind.direction.left, leftCount)
          leftCount += 1
        } else {
          this._layout_direction_side(subnode, JsMind.direction.right, rightCount)
          rightCount += 1
        }
      }
    }
  }

  /**
   * 布局一个节点到指定的方向
   * @param node {JsMindNode} 节点
   * @param direction {Integer} 这个节点的布局方向
   * @param sideIndex {Integer} 这个节点在指定方向的序号
   * @private
   */
  _layout_direction_side (node, direction, sideIndex) {
    let children = node.children
    node.meta.layout.direction = direction
    node.meta.layout.sideIndex = sideIndex
    let i = node.children.length
    while (i--) {
      this._layout_direction_side(children[i], direction, i)
    }
  }

  /**
   * 调整全部节点的布局定位
   * @private
   */
  _layout_offset () {
    let node = this.jm.mind.root
    const layout = node.meta.layout
    layout.offset_x = 0
    layout.offset_y = 0
    layout.outer_height = 0
    layout.left_nodes = []
    layout.right_nodes = []
    node.children.forEach(child => {
      if (child.meta.layout.direction === JsMind.direction.right) {
        layout.right_nodes.push(child)
      } else {
        layout.left_nodes.push(child)
      }
    })
    layout.outer_height_left = this._layout_offset_subnodes(layout.left_nodes)
    layout.outer_height_right = this._layout_offset_subnodes(layout.right_nodes)
    this.bounds.e = node.meta.view.width / 2
    this.bounds.w = 0 - this.bounds.e
    //logger.debug(this.bounds.w)
    this.bounds.n = 0
    this.bounds.s = Math.max(layout.outer_height_left, layout.outer_height_right)
  }

  // layout both the x and y axis
  _layout_offset_subnodes_1 (nodes) {
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
  _layout_offset_subnodes_height (nodes) {
    let total_height = 0
    let nodes_count = nodes.length
    let i = nodes_count
    let node = null
    let node_outer_height = 0
    let layout_data = null
    let base_y = 0
    let pd = null // parent.meta
    while (i--) {
      node = nodes[i]
      layout_data = node.meta.layout
      if (pd == null) {
        pd = node.parent.meta
      }

      node_outer_height = this._layout_offset_subnodes_height(node.children)
      if (!node.expanded) {
        node_outer_height = 0
      }
      node_outer_height = Math.max(node.meta.view.height, node_outer_height)

      layout_data.outer_height = node_outer_height
      layout_data.offset_y = base_y - node_outer_height / 2
      base_y = base_y - node_outer_height - this.opts.vspace
      total_height += node_outer_height
    }
    if (nodes_count > 1) {
      total_height += this.opts.vspace * (nodes_count - 1)
    }
    i = nodes_count
    let middle_height = total_height / 2
    while (i--) {
      node = nodes[i]
      node.meta.layout.offset_y += middle_height
      //logger.debug(node.topic)
      //logger.debug(node.meta.layout.offset_y)
    }
    return total_height
  }

  /**
   * 获取某个节点的偏移量
   * @param node {JsMindNode}
   * @returns {*}
   */
  get_node_offset (node) {
    const layoutData = node.meta.layout
    let offsetCache = null
    if (('_offset_' in layoutData) && this.cache_valid) {
      offsetCache = layoutData._offset_
    } else {
      offsetCache = {x: -1, y: -1}
      layoutData._offset_ = offsetCache
    }
    if (offsetCache.x === -1 || offsetCache.y === -1) {
      let x = layoutData.offset_x
      let y = layoutData.offset_y
      if (!node.isroot) {
        const offset = this.get_node_offset(node.parent)
        x += offset.x
        y += offset.y
      }
      offsetCache.x = x
      offsetCache.y = y
    }
    return offsetCache
  }

  get_node_point (node) {
    let view_data = node.meta.view
    let offset_p = this.get_node_offset(node)
    //logger.debug(offset_p)
    let p = {}
    p.x = offset_p.x + view_data.width * (node.meta.layout.direction - 1) / 2
    p.y = offset_p.y - view_data.height / 2
    //logger.debug(p)
    return p
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

  get_expander_point (node) {
    let p = this.get_node_point_out(node)
    let ex_p = {}
    if (node.meta.layout.direction == JsMind.direction.right) {
      ex_p.x = p.x - this.opts.pspace
    } else {
      ex_p.x = p.x
    }
    ex_p.y = p.y - Math.ceil(this.opts.pspace / 2)
    return ex_p
  }

  get_min_size () {
    let nodes = this.jm.mind.nodes
    let node = null
    let pout = null
    for (let nodeid in nodes) {
      node = nodes[nodeid]
      pout = this.get_node_point_out(node)
      //logger.debug(pout.x)
      if (pout.x > this.bounds.e) {
        this.bounds.e = pout.x
      }
      if (pout.x < this.bounds.w) {
        this.bounds.w = pout.x
      }
    }
    return {
      w: this.bounds.e - this.bounds.w,
      h: this.bounds.s - this.bounds.n
    }
  }

  toggle_node (node) {
    if (node.isroot) {
      return
    }
    if (node.expanded) {
      this.collapse_node(node)
    } else {
      this.expand_node(node)
    }
  }

  expand_node (node) {
    node.expanded = true
    this.part_layout(node)
    this.set_visible(node.children, true)
  }

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

  expand_to_depth (target_depth, curr_nodes, curr_depth) {
    if (target_depth < 1) {
      return
    }
    let nodes = curr_nodes || this.jm.mind.root.children
    let depth = curr_depth || 1
    let i = nodes.length
    let node = null
    while (i--) {
      node = nodes[i]
      if (depth < target_depth) {
        if (!node.expanded) {
          this.expand_node(node)
        }
        this.expand_to_depth(target_depth, node.children, depth + 1)
      }
      if (depth === target_depth) {
        if (node.expanded) {
          this.collapse_node(node)
        }
      }
    }
  }

  part_layout (node) {
    let root = this.jm.mind.root
    if (!!root) {
      let root_layout_data = root.meta.layout
      if (node.isroot) {
        root_layout_data.outer_height_right = this._layout_offset_subnodes_height(root_layout_data.right_nodes)
        root_layout_data.outer_height_left = this._layout_offset_subnodes_height(root_layout_data.left_nodes)
      } else {
        if (node.meta.layout.direction === JsMind.direction.right) {
          root_layout_data.outer_height_right = this._layout_offset_subnodes_height(root_layout_data.right_nodes)
        } else {
          root_layout_data.outer_height_left = this._layout_offset_subnodes_height(root_layout_data.left_nodes)
        }
      }
      this.bounds.s = Math.max(root_layout_data.outer_height_left, root_layout_data.outer_height_right)
      this.cache_valid = false
    } else {
      logger.warn('can not found root node')
    }
  }

  set_visible (nodes, visible) {
    let i = nodes.length
    let node = null
    let layout_data = null
    while (i--) {
      node = nodes[i]
      layout_data = node.meta.layout
      if (node.expanded) {
        this.set_visible(node.children, visible)
      } else {
        this.set_visible(node.children, false)
      }
      if (!node.isroot) {
        node.meta.layout.visible = visible
      }
    }
  }

  is_expand (node) {
    return node.expanded
  }

  is_visible (node) {
    let layout_data = node.meta.layout
    if (('visible' in layout_data) && !layout_data.visible) {
      return false
    } else {
      return true
    }
  }
}
