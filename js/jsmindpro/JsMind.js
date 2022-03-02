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
import JsMindDataProvider from './JsMindDataProvider'
import JsMindLayoutProvider from './JsMindLayoutProvider'
import JsMindViewProvider from './JsMindViewProvider'
import JsMindShortcutProvider from './JsMindShortcutProvider'

// set 'jsMind' as the library name.
// __name__ should be a const value, Never try to change it easily.
const __name__ = 'jsMind'
// library version
const __version__ = '0.5'
// author
const __author__ = 'hizzgdev@163.com'

// an noop function define
let _noop = () => {
}
let logger = (typeof console === 'undefined') ? {
    log: _noop, debug: _noop, error: _noop, warn: _noop, info: _noop
} : console


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

class JsMind {
    static direction = {left: -1, center: 0, right: 1}
    static event_type = {show: 1, resize: 2, edit: 3, select: 4}

    // Subclass registration
    static plugin = JsMindPlugin
    static util = JsMindUtil
    static node = JsMindNode
    static mind = JsMindMind
    static data_provider = JsMindDataProvider
    static layout_provider = JsMindLayoutProvider
    static view_provider = JsMindViewProvider
    static shortcut_provider = JsMindShortcutProvider

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
        this.data = new JsMindDataProvider(this)
        this.layout = new JsMindLayoutProvider(this, opts_layout)
        this.view = new JsMindViewProvider(this, opts_view)
        this.shortcut = new JsMindShortcutProvider(this, opts.shortcut)

        this.data.init()
        this.layout.init()
        this.view.init()
        this.shortcut.init()

        this._event_bind()

        jm.init_plugins(this)
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
        if (!jm.util.is_node(node)) {
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
        if (!jm.util.is_node(node)) {
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
        if (!jm.util.is_node(node)) {
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
        if (!jm.util.is_node(node)) {
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
        let m = mind || jm.format.node_array.example

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

        this.invoke_event_handle(jm.event_type.show, {data: [mind]})
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
                this.invoke_event_handle(jm.event_type.edit, {
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
            let beforeid = jm.util.is_node(node_before) ? node_before.id : node_before
            let node = this.mind.insert_node_before(node_before, nodeid, topic, data)
            if (!!node) {
                this.view.add_node(node)
                this.layout.layout()
                this.view.show(false)
                this.invoke_event_handle(jm.event_type.edit, {
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
            let afterid = jm.util.is_node(node_after) ? node_after.id : node_after
            let node = this.mind.insert_node_after(node_after, nodeid, topic, data)
            if (!!node) {
                this.view.add_node(node)
                this.layout.layout()
                this.view.show(false)
                this.invoke_event_handle(jm.event_type.edit, {
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
        if (!jm.util.is_node(node)) {
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
            this.invoke_event_handle(jm.event_type.edit, {evt: 'remove_node', data: [nodeid], node: parentid})
            return true
        } else {
            logger.error('fail, this mind map is not editable')
            return false
        }
    }

    update_node (nodeid, topic) {
        if (this.get_editable()) {
            if (jm.util.text.is_empty(topic)) {
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
                this.invoke_event_handle(jm.event_type.edit, {evt: 'update_node', data: [nodeid, topic], node: nodeid})
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
                this.invoke_event_handle(jm.event_type.edit, {
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
        if (!jm.util.is_node(node)) {
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
        if (!jm.util.is_node(node)) {
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
        if (!jm.util.is_node(node)) {
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
        if (plugin instanceof jm.plugin) {
            jm.plugins.push(plugin)
        }
    }

    static init_plugins (sender) {
        setTimeout(function () {
            jm._init_plugins(sender)
        }, 0)
    }

    static _init_plugins (sender) {
        let l = jm.plugins.length
        let fn_init = null
        for (let i = 0; i < l; i++) {
            fn_init = jm.plugins[i].init
            if (typeof fn_init === 'function') {
                fn_init(sender)
            }
        }
    }

    // quick way
    static show (options, mind) {
        let _jm = new jm(options)
        _jm.show(mind)
        return _jm
    }
}

// core object
const jm = JsMind


// ============= static object =============================================

// jm.mind.prototype = {
// }

jm.format = {
    node_tree: {
        example: {
            "meta": {
                "name": __name__,
                "author": __author__,
                "version": __version__
            },
            "format": "node_tree",
            "data": {"id": "root", "topic": "jsMind Example"}
        },
        get_mind: function (source) {
            let df = jm.format.node_tree
            let mind = new jm.mind()
            mind.name = source.meta.name
            mind.author = source.meta.author
            mind.version = source.meta.version
            df._parse(mind, source.data)
            return mind
        },
        get_data: function (mind) {
            let df = jm.format.node_tree
            let json = {}
            json.meta = {
                name: mind.name,
                author: mind.author,
                version: mind.version
            }
            json.format = 'node_tree'
            json.data = df._buildnode(mind.root)
            return json
        },

        _parse: function (mind, node_root) {
            let df = jm.format.node_tree
            let data = df._extract_data(node_root)
            mind.set_root(node_root.id, node_root.topic, data)
            if ('children' in node_root) {
                let children = node_root.children
                for (let i = 0; i < children.length; i++) {
                    df._extract_subnode(mind, mind.root, children[i])
                }
            }
        },

        _extract_data: function (node_json) {
            let data = {}
            for (let k in node_json) {
                if (k == 'id' || k == 'topic' || k == 'children' || k == 'direction' || k == 'expanded') {
                    continue
                }
                data[k] = node_json[k]
            }
            return data
        },

        _extract_subnode: function (mind, node_parent, node_json) {
            let df = jm.format.node_tree
            let data = df._extract_data(node_json)
            let d = null
            if (node_parent.isroot) {
                d = node_json.direction == 'left' ? JsMind.direction.left : JsMind.direction.right
            }
            let node = mind.add_node(node_parent, node_json.id, node_json.topic, data, null, d, node_json.expanded)
            if ('children' in node_json) {
                let children = node_json.children
                for (let i = 0; i < children.length; i++) {
                    df._extract_subnode(mind, node, children[i])
                }
            }
        },

        _buildnode: function (node) {
            let df = jm.format.node_tree
            if (!(node instanceof JsMindNode)) {
                return
            }
            let o = {
                id: node.id,
                topic: node.topic,
                expanded: node.expanded
            }
            if (!!node.parent && node.parent.isroot) {
                o.direction = node.direction == JsMind.direction.left ? 'left' : 'right'
            }
            if (node.data != null) {
                let node_data = node.data
                for (let k in node_data) {
                    o[k] = node_data[k]
                }
            }
            let children = node.children
            if (children.length > 0) {
                o.children = []
                for (let i = 0; i < children.length; i++) {
                    o.children.push(df._buildnode(children[i]))
                }
            }
            return o
        }
    },

    node_array: {
        example: {
            "meta": {
                "name": __name__,
                "author": __author__,
                "version": __version__
            },
            "format": "node_array",
            "data": [
                {"id": "root", "topic": "jsMind Example", "isroot": true}
            ]
        },

        get_mind: function (source) {
            let df = jm.format.node_array
            let mind = new jm.mind()
            mind.name = source.meta.name
            mind.author = source.meta.author
            mind.version = source.meta.version
            df._parse(mind, source.data)
            return mind
        },

        get_data: function (mind) {
            let df = jm.format.node_array
            let json = {}
            json.meta = {
                name: mind.name,
                author: mind.author,
                version: mind.version
            }
            json.format = 'node_array'
            json.data = []
            df._array(mind, json.data)
            return json
        },

        _parse: function (mind, node_array) {
            let df = jm.format.node_array
            let narray = node_array.slice(0)
            // reverse array for improving looping performance
            narray.reverse()
            let root_id = df._extract_root(mind, narray)
            if (!!root_id) {
                df._extract_subnode(mind, root_id, narray)
            } else {
                logger.error('root node can not be found')
            }
        },

        _extract_root: function (mind, node_array) {
            let df = jm.format.node_array
            let i = node_array.length
            while (i--) {
                if ('isroot' in node_array[i] && node_array[i].isroot) {
                    let root_json = node_array[i]
                    let data = df._extract_data(root_json)
                    mind.set_root(root_json.id, root_json.topic, data)
                    node_array.splice(i, 1)
                    return root_json.id
                }
            }
            return null
        },

        _extract_subnode: function (mind, parentid, node_array) {
            let df = jm.format.node_array
            let i = node_array.length
            let node_json = null
            let data = null
            let extract_count = 0
            while (i--) {
                node_json = node_array[i]
                if (node_json.parentid == parentid) {
                    data = df._extract_data(node_json)
                    let d = null
                    let node_direction = node_json.direction
                    if (!!node_direction) {
                        d = node_direction == 'left' ? JsMind.direction.left : JsMind.direction.right
                    }
                    mind.add_node(parentid, node_json.id, node_json.topic, data, null, d, node_json.expanded)
                    node_array.splice(i, 1)
                    extract_count++
                    let sub_extract_count = df._extract_subnode(mind, node_json.id, node_array)
                    if (sub_extract_count > 0) {
                        // reset loop index after extract subordinate node
                        i = node_array.length
                        extract_count += sub_extract_count
                    }
                }
            }
            return extract_count
        },

        _extract_data: function (node_json) {
            let data = {}
            for (let k in node_json) {
                if (k == 'id' || k == 'topic' || k == 'parentid' || k == 'isroot' || k == 'direction' || k == 'expanded') {
                    continue
                }
                data[k] = node_json[k]
            }
            return data
        },

        _array: function (mind, node_array) {
            let df = jm.format.node_array
            df._array_node(mind.root, node_array)
        },

        _array_node: function (node, node_array) {
            let df = jm.format.node_array
            if (!(node instanceof JsMindNode)) {
                return
            }
            let o = {
                id: node.id,
                topic: node.topic,
                expanded: node.expanded
            }
            if (!!node.parent) {
                o.parentid = node.parent.id
            }
            if (node.isroot) {
                o.isroot = true
            }
            if (!!node.parent && node.parent.isroot) {
                o.direction = node.direction == JsMind.direction.left ? 'left' : 'right'
            }
            if (node.data != null) {
                let node_data = node.data
                for (let k in node_data) {
                    o[k] = node_data[k]
                }
            }
            node_array.push(o)
            let ci = node.children.length
            for (let i = 0; i < ci; i++) {
                df._array_node(node.children[i], node_array)
            }
        },
    },

    freemind: {
        example: {
            "meta": {
                "name": __name__,
                "author": __author__,
                "version": __version__
            },
            "format": "freemind",
            "data": "<map version=\"1.0.1\"><node ID=\"root\" TEXT=\"freemind Example\"/></map>"
        },
        get_mind: function (source) {
            let df = jm.format.freemind
            let mind = new jm.mind()
            mind.name = source.meta.name
            mind.author = source.meta.author
            mind.version = source.meta.version
            let xml = source.data
            let xml_doc = df._parse_xml(xml)
            let xml_root = df._find_root(xml_doc)
            df._load_node(mind, null, xml_root)
            return mind
        },

        get_data: function (mind) {
            let df = jm.format.freemind
            let json = {}
            json.meta = {
                name: mind.name,
                author: mind.author,
                version: mind.version
            }
            json.format = 'freemind'
            let xmllines = []
            xmllines.push('<map version=\"1.0.1\">')
            df._buildmap(mind.root, xmllines)
            xmllines.push('</map>')
            json.data = xmllines.join(' ')
            return json
        },

        _parse_xml: function (xml) {
            let xml_doc = null
            if (window.DOMParser) {
                let parser = new DOMParser()
                xml_doc = parser.parseFromString(xml, 'text/xml')
            } else { // Internet Explorer
                xml_doc = new ActiveXObject('Microsoft.XMLDOM')
                xml_doc.async = false
                xml_doc.loadXML(xml)
            }
            return xml_doc
        },

        _find_root: function (xml_doc) {
            let nodes = xml_doc.childNodes
            let node = null
            let root = null
            let n = null
            for (let i = 0; i < nodes.length; i++) {
                n = nodes[i]
                if (n.nodeType == 1 && n.tagName == 'map') {
                    node = n
                    break
                }
            }
            if (!!node) {
                let ns = node.childNodes
                node = null
                for (let i = 0; i < ns.length; i++) {
                    n = ns[i]
                    if (n.nodeType == 1 && n.tagName == 'node') {
                        node = n
                        break
                    }
                }
            }
            return node
        },

        _load_node: function (mind, parent_id, xml_node) {
            let df = jm.format.freemind
            let node_id = xml_node.getAttribute('ID')
            let node_topic = xml_node.getAttribute('TEXT')
            // look for richcontent
            if (node_topic == null) {
                let topic_children = xml_node.childNodes
                let topic_child = null
                for (let i = 0; i < topic_children.length; i++) {
                    topic_child = topic_children[i]
                    //logger.debug(topic_child.tagName)
                    if (topic_child.nodeType == 1 && topic_child.tagName === 'richcontent') {
                        node_topic = topic_child.textContent
                        break
                    }
                }
            }
            let node_data = df._load_attributes(xml_node)
            let node_expanded = ('expanded' in node_data) ? (node_data.expanded == 'true') : true
            delete node_data.expanded

            let node_position = xml_node.getAttribute('POSITION')
            let node_direction = null
            if (!!node_position) {
                node_direction = node_position == 'left' ? JsMind.direction.left : JsMind.direction.right
            }
            //logger.debug(node_position +':'+ node_direction)
            if (!!parent_id) {
                mind.add_node(parent_id, node_id, node_topic, node_data, null, node_direction, node_expanded)
            } else {
                mind.set_root(node_id, node_topic, node_data)
            }
            let children = xml_node.childNodes
            let child = null
            for (let i = 0; i < children.length; i++) {
                child = children[i]
                if (child.nodeType == 1 && child.tagName == 'node') {
                    df._load_node(mind, node_id, child)
                }
            }
        },

        _load_attributes: function (xml_node) {
            let children = xml_node.childNodes
            let attr = null
            let attr_data = {}
            for (let i = 0; i < children.length; i++) {
                attr = children[i]
                if (attr.nodeType == 1 && attr.tagName === 'attribute') {
                    attr_data[attr.getAttribute('NAME')] = attr.getAttribute('VALUE')
                }
            }
            return attr_data
        },

        _buildmap: function (node, xmllines) {
            let df = jm.format.freemind
            let pos = null
            if (!!node.parent && node.parent.isroot) {
                pos = node.direction === JsMind.direction.left ? 'left' : 'right'
            }
            xmllines.push('<node')
            xmllines.push('ID=\"' + node.id + '\"')
            if (!!pos) {
                xmllines.push('POSITION=\"' + pos + '\"')
            }
            xmllines.push('TEXT=\"' + node.topic + '\">')

            // store expanded status as an attribute
            xmllines.push('<attribute NAME=\"expanded\" VALUE=\"' + node.expanded + '\"/>')

            // for attributes
            let node_data = node.data
            if (node_data != null) {
                for (let k in node_data) {
                    xmllines.push('<attribute NAME=\"' + k + '\" VALUE=\"' + node_data[k] + '\"/>')
                }
            }

            // for children
            let children = node.children
            for (let i = 0; i < children.length; i++) {
                df._buildmap(children[i], xmllines)
            }

            xmllines.push('</node>')
        },
    },
}


export default JsMind
