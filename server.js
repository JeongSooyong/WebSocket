/**
 * server.js
 * 실시간 상담원 상태 보드 — WebSocket 브로드캐스트 연습용 토이 프로젝트.
 *
 * 구조: Express(정적 파일 서빙)와 WebSocket 서버를 같은 포트(3000)에서 같이 띄웁니다.
 * 지난번 예시에서는 WebSocket을 별도 포트(8080)로 띄웠지만,
 * 실무에서는 보통 이렇게 하나의 HTTP 서버 위에 WebSocket을 "얹어서" 같이 씁니다.
 */

const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");

const app = express();
app.use(express.static(path.join(__dirname, "public")));

// Express 앱을 감싸는 순수 HTTP 서버를 만들고, WebSocket을 그 위에 얹습니다.
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// 현재 접속 중인 상담원들의 상태를 메모리에 저장 (Map: agentId → {name, status})
// 서버가 재시작되면 초기화됩니다 — DB가 아니라 메모리에만 있는 토이 프로젝트라서요.
const agents = new Map();
let nextAgentId = 1;

function broadcastAgentList() {
  const payload = JSON.stringify({
    type: "agent_list",
    agents: Array.from(agents.values()),
  });

  // 연결된 '모든' 클라이언트에게 현재 상담원 목록 전체를 다시 뿌려줌
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
}

wss.on("connection", (socket) => {
  const agentId = nextAgentId++;
  console.log(`[연결] 상담원 #${agentId} 접속`);

  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return; // 이상한 데이터는 무시
    }

    if (msg.type === "join") {
      agents.set(agentId, { id: agentId, name: msg.name || `상담원${agentId}`, status: "대기중" });
      broadcastAgentList();
    }

    if (msg.type === "status" && agents.has(agentId)) {
      agents.get(agentId).status = msg.status;
      broadcastAgentList();
    }
  });

  socket.on("close", () => {
    console.log(`[연결 종료] 상담원 #${agentId} 퇴장`);
    agents.delete(agentId);
    broadcastAgentList();
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
