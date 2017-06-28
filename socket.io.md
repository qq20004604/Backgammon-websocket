<h2>socket.io简述</h2>

<h3>1、基本介绍</h3>

socket.io是基于websocket技术，实现实时通信功能的技术。

简单来说，通过websocket技术，客户端可以和服务器端进行双向实时通信，从而可以实现很多高级特性。

这里附一个阮一峰的关于[WebSocket 教程](http://www.ruanyifeng.com/blog/2017/05/websocket.html)，以供深入理解。

而socket.io是以websocket技术为主，为了兼容性还带多个降级支持办法，包括：

```
Flash Socket

AJAX long-polling

AJAX multipart Stream

Forever IFrame

JSONP polling
```

他会根据浏览器的支持程度，自动选择通过哪种技术来实现通信。

另附一个[socket.io的详细工作流程](https://www.zhihu.com/question/31965911)的知乎回答，个人觉得讲得很好。

<h3>2、环境</h3>

socket.io封装了前端和后端的全部内容，他是一个跨平台的库。

包括前端的socket.io的js库，以及后端基于Node.js的模块。

简单来说：

1. 前端引入socket.io的js文件即可；
2. 后端通过npm安装socket.io，然后引入并使用即可；

<h3>3、前端</h3>

[socket.io官网](https://socket.io/)下载即可，或者直接引入通过CDN加速过的文件。

<h3>4、后端</h3>

我姑且认为你有Node.js和npm。

通过npm安装socket.io

```
npm install --save socket.io
```

然后通过require引入socket.io的初始化函数，并使用这个函数初始化http服务器实例。

这里假定你使用express框架（因为这个最简单方便），如以下代码：

```javascript
// 引入需要的模块：http和express
var http = require('http');
var express = require('express');
var path = require('path');
var app = express();
//设置public为静态目录
app.use(express.static(path.join(__dirname, 'public')));
app.set('port', '80');
var server = http.createServer(app);
//启动服务器
server.listen(80);

//以上服务器创建完毕，这个时候可以引入socket.io了
//创建socket
var io = require('socket.io')(server);
```

初始化之后，会返回一个对象io，用这个对象去监听connection事件，然后在回调函数里传的参数，就是每一个用户的websocket实例。可以用这个实例对该用户发送信息，或者监听用户发出的信息等。

```
//添加连接监听
io.on('connection', function (socket) {
    console.log("Clent has connectioned");
    var number = 0;
    //连接成功则执行下面的监听
    socket.on('message', function (event) {
        console.log('Received message from client!', event);
        number++;
        socket.emit("receiveMessage", new Date() + "：客户端第" + number + "次发送信息");
    });
    //断开连接callback
    socket.on('disconnect', function () {
        console.log('Clent has disconnected');
    });
});
```

具体见我的github上的代码[socketIO.js](https://github.com/qq20004604/Backgammon-websocket/blob/master/socket.IO/socketIO.js)


