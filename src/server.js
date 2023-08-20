import http from "http";
//import { WebSocketServer } from "ws";  //websocket ver :8.13 버전에서 수정
import { Server } from "socket.io"; //socketIO ver
import express from "express";
import { instrument } from "@socket.io/admin-ui";
//어드민 온라인 데모를 위한 설정

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

const handleListen = () => console.log(`Listening on http://localhost:8080`);
/* app.listen(3000, handleListen); */

/* (express방법) http서버위에 ws 서버를 만들기 위함
-> 동일한 포트에서 http, ws request 둘 다 처리가능 */
const httpServer = http.createServer(app);
const wsServer = new Server(httpServer, {
    cors: {
        origins: ["https://admin.socket.io"],
        credentials: true,
    },
});
instrument(wsServer, {
    auth: false,
});

function publicRooms() {
    const {
        sockets: {
            adapter: {sids, rooms},
            },
        } = wsServer;   // = wsServer.sockets.adapter안에 sids, rooms
    const publicRooms = [];
    rooms.forEach((_,key) =>{
        if(sids.get(key) === 'undefined'){
            //sids key가 없다면 public room
            publicRooms.push(key)
        }
    });
    return publicRooms;   
}

function countRoom(roomName) {
   return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}




 
// ready to recieve Connection
//message뿐만아니라 커스텀 이벤트 전송가능해짐
wsServer.on("connection", (socket) => {
    socket["nickname"] = "Aonoymous";

    //old ver
    socket.on("enter_room", (roomName, entered) => {
        socket.join(roomName);
        //BE :welldone func 실행 -> FE: backendDone func실행(인자전송도 가능)
        entered();
        socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));
        wsServer.sockets.emit("room_change", publicRooms());  //모든 sockets에게 알림
   
    });

    //new ver
    socket.on("join_room", (roomName) => {
        socket.join(roomName);
        socket.to(roomName).emit("welcome");
    });

    //offer받음
    socket.on("offer", (offer, roomName) => {
        socket.to(roomName).emit("offer", offer);
    });

    //peer B에게 answer받음
    socket.on("answer", (answer, roomName) => {
        socket.to(roomName).emit("answer",answer);
    });
    
    socket.on("ice", (ice, roomName) => {
        socket.to(roomName).emit("ice",ice);
    });



    socket.on("disconnecting", () => {
        //disconnection event는 socket이 방 떠나기 직전에 발생
        socket.rooms.forEach((room) => socket.to(room).emit("bye", socket.nickname, countRoom(room)-1)); 
    });

    socket.on("disconnect", () => {
        wsServer.sockets.emit("room_change", publicRooms());  //모든 sockets에게 알림

    });

    socket.on("new_message", (msg, roomName, done) => {
        socket.to(roomName).emit("new_message", `${socket.nickname} : ${msg}`);
        done();
    });

    socket.on("nickname", nickname => socket["nickname"] = nickname);
  
   });


















/* 
const wss = new WebSocketServer({ server });

webSocket을 이용한 방식
const sockets = []; //연결된 소켓들을 넣을 공간

wss.on("connection", (socket) => {
    sockets.push(socket); 
    console.log("nickname1" +socket.nickname);
    socket.nickname = "Anonymous";
    console.log("nickname2" +socket.nickname);
    console.log("Connected to Browser");
    socket.on("close", () => console.log("Disconnected from Browser"));

    //input 입력과 동시에 socket on 시작
    socket.on("message", (message) => {
        console.log("socket on func on start");
        message = message.toString('utf8'); //인코딩 이슈
        const msg = JSON.parse(message);  //JSON객체로 변환
        switch(msg.type) {
            case "newMsg":
                sockets.forEach((aSocket) => aSocket.send(`${socket.nickname} : ${msg.payload}`));
                break;
            case "nickname":
                socket["nickname"] = msg.payload;
        }
    });
    
});   */

httpServer.listen(8080, handleListen);