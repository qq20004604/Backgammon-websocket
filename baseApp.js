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

//创建socket
var io = require('socket.io')(server);

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