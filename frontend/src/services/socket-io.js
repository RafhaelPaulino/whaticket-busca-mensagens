// frontend/src/services/socket-io.js
// CORREÇÃO: WebSocket connection stability

import openSocket from "socket.io-client";
import { getBackendUrl } from "../config";

let socketInstance = null;
let connectionAttempts = 0;
const maxConnectionAttempts = 5;
const reconnectInterval = 3000;

function connectToSocket() {
  // Reutilizar conexão existente se estiver ativa
  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  const token = localStorage.getItem("token");
  
  if (!token) {
    console.warn("Token não encontrado para conexão Socket.IO");
    // CORREÇÃO: Retornar um objeto mock para evitar erros de .on()
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
    
    // CORREÇÃO: Configuração robusta do Socket.IO
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

    // Event listeners para debugging e estabilidade
    socketInstance.on("connect", () => {
      console.log("✅ Socket.IO conectado:", socketInstance.id);
      connectionAttempts = 0;
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("🔌 Socket.IO desconectado:", reason);
      
      // Reconectar automaticamente em casos específicos
      if (reason === "io server disconnect") {
        // Server forçou desconexão - reconectar manualmente
        socketInstance.connect();
      }
    });

    socketInstance.on("connect_error", (error) => {
      connectionAttempts++;
      console.error(`❌ Erro conexão Socket.IO (tentativa ${connectionAttempts}):`, error.message);
      
      // Se token inválido, limpar e redirecionar
      if (error.message.includes("401") || error.message.includes("unauthorized")) {
        console.warn("Token inválido - limpando localStorage");
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }
      
      // Limite de tentativas atingido
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

    // Eventos customizados da aplicação
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

// Função para desconectar graciosamente
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
    console.log("🔌 Socket.IO desconectado manualmente");
  }
}

// Função para verificar status da conexão
export function isSocketConnected() {
  return socketInstance && socketInstance.connected;
}

// Função para forçar reconexão
export function reconnectSocket() {
  if (socketInstance) {
    disconnectSocket();
  }
  return connectToSocket();
}

export default connectToSocket;