import JsMindNode from './JsMindNode'

const logger = console

export default class JsMindUtil {
  static is_node (node) {
    return !!node && node instanceof JsMindNode
  }

  /**
   * 如果传入是节点，返回其 ID，否则返回其本身（假设其是一个 ID）
   * @param node {JsMindNode|Number|String}
   * @returns {Number|String}
   */
  static to_node_id (node) {
    return this.is_node(node) ? node.id : node
  }

  static dom = {
    //target,eventType,handler
    add_event: function (t, e, h) {
      if (!!t.addEventListener) {
        t.addEventListener(e, h, false)
      } else {
        t.attachEvent('on' + e, h)
      }
    }
  }

  static canvas = {
    bezierto: function (ctx, x1, y1, x2, y2) {
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.bezierCurveTo(x1 + (x2 - x1) * 2 / 3, y1, x1, y2, x2, y2)
      ctx.stroke()
    },
    lineto: function (ctx, x1, y1, x2, y2) {
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
  }

  static file = {
    read: function (file_data, fn_callback) {
      let reader = new FileReader()
      reader.onload = function () {
        if (typeof fn_callback === 'function') {
          fn_callback(this.result, file_data.name)
        }
      }
      reader.readAsText(file_data)
    },

    save: function (file_data, type, name) {
      let blob = new Blob([file_data], {type: type})
      if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, name)
      } else {
        let URL = $w.URL || $w.webkitURL
        let bloburl = URL.createObjectURL(blob)
        let anchor = $c('a')
        if ('download' in anchor) {
          anchor.style.visibility = 'hidden'
          anchor.href = bloburl
          anchor.download = name
          $d.body.appendChild(anchor)
          let evt = $d.createEvent('MouseEvents')
          evt.initEvent('click', true, true)
          anchor.dispatchEvent(evt)
          $d.body.removeChild(anchor)
        } else {
          location.href = bloburl
        }
      }
    }
  }

  static uuid = {
    newid: function () {
      return (new Date().getTime().toString(16) + Math.random().toString(16).substr(2)).substr(2, 16)
    }
  }
}
