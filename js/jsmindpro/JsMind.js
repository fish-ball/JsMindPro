/*
 * Released under BSD License
 * Copyright (c) 2014-2016 hizzgdev@163.com
 *
 * Project Home:
 *   https://github.com/hizzgdev/jsmind/
 */
import JsMindPlugin from './JsMindPlugin'
import JsMindUtil from './JsMindUtil'
import JsMindNode from './JsMindNode'
import JsMindMind from './JsMindMind'
import JsMindData from './JsMindData'
import JsMindLayout from './JsMindLayout'
import JsMindView from './JsMindView'
import JsMindShortcut from './JsMindShortcut'
import JsMindFormat from './JsMindFormat'

const __version__ = 0.5

const logger = console

let DEFAULT_OPTIONS = {
  container: '',   // id of the container
  editable: false, // you can change it in your options
  theme: null,
  mode: 'full',     // full or side
  support_html: true,

  view: {
    hmargin: 100,
    vmargin: 50,
    line_width: 2,
    line_color: '#555'
  },
  layout: {
    hspace: 30,
    vspace: 20,
    pspace: 13
  },
  default_event_handle: {
    enable_mousedown_handle: true,
    enable_click_handle: true,
    enable_dblclick_handle: true
  },
  shortcut: {
    enable: true,
    handles: {},
    mapping: {
      addchild: 45, // Insert
      addbrother: 13, // Enter
      editnode: 113,// F2
      delnode: 46, // Delete
      toggle: 32, // Space
      left: 37, // Left
      up: 38, // Up
      right: 39, // Right
      down: 40, // Down
    }
  }
}

export default class JsMind {
  static direction = {left: -1, center: 0, right: 1}
  static event_type = {show: 1, resize: 2, edit: 3, select: 4}

  // Subclass registration
  static plugin = JsMindPlugin
  static util = JsMindUtil
  static node = JsMindNode
  static mind = JsMindMind
  static format = JsMindFormat

  static plugins = []

  constructor (options) {
    this.version = __version__
    let opts = {}
    JsMind.util.json.merge(opts, DEFAULT_OPTIONS)
    JsMind.util.json.merge(opts, options)

    if (!opts.container) {
      logger.error('the options.container should not be null or empty.')
      return
    }
    this.options = opts
    this.inited = false
    this.mind = null
    this.event_handles = []
    this.init()
  }

  init () {
    if (this.inited) return
    this.inited = true

    let opts = this.options

    let opts_layout = {
      mode: opts.mode,
      hspace: opts.layout.hspace,
      vspace: opts.layout.vspace,
      pspace: opts.layout.pspace
    }
    let opts_view = {
      container: opts.container,
      support_html: opts.support_html,
      hmargin: opts.view.hmargin,
      vmargin: opts.view.vmargin,
      line_width: opts.view.line_width,
      line_color: opts.view.line_color
    }
    // create instance of function provider
    this.data = new JsMindData(this)
    this.layout = new JsMindLayout(this, opts_layout)
    this.view = new JsMindView(this, opts_view)
    this.shortcut = new JsMindShortcut(this, opts.shortcut)

    this.data.init()
    this.layout.init()
    this.view.init()
    this.shortcut.init()

    this._event_bind()

    JsMind.init_plugins(this)
  }

  enable_edit () {
    this.options.editable = true
  }

  disable_edit () {
    this.options.editable = false
  }

  // call enable_event_handle('dblclick')
  // options are 'mousedown', 'click', 'dblclick'
  enable_event_handle (event_handle) {
    this.options.default_event_handle['enable_' + event_handle + '_handle'] = true
  }

  // call disable_event_handle('dblclick')
  // options are 'mousedown', 'click', 'dblclick'
  disable_event_handle (event_handle) {
    this.options.default_event_handle['enable_' + event_handle + '_handle'] = false
  }

  get_editable () {
    return this.options.editable
  }

  set_theme (theme) {
    let theme_old = this.options.theme
    this.options.theme = (!!theme) ? theme : null
    if (theme_old != this.options.theme) {
      this.view.reset_theme()
      this.view.reset_custom_style()
    }
  }

  _event_bind () {
    this.view.add_event(this, 'mousedown', this.mousedown_handle)
    this.view.add_event(this, 'click', this.click_handle)
    this.view.add_event(this, 'dblclick', this.dblclick_handle)
  }

  mousedown_handle (e) {
    if (!this.options.default_event_handle['enable_mousedown_handle']) {
      return
    }
    let element = e.target || event.srcElement
    let nodeid = this.view.get_binded_nodeid(element)
    if (!!nodeid) {
      this.select_node(nodeid)
    } else {
      this.select_clear()
    }
  }

  click_handle (e) {
    if (!this.options.default_event_handle['enable_click_handle']) {
      return
    }
    let element = e.target || event.srcElement
    let isexpander = this.view.is_expander(element)
    if (isexpander) {
      let nodeid = this.view.get_binded_nodeid(element)
      if (!!nodeid) {
        this.toggle_node(nodeid)
      }
    }
  }

  dblclick_handle (e) {
    if (!this.options.default_event_handle['enable_dblclick_handle']) {
      return
    }
    if (this.get_editable()) {
      let element = e.target || event.srcElement
      let nodeid = this.view.get_binded_nodeid(element)
      if (!!nodeid) {
        this.begin_edit(nodeid)
      }
    }
  }

  begin_edit (node) {
    if (!JsMindUtil.is_node(node)) {
      let the_node = this.get_node(node)
      if (!the_node) {
        logger.error('the node[id=' + node + '] can not be found.')
        return false
      } else {
        return this.begin_edit(the_node)
      }
    }
    if (this.get_editable()) {
      this.view.edit_node_begin(node)
    } else {
      logger.error('fail, this mind map is not editable.')
      return
    }
  }

  end_edit () {
    this.view.edit_node_end()
  }

  toggle_node (node) {
    if (!JsMindUtil.is_node(node)) {
      let the_node = this.get_node(node)
      if (!the_node) {
        logger.error('the node[id=' + node + '] can not be found.')
        return
      } else {
        return this.toggle_node(the_node)
      }
    }
    if (node.isroot) {
      return
    }
    this.view.save_location(node)
    this.layout.toggle_node(node)
    this.view.relayout()
    this.view.restore_location(node)
  }

  expand_node (node) {
    if (!JsMindUtil.is_node(node)) {
      let the_node = this.get_node(node)
      if (!the_node) {
        logger.error('the node[id=' + node + '] can not be found.')
        return
      } else {
        return this.expand_node(the_node)
      }
    }
    if (node.isroot) {
      return
    }
    this.view.save_location(node)
    this.layout.expand_node(node)
    this.view.relayout()
    this.view.restore_location(node)
  }

  collapse_node (node) {
    if (!JsMindUtil.is_node(node)) {
      let the_node = this.get_node(node)
      if (!the_node) {
        logger.error('the node[id=' + node + '] can not be found.')
        return
      } else {
        return this.collapse_node(the_node)
      }
    }
    if (node.isroot) {
      return
    }
    this.view.save_location(node)
    this.layout.collapse_node(node)
    this.view.relayout()
    this.view.restore_location(node)
  }

  expand_all () {
    this.layout.expand_all()
    this.view.relayout()
  }

  collapse_all () {
    this.layout.collapse_all()
    this.view.relayout()
  }

  expand_to_depth (depth) {
    this.layout.expand_to_depth(depth)
    this.view.relayout()
  }

  _reset () {
    this.view.reset()
    this.layout.reset()
    this.data.reset()
  }

  _show (mind) {
    let m = mind || JsMind.format.node_array.example

    this.mind = this.data.load(m)
    if (!this.mind) {
      logger.error('data.load error')
      return
    } else {
      logger.debug('data.load ok')
    }

    this.view.load()
    logger.debug('view.load ok')

    this.layout.layout()
    logger.debug('layout.layout ok')

    this.view.show(true)
    logger.debug('view.show ok')

    this.invoke_event_handle(JsMind.event_type.show, {data: [mind]})
  }

  show (mind) {
    this._reset()
    this._show(mind)
  }

  get_meta () {
    return {
      name: this.mind.name,
      author: this.mind.author,
      version: this.mind.version
    }
  }

  get_data (data_format) {
    let df = data_format || 'node_tree'
    return this.data.get_data(df)
  }

  get_root () {
    return this.mind.root
  }

  get_node (nodeid) {
    return this.mind.get_node(nodeid)
  }

  add_node (parent_node, nodeid, topic, data) {
    if (this.get_editable()) {
      let node = this.mind.add_node(parent_node, nodeid, topic, data)
      if (!!node) {
        this.view.add_node(node)
        this.layout.layout()
        this.view.show(false)
        this.view.reset_node_custom_style(node)
        this.expand_node(parent_node)
        this.invoke_event_handle(JsMind.event_type.edit, {
          evt: 'add_node',
          data: [parent_node.id, nodeid, topic, data],
          node: nodeid
        })
      }
      return node
    } else {
      logger.error('fail, this mind map is not editable')
      return null
    }
  }

  insert_node_before (node_before, nodeid, topic, data) {
    if (this.get_editable()) {
      let beforeid = JsMindUtil.is_node(node_before) ? node_before.id : node_before
      let node = this.mind.insert_node_before(node_before, nodeid, topic, data)
      if (!!node) {
        this.view.add_node(node)
        this.layout.layout()
        this.view.show(false)
        this.invoke_event_handle(JsMind.event_type.edit, {
          evt: 'insert_node_before',
          data: [beforeid, nodeid, topic, data],
          node: nodeid
        })
      }
      return node
    } else {
      logger.error('fail, this mind map is not editable')
      return null
    }
  }

  insert_node_after (node_after, nodeid, topic, data) {
    if (this.get_editable()) {
      let afterid = JsMindUtil.is_node(node_after) ? node_after.id : node_after
      let node = this.mind.insert_node_after(node_after, nodeid, topic, data)
      if (!!node) {
        this.view.add_node(node)
        this.layout.layout()
        this.view.show(false)
        this.invoke_event_handle(JsMind.event_type.edit, {
          evt: 'insert_node_after',
          data: [afterid, nodeid, topic, data],
          node: nodeid
        })
      }
      return node
    } else {
      logger.error('fail, this mind map is not editable')
      return null
    }
  }

  remove_node (node) {
    if (!JsMindUtil.is_node(node)) {
      let the_node = this.get_node(node)
      if (!the_node) {
        logger.error('the node[id=' + node + '] can not be found.')
        return false
      } else {
        return this.remove_node(the_node)
      }
    }
    if (this.get_editable()) {
      if (node.isroot) {
        logger.error('fail, can not remove root node')
        return false
      }
      let nodeid = node.id
      let parentid = node.parent.id
      let parent_node = this.get_node(parentid)
      this.view.save_location(parent_node)
      this.view.remove_node(node)
      this.mind.remove_node(node)
      this.layout.layout()
      this.view.show(false)
      this.view.restore_location(parent_node)
      this.invoke_event_handle(JsMind.event_type.edit, {evt: 'remove_node', data: [nodeid], node: parentid})
      return true
    } else {
      logger.error('fail, this mind map is not editable')
      return false
    }
  }

  update_node (nodeid, topic) {
    if (this.get_editable()) {
      if (JsMindUtil.text.is_empty(topic)) {
        logger.warn('fail, topic can not be empty')
        return
      }
      let node = this.get_node(nodeid)
      if (!!node) {
        if (node.topic === topic) {
          logger.info('nothing changed')
          this.view.update_node(node)
          return
        }
        node.topic = topic
        this.view.update_node(node)
        this.layout.layout()
        this.view.show(false)
        this.invoke_event_handle(JsMind.event_type.edit, {evt: 'update_node', data: [nodeid, topic], node: nodeid})
      }
    } else {
      logger.error('fail, this mind map is not editable')
    }
  }

  move_node (nodeid, beforeid, parentid, direction) {
    if (this.get_editable()) {
      let node = this.mind.move_node(nodeid, beforeid, parentid, direction)
      if (!!node) {
        this.view.update_node(node)
        this.layout.layout()
        this.view.show(false)
        this.invoke_event_handle(JsMind.event_type.edit, {
          evt: 'move_node',
          data: [nodeid, beforeid, parentid, direction],
          node: nodeid
        })
      }
    } else {
      logger.error('fail, this mind map is not editable')
    }
  }

  select_node (node) {
    if (!JsMindUtil.is_node(node)) {
      let the_node = this.get_node(node)
      if (!the_node) {
        logger.error('the node[id=' + node + '] can not be found.')
        return
      } else {
        return this.select_node(the_node)
      }
    }
    if (!this.layout.is_visible(node)) {
      return
    }
    this.mind.selected = node
    this.view.select_node(node)
  }

  get_selected_node () {
    if (!!this.mind) {
      return this.mind.selected
    } else {
      return null
    }
  }

  select_clear () {
    if (!!this.mind) {
      this.mind.selected = null
      this.view.select_clear()
    }
  }

  is_node_visible (node) {
    return this.layout.is_visible(node)
  }

  find_node_before (node) {
    if (!JsMindUtil.is_node(node)) {
      let the_node = this.get_node(node)
      if (!the_node) {
        logger.error('the node[id=' + node + '] can not be found.')
        return
      } else {
        return this.find_node_before(the_node)
      }
    }
    if (node.isroot) {
      return null
    }
    let n = null
    if (node.parent.isroot) {
      let c = node.parent.children
      let prev = null
      let ni = null
      for (let i = 0; i < c.length; i++) {
        ni = c[i]
        if (node.direction === ni.direction) {
          if (node.id === ni.id) {
            n = prev
          }
          prev = ni
        }
      }
    } else {
      n = this.mind.get_node_before(node)
    }
    return n
  }

  find_node_after (node) {
    if (!JsMindUtil.is_node(node)) {
      let the_node = this.get_node(node)
      if (!the_node) {
        logger.error('the node[id=' + node + '] can not be found.')
        return
      } else {
        return this.find_node_after(the_node)
      }
    }
    if (node.isroot) {
      return null
    }
    let n = null
    if (node.parent.isroot) {
      let c = node.parent.children
      let getthis = false
      let ni = null
      for (let i = 0; i < c.length; i++) {
        ni = c[i]
        if (node.direction === ni.direction) {
          if (getthis) {
            n = ni
            break
          }
          if (node.id === ni.id) {
            getthis = true
          }
        }
      }
    } else {
      n = this.mind.get_node_after(node)
    }
    return n
  }

  set_node_color (nodeid, bgcolor, fgcolor) {
    if (this.get_editable()) {
      let node = this.mind.get_node(nodeid)
      if (!!node) {
        if (!!bgcolor) {
          node.data['background-color'] = bgcolor
        }
        if (!!fgcolor) {
          node.data['foreground-color'] = fgcolor
        }
        this.view.reset_node_custom_style(node)
      }
    } else {
      logger.error('fail, this mind map is not editable')
      return null
    }
  }

  set_node_font_style (nodeid, size, weight, style) {
    if (this.get_editable()) {
      let node = this.mind.get_node(nodeid)
      if (!!node) {
        if (!!size) {
          node.data['font-size'] = size
        }
        if (!!weight) {
          node.data['font-weight'] = weight
        }
        if (!!style) {
          node.data['font-style'] = style
        }
        this.view.reset_node_custom_style(node)
        this.view.update_node(node)
        this.layout.layout()
        this.view.show(false)
      }
    } else {
      logger.error('fail, this mind map is not editable')
      return null
    }
  }

  set_node_background_image (nodeid, image, width, height, rotation) {
    if (this.get_editable()) {
      let node = this.mind.get_node(nodeid)
      if (!!node) {
        if (!!image) {
          node.data['background-image'] = image
        }
        if (!!width) {
          node.data['width'] = width
        }
        if (!!height) {
          node.data['height'] = height
        }
        if (!!rotation) {
          node.data['background-rotation'] = rotation
        }
        this.view.reset_node_custom_style(node)
        this.view.update_node(node)
        this.layout.layout()
        this.view.show(false)
      }
    } else {
      logger.error('fail, this mind map is not editable')
      return null
    }
  }

  set_node_background_rotation (nodeid, rotation) {
    if (this.get_editable()) {
      let node = this.mind.get_node(nodeid)
      if (!!node) {
        if (!node.data['background-image']) {
          logger.error('fail, only can change rotation angle of node with background image')
          return null
        }
        node.data['background-rotation'] = rotation
        this.view.reset_node_custom_style(node)
        this.view.update_node(node)
        this.layout.layout()
        this.view.show(false)
      }
    } else {
      logger.error('fail, this mind map is not editable')
      return null
    }
  }

  resize () {
    this.view.resize()
  }

  // callback(type ,data)
  add_event_listener (callback) {
    if (typeof callback === 'function') {
      this.event_handles.push(callback)
    }
  }

  invoke_event_handle (type, data) {
    let j = this
    setTimeout(function () {
      j._invoke_event_handle(type, data)
    }, 0)
  }

  _invoke_event_handle (type, data) {
    let l = this.event_handles.length
    for (let i = 0; i < l; i++) {
      this.event_handles[i](type, data)
    }
  }

  // >>>>>>>> static methods >>>>>>>>

  static register_plugin (plugin) {
    if (plugin instanceof JsMindPlugin) {
      JsMind.plugins.push(plugin)
    }
  }

  static init_plugins (sender) {
    setTimeout(function () {
      JsMind._init_plugins(sender)
    }, 0)
  }

  static _init_plugins (sender) {
    let l = JsMind.plugins.length
    let fn_init = null
    for (let i = 0; i < l; i++) {
      fn_init = JsMind.plugins[i].init
      if (typeof fn_init === 'function') {
        fn_init(sender)
      }
    }
  }

  // quick way
  static show (options, mind) {
    let _jm = new JsMind(options)
    _jm.show(mind)
    return _jm
  }
}



