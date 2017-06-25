/**
 * Created by 王冬 on 2017/6/10.
 */
var fun = require("../models/fun");
var RoomList = require("../models/roomList");
var socketIOModule = require('socket.io');

//初始化函数
function init(http) {
    var io = socketIOModule(http);
    bindEvent(io);
}

//事件绑定
function bindEvent(io) {
    //在线用户
    //userSocket -> null或者{}
    /** value为对象时如下：
     *  {
     *      id:roomID,    //游戏ID
     *      role:"black"    //角色，black或者white或者watcher
     *  }
     */
    var onlineUsers = new Map();
    //游戏列表，内部的key是
    //roomID -> {roomInfo}
    var roomList = new RoomList(onlineUsers);


    io.on('connection', function (socket) {
        var userID = socket.id;
        var userINFO = {
            id: userID,
            name: '无名氏'
        }
        onlineUsers.set(socket, null);
        console.log("新用户进入，当前在线用户：" + onlineUsers.size + "人");
        socket.userINFO = userINFO;

        //监听用户退出
        socket.on('disconnect', function (msg) {
            roomList.clearPlayer(socket);
            onlineUsers.delete(socket);
            console.log("用户退出，剩余在线用户：" + onlineUsers.size + "人");
        });

        //创建棋局，并加入游戏
        socket.on("createRoom", function () {
            var roomID = roomList.createRoom();
            roomList.userEnterRoom(roomID, socket, null, function (roomID) {
                //原本是通报roomID，现在用向房间内所有人更新房间信息替代，因此原代码删除
            });
        })

        //监听用户更新名字
        socket.on('updateName', function (msg) {
            socket.userINFO.name = msg.name;
            //告诉用户更名成功
            socket.emit("getCurrentName", {
                name: msg.name,
                date: fun.getNowDate()
            })
            //更新房间内所有用户的信息
            roomList.postRoomInfoToUser(socket);
        });

        //用户离开房间
        socket.on("leaveRoom", function (msg) {
            roomList.clearPlayer(socket, true);
            //更新房间内所有用户的信息
            roomList.postRoomInfoToUser(socket);
        })

        //用户进入某个房间
        socket.on("userEnterRoom", function (msg) {
            var room = msg.roomID;
            roomList.userEnterRoom(room, socket, null, function (roomID) {
                //原本是通报roomID，现在用向房间内所有人更新房间信息替代
            });
            //更新房间内所有用户的信息
            roomList.postRoomInfoToUser(socket);
        })

        //用户修改角色
        socket.on("userChangeRole", function (msg) {
            var newRole = msg.role;
            roomList.changeRole(socket, newRole);
            //更新房间内所有用户的信息
            roomList.postRoomInfoToUser(socket);
        })

        //监听用户发布聊天内容
        socket.on('speakwords', function (msg) {
            if (msg.msg.length === 0) {
                return;
            }
            //拼接说话，格式为：【某某人：说的话】
            var words = socket.userINFO.name + "：" + msg.msg;
            // console.log(words);
            var isInRoom = roomList.forEachUserSocketInRoom(socket, function (member, role) {
                member.emit("chat-words", {
                    msg: "【房间" + roomList.getTheRoomOfThisUserInIt(socket).roomID + "】" + fun.getNowTime() + " " + words
                })
            })
            // 如果不在房间，则在大厅发言。
            // 遍历所有不在房间的人，emit信息
            if (!isInRoom) {
                roomList.forEachUserOutOfRoom(function (member) {
                    member.emit("chat-words", {
                        msg: "【大厅】" + fun.getNowTime() + " " + words
                    })
                })
            }
        });

        //当要求开始新的一局的时候
        socket.on("restartRoom", function (msg) {
            var obj = roomList.getTheRoomOfThisUserInIt(socket);
            var role = obj.role;
            var room = obj.room;
            if (!room) {
                socket.emit("alertToUser", {
                    msg: fun.getNowTime() + " 你必须加入房间后才能开始新的一局！"
                });
                return;
            }

            //如果点击的不是黑方或者白方，直接返回
            if (role !== 'black' && role !== 'white') {
                socket.emit("alertToUser", {
                    msg: fun.getNowTime() + " 你只有成为黑方或者白方后，才能下棋！"
                });
                return;
            }

            //必须双方都有人才能开启游戏
            if (!room.player.black || !room.player.white) {
                socket.emit("alertToUser", {
                    msg: fun.getNowTime() + " 只有同时存在黑、白双方时，才能下棋！"
                });
                return;
            }

            //如果进行中的话，提示其进行中
            if (room.gameStatus === "doing") {
                socket.emit("alertToUser", {
                    msg: fun.getNowTime() + " 游戏已经开始了！"
                });
                return;
            }

            //需要重置房间信息
            room.steps = [];
            room.gameStatus = "doing";      //游戏状态，original未开局，doing进行中，end已结束

            /* *一个新的房间的属性
             *  var newRoom = {
             *      player: {   //玩家，值为其socket
             *          black: null,  //创建游戏者默认为黑棋方，直接添加进去
             *          white: null     //另一方设置为空
             *      },
             *      watcher: new Set(),        //观战者，将其socket存放其中
             *      ctime: (new Date()).getTime(),  //游戏创建时间，单位为秒
             *      size: 19,    //棋盘大小
             *      // 下棋的每一步都存在这里，索引为0的地方，是棋盘(1, 1)的位置；
             *      // html标签的索引值let index = room.steps[room.steps.length - 1] + 1;
             *      steps: [],
             *      gameStatus: "original",     //游戏状态，original未开局，doing进行中，end已结束
             *      lastWinner: "",     //上一个胜利者
             *      roomID: roomID,      //游戏房间ID
             *  }
             * */
            roomList.postRoomInfoToUser(room, true);
        })

        //服务器端判定能否下这一步棋
        socket.on("doNextStep", function (msg) {
            var index = msg.step;
            roomList.checkCanPutPiece(socket, index);
        })

        //告诉客户端，连接建立成功
        socket.emit("connection-success", {
            msg: "connection-success",
            code: "200",
            date: fun.getNowDate()
        })
    });

    //定时器
    pushRoomListInformation(io, roomList, onlineUsers);
    clearEmptyRooms(io, roomList)
    updateRoomInformationForAll(roomList);
}

//定时器，通报时间、在线人数，开启房间数
function pushRoomListInformation(io, roomList, onlineUsers) {
    var delayTime = 2000;
    setInterval(function () {
        var msg = "服务器时间：" + fun.getNowDate();
        msg += "，当前开启中的房间共计" + roomList.countRoomRooms() + "个，在线" + onlineUsers.size + "人。";
        io.emit("broadcast", msg);
    }, delayTime);
}

//定时器，60秒清理一次空房间
function clearEmptyRooms(io, roomList) {
    var delayTime = 60000;
    setInterval(function () {
        var list = roomList.clearAllEmptyRoom();
        if (list.length > 0) {
            io.emit("alertToUser", {
                msg: "服务器时间：" + fun.getNowDate() + " 本次已清空房间" + list.length + "个，以下：房间" + list.join("、房间")
            })
        }
    }, delayTime);
}

//定时器，更新所有房间信息（15秒一次）
function updateRoomInformationForAll(roomList) {
    var delayTime = 15000;
    setInterval(function () {
        roomList.postEveryRoomInfoToUser();
    }, delayTime)
}

module.exports = init;
