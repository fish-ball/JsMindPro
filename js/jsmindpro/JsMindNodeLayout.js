export default class JsMindNodeLayout {
  constructor () {
    /** @type {Boolean} */
    this.visible = true
    /** @type {Integer} */
    this.direction = null
    /** @type {Integer} */
    this.side_index = null
    /** @type {Integer} */
    this.offset_x = null
    /** @type {Integer} */
    this.offset_y = null
    /** @type {Integer} */
    this.outer_height = null
    /** @type {Integer} */
    this.outer_height_left = null
    /** @type {Integer} */
    this.outer_height_right = null
    /** @type {JsMindNode[]} */
    this.left_nodes = []
    /** @type {JsMindNode[]} */
    this.right_nodes = []
    /** 偏移值缓存
     * @type {{x: Number, y: Number}}
     * @private
     */
    this.offset = {x: -1, y: -1}
  }
}
