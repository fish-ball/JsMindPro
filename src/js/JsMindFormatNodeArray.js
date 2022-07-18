import _ from 'lodash-es'
import JsMindFormatBase from './JsMindFormatBase'
import JsMindNode from './JsMindNode'

export default class JsMindFormatNodeArray extends JsMindFormatBase {
  static example = {
    "format": "node_array",
    "data": [
      // 没有 parent 就是 root
      {"id": "root", "topic": "jsMind Example"}
    ]
  }

  /**
   * 从 node_array 中展开输入填入 model
   * @param model {JsMindModel}
   * @param arr {Object[]}
   * @private
   */
  static load (model, arr) {
    // 重置模型数据
    model.root = null
    model.nodes = {}
    // 先创建所有节点
    arr.forEach(node => {
      model.nodes[node.id] = new JsMindNode(
        node.id, -1, node.topic, node.data, null,
        null, node.expanded)
      // 遇到根节点的话将其设置
      if (!node.parentid) {
        if (model.root) throw new Error('More than one root node.')
        model.root = model.nodes[node.id]
      }
    })
    // 没有根节点报错
    if (!model.root) throw new Error('No root node found.')
    arr.forEach(node => {
      if (!node.parentid) return
      const childNode = model.nodes[node.id]
      const parentNode = model.nodes[node.parentid]
      if (!parentNode) throw new Error(`Parent with id=${node.parentid} not found.`)
      childNode.parent = parentNode
      parentNode.children.push(childNode)
    })
    // 整理 model
    model.arrange()
  }

  /**
   * 追加数据
   * @param model {JsMindModel}
   * @param arr {Object[]}
   */
  static append_data (model, arr) {
    // 先创建所有节点
    arr.forEach(node => {
      if (model.nodes[node.id]) {
        // TODO: 如果进入这个分支实际上会导致渲染错误（可能因为引用丢失）
        const nd = model.nodes[node.id]
        nd.topic = node.topic
        nd.data = node.data
      } else {
        // console.log('create_node model:', node.id, node.topic)
        model.nodes[node.id] = new JsMindNode(
          node.id, -1, node.topic, node.data, null,
          null, node.expanded)
      }
    })
    // 整理父链
    arr.forEach(node => {
      if (!node.parentid) return
      const childNode = model.nodes[node.id]
      const parentNode = model.nodes[node.parentid]
      if (!parentNode) throw new Error(`Parent with id=${node.parentid} not found.`)
      childNode.parent = parentNode
      parentNode.children.push(childNode)
    })
    // 整理 model
    model.arrange()
  }

  /**
   * 获取某个 JsMindModel 的 node_array JSON 对象接口格式
   * @param model {JsMindModel}
   * @returns {{format:String, data:Object[]}}
   */
  static dump (model) {
    return {
      format: 'node_array',
      data: _.forEach(model.nodes, node => node.serialize())
    }
  }

}
