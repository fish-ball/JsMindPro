JsMindPro
=========

JsMindPro 是一个显示/编辑思维导图的纯 javascript 类库，其基于 html5 的 canvas 进行设计。JsMindPro 以 BSD 协议开源，在此基础上你可以在你的项目上任意使用。

你可以在此浏览[适用于 JsMindPro 的 BSD 许可协议(中英文版本)][3]。

本应用主要基于 jsmind (https://github.com/hizzgdev/jsmind) 扩展的 ES6 版本。

由于原 jsmind 已经停止功能迭代，并且 JS 语言已经发展多年，因此对原有的 ES5 语法的 jsmind 进行了重写。

JsMindPro 在支持原有大部分功能的基础上（部分功能因为在实际业务项目中未使用暂未实现迁移），加入了新的功能集合以及架构机制。

JsMindPro is a pure javascript library for mindmap, it base on html5 canvas. jsMind was released under BSD license, you can embed it in any project, if only you observe the license. You can read [the BSD license agreement for jsMind in English and Chinese version][3] here.

**jsmind 现已发布到 npm https://www.npmjs.com/package/jsmind**

Links:

* App : <http://jsmind.sinaapp.com>
* Home : <http://hizzgdev.github.io/jsmind/developer.html>
* Demo :
  * <http://hizzgdev.github.io/jsmind/example/1_basic.html>
  * <http://hizzgdev.github.io/jsmind/example/2_features.html>
* Documents :
  * [简体中文][1]
  * [English(draft)][2]
* Wiki :
  * [邮件列表 Mailing List](../../wiki/MailingList)
  * [热点问题 Hot Topics](../../wiki/HotTopics)
* Donate :
  * [资助本项目的开发][4]

Get Started:

```html
<html>
    <head>
        <link type="text/css" rel="stylesheet" href="style/jsmind.css" />
        <script type="text/javascript" src="js/jsmind.js"></script>
        <!--
            enable drag-and-drop feature
            <script type="text/javascript" src="js/jsmind.draggable.js"></script>
        -->
    </head>
    <body>
        <div id="jsmind_container"></div>

        <script type="text/javascript">
            var mind = {
                // 3 data formats were supported ...
                // see Documents for more information
            };
            var options = {
                container:'jsmind_container',
                theme:'orange',
                editable:true
            };
            var jm = new jsMind(options);
            jm.show(mind);
        </script>
    </body>
</html>
```

[1]:docs/zh/index.md
[2]:docs/en/index.md
[3]:LICENSE
[4]:http://hizzgdev.github.io/jsmind/donate.html
