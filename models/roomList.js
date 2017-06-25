/**
 * Created by 王冬 on 2017/6/19.
 * 五子棋网络对战版的服务器
 */

/*
* 2、空房间检测代码好像有问题；（似乎没问题，待确认）
* 3、房间列表；
* 4、观察者变成列表；
* 5、上一步对方下棋位置；
* */


var fun = require("../models/fun");
var roleInfo = {
    "watcher": "观战者",
    "black": "黑方",
    "white": "白方"
}

//游戏列表
function RoomList(onlineUsers) {
    //游戏列表是一个Map结构
    //key是该局游戏的ID，value是一个对象，存储信息
    this.roomlist = new Map();
    //在线用户也是一个Map结构
    this.onlineUsers = onlineUsers;
}

//创建游戏房间（空的游戏房间），返回创建的游戏的ID
RoomList.prototype.createRoom = function (userSocket) {
    var isInRoom = this.onlineUsers.get(userSocket);
    if (isInRoom) {
        userSocket.emit("alertToUser", {
            msg: fun.getNowDate() + ": " + "你已经在游戏里了，不能创建游戏！"
        });
        return;
    }

    //创建游戏，给予唯一ID，防止其重复
    var roomID = parseInt(Math.random() * 100000);
    while (this.roomlist.has(roomID)) {
        roomID = parseInt(Math.random() * 100000);
    }
    roomID = String(roomID);
    //将房间ID加入到map结构中
    this.roomlist.set(roomID, {
        player: {   //玩家，值为其socket
            black: null,  //创建游戏者默认为黑棋方，直接添加进去
            white: null     //另一方设置为空
        },
        watcher: new Set(),        //观战者，将其socket存放其中
        ctime: (new Date()).getTime(),  //游戏创建时间，单位为秒
        size: 19,    //棋盘大小
        // 下棋的每一步都存在这里，索引为0的地方，是棋盘(1, 1)的位置；
        // html标签的索引值let index = room.steps[room.steps.length - 1] + 1;
        steps: [],
        gameStatus: "original",     //游戏状态，original未开局，doing进行中，end已结束
        lastWinner: "",     //上一个胜利者
        roomID: roomID      //游戏房间ID
    });

    //返回游戏ID
    return roomID;
}

//用户加入游戏房间
RoomList.prototype.userEnterRoom = function (roomID, userSocket, role, callback) {
    //拉取到用户当前信息
    var currentRoom = this.onlineUsers.get(userSocket);
    //有则调用【退出游戏房间】相关逻辑
    if (currentRoom) {
        this.clearPlayer(userSocket, true);
    }

    //从roomID查该游戏
    var room = this.roomlist.get(roomID);
    if (!room) {
        userSocket.emit("alertToUser", {
            msg: fun.getNowDate() + ": " + "该房间不存在"
        });
        return;
    }
    //如果有角色，则按角色来
    if (role && ( role === 'black' || role === 'white')) {
        if (room.player[role]) {
            userSocket.emit("alertToUser", {
                msg: fun.getNowDate() + ": " + "该位置有用户存在"
            });
            return;
        } else {
            room.player[role] = userSocket;
        }
    } else {
        role = 'watcher';
        //不然添加到观战者
        room.watcher.add(userSocket);
    }

    //更新当前用户所在房间的信息
    this.onlineUsers.set(userSocket, {
        id: roomID,    //游戏ID
        role: role    //角色，black或者white或者watcher
    })

    //通报所有本房间用户，有玩家加入到游戏中
    this.forEachUserSocketInRoom(room, function (member, role) {
        //这里是每个用户的socket
        member.emit("alertToRoom", {
            //这里是当前加入的用户userSocket
            msg: fun.getNowDate() + ": " + userSocket.userINFO.name + " 加入到房间" + roomID + "中，角色为：" + roleInfo[role]
        })
    })
    //向房间内通报用户信息
    this.postRoomInfoToUser(room);
    callback && callback(roomID);
}

//用户退出游戏房间，清空该用户所在游戏房间的数据
RoomList.prototype.clearPlayer = function (userSocket, isUserLeave) {
    //参数二为true表示是该用户主动退出游戏的
    //node v4.x版本不能用var {role, room, roomID} = xxx这样的es6语法，蛋疼
    var obj = this.getTheRoomOfThisUserInIt(userSocket);
    var role = obj.role;
    var room = obj.room;
    var roomID = obj.roomID;

    //如果room存在才继续，否则没必要继续
    if (room) {
        //先拉取游戏ID和在该游戏中的角色
        //如果是观战，则清除
        if (role === 'watcher') {
            room.watcher.delete(userSocket);
        } else {
            //如果是玩家，则重置为空
            room.player[role] = null;
        }
        if (isUserLeave) {
            //对其发出通告，告知其已经离开游戏
            userSocket.emit("leaveRoom", {
                msg: fun.getNowDate() + ": " + "你已离开游戏房间" + roomID
            });
        }
        this.forEachUserSocketInRoom(userSocket, function (member) {
            member.emit("alertToRoom", {
                msg: fun.getNowDate() + ": " + userSocket.userINFO.name + "离开了房间" + roomID + "，他的角色是：" + roleInfo[role]
            })
        })
        //更新在线用户里，该用户所在的信息
        this.onlineUsers.set(userSocket, null);
        return true;
    } else {
        return false;
    }
}

//清除空的游戏房间，返回清除掉的游戏房间的数目
RoomList.prototype.clearAllEmptyRoom = function () {
    var clearRoomList = [];

    this.roomlist.forEach((value, key, roomlist) => {
            var isEmpty = true;
            //其中一个位置有人就算有
            if (value.player.white || value.player.black || value.watcher.size) {
                isEmpty = false;
            }
            if (isEmpty) {
                roomlist.delete(key);
                clearRoomList.push(key);
            }
        }
    )
    return clearRoomList;
}

//获取当前开启的房间数
RoomList.prototype.countRoomRooms = function () {
    return this.roomlist.size;
}

//通过用户(socket)，返回该用户当前所在的游戏room，他在其中的角色，以及游戏房间ID
RoomList.prototype.getTheRoomOfThisUserInIt = function (userSocket) {
    var userInfoInRoom = this.onlineUsers.get(userSocket);
    if (!userInfoInRoom) {
        return {
            room: undefined,
            role: undefined,
            roomID: undefined
        };
    }
    var roomID = userInfoInRoom.id;
    var role = userInfoInRoom.role;
    //拉取到该游戏
    var roomInfo = this.roomlist.get(roomID);
    return {
        room: roomInfo,
        role: role,
        roomID: roomID
    };
}

//用户切换角色（变黑、白、观众）
RoomList.prototype.changeRole = function (userSocket, role) {
    //先获取游戏房间
    var obj = this.getTheRoomOfThisUserInIt(userSocket);
    var oldRole = obj.role;
    var oldRoom = obj.room;
    var oldRoomID = obj.roomID;
    //假如没有房间（还真有可能没有，比如用户搞事，手动emit），直接返回
    if (!oldRoom) {
        return;
    }
    //前后角色一样，直接返回
    if (role === oldRole) {
        userSocket.emit("alertToUser", {
            msg: fun.getNowDate() + ": " + "你已经是" + roleInfo[role] + "了。"
        });
        return;
    }

    //然后判断该位置有没有用户
    if (role === 'black' || role === 'white') {
        if (oldRoom.player[role]) {
            userSocket.emit("alertToUser", {
                msg: fun.getNowDate() + ": " + "该位置有用户存在"
            });
            return;
        } else {
            oldRoom.player[role] = userSocket;
        }
    } else {
        //不然添加到观战者
        oldRoom.watcher.add(userSocket);
    }

    //添加完后，要删去老的
    if (oldRole === 'black' || oldRole === 'white') {
        oldRoom.player[oldRole] = null;
    } else {
        oldRoom.watcher.delete(userSocket);
    }
    //更新当前用户所在房间的信息
    this.onlineUsers.set(userSocket, {
        id: oldRoomID,    //游戏ID没变
        role: role    //新的角色
    })

    userSocket.emit("alertToUser", {
        msg: fun.getNowDate() + ": " + "角色切换成功，你现在是 " + roleInfo[role] + " 了。"
    });
    //通报所有人，某人转换了角色
    this.forEachUserSocketInRoom(userSocket, function (member) {
        member.emit("alertToRoom", {
            msg: fun.getNowDate() + ": 房间" + oldRoomID + " " + userSocket.userINFO.name + " 将角色切换为 " + roleInfo[role] + " 。"
        });
    })
}

//向房间内所有人通报信息，只适合发不带参数的信息
RoomList.prototype.alertToRoom = function (room/*房间ID或者直接就是房间room*/, msg) {
    if (typeof room === 'number') {
        room = this.roomlist.get(room);
    }
    this.forEachUserSocketInRoom(room, function (userSocket, role) {
        userSocket.emit("alertToRoom", {
            msg: msg
        })
    })
}

//通过room，遍历每个存在的userSocket，然后执行callback
RoomList.prototype.forEachUserSocketInRoom = function (base/*房间room，或者用户socket*/, callback) {
    //如果能拉取到userINFO，说明传的是socket，那么要通过这个去找room
    if (base.userINFO) {
        var room = this.getTheRoomOfThisUserInIt(base).room;
        base = room;
    }
    if (!base) {
        return false;
    }

    if (base.player.black) {
        callback(base.player.black, "black");
    }
    if (base.player.white) {
        callback(base.player.white, "white");
    }
    base.watcher.forEach(function (userSocket) {
        callback(userSocket, "watcher");
    })
}

//遍历每个不在游戏房间中的人（即在大厅中的人）
RoomList.prototype.forEachUserOutOfRoom = function (callback) {
    this.onlineUsers.forEach(function (roomInfo, userSocket) {
        //如果能查询到房间，说明在房间中，跳过
        if (roomInfo) {
            return;
        }
        //否则说明不在房间，那就在大厅中
        callback(userSocket);
    })
}

//向每个房间内里，所有人通报本房间情况（定时执行本函数，做到信息更新效果）
RoomList.prototype.postEveryRoomInfoToUser = function () {
    var self = this;
    //遍历所有房间
    this.roomlist.forEach(function (room) {
        self.postRoomInfoToUser(room);
    })
}

//对当前房间所有用户通报本房间信息情况
RoomList.prototype.postRoomInfoToUser = function (room/*也可能是userSocket，那么就要先拿用户信息*/, isGameStart) {
    //如果是userSocket，需要先处理一下
    if (room.userINFO) {
        room = this.getTheRoomOfThisUserInIt(room).room;
    }
    //如果拉取不到room信息，说明是该用户没有房间，那么返回
    if (!room) {
        return;
    }

    this.forEachUserSocketInRoom(room, function (member) {
        // var roomInfo = {
        //     player: {   //玩家，值为其socket
        //         black: null,  //创建游戏者默认为黑棋方，直接添加进去
        //         white: null     //另一方设置为空
        //     },
        //     watcher: new Set(),        //观战者，将其socket存放其中
        //     ctime: (new Date()).getTime(),  //游戏创建时间，单位为秒
        //     size: 19,    //棋盘大小
        //     // 下棋的每一步都存在这里，索引为0的地方，是棋盘(1, 1)的位置；
        //     // html标签的索引值let index = room.steps[room.steps.length - 1] + 1;
        //     steps: [],
        //     lastWinner: "",     //上一个胜利者
        //     gameStatus: "original",     //游戏状态，original未开局，doing进行中，end已结束
        //     roomID: roomID      //游戏房间ID
        // };

        var watcher = Array.from(room.watcher).map(function (item) {
            return item.userINFO.name
        });
        var obj = {
            black: room.player.black ? room.player.black.userINFO.name : "",
            white: room.player.white ? room.player.white.userINFO.name : "",
            watcher: watcher,
            ctime: fun.getNowDate(room.ctime),
            size: room.size,
            steps: room.steps,
            lastWinner: room.lastWinner,    //上一个胜利者
            gameStatus: room.gameStatus,    //游戏状态，original未开局，doing进行中，end已结束
            roomID: room.roomID
        };
        //如果是游戏开始，则添加游戏开始标志
        if (isGameStart) {
            obj.toStartGame = true;
        }
        member.emit("getRoomInfo", obj);
    })

}

//是否可以下这一步棋
RoomList.prototype.checkCanPutPiece = function (userSocket, index) {
    if (index === -1) {
        return;
    }

    var obj = this.getTheRoomOfThisUserInIt(userSocket);
    var room = obj.room;
    var role = obj.role;
    //如果点击的不是黑方或者白方，直接返回
    if (role !== 'black' && role !== 'white') {
        userSocket.emit("alertToUser", {
            msg: fun.getNowTime() + " 你只有成为黑方或者白方后，才能下棋！"
        });
        return;
    }
    //下棋者和颜色不符
    if (room.steps.length % 2 === 0 && role !== 'black') {
        return;
    }
    if (room.steps.length % 2 === 1 && role !== 'white') {
        return;
    }
    //游戏没有结束
    if (room.gameStatus !== 'doing') {
        userSocket.emit("alertToUser", {
            msg: fun.getNowTime() + " 游戏已经结束，你需要开始新的依据！"
        });
        return;
    }

    //如果没有房间，则直接返回（除非作弊才会触发这个）
    if (!room) {
        return;
    }

    //如果之前下的其里有这一步，则不允许
    if (room.steps.indexOf(index) > -1) {
        userSocket.emit("alertToUser", {
            msg: fun.getNowTime() + " 这一步已有棋子存在，所以不能在这一步下棋！"
        });
        return;
    } else {
        //将这一步棋添加到下棋列表里
        room.steps.push(index);
        this.forEachUserSocketInRoom(userSocket, function (member) {
            member.emit("canDoNextStep", {
                step: index,    //这一步棋的索引
                steps: room.steps   //所有棋
            });
        })
        var winWords = this.whoIsWinner(room);
        //如果不是false，那么说明有人胜利了
        if (winWords) {
            var winner = room.steps.length % 2 ? "black" : "white";
            room.gameStatus = "end";
            room.lastWinner = room.player[winner].userINFO.name;

            var watcher = Array.from(room.watcher).map(function (item) {
                return item.userINFO.name
            });
            var obj = {
                black: room.player.black ? room.player.black.userINFO.name : "",
                white: room.player.white ? room.player.white.userINFO.name : "",
                watcher: watcher,
                ctime: fun.getNowDate(room.ctime),
                size: room.size,
                steps: room.steps,
                lastWinner: room.lastWinner,    //上一个胜利者
                gameStatus: room.gameStatus,    //游戏状态，original未开局，doing进行中，end已结束
                roomID: room.roomID
            };

            //添加游戏结束标志
            obj.isGameOver = true;
            obj.winWords = winWords;

            //更新房间信息
            this.forEachUserSocketInRoom(userSocket, function (member) {
                member.emit("getRoomInfo", obj);
            })
        }
        return;
    }
}

//判定谁是胜利者
RoomList.prototype.whoIsWinner = function (room) {
    //先获取最后一步的索引
    var index = room.steps[room.steps.length - 1];
    var rect = rectTransformation.changeIndexToXY(index, room);
    //以该位置为中心，下来取横、竖、左上到右下、右上到左下四个数组
    //每个数组长度为9，当前索引为第5个元素
    var Left_Right = [];
    var Top_Bottom = [];
    var TopLeft_BottomRight = [];
    var TopRight_BottomLeft = [];
    //通过当前坐标的x、y坐标，计算和他相连的每个方向8个棋子的坐标值
    for (var i = -4; i < 5; i++) {
        Left_Right.push({
            x: rect.x + i,
            y: rect.y
        });
        Top_Bottom.push({
            x: rect.x,
            y: rect.y + i
        });
        TopLeft_BottomRight.push({
            x: rect.x + i,
            y: rect.y + i
        });
        TopRight_BottomLeft.push({
            x: rect.x - i,
            y: rect.y + i
        });
    }
    //排除过界元素
    Left_Right = filter.beyondBorder(Left_Right, room);
    Top_Bottom = filter.beyondBorder(Top_Bottom, room);
    TopLeft_BottomRight = filter.beyondBorder(TopLeft_BottomRight, room);
    TopRight_BottomLeft = filter.beyondBorder(TopRight_BottomLeft, room);

    //排除颜色不同的棋子、以及不存在的棋子
    Left_Right = filter.filterSameColor(Left_Right, room);
    Top_Bottom = filter.filterSameColor(Top_Bottom, room);
    TopLeft_BottomRight = filter.filterSameColor(TopLeft_BottomRight, room);
    TopRight_BottomLeft = filter.filterSameColor(TopRight_BottomLeft, room);

    var haveWin = "";
    if (isWin(Left_Right)) {
        haveWin += "左右一排五子连珠，";
    }
    if (isWin(Top_Bottom)) {
        haveWin += "上下一排五子连珠，";
    }
    if (isWin(TopLeft_BottomRight)) {
        haveWin += "左上右下一排五子连珠，";
    }
    if (isWin(TopRight_BottomLeft)) {
        haveWin += "左下右上五子连珠，";
    }
    if (haveWin) {
        return haveWin
    } else {
        return false;
    }

}

//向所有人通报，现在有哪些开启中的房间

//判断是否胜利
function isWin(arr) {
    // 参数是一个排除掉过界、以及颜色不同的对象之后的数组，只有当前位置元素合法才保留该位置元素，否则为undefined。
    // 遍历数组，当前元素不为空则放入临时数组，临时数组元素个数满5则说明符合条件；
    // 为空则清除临时数组；
    // 遍历结束后，未曾满5过，则说明这一排不成立。
    var tempArr = [];
    var overFive = false;
    arr.forEach(function (item) {
        if (item !== undefined) {
            tempArr.push(item);
        } else {
            tempArr = [];
        }
        if (tempArr.length === 5) {
            overFive = true;
        }
    })
    return overFive;
}

//x、y坐标与索引转换函数
var rectTransformation = {
    changeIndexToXY  (index, room) {
        //index从0开始，左上角坐标为(1,1)
        var x = index % room.size + 1;
        var y = parseInt(index / room.size) + 1;
        return {
            x, y
        }
    },
    changeXYToIndex(obj, room){
        return (obj.x - 1) + (obj.y - 1) * room.size;
    }
};

//过滤器，用于处理越界情况
var filter = {
    //超界排除
    beyondBorder(arr, room){
        //原理：x或y小于1的，或者x或y大于room.size（比如19格棋盘就是>19）的
        return arr.map(item => {
            if (item === undefined) {
                return undefined;
            }
            if (item.x < 1 || item.y < 1 || item.x > room.size || item.y > room.size) {
                return undefined;
            } else {
                return item;
            }
        })
    },
    //过滤掉数组中该位置棋子颜色不同的
    filterSameColor(arr, room){
        // 过滤原理：
        // 1、先得知当前这一步下棋的颜色（通过奇偶判断）；
        // 2、从当前可能连成一条线的数组索引中，依次取出一个元素；
        // 3、查看该元素是否在已下棋的数组中room.steps，不在则设置该位置为undefined；
        // 4、如果在，则查看该位置与当前这一步下棋步数的奇偶是否一致，不一致则设置该位置为undefined；
        // 5、如果在room.steps，并且奇偶一致，则保持不变；
        var isEven = (room.steps.length - 1) % 2;
        return arr.map(item => {
            if (item === undefined) {
                return undefined;
            }
            var index = rectTransformation.changeXYToIndex(item, room);
            var i = room.steps.indexOf(index);
            if (i === -1 || i % 2 !== isEven) {
                //不存在
                return undefined;
            } else {
                return item;
            }
        })
    }
};

module.exports = RoomList;