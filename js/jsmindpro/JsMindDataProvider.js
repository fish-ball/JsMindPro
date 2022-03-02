import JsMind from './JsMind'

const logger = console

export default class JsMindDataProvider {
  constructor (jm) {
    this.jm = jm
  }

  init () {
    logger.debug('data.init')
  }

  reset () {
    logger.debug('data.reset')
  }

  load (mind_data) {
    let df = null
    let mind = null
    if (typeof mind_data === 'object') {
      if (!!mind_data.format) {
        df = mind_data.format
      } else {
        df = 'node_tree'
      }
    } else {
      df = 'freemind'
    }

    if (df === 'node_array') {
      mind = JsMind.format.node_array.get_mind(mind_data)
    } else if (df === 'node_tree') {
      mind = JsMind.format.node_tree.get_mind(mind_data)
    } else if (df === 'freemind') {
      mind = JsMind.format.freemind.get_mind(mind_data)
    } else {
      logger.warn('unsupported format')
    }
    return mind
  }

  get_data (data_format) {
    let data = null
    if (data_format === 'node_array') {
      data = JsMind.format.node_array.get_data(this.jm.mind)
    } else if (data_format === 'node_tree') {
      data = JsMind.format.node_tree.get_data(this.jm.mind)
    } else if (data_format === 'freemind') {
      data = JsMind.format.freemind.get_data(this.jm.mind)
    } else {
      logger.error('unsupported ' + data_format + ' format')
    }
    return data
  }
}
