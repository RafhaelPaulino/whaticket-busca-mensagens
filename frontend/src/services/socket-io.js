import openSocket from "socket.io-client";
import { getBackendUrl } from "../config";

let socketInstance = null;
let connectionAttempts = 0;
const maxConnectionAttempts = 5;
const reconnectInterval = 3000;

function connectToSocket() {
  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  const token = localStorage.getItem("token");
  
  if (!token) {
    console.warn("Token não encontrado para conexão Socket.IO");
    return {
      on: () => {},
      off: () => {},
      emit: () => {},
      disconnect: () => {},
      connected: false
    };
  }

  try {
    const parsedToken = JSON.parse(token);
    
    socketInstance = openSocket(getBackendUrl(), {
      transports: ["websocket", "polling"],
      timeout: 20000,
      forceNew: false,
      reconnection: true,
      reconnectionDelay: reconnectInterval,
      reconnectionAttempts: maxConnectionAttempts,
      autoConnect: true,
      query: {
        token: parsedToken,
      },
    });

    socketInstance.on("connect", () => {
      console.log("✅ Socket.IO conectado:", socketInstance.id);
      connectionAttempts = 0;
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("🔌 Socket.IO desconectado:", reason);
      
      if (reason === "io server disconnect") {
        socketInstance.connect();
      }
    });

    socketInstance.on("connect_error", (error) => {
      connectionAttempts++;
      console.error(`❌ Erro conexão Socket.IO (tentativa ${connectionAttempts}):`, error.message);
      
      if (error.message.includes("401") || error.message.includes("unauthorized")) {
        console.warn("Token inválido - limpando localStorage");
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }
      
      if (connectionAttempts >= maxConnectionAttempts) {
        console.error("Limite de tentativas de conexão atingido");
        socketInstance.disconnect();
      }
    });

    socketInstance.on("reconnect", (attemptNumber) => {
      console.log(`🔄 Socket.IO reconectado na tentativa ${attemptNumber}`);
      connectionAttempts = 0;
    });

    socketInstance.on("reconnect_error", (error) => {
      console.error("❌ Erro na reconexão Socket.IO:", error.message);
    });

    socketInstance.on("user", (data) => {
      console.log("👤 Evento user recebido:", data.action);
    });

    socketInstance.on("ticket", (data) => {
      console.log("🎫 Evento ticket recebido:", data.action);
    });

    socketInstance.on("appMessage", (data) => {
      console.log("💬 Evento message recebido:", data.action);
    });

    return socketInstance;
    
  } catch (error) {
    console.error("❌ Erro ao conectar Socket.IO:", error);
    return null;
  }
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
    console.log("🔌 Socket.IO desconectado manualmente");
  }
}

export function isSocketConnected() {
  return socketInstance && socketInstance.connected;
}

export function reconnectSocket() {
  if (socketInstance) {
    disconnectSocket();
  }
  return connectToSocket();
}

export default connectToSocket;
