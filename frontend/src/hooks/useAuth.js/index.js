import { useState, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import openSocket from "../../services/socket-io";

import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useAuth = () => {
	const history = useHistory();
	const [isAuth, setIsAuth] = useState(false);
	const [loading, setLoading] = useState(true);
	const [user, setUser] = useState({});
	
	const isMountedRef = useRef(true);
	const socketRef = useRef(null);
	const refreshTokenTimeoutRef = useRef(null);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
			
			if (socketRef.current) {
				socketRef.current.off("user");
				socketRef.current.disconnect();
				socketRef.current = null;
			}
			
			const timeoutRef = refreshTokenTimeoutRef.current;
			if (timeoutRef) {
				clearTimeout(timeoutRef);
			}
		};
	}, []);

	api.interceptors.request.use(
		config => {
			const token = localStorage.getItem("token");
			if (token) {
				try {
					const parsedToken = JSON.parse(token);
					config.headers["Authorization"] = `Bearer ${parsedToken}`;
					if (isMountedRef.current) {
						setIsAuth(true);
					}
				} catch (error) {
					console.error("Erro ao fazer parse do token:", error);
					localStorage.removeItem("token");
					if (isMountedRef.current) {
						setIsAuth(false);
					}
				}
			}
			return config;
		},
		error => {
			return Promise.reject(error);
		}
	);

	api.interceptors.response.use(
		response => {
			return response;
		},
		async error => {
			const originalRequest = error.config;
			
			if (error?.response?.status === 403 && !originalRequest._retry) {
				originalRequest._retry = true;

				try {
					const { data } = await api.post("/auth/refresh_token");
					
					if (data && isMountedRef.current) {
						localStorage.setItem("token", JSON.stringify(data.token));
						api.defaults.headers.Authorization = `Bearer ${data.token}`;
						
						return api(originalRequest);
					}
				} catch (refreshError) {
					console.error("Erro ao renovar token:", refreshError);
					
					if (isMountedRef.current) {
						localStorage.removeItem("token");
						api.defaults.headers.Authorization = undefined;
						setIsAuth(false);
						setUser({});
						
						if (!window.location.pathname.includes('/login')) {
							history.push('/login');
						}
					}
				}
			}
			
			if (error?.response?.status === 401) {
				if (isMountedRef.current) {
					localStorage.removeItem("token");
					api.defaults.headers.Authorization = undefined;
					setIsAuth(false);
					setUser({});
					
					if (!window.location.pathname.includes('/login')) {
						history.push('/login');
					}
				}
			}
			
			return Promise.reject(error);
		}
	);

	useEffect(() => {
		const initializeAuth = async () => {
			const token = localStorage.getItem("token");
			
			if (token && isMountedRef.current) {
				try {
					const { data } = await api.post("/auth/refresh_token");
					
					if (data && isMountedRef.current) {
						api.defaults.headers.Authorization = `Bearer ${data.token}`;
						setIsAuth(true);
						setUser(data.user);
						localStorage.setItem("token", JSON.stringify(data.token));
					}
				} catch (err) {
					console.error("Erro na inicialização da autenticação:", err);
					
					if (isMountedRef.current) {
						localStorage.removeItem("token");
						api.defaults.headers.Authorization = undefined;
						setIsAuth(false);
						setUser({});
					}
					
					if (err?.response?.status !== 401 && err?.response?.status !== 403) {
						toastError(err);
					}
				}
			}
			
			if (isMountedRef.current) {
				setLoading(false);
			}
		};

		initializeAuth();
	}, []);

	useEffect(() => {
		if (!isAuth || !user.id || !isMountedRef.current) return;

		if (socketRef.current) {
			socketRef.current.off("user");
			socketRef.current.disconnect();
		}

		const socket = openSocket();
		socketRef.current = socket;

		socket.on("connect", () => {
			console.log("✅ Socket conectado para usuário:", user.name || user.id);
		});

		socket.on("user", data => {
			if (data.action === "update" && data.user.id === user.id && isMountedRef.current) {
				console.log("👤 Dados do usuário atualizados:", data.user.name);
				setUser(data.user);
			}
		});

		socket.on("connect_error", (error) => {
			console.error("❌ Erro na conexão do socket (useAuth):", error.message);
		});

		socket.on("disconnect", (reason) => {
			console.log("🔌 Socket desconectado (useAuth):", reason);
		});

		socket.on("reconnect", (attemptNumber) => {
			console.log(`🔄 Socket reconectado na tentativa ${attemptNumber}`);
		});

		return () => {
			if (socket && socket.connected) {
				socket.off("connect");
				socket.off("user");
				socket.off("connect_error");
				socket.off("disconnect");
				socket.off("reconnect");
				socket.disconnect();
			}
			socketRef.current = null;
		};
	}, [isAuth, user.id]);

	const handleLogin = async userData => {
		if (!isMountedRef.current) return;
		
		setLoading(true);

		try {
			const { data } = await api.post("/auth/login", userData);
			
			if (data && isMountedRef.current) {
				localStorage.setItem("token", JSON.stringify(data.token));
				api.defaults.headers.Authorization = `Bearer ${data.token}`;
				setUser(data.user);
				setIsAuth(true);
				
				toast.success(i18n.t("auth.toasts.success"));
				
				setTimeout(() => {
					if (isMountedRef.current) {
						history.push("/tickets");
					}
				}, 100);
			}
		} catch (err) {
			console.error("Erro no login:", err);
			toastError(err);
		} finally {
			if (isMountedRef.current) {
				setLoading(false);
			}
		}
	};

	const handleLogout = async () => {
		if (!isMountedRef.current) return;
		
		setLoading(true);

		try {
			await api.delete("/auth/logout");
		} catch (err) {
			console.warn("Erro ao fazer logout no servidor:", err);
		} finally {
			if (isMountedRef.current) {
				setIsAuth(false);
				setUser({});
				localStorage.removeItem("token");
				api.defaults.headers.Authorization = undefined;
				
				if (socketRef.current) {
					socketRef.current.off("user");
					socketRef.current.disconnect();
					socketRef.current = null;
				}
				
				setLoading(false);
				
				setTimeout(() => {
					if (isMountedRef.current) {
						history.push("/login");
					}
				}, 100);
			}
		}
	};

	const checkAuthStatus = () => {
		const token = localStorage.getItem("token");
		return !!(token && isAuth && user.id);
	};

	const refreshToken = async () => {
		try {
			const { data } = await api.post("/auth/refresh_token");
			
			if (data && isMountedRef.current) {
				localStorage.setItem("token", JSON.stringify(data.token));
				api.defaults.headers.Authorization = `Bearer ${data.token}`;
				return true;
			}
		} catch (error) {
			console.error("Erro ao renovar token manualmente:", error);
			return false;
		}
		return false;
	};

	return { 
		isAuth, 
		user, 
		loading, 
		handleLogin, 
		handleLogout,
		checkAuthStatus,
		refreshToken
	};
};

export default useAuth;
