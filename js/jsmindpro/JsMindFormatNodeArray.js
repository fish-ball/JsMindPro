import JsMind from './JsMind'
import JsMindMind from './JsMindMind'
import JsMindFormatBase from './JsMindFormatBase'

export default class JsMindFormatNodeArray extends JsMindFormatBase {
  static example = {
    "meta": {
      "name": 'Albert Einstein',
      "author": 'fish-ball',
      "version": '1.0'
    },
    "format": "node_array",
    "data": [
      {"id": "root", "topic": "jsMind Example", "isroot": true}
    ]
  }

  /**
   * 用指定的数据源生成一个 JsMindMind 对象
   * @param source {Object} 数据源
   * @returns {JsMindMind}
   */
  static async get_mind (source) {
    let mind = new JsMindMind()
    mind.name = source.meta.name
    mind.author = source.meta.author
    mind.version = source.meta.version
    await this._parse(mind, source.data)
    return mind
  }

  static get_data (mind) {
    let df = JsMind.format.node_array
    let json = {}
    json.meta = {
      name: mind.name,
      author: mind.author,
      version: mind.version
    }
    json.format = 'node_array'
    json.data = []
    df._array(mind, json.data)
    return json
  }

  /**
   * 从 node_array 中展开输入填入 mind
   * @param mind
   * @param nodeArray {Object[]}
   * @private
   */
  static async _parse (mind, nodeArray) {
    // 切片复制一份
    const arr = nodeArray.slice(0)
    // 翻转一下快点
    arr.reverse()
    const rootId = await this._extract_root(mind, arr)
    if (!rootId) throw new Error('root node can not be found')
    await this._extract_subnode(mind, rootId, arr)
  }

  /**
   * 解析出根节点
   * @param mind {JsMindMind}
   * @param nodeArray {[]}
   * @returns {Promise<Integer|String|null>} 返回根节点的 id
   * @private
   */
  static _extract_root (mind, nodeArray) {
    let i = nodeArray.length
    while (i--) {
      if (nodeArray[i].isroot) {
        let rawNode = nodeArray[i]
        let data = this._extract_data(rawNode)
        mind.set_root(rawNode.id, rawNode.topic, data)
        nodeArray.splice(i, 1)
        return rawNode.id
      }
    }
    return null
  }

  /**
   * 从 node_array 里面解析并提取子节点到 parentId 的节点子集中
   * @param mind {JsMindMind}
   * @param parentId {Integer|String}
   * @param nodeArray {Object[]} 原始节点数据
   * @returns {Promise<number>}
   * @private
   */
  static async _extract_subnode (mind, parentId, nodeArray) {
    let i = nodeArray.length
    let extract_count = 0
    while (i--) {
      const rawNode = nodeArray[i]
      if (rawNode.parentid !== parentId) continue
      const data = await this._extract_data(rawNode)
      let d = null
      let direction = rawNode.direction
      if (!!direction) {
        d = direction === 'left' ? JsMind.direction.left : JsMind.direction.right
      }
      await mind.add_node(parentId, rawNode.id, rawNode.topic, data, -1, d, rawNode.expanded)
      nodeArray.splice(i, 1)
      extract_count++
      let sub_extract_count = await this._extract_subnode(mind, rawNode.id, nodeArray)
      if (sub_extract_count > 0) {
        // reset loop index after extract subordinate node
        i = nodeArray.length
        extract_count += sub_extract_count
      }
    }
    return extract_count
  }

  /**
   * 整理一个原始数据，剔除一些保留字段之后产生一个剩余字段的对象作为原始对象
   * @param rawNode {Object}
   * @private
   */
  static _extract_data (rawNode) {
    let data = {}
    Object.keys(rawNode).forEach(k => {
      if (!/^id|topic|parentid|isroot|direction|expanded$/.test(k)) {
        data[k] = rawNode[k]
      }
    })
    return data
  }

  static _array (mind, node_array) {
    let df = JsMind.format.node_array
    df._array_node(mind.root, node_array)
  }

  static _array_node (node, node_array) {
    let df = JsMind.format.node_array
    if (!(node instanceof JsMindNode)) {
      return
    }
    let o = {
      id: node.id,
      topic: node.topic,
      expanded: node.expanded
    }
    if (!!node.parent) {
      o.parentid = node.parent.id
    }
    if (node.isroot) {
      o.isroot = true
    }
    if (!!node.parent && node.parent.isroot) {
      o.direction = node.direction == JsMind.direction.left ? 'left' : 'right'
    }
    if (node.data != null) {
      let node_data = node.data
      for (let k in node_data) {
        o[k] = node_data[k]
      }
    }
    node_array.push(o)
    let ci = node.children.length
    for (let i = 0; i < ci; i++) {
      df._array_node(node.children[i], node_array)
    }
  }
}
