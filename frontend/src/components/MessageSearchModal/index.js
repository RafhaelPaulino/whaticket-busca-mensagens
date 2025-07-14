import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
    Divider,
    Chip,
    InputAdornment,
    Grid,
    useMediaQuery
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { 
    Close, 
    Search, 
    Image,
    Audiotrack,
    VideoLibrary,
    Description,
    Message,
    Person,
    Navigation
} from "@material-ui/icons";
import { debounce } from "lodash";
import { format, parseISO } from "date-fns";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
    dialog: {
        "& .MuiDialog-paper": {
            width: "90vw",
            maxWidth: "900px",
            height: "80vh",
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
        },
    },
    dialogTitle: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingRight: theme.spacing(1),
        background: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
    },
    searchContainer: {
        padding: theme.spacing(2),
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        background: theme.palette.background.default,
    },
    searchField: {
        width: "100%",
        "& .MuiOutlinedInput-root": {
            borderRadius: 25,
        },
    },
    resultsList: {
        flex: 1,
        overflow: "auto",
        padding: 0,
    },
    messageItem: {
        cursor: "pointer",
        borderLeft: "4px solid transparent",
        transition: "all 0.2s ease-in-out",
        padding: theme.spacing(1.5),
        "&:hover": {
            backgroundColor: theme.palette.action.hover,
            borderLeftColor: theme.palette.primary.main,
            transform: "translateX(4px)",
        },
    },
    messageText: {
        wordBreak: "break-word",
        lineHeight: 1.5,
        fontSize: "0.95rem",
    },
    messageDate: {
        fontSize: "0.75rem",
        color: theme.palette.text.secondary,
        fontWeight: 500,
    },
    highlightText: {
        backgroundColor: theme.palette.warning.light,
        fontWeight: "bold",
        padding: "2px 4px",
        borderRadius: 3,
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    },
    searchStats: {
        padding: theme.spacing(1.5, 2),
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        background: theme.palette.background.paper,
        fontSize: "0.875rem",
    },
    loadingContainer: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: theme.spacing(4),
    },
    noResults: {
        textAlign: "center",
        padding: theme.spacing(4),
        color: theme.palette.text.secondary,
    },
    messagePreview: {
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        display: "-webkit-box",
        "-webkit-line-clamp": 3,
        "-webkit-box-orient": "vertical",
        marginTop: theme.spacing(0.5),
    },
    messageHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: theme.spacing(0.5),
    },
    senderChip: {
        fontSize: "0.7rem",
        height: 20,
    },
    mediaTypeIcon: {
        fontSize: "1rem",
        marginRight: theme.spacing(0.5),
    },
    loadMoreButton: {
        padding: theme.spacing(2),
        textAlign: "center",
    },
    emptyState: {
        textAlign: "center",
        padding: theme.spacing(6),
        color: theme.palette.text.secondary,
    },
    searchTips: {
        fontSize: "0.8rem",
        color: theme.palette.text.secondary,
        marginTop: theme.spacing(1),
    },
    navigationIcon: {
        color: theme.palette.primary.main,
        marginLeft: theme.spacing(1),
        animation: '$pulse 1.5s ease-in-out infinite',
    },
    '@keyframes pulse': {
        '0%': { opacity: 0.6 },
        '50%': { opacity: 1 },
        '100%': { opacity: 0.6 },
    },
    performanceIndicator: {
        position: "absolute",
        top: theme.spacing(1),
        right: theme.spacing(1),
        background: theme.palette.success.main,
        color: "white",
        padding: theme.spacing(0.5, 1),
        borderRadius: 12,
        fontSize: "0.7rem",
        fontWeight: "bold",
    }
}));

const MessageSearchModal = ({ open, onClose, ticketId, onNavigateToMessage }) => {
    const classes = useStyles();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [searchDuration, setSearchDuration] = useState(null);

    const searchInputRef = useRef(null);

    // ✅ CACHE OTIMIZADO
    const [searchCache] = useState(() => new Map());

    const normalizeText = (text) => {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[-\s]+/g, ' ')
            .trim();
    };

    const highlightText = (text, query) => {
        if (!query || query.length < 2) return text;
        
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
    
    // ✅ FUNÇÃO OTIMIZADA DE BUSCA
    const performSearch = useCallback(async (query, pageNum) => {
        if (!query || query.length < 2) return;

        const startTime = performance.now();
        const cacheKey = `${ticketId}-${query}-${pageNum}`;
        
        if (searchCache.has(cacheKey)) {
            const cachedResult = searchCache.get(cacheKey);
            if (pageNum === 1) {
                setSearchResults(cachedResult.messages || []);
            } else {
                setSearchResults(prev => [...prev, ...(cachedResult.messages || [])]);
            }
            setHasMore(cachedResult.hasMore);
            const endTime = performance.now();
            setSearchDuration(endTime - startTime);
            return;
        }

        setLoading(true);

        try {
            const params = {
                q: query,
                page: pageNum,
                limit: 40,
            };

            const { data } = await api.get(`/messages/search/${ticketId}`, { params });

            searchCache.set(cacheKey, {
                messages: data.messages || [],
                total: data.total || data.count || data.messages?.length || 0,
                hasMore: data.hasMore
            });

            if (searchCache.size > 50) {
                const firstKey = searchCache.keys().next().value;
                searchCache.delete(firstKey);
            }

            if (pageNum === 1) {
                setSearchResults(data.messages || []);
            } else {
                setSearchResults(prev => [...prev, ...(data.messages || [])]);
            }
            
            setHasMore(data.hasMore);
            
            const endTime = performance.now();
            setSearchDuration(endTime - startTime);
            
        } catch (error) {
            console.error("Erro na busca de mensagens:", error);
            setSearchResults([]);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [ticketId, searchCache]);

    // ✅ DEBOUNCE OTIMIZADO
    const debouncedSearch = useMemo(
        () => debounce((query) => {
            if (query.length >= 2) {
                setPage(1);
                setSearchResults([]);
                setHasMore(true);
                performSearch(query, 1);
            } else {
                setSearchResults([]);
                setHasMore(true);
                setSearchDuration(null);
            }
        }, 600),
        [performSearch] 
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
            setSearchDuration(null);
            searchCache.clear();
        } else {
            setTimeout(() => {
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            }, 100);
        }
    }, [open, searchCache]);

    const handleSearchChange = (event) => {
        setSearchQuery(event.target.value);
    };

    // ✅ NAVEGAÇÃO OTIMIZADA
    const handleMessageClick = (messageId) => {
        if (onNavigateToMessage) {
            const clickedElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (clickedElement) {
                clickedElement.style.transform = "scale(0.98)";
                clickedElement.style.transition = "transform 0.1s";
                
                setTimeout(() => {
                    clickedElement.style.transform = "scale(1)";
                }, 100);
            }
            
            onNavigateToMessage(messageId);
        }
        onClose();
    };

    const loadMoreResults = useCallback(() => {
        if (hasMore && !loading && searchQuery.length >= 2) {
            const nextPage = page + 1;
            setPage(nextPage);
            performSearch(searchQuery, nextPage);
        }
    }, [hasMore, loading, searchQuery, page, performSearch]);

    const handleScroll = useCallback((e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !loading) {
            loadMoreResults();
        }
    }, [hasMore, loading, loadMoreResults]);

    const formatDate = (dateString) => {
        return format(parseISO(dateString), "dd/MM/yyyy HH:mm");
    };

    const getMediaTypeIcon = (mediaType) => {
        switch (mediaType) {
            case "image": return <Image className={classes.mediaTypeIcon} />;
            case "audio": return <Audiotrack className={classes.mediaTypeIcon} />;
            case "video": return <VideoLibrary className={classes.mediaTypeIcon} />;
            case "document": return <Description className={classes.mediaTypeIcon} />;
            default: return <Message className={classes.mediaTypeIcon} />;
        }
    };

    const stats = useMemo(() => {
        if (searchResults.length === 0) return { fromMeCount: 0, fromContactCount: 0 };
        const fromMeCount = searchResults.filter(msg => msg.fromMe).length;
        const fromContactCount = searchResults.length - fromMeCount;
        return { fromMeCount, fromContactCount };
    }, [searchResults]);

    const renderPerformanceIndicator = () => {
        if (searchDuration && searchResults.length > 0) {
            const isVeryFast = searchDuration < 100;
            const isFast = searchDuration < 500;
            
            return (
                <div className={classes.performanceIndicator} style={{
                    background: isVeryFast ? '#4caf50' : isFast ? '#ff9800' : '#f44336'
                }}>
                    ⚡ {Math.round(searchDuration)}ms
                </div>
            );
        }
        return null;
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            className={classes.dialog}
            fullWidth
            maxWidth={false}
            fullScreen={isMobile}
        >
            <DialogTitle className={classes.dialogTitle}>
                <Box display="flex" alignItems="center">
                    <Search style={{ marginRight: 8 }} />
                    <Typography variant="h6" component="span">
                        Busca Avançada de Mensagens
                    </Typography>
                </Box>
                {renderPerformanceIndicator()}
                <IconButton onClick={onClose} size="small" style={{ color: 'inherit' }}>
                    <Close />
                </IconButton>
            </DialogTitle>

            <div className={classes.searchContainer}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12}>
                        <TextField
                            className={classes.searchField}
                            placeholder="Digite pelo menos 2 caracteres para buscar mensagens..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            inputRef={searchInputRef}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search color="action" />
                                    </InputAdornment>
                                ),
                            }}
                            variant="outlined"
                            fullWidth
                        />
                        {searchQuery.length < 2 && (
                            <Typography className={classes.searchTips}>
                                <span role="img" aria-label="dica">💡</span> Dicas: digite uma palavra completa para começar a busca. Exemplo: "documento", "relatório", "pedido"...
                            </Typography>
                        )}
                    </Grid>
                </Grid>
            </div>
            
            <DialogContent style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
                {searchResults.length > 0 && !loading && (
                    <div className={classes.searchStats}>
                        <Grid container alignItems="center">
                            <Grid item xs={6}>
                                <Typography variant="body2">
                                    Encontradas: <strong>{searchResults.length}</strong> mensagens
                                    {searchDuration && (
                                        <span style={{ marginLeft: 8, color: '#666' }}>
                                            em {Math.round(searchDuration)}ms
                                        </span>
                                    )}
                                </Typography>
                            </Grid>
                            <Grid item xs={6} style={{ textAlign: 'right' }}>
                                <Typography variant="caption" display="block">
                                    <Person fontSize="small" style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                    Você: {stats.fromMeCount}
                                </Typography>
                                <Typography variant="caption" display="block">
                                    <Message fontSize="small" style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                    Cliente: {stats.fromContactCount}
                                </Typography>
                            </Grid>
                        </Grid>
                    </div>
                )}

                {searchQuery.length < 2 ? (
                    <div className={classes.emptyState}>
                        <Search style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
                        <Typography variant="h6" gutterBottom>
                            Busca Inteligente de Mensagens
                        </Typography>
                        <Typography color="textSecondary">
                            Digite pelo menos 2 caracteres para começar a buscar
                        </Typography>
                        <Box mt={2}>
                            <Typography variant="body2" color="textSecondary">
                                <span role="img" aria-label="star">✨</span> Busca otimizada com contexto inteligente
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                <span role="img" aria-label="rocket">🚀</span> Navegação instantânea para mensagens
                            </Typography>
                        </Box>
                    </div>
                ) : loading && searchResults.length === 0 ? (
                <div className={classes.loadingContainer}>
                    <CircularProgress />
                    <Typography style={{ marginLeft: 16 }}>
                        Buscando mensagens...
                    </Typography>
                </div>
            ) : !loading && searchResults.length === 0 ? (
                    <div className={classes.noResults}>
                        <Typography variant="h6" gutterBottom>
                            Nenhuma mensagem encontrada
                        </Typography>
                        <Typography color="textSecondary">
                            Tente ajustar sua busca para "{searchQuery}"
                        </Typography>
                    </div>
                ) : (
                    <List className={classes.resultsList} onScroll={handleScroll}>
                        {searchResults.map((message, index) => (
                            <React.Fragment key={message.id}>
                                <ListItem
                                    className={classes.messageItem}
                                    onClick={() => handleMessageClick(message.id)}
                                    data-message-id={message.id}
                                >
                                    <ListItemText
                                        primary={
                                            <div className={classes.messageHeader}>
                                                <Box display="flex" alignItems="center">
                                                    {getMediaTypeIcon(message.mediaType)}
                                                    <Chip
                                                        size="small"
                                                        label={message.fromMe ? "Você" : "Cliente"}
                                                        color={message.fromMe ? "primary" : "secondary"}
                                                        className={classes.senderChip}
                                                    />
                                                    <Navigation className={classes.navigationIcon} />
                                                </Box>
                                                <Typography className={classes.messageDate}>
                                                    {formatDate(message.createdAt)}
                                                </Typography>
                                            </div>
                                        }
                                        secondaryTypographyProps={{ component: "div" }}
                                        secondary={
                                            <div className={classes.messagePreview}>
                                                <Typography component="span" className={classes.messageText}>
                                                    {highlightText(message.body, searchQuery)}
                                                </Typography>
                                            </div>
                                        }
                                    />
                                </ListItem>
                                {index < searchResults.length - 1 && <Divider component="li" />}
                            </React.Fragment>
                        ))}

                        {hasMore && (
                            <ListItem className={classes.loadMoreButton}>
                                {loading ? (
                                    <Box display="flex" alignItems="center" justifyContent="center" width="100%">
                                        <CircularProgress size={24} />
                                        <Typography style={{ marginLeft: 16 }}>
                                            Carregando mais...
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Typography 
                                        color="primary" 
                                        style={{ cursor: 'pointer', textAlign: 'center', width: '100%' }}
                                        onClick={loadMoreResults}
                                    >
                                        Carregar mais resultados
                                    </Typography>
                                )}
                            </ListItem>
                        )}
                    </List>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default MessageSearchModal;