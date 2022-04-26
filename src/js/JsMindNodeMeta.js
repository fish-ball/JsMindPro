import JsMindNodeView from './JsMindNodeView'
import JsMindNodeLayout from './JsMindNodeLayout'


export default class JsMindNodeMeta {
  constructor () {
    /** @type {JsMindNodeView|null} */
    this.view = new JsMindNodeView()
    /** @type {JsMindNodeLayout|null} */
    this.layout = new JsMindNodeLayout()
  }
}
