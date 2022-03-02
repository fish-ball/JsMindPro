import JsMind from './JsMind'
import JsMindMind from './JsMindMind'
import JsMindFormatBase from './JsMindFormatBase'

export default class JsMindFormatFreemind extends JsMindFormatBase{
  static example = {
    "meta": {
      "name": 'Albert Einstein',
      "author": 'fish-ball',
      "version": '1.0'
    },
    "format": "freemind",
    "data": "<map version=\"1.0.1\"><node ID=\"root\" TEXT=\"freemind Example\"/></map>"
  }

  static get_mind (source) {
    let df = JsMind.format.freemind
    let mind = new JsMindMind()
    mind.name = source.meta.name
    mind.author = source.meta.author
    mind.version = source.meta.version
    let xml = source.data
    let xml_doc = df._parse_xml(xml)
    let xml_root = df._find_root(xml_doc)
    df._load_node(mind, null, xml_root)
    return mind
  }

  static get_data (mind) {
    let df = JsMind.format.freemind
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
  }

  static _parse_xml (xml) {
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
  }

  static _find_root (xml_doc) {
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
  }

  static _load_node (mind, parent_id, xml_node) {
    let df = JsMind.format.freemind
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
  }


  static _load_attributes (xml_node) {
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
  }


  static _buildmap (node, xmllines) {
    let df = JsMind.format.freemind
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
  }
}

