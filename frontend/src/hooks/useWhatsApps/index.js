import { useState, useEffect, useReducer, useRef } from "react";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";

import api from "../../services/api";

const reducer = (state, action) => {
  if (action.type === "LOAD_WHATSAPPS") {
    const whatsApps = action.payload;
    return [...whatsApps];
  }

  if (action.type === "UPDATE_WHATSAPPS") {
    const whatsApp = action.payload;
    const whatsAppIndex = state.findIndex(s => s.id === whatsApp.id);

    if (whatsAppIndex !== -1) {
      state[whatsAppIndex] = whatsApp;
      return [...state];
    } else {
      return [whatsApp, ...state];
    }
  }

  if (action.type === "UPDATE_SESSION") {
    const whatsApp = action.payload;
    const whatsAppIndex = state.findIndex(s => s.id === whatsApp.id);

    if (whatsAppIndex !== -1) {
      state[whatsAppIndex].status = whatsApp.status;
      state[whatsAppIndex].updatedAt = whatsApp.updatedAt;
      state[whatsAppIndex].qrcode = whatsApp.qrcode;
      state[whatsAppIndex].retries = whatsApp.retries;
      return [...state];
    } else {
      return [...state];
    }
  }

  if (action.type === "DELETE_WHATSAPPS") {
    const whatsAppId = action.payload;
    const whatsAppIndex = state.findIndex(s => s.id === whatsAppId);
    if (whatsAppIndex !== -1) {
      state.splice(whatsAppIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useWhatsApps = () => {
  const [whatsApps, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(true);
  
  const isMountedRef = useRef(true);
  const socketRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (socketRef.current) {
        socketRef.current.off("whatsapp");
        socketRef.current.off("whatsappSession");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const fetchSession = async () => {
      if (!isMountedRef.current) return;
      
      setLoading(true);
      try {
        const { data } = await api.get("/whatsapp/");
        
        if (isMountedRef.current) {
          dispatch({ type: "LOAD_WHATSAPPS", payload: data });
          setLoading(false);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setLoading(false);
          if (err?.response?.status !== 401) {
            toastError(err);
          }
        }
      }
    };
    
    fetchSession();
  }, []);

  useEffect(() => {
    if (!isMountedRef.current) return;

    if (socketRef.current) {
      socketRef.current.off("whatsapp");
      socketRef.current.off("whatsappSession");
      socketRef.current.disconnect();
    }

    const socket = openSocket();
    
    if (!socket) {
      console.warn("Socket não pôde ser criado no useWhatsApps");
      return;
    }

    socketRef.current = socket;

    socket.on("whatsapp", data => {
      if (!isMountedRef.current) return;
      
      if (data.action === "update") {
        dispatch({ type: "UPDATE_WHATSAPPS", payload: data.whatsapp });
      }
    });

    socket.on("whatsapp", data => {
      if (!isMountedRef.current) return;
      
      if (data.action === "delete") {
        dispatch({ type: "DELETE_WHATSAPPS", payload: data.whatsappId });
      }
    });

    socket.on("whatsappSession", data => {
      if (!isMountedRef.current) return;
      
      if (data.action === "update") {
        dispatch({ type: "UPDATE_SESSION", payload: data.session });
      }
    });

    socket.on("connect_error", (error) => {
      console.error("Erro na conexão do socket (useWhatsApps):", error.message);
    });

    return () => {
      if (socket && socket.connected) {
        socket.off("whatsapp");
        socket.off("whatsappSession");
        socket.off("connect_error");
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, []);

  return { whatsApps, loading };
};

export default useWhatsApps;
