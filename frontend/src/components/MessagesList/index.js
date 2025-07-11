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
		backgroundColor: '#ffeb3b !important',
		transition: 'background-color 2s ease-out',
		boxShadow: '0 0 10px rgba(255, 235, 59, 0.8) !important',
	},
}));

const reducer = (state, action) => {
	if (action.type === "LOAD_MESSAGES") {
		const messages = action.payload;
		const newMessages = [];

		messages.forEach((message) => {
			const messageIndex = state.findIndex((m) => m.id === message.id);
			if (messageIndex !== -1) {
				state[messageIndex] = message;
			} else {
				newMessages.push(message);
			}
		});

		return [...newMessages, ...state];
	}

	if (action.type === "ADD_MESSAGE") {
		const newMessage = action.payload;
		const messageIndex = state.findIndex((m) => m.id === newMessage.id);

		if (messageIndex !== -1) {
			state[messageIndex] = newMessage;
		} else {
			state.push(newMessage);
		}

		return [...state];
	}

	if (action.type === "UPDATE_MESSAGE") {
		const messageToUpdate = action.payload;
		const messageIndex = state.findIndex((m) => m.id === messageToUpdate.id);

		if (messageIndex !== -1) {
			state[messageIndex] = messageToUpdate;
		}

		return [...state];
	}

	if (action.type === "RESET") {
		return [];
	}

	return state;
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
	const currentTicketId = useRef(ticketId);
	const [findingMessage, setFindingMessage] = useState(null);

	const scrollToBottom = useCallback(() => {
		if (lastMessageRef.current && isMountedRef.current) {
			lastMessageRef.current.scrollIntoView({});
		}
	}, []);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		if (messageToScrollToId) {
			const messageExists = messagesList.some(m => m.id === messageToScrollToId);
			if (!messageExists) {
				dispatch({ type: "RESET" });
				setPageNumber(1);
				setFindingMessage(messageToScrollToId);
			}
		}
	}, [messageToScrollToId]);

	useEffect(() => {
		dispatch({ type: "RESET" });
		setPageNumber(1);
		currentTicketId.current = ticketId;
	}, [ticketId]);

	useEffect(() => {
		if (!ticketId) return;
		if (findingMessage && pageNumber === 1) {
			setLoading(true);
		} else if (!findingMessage) {
			setLoading(true);
		}

		const delayDebounceFn = setTimeout(async () => {
			try {
				const { data } = await api.get("/messages/" + ticketId, {
					params: { pageNumber },
				});

				if (isMountedRef.current && currentTicketId.current === ticketId) {
					dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
					setHasMore(data.hasMore);
					setLoading(false);

					if (findingMessage) {
						const found = data.messages.some(m => m.id === findingMessage);
						if (!found && data.hasMore) {
							setPageNumber(p => p + 1);
						} else {
							setFindingMessage(null);
						}
					} else if (pageNumber === 1 && data.messages.length > 0) {
						scrollToBottom();
					}
				}
			} catch (err) {
				if (isMountedRef.current) {
					setLoading(false);
					toastError(err);
				}
			}
		}, 500);
		return () => clearTimeout(delayDebounceFn);
	}, [pageNumber, ticketId, scrollToBottom, findingMessage]);

	useEffect(() => {
		if (!ticketId) return;

		const socket = openSocket();

		socket.on("connect", () => socket.emit("joinChatBox", ticketId));

		socket.on("appMessage", (data) => {
			if (!isMountedRef.current || currentTicketId.current !== data.ticket.id) return;

			if (data.action === "create") {
				dispatch({ type: "ADD_MESSAGE", payload: data.message });
				scrollToBottom();
			}

			if (data.action === "update") {
				dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
			}
		});

		socket.on("connect_error", (error) => console.error("Socket connection error:", error));

		return () => {
			if (socket && socket.connected) {
				socket.off("connect");
				socket.off("appMessage");
				socket.off("connect_error");
				socket.disconnect();
			}
		};
	}, [ticketId, scrollToBottom]);

	useEffect(() => {
		if (messageToScrollToId && messagesList.length > 0 && !findingMessage) {
			const messageElement = document.getElementById(`message-${messageToScrollToId}`);
			
			if (messageElement) {
				messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
				messageElement.classList.add(classes.highlightedMessage);

				const timer = setTimeout(() => {
					if (isMountedRef.current) {
						messageElement.classList.remove(classes.highlightedMessage);
					}
				}, 3000);

				return () => clearTimeout(timer);
			}
		}
	}, [messageToScrollToId, messagesList, classes.highlightedMessage, findingMessage]);

	const loadMore = useCallback(() => {
		if (isMountedRef.current && hasMore && !loading) {
			setPageNumber((prevPageNumber) => prevPageNumber + 1);
		}
	}, [hasMore, loading]);

	const handleScroll = useCallback((e) => {
		if (!hasMore || loading || !isMountedRef.current) return;
		const { scrollTop } = e.currentTarget;

		if (scrollTop < 50) {
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
			const viewMessagesList = messagesList.map((message, index) => {
				const isFromMe = message.fromMe;
				return (
					<React.Fragment key={message.id}>
						{renderDailyTimestamps(message, index)}
						{renderMessageDivider(message, index)}
						<div
							id={`message-${message.id}`}
							className={clsx(classes.messageLeft, {
								[classes.messageRight]: isFromMe,
							})}
						>
							<IconButton
								variant="contained"
								size="small"
								id="messageActionsButton"
								disabled={message.isDeleted}
								className={classes.messageActionsButton}
								onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
							>
								<ExpandMore />
							</IconButton>
							{!isFromMe && isGroup && (
								<span className={classes.messageContactName}>
									{message.contact?.name}
								</span>
							)}
							{(message.mediaUrl || message.mediaType === "location" || message.mediaType === "vcard") && 
								checkMessageMedia(message)
							}
							<div className={clsx(classes.textContentItem, {
								[classes.textContentItemDeleted]: message.isDeleted,
							})}>
								{message.isDeleted && (
									<Block
										color="disabled"
										fontSize="small"
										className={classes.deletedIcon}
									/>
								)}
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
			return viewMessagesList;
		} else {
			return <div>Say hello to your new contact!</div>;
		}
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
				{(loading || findingMessage) && (
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
