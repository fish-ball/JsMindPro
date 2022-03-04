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

  static get_mind (source) {
    let df = JsMind.format.node_array
    let mind = new JsMindMind()
    mind.name = source.meta.name
    mind.author = source.meta.author
    mind.version = source.meta.version
    df._parse(mind, source.data)
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

  static _parse (mind, node_array) {
    let df = JsMind.format.node_array
    let narray = node_array.slice(0)
    // reverse array for improving looping performance
    narray.reverse()
    let root_id = df._extract_root(mind, narray)
    if (!!root_id) {
      df._extract_subnode(mind, root_id, narray)
    } else {
      logger.error('root node can not be found')
    }
  }

  static _extract_root (mind, node_array) {
    let df = JsMind.format.node_array
    let i = node_array.length
    while (i--) {
      if ('isroot' in node_array[i] && node_array[i].isroot) {
        let root_json = node_array[i]
        let data = df._extract_data(root_json)
        mind.set_root(root_json.id, root_json.topic, data)
        node_array.splice(i, 1)
        return root_json.id
      }
    }
    return null
  }

  static _extract_subnode (mind, parentid, node_array) {
    let df = JsMind.format.node_array
    let i = node_array.length
    let node_json = null
    let data = null
    let extract_count = 0
    while (i--) {
      node_json = node_array[i]
      if (node_json.parentid === parentid) {
        data = df._extract_data(node_json)
        let d = null
        let node_direction = node_json.direction
        if (!!node_direction) {
          d = node_direction == 'left' ? JsMind.direction.left : JsMind.direction.right
        }
        mind.add_node(parentid, node_json.id, node_json.topic, data, null, d, node_json.expanded)
        node_array.splice(i, 1)
        extract_count++
        let sub_extract_count = df._extract_subnode(mind, node_json.id, node_array)
        if (sub_extract_count > 0) {
          // reset loop index after extract subordinate node
          i = node_array.length
          extract_count += sub_extract_count
        }
      }
    }
    return extract_count
  }

  static _extract_data (node_json) {
    let data = {}
    for (let k in node_json) {
      if (k == 'id' || k == 'topic' || k == 'parentid' || k == 'isroot' || k == 'direction' || k == 'expanded') {
        continue
      }
      data[k] = node_json[k]
    }
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
