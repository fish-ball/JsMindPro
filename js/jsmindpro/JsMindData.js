import JsMind from './JsMind'

const logger = console

export default class JsMindData {
  constructor (jm) {
    this.jm = jm
  }

  init () {
    logger.debug('data.init')
  }

  reset () {
    logger.debug('data.reset')
  }

  /**
   * 自动加载一个 mind 的配置数据（包含格式）
   * @param mind_data {Object}
   * @returns {JsMindMind}
   */
  load (mind_data) {
    let format = typeof mind_data === 'object' ?
      (mind_data.format || 'node_tree') : 'freemind'

    if (format === 'node_array') {
      return JsMind.format.node_array.get_mind(mind_data)
    } else if (format === 'node_tree') {
      return JsMind.format.node_tree.get_mind(mind_data)
    } else if (format === 'freemind') {
      return JsMind.format.freemind.get_mind(mind_data)
    }
    throw new Error('unsupported format')
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
