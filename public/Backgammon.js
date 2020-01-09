/**
 * Created by 王冬 on 2017/6/9.
 */
"use strict"
//选择器
let SETTING = {
    imgSize: 39
};

//房间信息（从服务器端拉取），包括下棋信息
let ROOMINFO = {
    black: "",
    white: "",
    watcher: [],
    ctime: "",
    size: 19,
    // 下棋的每一步都存在这里，索引为0的地方，是棋盘(1, 1)的位置；
    // html标签的索引值let index = ROOMINFO.steps[ROOMINFO.steps.length - 1] + 1;
    steps: [],
    lastWinner: "",
    gameStatus: "",     //游戏状态，original未开局，doing进行中，end已结束
    roomID: "",
    // toStartGame: true,  //只有在【游戏刚开始】的时候才会存在这个属性，侦测到这个属性后，会去生成棋盘
}

//玩家信息
let USERINFO = {
    name: "",
};

//初始化
window.onload = init;

function init() {

    // 比如：
    // let serverURL = 'http://127.0.0.1:80';
    //选择器初始化
    selector();
    let serverURL = window.location.origin;

    //连接websocket后端服务器
    let socket = window.io.connect(serverURL);

    //监听点击事件
    listenDomclickEvent(socket);

    //设置socket相关的点击事件
    listenSocketEvent(socket);
}

//选择器配置
function selector() {
    //选择器
    let $OBJECT = undefined;
    if (window.$ !== "undefined") {
        $OBJECT = window.$;
    }
    window.$ = function (selector) {
        if (selector.charAt(0) === '#') {
            return document.querySelector(selector)
        } else {
            return document.querySelectorAll(selector);
        }
    }
    if ($OBJECT) {
        if (Object.assign) {
            Object.assign(window.$, $OBJECT)
        } else if (Object.setPrototypeOf) {
            Object.setPrototypeOf(window.$, $OBJECT);
        } else if (window.$.__proto__) {
            window.$.__proto__ = $OBJECT;
        } else {
            console.error("你的浏览器不支持实现$选择器的语法（这种可能性太低了……），很可能你也看不到这条log");
        }
    }
}

//设置socket相关的点击事件
function listenSocketEvent(socket) {
    //监听登录成功的反馈
    socket.on("connection-success", function (msg) {
        $("#user-name").innerText = "无名氏";
        if (msg.code === '200') {
            //告诉服务器端有要更新名字了
            let name = getName();
            socket.emit('updateName', {
                name: name
            });

            let li = document.createElement("li");
            li.innerText = "系统消息：" + msg.date + " 你连接到服务器！";
            li.style.color = "red";
            li.style.fontWeight = "bold";
            $("#chat-room").appendChild(li);
            $("#room-info").innerHTML = "大厅";
        }
    })

    //假如断线
    socket.on("disconnect", function () {
        let li = document.createElement("li");
        li.innerText = "系统消息：" + getNowDate() + " 哇！悲剧了！你断线了！";
        li.style.color = "red";
        li.style.fontWeight = "bold";
        $("#chat-room").appendChild(li);
        $("#room-info").innerText = "断线中";
        $("#time").innerText = "断线中，拉取不到服务器信息";

        resetRoomInfo();
    })

    //监听普通提示（黑字）
    socket.on('tipsToUser', function (msg) {
        let li = document.createElement("li");
        li.innerText = "系统消息：" + msg.msg;
        $("#chat-room").appendChild(li);
    });

    //监听警告提示（红字）
    socket.on('alertToUser', function (msg) {
        let li = document.createElement("li");
        li.innerText = "系统消息：" + msg.msg;
        li.style.color = "red";
        $("#chat-room").appendChild(li);
    });

    //监听当前姓名
    socket.on("getCurrentName", function (msg) {
        USERINFO.name = msg.name;
        $("#user-name").innerText = msg.name;
    })

    //警告信息
    socket.on("alertToRoom", function (msg) {
        let li = document.createElement("li");
        li.innerText = "系统消息：" + msg.msg;
        li.style.color = "red";
        $("#chat-room").appendChild(li);
    })

    //离开房间时收到的信息
    socket.on("leaveRoom", function (msg) {
        let li = document.createElement("li");
        li.innerText = "系统消息：" + msg.msg;
        li.style.color = "blue";
        $("#chat-room").appendChild(li);
        $("#room-info").innerHTML = "大厅";

        resetRoomInfo();
    })

    //聊天信息
    socket.on("chat-words", function (msg) {
        let li = document.createElement("li");
        li.innerText = msg.msg;
        $("#chat-room").appendChild(li);
    })

    //广播
    socket.on('broadcast', function (o) {
        // console.log(o);
        $("#time").innerText = o;
    });

    //更新房间信息
    socket.on("getRoomInfo", function (roomInfo) {
        //游戏开始标志
        if (roomInfo.toStartGame) {
            initBoard(roomInfo);
        }
        //游戏结束标志
        if (roomInfo.isGameOver) {
            GameOver(roomInfo);
        }

        let myName = USERINFO.name;
        //上一个胜利者
        $("#winner").innerText = roomInfo.lastWinner ? roomInfo.lastWinner : "【无】";
        //房间号
        $("#room-info").innerText = roomInfo.roomID;
        //对当前玩家的名字的字体进行加粗
        if (myName === roomInfo.black) {
            $("#player-black").innerHTML = "<span class='myName'>" + roomInfo.black + "</span>";
        } else {
            //黑方
            if (roomInfo.black) {
                $("#player-black").innerText = roomInfo.black;
            } else {
                $("#player-black").innerHTML = "<span class='alert'>【无】</span>";
            }
        }
        if (myName === roomInfo.white) {
            $("#player-white").innerHTML = "<span class='myName'>" + roomInfo.white + "</span>";
        } else {
            //白方
            if (roomInfo.black) {
                $("#player-white").innerText = roomInfo.white;
            } else {
                $("#player-white").innerHTML = "<span class='alert'>【无】</span>";
            }
        }
        if (roomInfo.watcher.indexOf(myName) !== -1) {
            let newWatcherList = roomInfo.watcher.map(item => {
                if (item === myName) {
                    return "<span class='myName'>" + myName + "</span>"
                } else {
                    return item;
                }
            })
            $("#watcher").innerHTML = newWatcherList.join("、");
        } else {
            //观战
            $("#watcher").innerText = roomInfo.watcher.length > 0 ? roomInfo.watcher.join("、") : "【无】";
        }
        //房间创建时间
        $("#ctime").innerText = roomInfo.ctime;
        //棋盘大小
        $("#board-size").innerText = roomInfo.size;

        $("#btn-changeToGameRoom").parentElement.style.display = "";
    });

    //接收到服务器说可以下这一步棋
    socket.on("canDoNextStep", function (stepInfo) {
        var index = stepInfo.step;
        var steps = stepInfo.steps;
        //将这一步添加到本地的下棋序列里
        ROOMINFO.steps.push(index);

        //本地验证下棋步骤是否一致
        var isError = false;
        //长度是否一致
        if (ROOMINFO.steps.length !== stepInfo.steps.length) {
            isError = true;
            console.error("本地下棋序列与服务器不符，服务器端该步序列长度为：" + stepInfo.steps.length + "，本地为：" + ROOMINFO.steps.length);
        } else {
            //遍历每一步是否一致
            steps.map(function (step, i) {
                //如果服务器返回的当前一步和客户端的不符，则移除客户端的，用服务器端的替代，并标记错误
                if (step !== ROOMINFO.steps[i]) {
                    console.error("第" + (i + 1) + "步出错，服务器端该步序列为：" + step + "，本地为：" + ROOMINFO.steps[i]);
                    isError = true;
                }
            })
        }
        //如果发现错误，则重新生成棋盘，并按照服务器存储的棋子顺序更新
        if (isError) {
            ROOMINFO.steps = stepInfo.steps;
            $("#checkerboard").innerHTML = '';
            initBoard(ROOMINFO);
            //注意，更新完后还是要继续下棋的，参考下面
        } else {
            //如果没错，则在该位置下棋
            createPiece(index, ROOMINFO.steps.length - 1);
        }
        changeColor(steps);
    })

    //测试
    socket.on("test", function (obj) {
        console.log(obj);
    })
}

//设置一般点击事件
function listenDomclickEvent(socket) {
    //切换到游戏房间
    $("#btn-changeToGameRoom").addEventListener("click", function () {
        if ($("#btn-changeToGameRoom").parentNode.classList.contains("btn-blue")) {
            return;
        }
        $("#btn-changeToChatRoom").parentNode.classList.remove("btn-blue");
        $("#btn-changeToGameRoom").parentNode.classList.add("btn-blue");

        $("#page-chatroom").style.display = "none";
        $("#page-gameroom").style.display = "block";
    })

    //切换到聊天室
    $("#btn-changeToChatRoom").addEventListener("click", function () {
        if ($("#btn-changeToChatRoom").parentNode.classList.contains("btn-blue")) {
            return;
        }
        $("#btn-changeToChatRoom").parentNode.classList.add("btn-blue");
        $("#btn-changeToGameRoom").parentNode.classList.remove("btn-blue");

        $("#page-chatroom").style.display = "block";
        $("#page-gameroom").style.display = "none";
    })

    //点击按钮更新名字
    $("#updateName-btn").addEventListener("click", function () {
        //告诉服务器端有要更新名字了
        let name = getName();
        socket.emit('updateName', {
            name: name
        });
    })

    //点击发言按钮发言
    $("#words-btn").addEventListener("click", function () {
        let text = $("#words").value;
        $("#words").value = '';
        socket.emit("speakwords", {
            msg: text
        })
    })

    //回车发言
    $("#words").addEventListener("keydown", function (evt) {
        if (evt.keyCode !== 13) {
            return;
        }
        let text = $("#words").value;
        $("#words").value = '';
        socket.emit("speakwords", {
            msg: text
        })
    })

    //创建新游戏
    $("#create-room").addEventListener("click", function () {
        socket.emit("createRoom");
    })

    //点击进入某房间
    $("#enter-room").addEventListener("click", function () {
        let roomID = $("#room-id").value;
        roomID = roomID.replace(/[^0-9]/g, "");
        $("#room-id").value = roomID;
        socket.emit("userEnterRoom", {
            roomID: roomID
        })
    })

    //按键回车进入某房间
    $("#room-id").addEventListener("keydown", function (evt) {
        if (evt.keyCode !== 13) {
            return;
        }
        let roomID = $("#room-id").value;
        roomID = roomID.replace(/[^0-9]/g, "");
        $("#room-id").value = roomID;
        socket.emit("userEnterRoom", {
            roomID: roomID
        })
    })

    //点击离开房间
    $("#leave-room").addEventListener("click", function () {
        socket.emit("leaveRoom");
    })

    //切换角色——变黑
    $("#beBlack-btn").addEventListener("click", function () {
        socket.emit("userChangeRole", {
            role: "black"
        })
    })

    //切换角色——变白
    $("#beWhite-btn").addEventListener("click", function () {
        socket.emit("userChangeRole", {
            role: "white"
        })
    })

    //切换角色——变观众
    $("#beWatcher-btn").addEventListener("click", function () {
        socket.emit("userChangeRole", {
            role: "watcher"
        })
    })

    //点击开始新的一局按钮
    $("#reset-btn").addEventListener("click", function () {
        socket.emit("restartRoom");
    });

    //棋盘下棋点击的事件代理函数
    $("#checkerboard").addEventListener("click", function (evt) {
        checkerboardClick(evt, socket);
    });
}

// 生成随机姓名
function getName() {
    let familyNames = new Array(
        "赵", "钱", "孙", "李", "周", "吴", "郑", "王", "冯", "陈",
        "褚", "卫", "蒋", "沈", "韩", "杨", "朱", "秦", "尤", "许",
        "何", "吕", "施", "张", "孔", "曹", "严", "华", "金", "魏",
        "陶", "姜", "戚", "谢", "邹", "喻", "柏", "水", "窦", "章",
        "云", "苏", "潘", "葛", "奚", "范", "彭", "郎", "鲁", "韦",
        "昌", "马", "苗", "凤", "花", "方", "俞", "任", "袁", "柳",
        "酆", "鲍", "史", "唐", "费", "廉", "岑", "薛", "雷", "贺",
        "倪", "汤", "滕", "殷", "罗", "毕", "郝", "邬", "安", "常",
        "乐", "于", "时", "傅", "皮", "卞", "齐", "康", "伍", "余",
        "元", "卜", "顾", "孟", "平", "黄", "和", "穆", "萧", "尹"
    );
    let givenNames = new Array(
        "子璇", "淼", "国栋", "夫子", "瑞堂", "甜", "敏", "尚", "国贤", "贺祥", "晨涛",
        "昊轩", "易轩", "益辰", "益帆", "益冉", "瑾春", "瑾昆", "春齐", "杨", "文昊",
        "东东", "雄霖", "浩晨", "熙涵", "溶溶", "冰枫", "欣欣", "宜豪", "欣慧", "建政",
        "美欣", "淑慧", "文轩", "文杰", "欣源", "忠林", "榕润", "欣汝", "慧嘉", "新建",
        "建林", "亦菲", "林", "冰洁", "佳欣", "涵涵", "禹辰", "淳美", "泽惠", "伟洋",
        "涵越", "润丽", "翔", "淑华", "晶莹", "凌晶", "苒溪", "雨涵", "嘉怡", "佳毅",
        "子辰", "佳琪", "紫轩", "瑞辰", "昕蕊", "萌", "明远", "欣宜", "泽远", "欣怡",
        "佳怡", "佳惠", "晨茜", "晨璐", "运昊", "汝鑫", "淑君", "晶滢", "润莎", "榕汕",
        "佳钰", "佳玉", "晓庆", "一鸣", "语晨", "添池", "添昊", "雨泽", "雅晗", "雅涵",
        "清妍", "诗悦", "嘉乐", "晨涵", "天赫", "玥傲", "佳昊", "天昊", "萌萌", "若萌",
        "佳怡", "萌萌", "莹莹", "灵灵", "诺诺", "佳佳", "莎尔"
    );

    let i = parseInt(Math.random() * familyNames.length);
    if (i === familyNames.length) {
        i = familyNames.length - 1;
    }
    let familyName = familyNames[i];

    let j = parseInt(Math.random() * givenNames.length);
    if (j === givenNames.length) {
        j = givenNames.length - 1;
    }
    let givenName = givenNames[j];

    return familyName + givenName;
}

//获取当前时间：2000-01-01 00:00:00
function getNowDate() {
    //格式化时间
    let formatDate = function (date) {
        return date.getFullYear() + "-" + addZero(date.getMonth() + 1, 2) + "-" + addZero(date.getDate(), 2) + " " +
            addZero(date.getHours(), 2) + ":" + addZero(date.getMinutes(), 2) + ":" + addZero(date.getSeconds(), 2);
    }
    //在字符串开始补足0
    let addZero = function (str, length) {
        str = String(str);
        if (typeof str !== "string" || typeof length !== "number") {
            return str;
        }
        while (str.length < length) {
            str = "0" + str;
        }
        return str;
    }

    return formatDate(new Date());
}

//棋盘初始化
function initBoard(infoForServer) {
    //参数infoForServer来源于服务器
    //修改提示信息
    $("#game-status").parentElement.style.display = "none";
    $("#thisOrder").parentElement.style.display = "";
    $("#thisOrder").innerHTML = "黑方";
    $("#why-win").parentNode.style.display = "none";

    //棋盘的尺寸
    ROOMINFO = infoForServer;
    let size = infoForServer.size;

    //设置游戏结束标志为false
    ROOMINFO.gameover = false;

    //将棋盘置为空
    $("#checkerboard").innerHTML = "";

    //棋盘长宽 = size * config.imgSize单个图片尺寸
    $("#checkerboard").style.width = size * SETTING.imgSize + "px";
    $("#checkerboard").style.height = size * SETTING.imgSize + "px";

    //生成棋盘
    for (let i = 1; i <= size * size; i++) {
        //四个角是|__型
        if (i === 1) {
            $("#checkerboard").appendChild(createBox(["two", "left-top"], i));
        } else if (i === size) {
            $("#checkerboard").appendChild(createBox(["two", "right-top"], i));
        } else if (i === size * (size - 1) + 1) {
            $("#checkerboard").appendChild(createBox(["two", "left-bottom"], i));
        } else if (i === size * size) {
            $("#checkerboard").appendChild(createBox(["two", "right-bottom"], i));
        } else if (i < size) {
            //第一排是横线T字
            $("#checkerboard").appendChild(createBox(["three", "top"], i));
        } else if (i > size && i < size * (size - 1) && i % size === 1) {
            //左列
            $("#checkerboard").appendChild(createBox(["three", "left"], i));
        } else if (i > size && i <= size * (size - 1) && i % size === 0) {
            //右列
            $("#checkerboard").appendChild(createBox(["three", "right"], i));
        } else if (i > size * (size - 1)) {
            $("#checkerboard").appendChild(createBox(["three", "bottom"], i));
        } else {
            $("#checkerboard").appendChild(createBox(["four"], i));
        }
    }
    //棋盘创建完毕

    //如果有棋子的话，生成棋子
    toMakePieceWhenHasStart(infoForServer.steps);
}

//创建<div class="box"></div>
//参数是数组，是额外添加的类名
function createBox(classNames, index) {
    let box = document.createElement("div");
    box.classList.add("box");
    if (classNames) {
        classNames.forEach(item => {
            box.classList.add(item);
        })
    }
    if (typeof index !== "undefined") {
        box.setAttribute("index", index);
    }
    return box;
}

//如果已经在下棋中，那么需要通过这个方法来生成棋盘上的棋子
function toMakePieceWhenHasStart(steps) {
    steps.forEach(function (step, index) {
        createPiece(step, index);
    })
    changeColor(steps);
}

//创造棋子，第一个是棋子位置的索引，第二个是棋子在下棋序列数组里的索引，数组里0黑1白
function createPiece(step, index) {
    let piece = document.createElement("div");
    piece.classList.add("piece");

    while ($(".last-piece").length > 0) {
        $(".last-piece")[0].classList.remove("last-piece");
    }
    //先清空上一个能找到这个类的棋子的这个类。
    piece.classList.add("last-piece");
    //奇数步为黑
    if ((index + 1) % 2 === 1) {
        piece.classList.add("black");
    } else {
        piece.classList.add("white");
    }
    //有棋子时，先移除再生成
    while ($(".box")[step].children.length > 0) {
        $(".box")[step].children[0].remove();
    }
    $(".box")[step].appendChild(piece);

}

//重置棋盘、房间信息等状态（离开房间后）
function resetRoomInfo() {
    //隐藏掉【游戏房间】按钮，以及切换到聊天室
    $("#btn-changeToGameRoom").parentNode.style.display = "none";
    if ($("#btn-changeToChatRoom").parentNode.classList.contains("btn-blue")) {
        return;
    }
    $("#btn-changeToChatRoom").parentNode.classList.add("btn-blue");
    $("#btn-changeToGameRoom").parentNode.classList.remove("btn-blue");

    $("#page-chatroom").style.display = "block";
    $("#page-gameroom").style.display = "none";

    //重置游戏房间信息
    $("#thisOrder").parentNode.style.display = "none";
    $("#game-status").parentNode.style.display = "";
    $("#checkerboard").innerHTML = "";
    $("#why-win").parentNode.style.display = "none";
}

//下棋的事件代理，避免重复绑定事件
function checkerboardClick(evt, socket) {
    //只有下棋中的时候点击才有效
    if (ROOMINFO.gameStatus !== 'doing') {
        return;
    }
    let dom = evt.target;
    //如果不含说明点击的不是五子棋
    if (!dom.classList.contains("box")) {
        return;
    }
    let index = dom.getAttribute("index") - 1;

    //如果可以下，则发送请求要求下这一步棋
    if (checkCanPutPiece(index)) {
        socket.emit("doNextStep", {
            step: index
        })
        // createPiece(index);
    } else {
        return;
    }
}

//判断是否可以下这一步棋
function checkCanPutPiece(index) {
    // console.log(ROOMINFO.steps, index);
    //如果之前下的其里有这一步，则不允许
    if (ROOMINFO.steps.indexOf(index) > -1) {
        return false;
    } else {
        return true;
    }
}

//游戏结束处理
function GameOver(roomInfo) {
    $("#thisOrder").parentNode.style.display = "none";
    $("#game-status").parentNode.style.display = "";
    $("#game-status").innerText = "本局游戏结束";
    $("#why-win").parentNode.style.display = "";
    $("#why-win").innerText = roomInfo.winWords;
    //上一个胜利者在有了胜利者之后，不再隐藏
    $("#winner").parentNode.style.display = "";
    $("#winner").innerText = roomInfo.lastWinner;
}

//切换颜色
function changeColor(steps) {
    if ((steps.length + 1) % 2 === 1) {
        $("#thisOrder").innerHTML = "<span style='background-color:white;color:black;display:inline-block;width:100%;'>黑方</span>"
    } else {
        $("#thisOrder").innerHTML = "<span style='background-color:black;color:white;display:inline-block;width:100%;'>白方</span>"
    }
}