/**
 * TODO: 尚未完成异步化重构，暂时别用
 */

import JsMind from './JsMind'
import JsMindMind from './JsMindMind'
import JsMindFormatBase from './JsMindFormatBase'


export default class JsMindForMatNodeTree extends JsMindFormatBase {
  static example = {
    "meta": {
      "name": 'Albert Einstein',
      "author": 'fish-ball',
      "version": '1.0'
    },
    "format": "node_tree",
    "data": {"id": "root", "topic": "jsMind Example"}
  }

  static get_mind (source) {
    let df = JsMind.format.node_tree
    let mind = new JsMindMind()
    mind.name = source.meta.name
    mind.author = source.meta.author
    mind.version = source.meta.version
    df._parse(mind, source.data)
    return mind
  }

  static get_data (mind) {
    let df = JsMind.format.node_tree
    let json = {}
    json.meta = {
      name: mind.name,
      author: mind.author,
      version: mind.version
    }
    json.format = 'node_tree'
    json.data = df._buildnode(mind.root)
    return json
  }

  static _parse (mind, node_root) {
    let df = JsMind.format.node_tree
    let data = df._extract_data(node_root)
    mind.set_root(node_root.id, node_root.topic, data)
    if ('children' in node_root) {
      let children = node_root.children
      for (let i = 0; i < children.length; i++) {
        df._extract_subnode(mind, mind.root, children[i])
      }
    }
  }

  static _extract_data (node_json) {
    let data = {}
    for (let k in node_json) {
      if (k == 'id' || k == 'topic' || k == 'children' || k == 'direction' || k == 'expanded') {
        continue
      }
      data[k] = node_json[k]
    }
    return data
  }

  static _extract_subnode (mind, node_parent, node_json) {
    let df = JsMind.format.node_tree
    let data = df._extract_data(node_json)
    let d = null
    if (node_parent.isroot) {
      d = node_json.direction === 'left' ? JsMind.direction.left : JsMind.direction.right
    }
    let node = mind.add_node(node_parent, node_json.id, node_json.topic, data, void 0, d, node_json.expanded)
    if ('children' in node_json) {
      let children = node_json.children
      for (let i = 0; i < children.length; i++) {
        df._extract_subnode(mind, node, children[i])
      }
    }
  }

  static _buildnode (node) {
    let df = JsMind.format.node_tree
    if (!(node instanceof JsMindNode)) {
      return
    }
    let o = {
      id: node.id,
      topic: node.topic,
      expanded: node.expanded
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
    let children = node.children
    if (children.length > 0) {
      o.children = []
      for (let i = 0; i < children.length; i++) {
        o.children.push(df._buildnode(children[i]))
      }
    }
    return o
  }
}


