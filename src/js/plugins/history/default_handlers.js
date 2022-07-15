import JsMindHistoryHandler from './JsMindHistoryHandler'

export class AddNodeHistoryHandler extends JsMindHistoryHandler {

  constructor (plugin) {
    super(plugin)
  }

  get action () {
    return 'add_node'
  }

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
    const data = JSON.parse(payload)
    const node = jm.get_node(data.id)
    await jm.remove_node(node)
  }

  async redo (payload) {
    const jm = this.plugin.jm
    const data = JSON.parse(payload)
    const parentNode = jm.get_node(data.parent)
    await jm.add_node(parentNode, data.id, data.topic, null, data.index)
  }
}

export class EditNodeHistoryHandler extends JsMindHistoryHandler {

  constructor (plugin) {
    super(plugin)
  }

  get action () {
    return 'edit_node'
  }

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
    const data = JSON.parse(payload)
    const node = jm.get_node(data.id)
    await jm.update_node(node, data.oldTopic)
  }

  async redo (payload) {
    const jm = this.plugin.jm
    const data = JSON.parse(payload)
    const node = jm.get_node(data.id)
    await jm.update_node(node, data.topic)
  }
}
