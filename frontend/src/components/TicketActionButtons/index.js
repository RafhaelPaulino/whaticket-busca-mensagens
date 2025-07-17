import React, { useContext, useState } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import { IconButton } from "@material-ui/core";
import { MoreVert, Replay, Search } from "@material-ui/icons";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import TicketOptionsMenu from "../TicketOptionsMenu";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import MessageSearchModal from "../MessageSearchModal";

import TicketsContext from "../../context/TicketsContext";

const useStyles = makeStyles(theme => ({
    actionButtons: {
        marginRight: 6,
        flex: "none",
        alignSelf: "center",
        marginLeft: "auto",
        "& > *": {
            margin: theme.spacing(1),
        },
    },

    searchButton: {
        position: "relative",
        "&.active": {
            backgroundColor: theme.palette.primary.light,
            color: theme.palette.primary.contrastText,
        }
    },
    searchIndicator: {
        position: "absolute",
        top: -2,
        right: -2,
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: theme.palette.secondary.main,
        animation: '$pulse 2s infinite',
    },
    '@keyframes pulse': {
        '0%': {
            transform: 'scale(0.95)',
            boxShadow: '0 0 0 0 rgba(255, 152, 0, 0.7)',
        },
        '70%': {
            transform: 'scale(1)',
            boxShadow: '0 0 0 10px rgba(255, 152, 0, 0)',
        },
        '100%': {
            transform: 'scale(0.95)',
            boxShadow: '0 0 0 0 rgba(255, 152, 0, 0)',
        },
    },
}));

const TicketActionButtons = ({ ticket, onNavigateToMessage }) => {
    const classes = useStyles();
    const history = useHistory();
    const [anchorEl, setAnchorEl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [messageSearchOpen, setMessageSearchOpen] = useState(false);
    const ticketOptionsMenuOpen = Boolean(anchorEl);
    const { user } = useContext(AuthContext);

    
    const { refreshTickets } = useContext(TicketsContext);

    const handleOpenTicketOptionsMenu = e => {
        setAnchorEl(e.currentTarget);
    };

    const handleCloseTicketOptionsMenu = e => {
        setAnchorEl(null);
    };

    const handleOpenMessageSearch = () => {
        setMessageSearchOpen(true);
    };

    const handleCloseMessageSearch = () => {
        setMessageSearchOpen(false);
    };

    const handleUpdateTicketStatus = async (e, status, userId) => {
        setLoading(true);
        try {
            await api.put(`/tickets/${ticket.id}`, {
                status: status,
                userId: userId || null,
            });

            setLoading(false);
            
            
            refreshTickets();

            if (status === "open") {
                history.push(`/tickets/${ticket.id}`);
            } else {
                history.push("/tickets");
            }
        } catch (err) {
            setLoading(false);
            toastError(err);
        }
    };

    return (
        <div className={classes.actionButtons}>
            {ticket.status === "closed" && (
                <ButtonWithSpinner
                    loading={loading}
                    startIcon={<Replay />}
                    size="small"
                    onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
                >
                    {i18n.t("messagesList.header.buttons.reopen")}
                </ButtonWithSpinner>
            )}
            {ticket.status === "open" && (
                <>
                    <ButtonWithSpinner
                        loading={loading}
                        startIcon={<Replay />}
                        size="small"
                        onClick={e => handleUpdateTicketStatus(e, "pending", null)}
                    >
                        {i18n.t("messagesList.header.buttons.return")}
                    </ButtonWithSpinner>
                    <ButtonWithSpinner
                        loading={loading}
                        size="small"
                        variant="contained"
                        color="primary"
                        onClick={e => handleUpdateTicketStatus(e, "closed", user?.id)}
                    >
                        {i18n.t("messagesList.header.buttons.resolve")}
                    </ButtonWithSpinner>
                    
                    <IconButton 
                        onClick={handleOpenMessageSearch}
                        className={`${classes.searchButton} ${messageSearchOpen ? 'active' : ''}`}
                        title="Buscar mensagens (Ctrl+F)"
                    >
                        <Search />
                        {messageSearchOpen && <div className={classes.searchIndicator} />}
                    </IconButton>
                    
                    <IconButton onClick={handleOpenTicketOptionsMenu}>
                        <MoreVert />
                    </IconButton>
                    <TicketOptionsMenu
                        ticket={ticket}
                        anchorEl={anchorEl}
                        menuOpen={ticketOptionsMenuOpen}
                        handleClose={handleCloseTicketOptionsMenu}
                    />
                    
                    <MessageSearchModal
                        open={messageSearchOpen}
                        onClose={handleCloseMessageSearch}
                        ticketId={ticket.id}
                        onNavigateToMessage={onNavigateToMessage}
                    />
                </>
            )}
            {ticket.status === "pending" && (
                <ButtonWithSpinner
                    loading={loading}
                    size="small"
                    variant="contained"
                    color="primary"
                    onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
                >
                    {i18n.t("messagesList.header.buttons.accept")}
                </ButtonWithSpinner>
            )}
        </div>
    );
};

export default TicketActionButtons;
