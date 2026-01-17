const socket = io();
let pc, partnerId, stream;
let isCaller = false;

const local = document.getElementById("local");
const remote = document.getElementById("remote");

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }
  ]
};

async function init() {
  stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  local.srcObject = stream;
  socket.emit("find");
}

function createPC() {
  pc = new RTCPeerConnection(config);

  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  pc.ontrack = e => {
    remote.srcObject = e.streams[0];
  };

  pc.onicecandidate = e => {
    if (e.candidate && partnerId) {
      socket.emit("signal", { to: partnerId, data: { candidate: e.candidate } });
    }
  };
}

socket.on("paired", async ({ partner }) => {
  partnerId = partner;

  // Decide roles: first socket ID alphabetically becomes caller
  isCaller = socket.id < partner;

  createPC();

  if (isCaller) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("signal", { to: partnerId, data: { sdp: pc.localDescription } });
  }
});

socket.on("signal", async ({ from, data }) => {
  if (!pc) {
    partnerId = from;
    createPC();
  }

  if (data.sdp) {
    if (pc.signalingState === "stable" && data.sdp.type === "answer") {
      // prevent double answer bug
      return;
    }

    await pc.setRemoteDescription(data.sdp);

    if (data.sdp.type === "offer") {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("signal", { to: from, data: { sdp: pc.localDescription } });
    }
  }

  if (data.candidate) {
    try {
      await pc.addIceCandidate(data.candidate);
    } catch (e) {}
  }
});

document.getElementById("next").onclick = () => location.reload();

init();
