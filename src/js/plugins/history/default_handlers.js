import {JsMindHistoryHandler} from './index'

export class AddNodeHistoryHandler extends JsMindHistoryHandler {
  static action = 'add_node'

  constructor (jm) {
    super(jm)
  }

  async init () {
    this.jm.add_hook('after_add_node', async ({node}, context) => {
    })
  }
}
