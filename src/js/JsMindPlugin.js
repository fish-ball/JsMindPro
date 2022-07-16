export default class JsMindPlugin {
  /** @type String **/
  static plugin_name = ''

  constructor (jm) {
    /** @type JsMind */
    this.jm = jm
    // 用于存放在 after_init_plugin 钩子中传入的上下文参数
    this.context = {}
  }

  async init () {
    await this.jm.apply_hook_sync('after_init_plugin', {plugin: this})
  }
}
