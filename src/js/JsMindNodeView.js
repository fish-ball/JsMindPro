export default class JsMindNodeView {
  constructor () {
    /** @type {HTMLElement|null} */
    this.element = null
    /** @type {HTMLElement|null} */
    this.expander = null

    /** @type {number} */
    this.abs_x = 0
    /** @type {number} */
    this.abs_y = 0
    /** @type {number} */
    this.width = -1
    /** @type {number} */
    this.height = -1

    /**
     * @type {{x: number, y: number}}
     * @private
     */
    this._saved_location = {x: 0, y: 0}
  }

  save_location (x, y) {
    this._saved_location = {x, y}
  }

  restore_location () {
    return this._saved_location
  }
}
