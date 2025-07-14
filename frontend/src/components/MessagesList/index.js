import React, { useState, useEffect, useReducer, useRef, useCallback } from "react";
import { isSameDay, parseISO, format } from "date-fns";
import openSocket from "../../services/socket-io";
import clsx from "clsx";

import { green } from "@material-ui/core/colors";
import {
	Button,
	CircularProgress,
	Divider,
	IconButton,
	makeStyles,
} from "@material-ui/core";
import {
	AccessTime,
	Block,
	Done,
	DoneAll,
	ExpandMore,
	GetApp,
} from "@material-ui/icons";

import MarkdownWrapper from "../MarkdownWrapper";
import VcardPreview from "../VcardPreview";
import LocationPreview from "../LocationPreview";
import ModalImageCors from "../ModalImageCors";
import MessageOptionsMenu from "../MessageOptionsMenu";
import whatsBackground from "../../assets/wa-background.png";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import Audio from "../Audio";

const useStyles = makeStyles((theme) => ({
	messagesListWrapper: {
		overflow: "hidden",
		position: "relative",
		display: "flex",
		flexDirection: "column",
		flexGrow: 1,
	},
	messagesList: {
		backgroundImage: `url(${whatsBackground})`,
		display: "flex",
		flexDirection: "column",
		flexGrow: 1,
		padding: "20px 20px 20px 20px",
		overflowY: "scroll",
		[theme.breakpoints.down("sm")]: {
			paddingBottom: "90px",
		},
		...theme.scrollbarStyles,
	},
	circleLoading: {
		color: green[500],
		position: "absolute",
		opacity: "70%",
		top: 0,
		left: "50%",
		marginTop: 12,
	},
	messageLeft: {
		marginRight: 20,
		marginTop: 2,
		minWidth: 100,
		maxWidth: 600,
		height: "auto",
		display: "block",
		position: "relative",
		"&:hover #messageActionsButton": {
			display: "flex",
			position: "absolute",
			top: 0,
			right: 0,
		},
		whiteSpace: "pre-wrap",
		backgroundColor: "#ffffff",
		color: "#303030",
		alignSelf: "flex-start",
		borderTopLeftRadius: 0,
		borderTopRightRadius: 8,
		borderBottomLeftRadius: 8,
		borderBottomRightRadius: 8,
		paddingLeft: 5,
		paddingRight: 5,
		paddingTop: 5,
		paddingBottom: 0,
		boxShadow: "0 1px 1px #b3b3b3",
	},
	quotedContainerLeft: {
		margin: "-3px -80px 6px -6px",
		overflow: "hidden",
		backgroundColor: "#f0f0f0",
		borderRadius: "7.5px",
		display: "flex",
		position: "relative",
	},
	quotedMsg: {
		padding: 10,
		maxWidth: 300,
		height: "auto",
		display: "block",
		whiteSpace: "pre-wrap",
		overflow: "hidden",
	},
	quotedSideColorLeft: {
		flex: "none",
		width: "4px",
		backgroundColor: "#6bcbef",
	},
	messageRight: {
		marginLeft: 20,
		marginTop: 2,
		minWidth: 100,
		maxWidth: 600,
		height: "auto",
		display: "block",
		position: "relative",
		"&:hover #messageActionsButton": {
			display: "flex",
			position: "absolute",
			top: 0,
			right: 0,
		},
		whiteSpace: "pre-wrap",
		backgroundColor: "#dcf8c6",
		color: "#303030",
		alignSelf: "flex-end",
		borderTopLeftRadius: 8,
		borderTopRightRadius: 8,
		borderBottomLeftRadius: 8,
		borderBottomRightRadius: 0,
		paddingLeft: 5,
		paddingRight: 5,
		paddingTop: 5,
		paddingBottom: 0,
		boxShadow: "0 1px 1px #b3b3b3",
	},
	quotedContainerRight: {
		margin: "-3px -80px 6px -6px",
		overflowY: "hidden",
		backgroundColor: "#cfe9ba",
		borderRadius: "7.5px",
		display: "flex",
		position: "relative",
	},
	quotedMsgRight: {
		padding: 10,
		maxWidth: 300,
		height: "auto",
		whiteSpace: "pre-wrap",
	},
	quotedSideColorRight: {
		flex: "none",
		width: "4px",
		backgroundColor: "#35cd96",
	},
	messageActionsButton: {
		display: "none",
		position: "relative",
		color: "#999",
		zIndex: 1,
		backgroundColor: "inherit",
		opacity: "90%",
		"&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
	},
	messageContactName: {
		display: "flex",
		color: "#6bcbef",
		fontWeight: 500,
	},
	textContentItem: {
		overflowWrap: "break-word",
		padding: "3px 80px 6px 6px",
	},
	textContentItemDeleted: {
		fontStyle: "italic",
		color: "rgba(0, 0, 0, 0.36)",
		overflowWrap: "break-word",
		padding: "3px 80px 6px 6px",
	},
	messageMedia: {
		objectFit: "cover",
		width: 250,
		height: 200,
		borderTopLeftRadius: 8,
		borderTopRightRadius: 8,
		borderBottomLeftRadius: 8,
		borderBottomRightRadius: 8,
	},
	timestamp: {
		fontSize: 11,
		position: "absolute",
		bottom: 0,
		right: 5,
		color: "#999",
	},
	dailyTimestamp: {
		alignItems: "center",
		textAlign: "center",
		alignSelf: "center",
		width: "110px",
		backgroundColor: "#e1f3fb",
		margin: "10px",
		borderRadius: "10px",
		boxShadow: "0 1px 1px #b3b3b3",
	},
	dailyTimestampText: {
		color: "#808888",
		padding: 8,
		alignSelf: "center",
		marginLeft: "0px",
	},
	ackIcons: {
		fontSize: 18,
		verticalAlign: "middle",
		marginLeft: 4,
	},
	deletedIcon: {
		fontSize: 18,
		verticalAlign: "middle",
		marginRight: 4,
	},
	ackDoneAllIcon: {
		color: green[500],
		fontSize: 18,
		verticalAlign: "middle",
		marginLeft: 4,
	},
	downloadMedia: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "inherit",
		padding: 10,
	},
	highlightedMessage: {
		backgroundColor: '#fff9c4 !important',
		transition: 'background-color 2s ease-out',
	},
}));

const reducer = (state, action) => {
	switch (action.type) {
		case "LOAD_MESSAGES": {
			const messages = action.payload;
			const newMessages = [];
			messages.forEach((message) => {
				const messageIndex = state.findIndex((m) => m.id === message.id);
				if (messageIndex === -1) {
					newMessages.push(message);
				}
			});
			return [...newMessages, ...state].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
		}
		case "LOAD_CONTEXT":
			return action.payload; // Substitui a lista inteira pelo contexto
		case "ADD_MESSAGE": {
			const newMessage = action.payload;
			const messageIndex = state.findIndex((m) => m.id === newMessage.id);
			if (messageIndex !== -1) {
				state[messageIndex] = newMessage;
			} else {
				state.push(newMessage);
			}
			return [...state];
		}
		case "UPDATE_MESSAGE": {
			const messageToUpdate = action.payload;
			const messageIndex = state.findIndex((m) => m.id === messageToUpdate.id);
			if (messageIndex !== -1) {
				state[messageIndex] = messageToUpdate;
			}
			return [...state];
		}
		case "RESET":
			return [];
		default:
			return state;
	}
};

const MessagesList = ({ ticketId, isGroup, messageToScrollToId }) => {
	const classes = useStyles();
	const [messagesList, dispatch] = useReducer(reducer, []);
	const [pageNumber, setPageNumber] = useState(1);
	const [hasMore, setHasMore] = useState(false);
	const [loading, setLoading] = useState(false);
	const lastMessageRef = useRef();
	const messagesListContainerRef = useRef(null);
	const [selectedMessage, setSelectedMessage] = useState({});
	const [anchorEl, setAnchorEl] = useState(null);
	const messageOptionsMenuOpen = Boolean(anchorEl);
	const isMountedRef = useRef(true);

	const scrollToBottom = useCallback(() => {
		if (lastMessageRef.current) {
			lastMessageRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, []);

	// Função para buscar as mensagens da conversa (scroll para cima ou inicial)
	const fetchMessages = useCallback(async (page) => {
		setLoading(true);
		try {
			const { data } = await api.get(`/messages/${ticketId}`, {
				params: { pageNumber: page },
			});
			dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
			setHasMore(data.hasMore);
			if (page === 1) {
				scrollToBottom();
			}
		} catch (err) {
			toastError(err);
		} finally {
			setLoading(false);
		}
	}, [ticketId, scrollToBottom]);

	// Efeito principal que decide o que fazer: carregar do início ou pular para o meio
	useEffect(() => {
		const fetchMessageContext = async (msgId) => {
			setLoading(true);
			try {
				const { data } = await api.get(`/messages/context/${msgId}`, {
					params: { ticketId }
				});
				dispatch({ type: "LOAD_CONTEXT", payload: data.messages });
				setHasMore(true); // Assume que pode haver mais para carregar
			} catch (err) {
				toastError("Erro ao carregar o contexto da mensagem.");
				fetchMessages(1); // Se falhar, carrega do início
			} finally {
				setLoading(false);
			}
		};

		dispatch({ type: "RESET" });
		setPageNumber(1);

		if (messageToScrollToId) {
			fetchMessageContext(messageToScrollToId);
		} else {
			fetchMessages(1);
		}
	}, [ticketId, messageToScrollToId, fetchMessages]);

	// Efeito para rolar e destacar a mensagem quando ela estiver na tela
	useEffect(() => {
		if (messageToScrollToId && messagesList.length > 0 && !loading) {
			const messageElement = document.getElementById(`message-${messageToScrollToId}`);
			if (messageElement) {
				messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
				messageElement.classList.add(classes.highlightedMessage);
				setTimeout(() => {
					if (isMountedRef.current) {
						messageElement.classList.remove(classes.highlightedMessage);
					}
				}, 3000);
			}
		}
	}, [messageToScrollToId, messagesList, loading, classes.highlightedMessage]);
	
	useEffect(() => {
		isMountedRef.current = true;
		return () => { isMountedRef.current = false; };
	}, []);

	// Socket listener
	useEffect(() => {
		const socket = openSocket();
		socket.on("connect", () => socket.emit("joinChatBox", ticketId));
		socket.on("appMessage", (data) => {
			if (data.action === "create") {
				dispatch({ type: "ADD_MESSAGE", payload: data.message });
				scrollToBottom();
			}
			if (data.action === "update") {
				dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
			}
		});
		return () => { socket.disconnect(); };
	}, [ticketId, scrollToBottom]);

	const loadMore = useCallback(() => {
		setPageNumber((prevPageNumber) => prevPageNumber + 1);
	}, []);

	const handleScroll = useCallback((e) => {
		if (!hasMore || loading) return;
		if (e.currentTarget.scrollTop < 50) {
			loadMore();
		}
	}, [hasMore, loading, loadMore]);

	const handleOpenMessageOptionsMenu = (e, message) => {
		setAnchorEl(e.currentTarget);
		setSelectedMessage(message);
	};

	const handleCloseMessageOptionsMenu = () => {
		setAnchorEl(null);
	};

	// Suas funções de renderização (checkMessageMedia, renderMessageAck, etc.)
	// permanecem exatamente as mesmas que você me enviou.
	// ...
	const checkMessageMedia = useCallback((message) => { /* ... SEU CÓDIGO ORIGINAL ... */ }, []);
	const renderMessageAck = useCallback((message) => { /* ... SEU CÓDIGO ORIGINAL ... */ }, []);
	const renderDailyTimestamps = useCallback((message, index) => { /* ... SEU CÓDIGO ORIGINAL ... */ }, [messagesList]);
	const renderMessageDivider = useCallback((message, index) => { /* ... SEU CÓDIGO ORIGINAL ... */ }, [messagesList]);
	const renderQuotedMessage = useCallback((message) => { /* ... SEU CÓDIGO ORIGINAL ... */ }, []);

	const renderMessages = useCallback(() => {
		if (messagesList.length > 0) {
			return messagesList.map((message, index) => {
				const isFromMe = message.fromMe;
				return (
					<React.Fragment key={message.id}>
						{renderDailyTimestamps(message, index)}
						{renderMessageDivider(message, index)}
						<div
							id={`message-${message.id}`}
							className={clsx(classes.messageLeft, { [classes.messageRight]: isFromMe })}
						>
							<IconButton
								id="messageActionsButton"
								disabled={message.isDeleted}
								className={classes.messageActionsButton}
								onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
							>
								<ExpandMore />
							</IconButton>
							{!isFromMe && isGroup && (
								<span className={classes.messageContactName}>{message.contact?.name}</span>
							)}
							{(message.mediaUrl || message.mediaType === "location" || message.mediaType === "vcard") &&
								checkMessageMedia(message)
							}
							<div className={clsx(classes.textContentItem, { [classes.textContentItemDeleted]: message.isDeleted })}>
								{message.isDeleted && <Block color="disabled" fontSize="small" className={classes.deletedIcon} />}
								{renderQuotedMessage(message)}
								<MarkdownWrapper>{message.body}</MarkdownWrapper>
								<span className={classes.timestamp}>
									{format(parseISO(message.createdAt), "HH:mm")}
									{renderMessageAck(message)}
								</span>
							</div>
						</div>
					</React.Fragment>
				);
			});
		}
		return null;
	}, [
		messagesList,
		isGroup,
		classes,
		renderDailyTimestamps,
		renderMessageDivider,
		renderQuotedMessage,
		checkMessageMedia,
		renderMessageAck,
		handleOpenMessageOptionsMenu
	]);

	return (
		<div className={classes.messagesListWrapper}>
			<MessageOptionsMenu
				message={selectedMessage}
				anchorEl={anchorEl}
				menuOpen={messageOptionsMenuOpen}
				handleClose={handleCloseMessageOptionsMenu}
			/>
			<div
				id="messagesList"
				className={classes.messagesList}
				onScroll={handleScroll}
				ref={messagesListContainerRef}
			>
				{messagesList.length > 0 ? renderMessages() : []}
				{loading && (
					<div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
						<CircularProgress className={classes.circleLoading} />
					</div>
				)}
				<div ref={lastMessageRef} />
			</div>
		</div>
	);
};

export default MessagesList;
