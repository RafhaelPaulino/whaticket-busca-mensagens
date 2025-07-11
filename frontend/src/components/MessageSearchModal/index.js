import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  TextField,
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
  IconButton,
  CircularProgress,
  Divider
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Close, Search } from "@material-ui/icons";
import { debounce } from "lodash";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  dialog: {
    "& .MuiDialog-paper": {
      width: "500px",
      maxWidth: "90vw",
      height: "70vh",
      maxHeight: "70vh",
    },
  },
  dialogTitle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: theme.spacing(1),
  },
  searchContainer: {
    padding: theme.spacing(2),
    borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
  },
  searchField: {
    width: "100%",
  },
  resultsList: {
    flex: 1,
    overflow: "auto",
    padding: 0,
  },
  messageItem: {
    cursor: "pointer",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  messageText: {
    wordBreak: "break-word",
  },
  messageDate: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
  },
  noResults: {
    textAlign: "center",
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(4),
  },
  highlightText: {
    backgroundColor: theme.palette.warning.light,
    fontWeight: "bold",
  },
}));

const MessageSearchModal = ({ open, onClose, ticketId, onNavigateToMessage }) => {
  const classes = useStyles();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const normalizeText = (text) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-\s]+/g, ' ')
      .trim();
  };

  const highlightText = (text, query) => {
    if (!query) return text;
    const normalizedText = normalizeText(text);
    const normalizedQuery = normalizeText(query);

    const index = normalizedText.indexOf(normalizedQuery);
    if (index === -1) return text;

    const start = index;
    const end = index + normalizedQuery.length;

    return (
      <>
        {text.substring(0, start)}
        <span className={classes.highlightText}>
          {text.substring(start, end)}
        </span>
        {text.substring(end)}
      </>
    );
  };

  const fetchMessages = useCallback(async (query, pageNum) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setHasMore(true);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get(`/messages/search/${ticketId}`, {
        params: {
          q: query,
          page: pageNum,
          limit: 40
        }
      });

      if (pageNum === 1) {
        setSearchResults(data.messages);
      } else {
        setSearchResults(prev => [...prev, ...data.messages]);
      }
      setHasMore(data.hasMore);
    } catch (error) {
      console.error("Erro na busca de mensagens:", error);
      setSearchResults([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const debouncedSearch = useMemo(
    () => debounce((query) => {
      setPage(1);
      setSearchResults([]);
      setHasMore(true);
      fetchMessages(query, 1);
    }, 1000),
    [fetchMessages]
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
      setPage(1);
      setHasMore(true);
    }
  }, [open]);

  const handleMessageClick = (messageId) => {
    if (onNavigateToMessage) {
      onNavigateToMessage(messageId);
    }
    onClose();
  };

  const loadMoreResults = () => {
    if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMessages(searchQuery, nextPage);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className={classes.dialog}
      fullWidth
      maxWidth={false}
    >
      <DialogTitle className={classes.dialogTitle}>
        <Typography variant="h6" component="span">Buscar Mensagens</Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <div className={classes.searchContainer}>
        <TextField
          className={classes.searchField}
          placeholder="Digite para buscar mensagens..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <Search style={{ marginRight: 8, color: '#999' }} />,
            endAdornment: loading && searchQuery.length >= 2 ? (
              <CircularProgress size={20} />
            ) : null,
          }}
          autoFocus
        />
      </div>

      <DialogContent style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        {searchResults.length > 0 ? (
          <List className={classes.resultsList} onScroll={(e) => {
            const { scrollTop, scrollHeight, clientHeight } = e.target;
            if (scrollHeight - scrollTop === clientHeight) {
              loadMoreResults();
            }
          }}>
            {searchResults.map((message, index) => (
              <React.Fragment key={message.id}>
                <ListItem
                  className={classes.messageItem}
                  onClick={() => handleMessageClick(message.id)}
                >
                  <ListItemText
                    primary={
                      <Typography className={classes.messageText}>
                        {highlightText(message.body, searchQuery)}
                      </Typography>
                    }
                    secondary={
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography className={classes.messageDate} component="div">
                          {formatDate(message.createdAt)}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" component="div">
                          {message.fromMe ? "Você" : "Cliente"}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
                {index < searchResults.length - 1 && <Divider />}
              </React.Fragment>
            ))}

            {hasMore && (
              <ListItem button disabled={loading}>
                <ListItemText
                  primary={
                    <Box display="flex" justifyContent="center">
                      <CircularProgress size={20} />
                    </Box>
                  }
                />
              </ListItem>
            )}
          </List>
        ) : searchQuery.length >= 2 && !loading ? (
          <div className={classes.noResults}>
            <Typography>Nenhuma mensagem encontrada para "{searchQuery}"</Typography>
          </div>
        ) : searchQuery.length < 2 && !loading ? (
          <div className={classes.noResults}>
            <Typography>Digite pelo menos 2 caracteres para buscar</Typography>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default MessageSearchModal;