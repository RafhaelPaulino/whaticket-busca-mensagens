import React, { useState, useEffect, useReducer, useContext, useRef } from "react";
import connectToSocket from "../../services/socket-io";

import { makeStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";

import TicketListItem from "../TicketListItem";
import TicketsListSkeleton from "../TicketsListSkeleton";

import useTickets from "../../hooks/useTickets";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles(theme => ({
	ticketsListWrapper: {
		position: "relative",
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflow: "hidden",
		borderTopRightRadius: 0,
		borderBottomRightRadius: 0,
	},

	ticketsList: {
		flex: 1,
		overflowY: "scroll",
		...theme.scrollbarStyles,
		borderTop: "2px solid rgba(0, 0, 0, 0.12)",
	},

	ticketsListHeader: {
		color: "rgb(67, 83, 105)",
		zIndex: 2,
		backgroundColor: "white",
		borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
	},

	ticketsCount: {
		fontWeight: "normal",
		color: "rgb(104, 121, 146)",
		marginLeft: "8px",
		fontSize: "14px",
	},

	noTicketsText: {
		textAlign: "center",
		color: "rgb(104, 121, 146)",
		fontSize: "14px",
		lineHeight: "1.4",
	},

	noTicketsTitle: {
		textAlign: "center",
		fontSize: "16px",
		fontWeight: "600",
		margin: "0px",
	},

	noTicketsDiv: {
		display: "flex",
		height: "100px",
		margin: 40,
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
	},
}));

const reducer = (state, action) => {
	console.log(`[REDUCER:${action.status}]`, { type: action.type, ticketId: action.payload?.id || action.payload, stateSize: state.length });

	switch (action.type) {
		case "LOAD_TICKETS": {
			const newTickets = action.payload;
			const uniqueNewTickets = newTickets.filter(
				(newTicket) => !state.some((existingTicket) => existingTicket.id === newTicket.id)
			);
			return [...state, ...uniqueNewTickets];
		}

		case "RESET_UNREAD": {
			const ticketId = action.payload;
			return state.map(ticket =>
				ticket.id === ticketId ? { ...ticket, unreadMessages: 0 } : ticket
			);
		}

		// ✅ LÓGICA DE ATUALIZAÇÃO REFINADA
		case "UPDATE_TICKET": {
			const updatedTicket = action.payload;
			const currentListStatus = action.status;
			
			// 1. "Limpeza de vestígio": Remove qualquer versão antiga do ticket da lista.
			const newState = state.filter(t => t.id !== updatedTicket.id);

			// 2. Se o ticket atualizado pertence a esta lista, adiciona no topo.
			if (updatedTicket.status === currentListStatus) {
				newState.unshift(updatedTicket);
				console.log(`[REDUCER] Ticket ${updatedTicket.id} adicionado/atualizado na lista '${currentListStatus}'.`);
			} else {
				console.log(`[REDUCER] Ticket ${updatedTicket.id} não pertence à lista '${currentListStatus}', removido (se existia).`);
			}
			
			return newState;
		}

		case "UPDATE_TICKET_CONTACT": {
			const contact = action.payload;
			return state.map(ticket =>
				ticket.contactId === contact.id ? { ...ticket, contact } : ticket
			);
		}

		case "DELETE_TICKET": {
			const ticketId = action.payload;
			const ticketExists = state.some(t => t.id === ticketId);
			console.log(`[REDUCER] Recebida ordem para deletar ticket ${ticketId}. Ele existe nesta lista ('${action.status}')? ${ticketExists}`);
			return state.filter(t => t.id !== ticketId);
		}

		case "RESET": {
			return [];
		}

		default:
			return state;
	}
};

const TicketsList = (props) => {
	const { status, searchParam, showAll, selectedQueueIds, updateCount, style } = props;
	const classes = useStyles();
	const [pageNumber, setPageNumber] = useState(1);
	const [ticketsList, dispatch] = useReducer(reducer, []);
	const { user } = useContext(AuthContext);
	const isMountedRef = useRef(true);

	// ✅ Estabiliza a dependência do array de filas para o useEffect
	const queueIds = JSON.stringify(selectedQueueIds);

	useEffect(() => {
		isMountedRef.current = true;
		return () => { isMountedRef.current = false; };
	}, []);

	useEffect(() => {
		dispatch({ type: "RESET" });
		setPageNumber(1);
	}, [status, searchParam, showAll, queueIds]); // Usa a dependência estável

	const { tickets, hasMore, loading } = useTickets({
		pageNumber,
		searchParam,
		status,
		showAll,
		queueIds: queueIds, // Usa a dependência estável
	});

	useEffect(() => {
		if (tickets.length > 0) {
			dispatch({ type: "LOAD_TICKETS", payload: tickets, status });
		}
	}, [tickets, status]);

	useEffect(() => {
		if (typeof updateCount === 'function') {
			updateCount(ticketsList.length);
		}
	}, [ticketsList, updateCount]);

	useEffect(() => {
		const socket = connectToSocket();

		const handleTicket = (data) => {
			if (!isMountedRef.current) return;
			
			if (data.action === "update" && data.ticket) {
				dispatch({ type: "UPDATE_TICKET", payload: data.ticket, status });
			}
			if (data.action === "updateUnread") {
				dispatch({ type: "RESET_UNREAD", payload: data.ticketId, status });
			}
			if (data.action === "delete") {
				dispatch({ type: "DELETE_TICKET", payload: data.ticketId, status });
			}
		};

		const handleAppMessage = (data) => {
			if (!isMountedRef.current) return;
			if (data.action === "create" && data.ticket) {
				dispatch({ type: "UPDATE_TICKET", payload: data.ticket, status });
			}
		};

		const handleContact = (data) => {
			if (!isMountedRef.current) return;
			if (data.action === "update") {
				dispatch({ type: "UPDATE_TICKET_CONTACT", payload: data.contact, status });
			}
		};

		const handleConnect = () => {
			if (status) {
				socket.emit("joinTickets", status);
			}
			socket.emit("joinNotification");
		};

		socket.on("ticket", handleTicket);
		socket.on("appMessage", handleAppMessage);
		socket.on("contact", handleContact);
		socket.on("connect", handleConnect);

		if (socket.connected) {
			handleConnect();
		}

		return () => {
			socket.off("ticket", handleTicket);
			socket.off("appMessage", handleAppMessage);
			socket.off("contact", handleContact);
			socket.off("connect", handleConnect);
		};
	// ✅ CORREÇÃO DEFINITIVA: As dependências agora são estáveis.
	// `user.id` em vez do objeto `user`, e `queueIds` (string) em vez do array `selectedQueueIds`.
	// Isso impede que o useEffect seja executado desnecessariamente, estabilizando a conexão do socket.
	}, [status, user?.id, showAll, queueIds, searchParam]);

	const loadMore = () => {
		setPageNumber(prevState => prevState + 1);
	};

	const handleScroll = e => {
		if (!hasMore || loading) return;
		const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
		if (scrollHeight - (scrollTop + 100) < clientHeight) {
			loadMore();
		}
	};

	return (
		<Paper className={classes.ticketsListWrapper} style={style}>
			<Paper
				square
				name="closed"
				elevation={0}
				className={classes.ticketsList}
				onScroll={handleScroll}
			>
				<List style={{ paddingTop: 0 }}>
					{ticketsList.length === 0 && !loading ? (
						<div className={classes.noTicketsDiv}>
							<span className={classes.noTicketsTitle}>
								{i18n.t("ticketsList.noTicketsTitle")}
							</span>
							<p className={classes.noTicketsText}>
								{i18n.t("ticketsList.noTicketsMessage")}
							</p>
						</div>
					) : (
						<>
							{ticketsList.map(ticket => (
								<TicketListItem ticket={ticket} key={ticket.id} />
							))}
						</>
					)}
					{loading && <TicketsListSkeleton />}
				</List>
			</Paper>
		</Paper>
	);
};

export default TicketsList;
