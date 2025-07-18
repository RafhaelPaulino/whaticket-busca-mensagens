import React, { useState, useEffect, useReducer, useRef, useCallback } from "react";
import { isSameDay, parseISO, format } from "date-fns";
import connectToSocket from "../../services/socket-io";
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
		animation: '$pulse 2s ease-in-out',
	},
	'@keyframes pulse': {
		'0%': {
			backgroundColor: '#fff3cd',
			transform: 'scale(1.02)',
		},
		'50%': {
			backgroundColor: '#fff9c4',
			transform: 'scale(1.01)',
		},
		'100%': {
			backgroundColor: 'transparent',
			transform: 'scale(1)',
		},
	},
}));

const reducer = (state, action) => {
	switch (action.type) {
		case "LOAD_MESSAGES": {
			const messages = action.payload;
			const newState = [...state];
			
			messages.forEach((message) => {
				const messageIndex = newState.findIndex((m) => m.id === message.id);
				if (messageIndex === -1) {
					newState.push({ ...message });
				}
			});
			
			return newState.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
		}
		case "LOAD_CONTEXT": {
			return action.payload.map(msg => ({ ...msg })).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
		}
		case "ADD_MESSAGE": {
			const newMessage = action.payload;
			console.log("💬 ADD_MESSAGE - Nova mensagem:", newMessage.id, newMessage.body?.substring(0, 50));
			
			const newState = [...state];
			const messageIndex = newState.findIndex((m) => m.id === newMessage.id);
			
			if (messageIndex !== -1) {
				newState[messageIndex] = { ...newMessage };
			} else {
				newState.push({ ...newMessage });
			}
			
			return newState.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
		}
		case "UPDATE_MESSAGE": {
			const messageToUpdate = action.payload;
			console.log("🔄 UPDATE_MESSAGE - Atualizando mensagem:", messageToUpdate.id, "ACK:", messageToUpdate.ack);
			
			const newState = [...state];
			const messageIndex = newState.findIndex((m) => m.id === messageToUpdate.id);
			
			if (messageIndex !== -1) {
				newState[messageIndex] = { ...messageToUpdate };
			}
			
			return newState;
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
	const [isContextMode, setIsContextMode] = useState(false);
	const lastMessageRef = useRef();
	const messagesListContainerRef = useRef(null);
	const [selectedMessage, setSelectedMessage] = useState({});
	const [anchorEl, setAnchorEl] = useState(null);
	const messageOptionsMenuOpen = Boolean(anchorEl);
	const isMountedRef = useRef(true);
	const socketRef = useRef(null);


	const fetchMessages = useCallback(async (page) => {
		if (isContextMode || loading || !ticketId) return;
		
		setLoading(true);
		try {
			const { data } = await api.get(`/messages/${ticketId}`, {
				params: { pageNumber: page },
			});
			dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
			setHasMore(data.hasMore);
			if (page === 1) {
				setTimeout(() => {
					if (lastMessageRef.current) {
						lastMessageRef.current.scrollIntoView({ behavior: "smooth" });
					}
				}, 100);
			}
		} catch (err) {
			toastError(err);
		} finally {
			if (isMountedRef.current) {
				setLoading(false);
			}
		}
	}, [ticketId, isContextMode, loading]);

	const fetchMessageContext = useCallback(async (msgId) => {
		if (!ticketId || loading) return;
		
		setLoading(true);
		setIsContextMode(true);
		
		try {
			const { data } = await api.get(`/messages/${ticketId}/context/${msgId}`);
			dispatch({ type: "LOAD_CONTEXT", payload: data.messages });
			setHasMore(true);
		} catch (err) {
			console.error("Erro ao carregar contexto da mensagem:", err);
			toastError("Erro ao carregar o contexto da mensagem.");
			setIsContextMode(false);
			fetchMessages(1);
		} finally {
			if (isMountedRef.current) {
				setLoading(false);
			}
		}
	}, [ticketId, fetchMessages]);

	
	useEffect(() => {
		if (!ticketId) return;

		console.log("🔄 MessagesList - Mudança de ticket:", ticketId, messageToScrollToId);

		dispatch({ type: "RESET" });
		setPageNumber(1);
		setIsContextMode(false);

	
		const timeout = setTimeout(() => {
			if (messageToScrollToId) {
				fetchMessageContext(messageToScrollToId);
			} else {
				fetchMessages(1);
			}
		}, 100);

		return () => clearTimeout(timeout);
	}, [ticketId, messageToScrollToId]);

	useEffect(() => {
		if (messageToScrollToId && messagesList.length > 0 && !loading) {
			const timer = setTimeout(() => {
				const messageElement = document.getElementById(`message-${messageToScrollToId}`);
				if (messageElement) {
					messageElement.scrollIntoView({ 
						behavior: "smooth", 
						block: "center",
						inline: "nearest" 
					});
					
					messageElement.classList.add(classes.highlightedMessage);
					
					const highlightTimer = setTimeout(() => {
						if (isMountedRef.current && messageElement) {
							messageElement.classList.remove(classes.highlightedMessage);
						}
					}, 3000);
					
					return () => clearTimeout(highlightTimer);
				}
			}, 150);
			
			return () => clearTimeout(timer);
		}
	}, [messageToScrollToId, messagesList, loading, classes.highlightedMessage]);
	
	useEffect(() => {
		isMountedRef.current = true;
		return () => { 
			isMountedRef.current = false; 
		};
	}, []);


	useEffect(() => {
		if (!ticketId) return;

		console.log("🔌 Configurando Socket.IO - MessagesList para ticket:", ticketId);

		const socket = connectToSocket();
		if (!socket || !socket.on) {
			console.error("❌ Erro ao obter instância do socket");
			return;
		}

		socketRef.current = socket;

		const handleConnect = () => {
			if (!isMountedRef.current) return;
			console.log("🔌 Socket conectado - MessagesList para ticket:", ticketId);
			
		
			setTimeout(() => {
				if (isMountedRef.current && socketRef.current && socketRef.current.connected) {
					console.log("📨 Emitindo joinChatBox para ticket:", ticketId);
					socketRef.current.emit("joinChatBox", ticketId);
				}
			}, 150);
		};

		const handleAppMessage = (data) => {
			if (!isMountedRef.current) return;
			
			console.log("📨 Evento appMessage recebido:", data.action, data.message?.id, "ACK:", data.message?.ack);
			
			
			if (data.ticket?.id && data.ticket.id !== parseInt(ticketId)) {
				console.log("📨 Mensagem não é para o ticket atual, ignorando");
				return;
			}
			
			if (data.action === "create" && data.message) {
				console.log("📨 ✅ ADICIONANDO nova mensagem:", data.message.body?.substring(0, 50));
				dispatch({ type: "ADD_MESSAGE", payload: data.message });
				
				
				setTimeout(() => {
					if (isMountedRef.current && lastMessageRef.current) {
						console.log("📨 Fazendo scroll para a nova mensagem");
						lastMessageRef.current.scrollIntoView({ behavior: "smooth" });
					}
				}, 100);
			}
			
			if (data.action === "update" && data.message) {
				console.log("📨 ✅ ATUALIZANDO ACK da mensagem:", data.message.id, "Novo ACK:", data.message.ack);
				dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
			}
		};

		const handleConnectError = (error) => {
			if (!isMountedRef.current) return;
			console.error("❌ Erro conexão socket MessagesList:", error.message);
		};

		const handleDisconnect = (reason) => {
			if (!isMountedRef.current) return;
			console.log("🔌 Socket desconectado MessagesList:", reason);
		};

		
		socket.on("connect", handleConnect);
		socket.on("appMessage", handleAppMessage);
		socket.on("connect_error", handleConnectError);
		socket.on("disconnect", handleDisconnect);

		console.log("✅ Listeners configurados - MessagesList para ticket:", ticketId);

		
		if (socket.connected) {
			console.log("🔌 Socket já conectado, configurando imediatamente");
			handleConnect();
		}


		return () => {
			console.log("🧹 Cleanup MessagesList socket para ticket:", ticketId);
			if (socketRef.current) {
				socketRef.current.off("connect", handleConnect);
				socketRef.current.off("appMessage", handleAppMessage);
				socketRef.current.off("connect_error", handleConnectError);
				socketRef.current.off("disconnect", handleDisconnect);
			}
			socketRef.current = null;
		};
	}, [ticketId]); 

	const loadMore = useCallback(() => {
		if (isContextMode) {
			setIsContextMode(false);
			setPageNumber(2);
			fetchMessages(2);
		} else {
			const nextPage = pageNumber + 1;
			setPageNumber(nextPage);
			fetchMessages(nextPage);
		}
	}, [pageNumber, fetchMessages, isContextMode]);

	const handleScroll = useCallback((e) => {
		if (!hasMore || loading) return;
		if (e.currentTarget.scrollTop < 50) {
			loadMore();
		}
	}, [hasMore, loading, loadMore]);

	const handleOpenMessageOptionsMenu = useCallback((e, message) => {
		setAnchorEl(e.currentTarget);
		setSelectedMessage(message);
	}, []);

	const handleCloseMessageOptionsMenu = useCallback(() => {
		setAnchorEl(null);
	}, []);

	const checkMessageMedia = useCallback((message) => {
		if (message.mediaType === "location" && message.body.split('|').length >= 2) {
			let locationParts = message.body.split('|');
			let imageLocation = locationParts[0];
			let linkLocation = locationParts[1];
			let descriptionLocation = null;
			if (locationParts.length > 2) {
				descriptionLocation = message.body.split('|')[2];
			}
			return <LocationPreview image={imageLocation} link={linkLocation} description={descriptionLocation} />;
		}
		else if (message.mediaType === "vcard") {
			let array = message.body.split("\n");
			let obj = [];
			let contact = "";
			for (let index = 0; index < array.length; index++) {
				const v = array[index];
				let values = v.split(":");
				for (let ind = 0; ind < values.length; ind++) {
					if (values[ind].indexOf("+") !== -1) {
						obj.push({ number: values[ind] });
					}
					if (values[ind].indexOf("FN") !== -1) {
						contact = values[ind + 1];
					}
				}
			}
			return <VcardPreview contact={contact} numbers={obj[0]?.number} />;
		}
		else if (/^.*\.(jpe?g|png|gif)?$/i.exec(message.mediaUrl) && message.mediaType === "image") {
			return <ModalImageCors imageUrl={message.mediaUrl} />;
		} else if (message.mediaType === "audio") {
			return <Audio url={message.mediaUrl} />;
		} else if (message.mediaType === "video") {
			return (
				<video
					className={classes.messageMedia}
					src={message.mediaUrl}
					controls
				/>
			);
		} else {
			return (
				<>
					<div className={classes.downloadMedia}>
						<Button
							startIcon={<GetApp />}
							color="primary"
							variant="outlined"
							target="_blank"
							href={message.mediaUrl}
						>
							Download
						</Button>
					</div>
					<Divider />
				</>
			);
		}
	}, [classes.messageMedia, classes.downloadMedia]);

	const renderMessageAck = useCallback((message) => {

		if (!message.fromMe) {
			return null;
		}

		if (message.ack === 0) {
			return <AccessTime fontSize="small" className={classes.ackIcons} />;
		}
		if (message.ack === 1) {
			return <Done fontSize="small" className={classes.ackIcons} />;
		}
		if (message.ack === 2) {
			return <DoneAll fontSize="small" className={classes.ackIcons} />;
		}
		if (message.ack === 3 || message.ack === 4) {
			return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />;
		}
		
		
		return null;
	}, [classes.ackIcons, classes.ackDoneAllIcon]);

	const renderDailyTimestamps = useCallback((message, index) => {
		if (index === 0) {
			return (
				<span
					className={classes.dailyTimestamp}
					key={`timestamp-${message.id}`}
				>
					<div className={classes.dailyTimestampText}>
						{format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
					</div>
				</span>
			);
		}
		if (index < messagesList.length) {
			let messageDay = parseISO(messagesList[index].createdAt);
			let previousMessageDay = parseISO(messagesList[index - 1].createdAt);
			if (!isSameDay(messageDay, previousMessageDay)) {
				return (
					<span
						className={classes.dailyTimestamp}
						key={`timestamp-${message.id}`}
					>
						<div className={classes.dailyTimestampText}>
							{format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
						</div>
					</span>
				);
			}
		}
		return null;
	}, [messagesList, classes.dailyTimestamp, classes.dailyTimestampText]);

	const renderMessageDivider = useCallback((message, index) => {
		if (index < messagesList.length && index > 0) {
			let messageUser = messagesList[index].fromMe;
			let previousMessageUser = messagesList[index - 1].fromMe;
			if (messageUser !== previousMessageUser) {
				return (
					<span style={{ marginTop: 16 }} key={`divider-${message.id}`}></span>
				);
			}
		}
		return null;
	}, [messagesList]);

	const renderQuotedMessage = useCallback((message) => {
		if (!message.quotedMsg) return null;
		return (
			<div
				className={clsx(classes.quotedContainerLeft, {
					[classes.quotedContainerRight]: message.fromMe,
				})}
			>
				<span
					className={clsx(classes.quotedSideColorLeft, {
						[classes.quotedSideColorRight]: message.quotedMsg?.fromMe,
					})}
				></span>
				<div className={classes.quotedMsg}>
					{!message.quotedMsg?.fromMe && (
						<span className={classes.messageContactName}>
							{message.quotedMsg?.contact?.name}
						</span>
					)}
					{message.quotedMsg?.body}
				</div>
			</div>
		);
	}, [classes]);

	const renderMessages = useCallback(() => {
		if (messagesList.length > 0) {
			return messagesList.map((message, index) => {
				const isFromMe = message.fromMe;
				

				const messageBody = message.body?.startsWith("0") && !isFromMe 
					? message.body.substring(1) 
					: message.body;

				return (
					<React.Fragment key={message.id}>
						{renderDailyTimestamps(message, index)}
						{renderMessageDivider(message, index)}
						<div
							id={`message-${message.id}`}
							className={clsx(classes.messageLeft, { [classes.messageRight]: isFromMe })}
						>
							<IconButton
								variant="contained"
								size="small"
								id="messageActionsButton"
								disabled={Boolean(message.isDeleted)}
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
								<MarkdownWrapper>{messageBody}</MarkdownWrapper>
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
		return <div>Diga olá para seu novo contato!</div>;
	}, [
		messagesList,
		renderDailyTimestamps,
		renderMessageDivider,
		classes,
		isGroup,
		checkMessageMedia,
		renderQuotedMessage,
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