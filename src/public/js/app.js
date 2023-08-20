// socketIO ver : How to connect with BE
// io는 자동으로 Backend.IO와 연결해주는 function
const socket = io(); 

//videoCall Section
const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");

const streamSection = document.getElementById("myStream");
streamSection.hidden = true;

let myStream;
let sounds = true;
let Recorded = true;

let myPeerConnection;
let myDataChannel; //Data channels

//mesaage Chating Section
const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");
room.hidden = true;
const nameForm = room.querySelector("#nickname");
const msgForm = document.getElementById("msg");

let roomName;

function addMessage(message) {
    const ul = msgForm.querySelector("ul");
    const li = document.createElement("li");
    li.innerText = message;
    ul.appendChild(li);

 }

function handleMessageSubmit(e) {
    e.preventDefault();
    const input = room.querySelector("#msg input");
    const value = input.value;
    socket.emit("new_message", value, roomName, ()=> {
        addMessage(`You : ${value}`);
    });
    input.value = "";
}

function showRoom() {
   welcome.hidden = true;
   //form.hidden = true;
   room.hidden = false;
   streamSection.hidden = false;
   const h3 = room.querySelector("h3");
   h3.innerText = `Room ${roomName}`;
   const msgForm = room.querySelector("#msg");
   msgForm.addEventListener("submit", handleMessageSubmit);
 
}


function handleNicknameSubmit(e) {
    e.preventDefault();
    const input = nameForm.querySelector("#nickname input");
    const value = input.value;
    socket.emit("nickname", value);
    input.value = "";
}

function handleRoomSubmit(e) {
    e.preventDefault();
    const input = form.querySelector("input");
    socket.emit("enter_room", input.value, showRoom);  
    //특정 event를 emit하기-> 특정 공간(room)으로 객체전송
    //어떤 이벤트, js객체 또한 전송가능
    //1인자 이벤트명, 2인자 payload, 3인자 서버에서 호출하는 함수

    roomName = input.value;
    input.value = "";
}
 
form.addEventListener("submit", handleRoomSubmit);
nameForm.addEventListener("submit", handleNicknameSubmit);

socket.on("welcome", (user, newCount) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${newCount})`;
    addMessage(`${user}  joined!`);
});

socket.on("bye", (left, newCount) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${newCount})`;
    addMessage(`${left} left here`);
});

socket.on("new_message", addMessage); //메세지 받는부분

socket.on("room_change", (rooms) => {
    const roomList = welcome.querySelector("ul");
    roomList.innerHTML = "";
    if(rooms.length === 0){
        roomList.innerHTML = "";
        return;
    }
    rooms.forEach((room) => {
        const li = document.createElement("li");
        li.innerText = room;
        roomList.append(li);
    });
});



// videocall Section
function handleCameraClick(e) {
    e.preventDefault();

    console.log(myStream.getVideoTracks());
    myStream
        .getVideoTracks()
        .forEach((track) => (track.enabled = !track.enabled));

    if(Recorded){
        cameraBtn.innerText = "Camera Off";
        Recorded = false;
    }else{
        cameraBtn.innerText = "Camera On";
        Recorded = true;
    }

}


function handleMuteClick(e) {
    e.preventDefault();
    console.log(myStream.getAudioTracks());
    myStream
        .getAudioTracks()
        .forEach((track) => (track.enabled = !track.enabled));

    if(!sounds){
        muteBtn.innerText = "Sounds on";
        sounds = true;
    }else{
        muteBtn.innerText = "Mute";
        sounds = false;
    }

}

//사용자 캠 보여주기 
async function getMedia(deviceId) {
    // deviceId 없을때(카메라 만들기 전) 초기셋팅
    const initialConstraints = {
        audio : true,
        video : {facingMode : "user"},
    };
    // deviceId 있을때 초기셋팅
    const cameraConstraints = {
        audio : true,
        video : {deviceId : {exact : deviceId} },
    };

    try {
        myStream = await navigator.mediaDevices.getUserMedia(
        deviceId ? cameraConstraints : initialConstraints
        );
        myFace.srcObject = myStream;
        if(!deviceId) {
            await getCameras();
        }

    } catch (e) {
        console.log(e);
    }
}

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log(`devices`,devices); // 연결된 유저의 모든 기기정보
        const myCameras = devices.filter(device => device.kind === "videoinput");
        console.log(`myCameras`,myCameras) //유저의 비디오에 접근
    
        const currentCamera = myStream.getVideoTracks()[0];

        myCameras.forEach(camera => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;

            if(currentCamera.label === camera.label){
                option.selected = true;
            }

            camerasSelect.appendChild(option);
        })
    } catch (e) {
        console.log(e);
    }
}


async function handleCameraChanged() {
    //console.log(camerasSelect.value);
    await getMedia(camerasSelect.value);
    //카메라 변경-> -peer 업데이트
    if(myPeerConnection){
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection
            .getSenders()
            .find((sender) => sender.track.kind === "video");
        videoSender.replaceTrack(videoTrack);
    }
}

async function initCall() {
    welcome.hidden = true;
    //call.hidden = false;
    nameForm.hidden = true;

    await getMedia();
    makeConnection();
}


async function handleWelcomeSubmit(e) {
    e.preventDefault();
    const input = form.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value);
    roomName = input.value;
    input.value = "";
}


//RTC code
//1. myPeerConnection을 양쪽 서버에 만들기
function makeConnection() {
    //myPeerConnection = new RTCPeerConnection();
    //웹|앱 사용하는 wifi가 다른경우 연결안되는 오류 발생
    //STUN 서버는 공용IP를 찾게 해줌 -> 구글제공 무료 퍼블릭 서버 사용하여 해결
    myPeerConnection = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:stun1.l.google.com:19302",
              "stun:stun2.l.google.com:19302",
              "stun:stun3.l.google.com:19302",
              "stun:stun4.l.google.com:19302",
            ],
          },
        ],
      });
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("addstream", handleAddStream);
    
    myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

//remote  stream 
//peer A에서 b의 stream, peer B에서 a의 stream 가능해짐
function handleAddStream(data) {
    console.log(`got an event from my peer`, data);
    console.log(`Peer's stream`, data.stream);
    console.log(`My stream`, myStream);

    const peersFace = document.getElementById("peersFace");
    peersFace.srcObject = data.stream;
}


function handleIce(data){
    socket.emit("ice", data.candidate, roomName)
    console.log(`got ice candidate`, data);
    console.log("sent ice candidate");
}

//new : signaling process
//offer를 주고받는 과정임. 이때는 서버가 필요하지만, offer연결된 이후로는 필요없음
//offer 생성 - setLocalDescription - peer B로 전송
//주체가되는 브라우저에서만 실행되는 코드
//peer A : 주체가 되는 브라우저

//Data channels : 모든 형식의 데이터를 peer to peer방식으로 전송가능.
//1. offering socket이 Data channel의 주체
socket.on("welcome", async () => {
    //데이터채널 생성
    myDataChannel = myPeerConnection.createDataChannel("chat");
    myDataChannel.addEventListener("message", console.log);
    console.log("made data channel");
    
    console.log("someone joined");
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    console.log(`sent :`, offer);
    //peer B로 전송
    socket.emit("offer", offer, roomName); 

  });

//peer B : 주체서버에게 수신받는 브라우저
//peer B 가 answer 보냄
socket.on("offer", async (offer) => {
    //data channel
    myPeerConnection.addEventListener("datachannel", (event) => {
        console.log("recieved data channel")
        myDataChannel = event.channel;
        myDataChannel.addEventListener("message", console.log);
    });

    console.log(`received :`, offer);
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
    console.log(`sent :`, answer);
});

//peer A 가 answer받음 
socket.on("answer", answer => {
    console.log(`received :`, answer);
    myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
    myPeerConnection.addIceCandidate(ice);
    console.log("received candidate");
});




cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChanged);
muteBtn.addEventListener("click", handleMuteClick);
form.addEventListener("submit", handleWelcomeSubmit);
