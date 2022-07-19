import JsMindHistoryHandler from './JsMindHistoryHandler'

export class AddNodeHistoryHandler extends JsMindHistoryHandler {

  action = 'add_node'

  async init () {
    this.plugin.jm.add_hook('after_add_node', async ({node}, context) => {
      this.plugin.history_push(this.action, JSON.stringify({
        id: node.id,
        topic: node.topic,
        parent: node.parent.id,
        index: node.index
      }))
    })
  }

  async undo (payload) {
    const jm = this.plugin.jm
    const nodeData = JSON.parse(payload)
    const node = jm.get_node(nodeData.id)
    await jm.remove_node(node)
  }

  async redo (payload) {
    const jm = this.plugin.jm
    const nodeData = JSON.parse(payload)
    const parentNode = jm.get_node(nodeData.parent)
    await jm.add_node(parentNode, nodeData.id, nodeData.topic, null, nodeData.index)
  }
}

export class EditNodeHistoryHandler extends JsMindHistoryHandler {

  action = 'edit_node'

  async init () {
    this.plugin.jm.add_hook('after_update_node', async ({node}, context) => {
      this.plugin.history_push(this.action, JSON.stringify({
        id: node.id,
        oldTopic: context.oldTopic,
        topic: node.topic
      }))
    })
  }

  async undo (payload) {
    const jm = this.plugin.jm
    const {id, oldTopic} = JSON.parse(payload)
    const node = jm.get_node(id)
    await jm.update_node(node, oldTopic)
  }

  async redo (payload) {
    const jm = this.plugin.jm
    const {id, topic} = JSON.parse(payload)
    const node = jm.get_node(id)
    await jm.update_node(node, topic)
  }
}

/**
 * 删除节点的默认处理器，但是恢复的时候会逐个插入，如果涉及后台操作，效果一般
 * 实际处理时，建议重写相关的处理器实现
 */
export class RemoveNodeHistoryHandler extends JsMindHistoryHandler {

  action = 'remove_node'

  async init () {
    this.plugin.jm.add_hook('after_remove_node', async ({nodes}, context) => {
      // 历史栈推入
      this.plugin.history_push(this.action, JSON.stringify({
        ids: nodes.map(node => node.id),
        nodes: context.allNodes.map(node => ({
          id: node.id,
          topic: node.topic,
          parent: node.parent.id,
          index: node.index
        }))
      }))
    })
  }

  async undo (payload) {
    const jm = this.plugin.jm
    const {nodes} = JSON.parse(payload)
    for (const nodeData of nodes) {
      const parent = jm.get_node(nodeData.parent)
      await jm.add_node(parent, nodeData.id, nodeData.topic, null, nodeData.index)
    }
  }

  async redo (payload) {
    const jm = this.plugin.jm
    const {ids} = JSON.parse(payload)
    await jm.remove_nodes(ids.map(id => jm.get_node(id)))
  }
}

/**
 * 移动节点的默认处理器
 */
export class MoveNodeHistoryHandler extends JsMindHistoryHandler {

  action = 'move_node'

  async init () {
    this.plugin.jm.add_hook('after_move_node', async ({node}, context) => {
      // 历史栈推入
      this.plugin.history_push(this.action, JSON.stringify({
        id: node.id,
        oldParent: context.parent.id,
        oldIndex: context.index,
        oldDirection: context.direction,
        parent: node.parent.id,
        index: node.index,
        direction: node.direction
      }))
    })
  }

  async undo (payload) {
    const jm = this.plugin.jm
    const {id, oldParent, oldIndex, oldDirection} = JSON.parse(payload)
    const node = jm.get_node(id)
    const parent = jm.get_node(oldParent)
    await jm.move_node(
      node, parent.children.filter(nd => nd !== node)[oldIndex], parent, oldDirection)
  }

  async redo (payload) {
    const jm = this.plugin.jm
    const {id, parent: parentId, index, direction} = JSON.parse(payload)
    const node = jm.get_node(id)
    const parent = jm.get_node(parentId)
    await jm.move_node(
      node, parent.children.filter(nd => nd !== node)[index], parent, direction)
  }
}
