export default class JsMindPlugin {
  /** @type String **/
  static plugin_name

  constructor (jm) {
    /** @type JsMind */
    this.jm = jm
  }

  async init () {
    throw new Error('This plugin has not implement the init() method.')
  }
}
