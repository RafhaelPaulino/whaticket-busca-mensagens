import openSocket from "socket.io-client";
import { getBackendUrl } from "../config";

let socketInstance = null;
let connectionAttempts = 0;
const maxConnectionAttempts = 5;
const reconnectInterval = 3000;
let isConnecting = false;
let lastTokenUsed = null; // NOVO: Para detectar mudanças de token

function connectToSocket() {
  const token = localStorage.getItem("token");
  
  if (!token) {
    console.warn("Token não encontrado para conexão Socket.IO");
    return createMockSocket();
  }

  const parsedToken = JSON.parse(token);

  // VERIFICAR: Se já existe uma conexão ativa e válida
  if (socketInstance && socketInstance.connected && lastTokenUsed === parsedToken) {
    console.log("🔌 Socket já conectado e válido, retornando instância existente");
    return socketInstance;
  }

  // VERIFICAR: Se mudou o token, desconectar socket anterior
  if (socketInstance && lastTokenUsed !== parsedToken) {
    console.log("🔄 Token mudou, desconectando socket anterior");
    cleanupSocket();
  }

  // EVITAR: Múltiplas conexões simultâneas
  if (isConnecting) {
    console.log("🔌 Conexão já em andamento, aguardando...");
    return socketInstance || createMockSocket();
  }

  try {
    isConnecting = true;
    lastTokenUsed = parsedToken;
    
    // LIMPAR: Conexão anterior se existir
    if (socketInstance) {
      cleanupSocket();
    }
    
    console.log("🔌 Criando nova conexão Socket.IO");
    
    socketInstance = openSocket(getBackendUrl(), {
      transports: ["websocket", "polling"],
      timeout: 20000,
      forceNew: false, // CORRIGIDO: Era true, causava múltiplas conexões
      reconnection: true,
      reconnectionDelay: reconnectInterval,
      reconnectionAttempts: maxConnectionAttempts,
      autoConnect: true,
      query: {
        token: parsedToken,
      },
    });

    // EVENTOS: Configurar apenas uma vez
    setupSocketEvents();

    return socketInstance;
    
  } catch (error) {
    console.error("❌ Erro ao conectar Socket.IO:", error);
    isConnecting = false;
    return createMockSocket();
  }
}

function setupSocketEvents() {
  if (!socketInstance) return;

  // REMOVER: Todos os listeners antes de adicionar novos
  socketInstance.removeAllListeners();

  socketInstance.on("connect", () => {
    console.log("✅ Socket.IO conectado:", socketInstance.id);
    connectionAttempts = 0;
    isConnecting = false;
  });

  socketInstance.on("disconnect", (reason) => {
    console.log("🔌 Socket.IO desconectado:", reason);
    isConnecting = false;
    
    // RECONECTAR: Apenas se desconectado pelo servidor
    if (reason === "io server disconnect") {
      setTimeout(() => {
        if (socketInstance && !socketInstance.connected) {
          socketInstance.connect();
        }
      }, 1000);
    }
  });

  socketInstance.on("connect_error", (error) => {
    connectionAttempts++;
    isConnecting = false;
    console.error(`❌ Erro conexão Socket.IO (tentativa ${connectionAttempts}):`, error.message);
    
    // TOKEN: Inválido - redirecionar para login
    if (error.message.includes("401") || error.message.includes("unauthorized")) {
      console.warn("Token inválido - limpando localStorage");
      localStorage.removeItem("token");
      lastTokenUsed = null;
      
      // EVITAR: Redirecionamento em loops
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
      return;
    }
    
    // LIMITE: De tentativas atingido
    if (connectionAttempts >= maxConnectionAttempts) {
      console.error("Limite de tentativas de conexão atingido");
      cleanupSocket();
    }
  });

  socketInstance.on("reconnect", (attemptNumber) => {
    console.log(`🔄 Socket.IO reconectado na tentativa ${attemptNumber}`);
    connectionAttempts = 0;
    isConnecting = false;
  });

  socketInstance.on("reconnect_error", (error) => {
    console.error("❌ Erro na reconexão Socket.IO:", error.message);
  });

  // EVENTOS: Globais apenas para debug
  socketInstance.on("user", (data) => {
    console.log("👤 [Global] Evento user:", data.action);
  });

  socketInstance.on("ticket", (data) => {
    console.log("🎫 [Global] Evento ticket:", data.action, data.ticket?.id || data.ticketId);
  });

  socketInstance.on("appMessage", (data) => {
    console.log("💬 [Global] Evento appMessage:", data.action, data.message?.id);
  });

  socketInstance.on("distribution", (data) => {
    console.log("🔄 [Global] Evento distribution:", data.action);
    
    // DISPARAR: Evento customizado para componentes React
    if (data.action === "update" || data.action === "create") {
      window.dispatchEvent(new CustomEvent("distributionUpdate", {
        detail: data.distribution
      }));
    }
  });
}

function cleanupSocket() {
  if (socketInstance) {
    console.log("🧹 Limpando socket anterior");
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
  }
  isConnecting = false;
}

function createMockSocket() {
  console.warn("🔌 Criando mock socket - token inválido ou erro");
  return {
    on: () => {},
    off: () => {},
    emit: () => {},
    disconnect: () => {},
    removeAllListeners: () => {},
    connected: false,
    id: null
  };
}

// EXPORTS: Funções utilitárias
export function disconnectSocket() {
  cleanupSocket();
  lastTokenUsed = null;
  console.log("🔌 Socket.IO desconectado manualmente");
}

export function isSocketConnected() {
  return socketInstance && socketInstance.connected;
}

export function reconnectSocket() {
  cleanupSocket();
  return connectToSocket();
}

export function getSocketInstance() {
  return socketInstance;
}

export default connectToSocket;