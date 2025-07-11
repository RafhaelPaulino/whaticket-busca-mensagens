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
    FormControl,
    Select,
    MenuItem,
    InputLabel,
    Grid,
    Tooltip,
    Badge,
    DialogActions,
    Button
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { 
    Close, 
    Search, 
    FilterList, 
    Clear,
    Image,
    Audiotrack,
    VideoLibrary,
    Description,
    Message,
    Person
} from "@material-ui/icons";
import { debounce } from "lodash";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
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
    filterToggle: {
        marginLeft: theme.spacing(1),
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
    }
}));

// Componente para o Modal de Filtros
const FilterModal = ({ open, onClose, initialFilters, onApplyFilters }) => {
    const [localFilters, setLocalFilters] = useState(initialFilters);

    useEffect(() => {
        setLocalFilters(initialFilters);
    }, [initialFilters, open]);

    const handleFilterChange = (filterName, value) => {
        setLocalFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const handleApply = () => {
        onApplyFilters(localFilters);
        onClose();
    };

    const handleClear = () => {
        const clearedFilters = {
            dateFrom: "",
            dateTo: "",
            fromMe: "all",
            mediaType: "all",
        };
        setLocalFilters(clearedFilters);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Filtros Avançados</DialogTitle>
            <DialogContent>
                <Grid container spacing={2} style={{ marginTop: 8 }}>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Data Inicial"
                            type="date"
                            value={localFilters.dateFrom}
                            onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                            variant="outlined"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Data Final"
                            type="date"
                            value={localFilters.dateTo}
                            onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                            variant="outlined"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant="outlined">
                            <InputLabel>Remetente</InputLabel>
                            <Select
                                value={localFilters.fromMe}
                                onChange={(e) => handleFilterChange("fromMe", e.target.value)}
                                label="Remetente"
                            >
                                <MenuItem value="all">Todos</MenuItem>
                                <MenuItem value="true">Apenas Você</MenuItem>
                                <MenuItem value="false">Apenas Cliente</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant="outlined">
                            <InputLabel>Tipo</InputLabel>
                            <Select
                                value={localFilters.mediaType}
                                onChange={(e) => handleFilterChange("mediaType", e.target.value)}
                                label="Tipo"
                            >
                                <MenuItem value="all">Todos</MenuItem>
                                <MenuItem value="text">Texto</MenuItem>
                                <MenuItem value="image">Imagem</MenuItem>
                                <MenuItem value="audio">Áudio</MenuItem>
                                <MenuItem value="video">Vídeo</MenuItem>
                                <MenuItem value="document">Documento</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button onClick={handleClear}>Limpar</Button>
                <Button onClick={handleApply} color="primary" variant="contained">Aplicar</Button>
            </DialogActions>
        </Dialog>
    );
};

const MessageSearchModal = ({ open, onClose, ticketId, onNavigateToMessage }) => {
    const classes = useStyles();
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [totalResults, setTotalResults] = useState(0);
    
    const [filters, setFilters] = useState({
        dateFrom: "",
        dateTo: "",
        fromMe: "all",
        mediaType: "all",
    });

    const searchInputRef = useRef(null);

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
    
    const performSearch = useCallback(async (query, searchFilters, pageNum) => {
        if (!query || query.length < 2) return;

        setLoading(true);

        try {
            const params = {
                q: query,
                page: pageNum,
                limit: 40,
            };

            if (searchFilters.dateFrom) {
                params.dateFrom = startOfDay(parseISO(searchFilters.dateFrom)).toISOString();
            }
            if (searchFilters.dateTo) {
                params.dateTo = endOfDay(parseISO(searchFilters.dateTo)).toISOString();
            }

            if (searchFilters.fromMe !== "all") {
                params.fromMe = searchFilters.fromMe === "true";
            }

            if (searchFilters.mediaType !== "all") {
                params.mediaType = searchFilters.mediaType;
            }

            const { data } = await api.get(`/messages/search/${ticketId}`, { params });

            if (pageNum === 1) {
                setSearchResults(data.messages || []);
                setTotalResults(data.total || data.count || data.messages?.length || 0);
            } else {
                setSearchResults(prev => [...prev, ...(data.messages || [])]);
            }
            
            setHasMore(data.hasMore);
        } catch (error) {
            console.error("Erro na busca de mensagens:", error);
            setSearchResults([]);
            setTotalResults(0);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    const debouncedSearch = useMemo(
        () => debounce((query, currentFilters) => {
            if (query.length >= 2) {
                setPage(1);
                setSearchResults([]);
                setHasMore(true);
                performSearch(query, currentFilters, 1);
            } else {
                setSearchResults([]);
                setTotalResults(0);
                setHasMore(true);
            }
        }, 1000),
        [performSearch] 
    );

    useEffect(() => {
        debouncedSearch(searchQuery, filters);
        return () => debouncedSearch.cancel();
    }, [searchQuery, filters, debouncedSearch]);

    useEffect(() => {
        if (!open) {
            setSearchQuery("");
            setSearchResults([]);
            setPage(1);
            setHasMore(true);
            setTotalResults(0);
            setFilters({
                dateFrom: "",
                dateTo: "",
                fromMe: "all",
                mediaType: "all",
            });
        } else {
            setTimeout(() => {
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            }, 100);
        }
    }, [open]);

    const handleSearchChange = (event) => {
        setSearchQuery(event.target.value);
    };

    const handleApplyFilters = (newFilters) => {
        setFilters(newFilters);
    };

    const handleMessageClick = (messageId) => {
        if (onNavigateToMessage) {
            onNavigateToMessage(messageId);
        }
        onClose();
    };

    const loadMoreResults = () => {
        if (hasMore && !loading && searchQuery.length >= 2) {
            const nextPage = page + 1;
            setPage(nextPage);
            performSearch(searchQuery, filters, nextPage);
        }
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop - clientHeight < 1 && hasMore && !loading) {
            loadMoreResults();
        }
    };

    const formatDate = (dateString) => {
        return format(parseISO(dateString), "dd/MM/yyyy HH:mm");
    };

    const getActiveFiltersCount = () => {
        let count = 0;
        if (filters.dateFrom || filters.dateTo) count++;
        if (filters.fromMe !== "all") count++;
        if (filters.mediaType !== "all") count++;
        return count;
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

    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                className={classes.dialog}
                fullWidth
                maxWidth={false}
            >
                <DialogTitle className={classes.dialogTitle}>
                    <Box display="flex" alignItems="center">
                        <Search style={{ marginRight: 8 }} />
                        <Typography variant="h6" component="span">
                            Busca Avançada de Mensagens
                        </Typography>
                    </Box>
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
                                    endAdornment: (
                                        <>
                                            {loading && searchQuery.length >= 2 && <CircularProgress size={24} style={{ marginRight: '10px' }}/>}
                                            <Tooltip title="Filtros Avançados">
                                                <Badge badgeContent={getActiveFiltersCount()} color="primary" overlap="rectangular">
                                                    <IconButton
                                                        onClick={() => setIsFilterModalOpen(true)}
                                                        className={classes.filterToggle}
                                                    >
                                                        <FilterList />
                                                    </IconButton>
                                                </Badge>
                                            </Tooltip>
                                        </>
                                    ),
                                }}
                                variant="outlined"
                                fullWidth
                            />
                            {searchQuery.length < 2 && (
                                <Typography className={classes.searchTips}>
                                    <span role="img" aria-label="dica">💡</span> Dicas: Use aspas para busca exata ("palavra exata") • Combine filtros para refinar resultados
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
                                        <strong>{totalResults}</strong> Resultados
                                    </Typography>
                                    <Typography variant="caption" display="block">
                                        Carregadas: {searchResults.length}
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
                            <Typography variant="body2" style={{ marginTop: 16, opacity: 0.7 }}>
                                Você pode usar filtros avançados para refinar sua busca por data, remetente e tipo de conteúdo
                            </Typography>
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
                                Tente ajustar sua busca ou remover alguns filtros para "{searchQuery}"
                            </Typography>
                        </div>
                    ) : (
                        <List className={classes.resultsList} onScroll={handleScroll}>
                            {searchResults.map((message, index) => (
                                <React.Fragment key={message.id}>
                                    <ListItem
                                        className={classes.messageItem}
                                        onClick={() => handleMessageClick(message.id)}
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
                                        <CircularProgress size={24} />
                                    ) : (
                                        <Typography 
                                            color="primary" 
                                            style={{ cursor: 'pointer' }}
                                            onClick={loadMoreResults}
                                        >
                                            Carregar mais resultados...
                                        </Typography>
                                    )}
                                </ListItem>
                            )}
                        </List>
                    )}
                </DialogContent>
            </Dialog>
            <FilterModal 
                open={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                initialFilters={filters}
                onApplyFilters={handleApplyFilters}
            />
        </>
    );
};

export default MessageSearchModal;
