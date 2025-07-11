// frontend/src/components/MessageSearchModal/index.js
// IMPLEMENTAÇÃO COMPLETA: Busca avançada de mensagens profissional

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
  Fade,
  Collapse,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Grid,
  Paper,
  Tooltip,
  Badge
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { 
  Close, 
  Search, 
  FilterList, 
  GetApp,
  Schedule,
  Person,
  Message,
  Clear,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Image,
  AudioTrack,
  VideoLibrary,
  Description
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
  advancedFilters: {
    padding: theme.spacing(1, 2),
    borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
    background: theme.palette.grey[50],
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
    padding: theme.spacing(1, 2),
    background: theme.palette.info.light,
    color: theme.palette.info.contrastText,
    fontSize: "0.875rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterChip: {
    margin: theme.spacing(0.5),
  },
  exportButton: {
    marginLeft: theme.spacing(1),
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
  resultHeader: {
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    padding: theme.spacing(1, 2),
    position: "sticky",
    top: 0,
    zIndex: 1,
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
  quickStats: {
    display: "flex",
    gap: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  statItem: {
    display: "flex",
    alignItems: "center",
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
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

const MessageSearchModal = ({ open, onClose, ticketId, onNavigateToMessage }) => {
  const classes = useStyles();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [searchTime, setSearchTime] = useState(0);
  
  // Filtros avançados
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    fromMe: "all", // all, true, false
    mediaType: "all", // all, text, image, audio, video, document
  });

  const searchInputRef = useRef(null);
  const resultsListRef = useRef(null);

  // Normalização de texto para busca
  const normalizeText = (text) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-\s]+/g, ' ')
      .trim();
  };

  // Função de highlight melhorada
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

  // Debounced search function
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
    [ticketId, performSearch] // CORREÇÃO: Adicionado performSearch
  );

  const performSearch = useCallback(async (query, searchFilters, pageNum) => {
    if (!query || query.length < 2) return;

    setLoading(true);
    const startTime = Date.now();

    try {
      const params = {
        q: query,
        page: pageNum,
        limit: 40,
        ...searchFilters
      };

      // Processar filtros de data
      if (searchFilters.dateFrom) {
        params.dateFrom = startOfDay(new Date(searchFilters.dateFrom)).toISOString();
      }
      if (searchFilters.dateTo) {
        params.dateTo = endOfDay(new Date(searchFilters.dateTo)).toISOString();
      }

      // Filtrar por tipo de remetente
      if (searchFilters.fromMe !== "all") {
        params.fromMe = searchFilters.fromMe === "true";
      }

      // Filtrar por tipo de mídia
      if (searchFilters.mediaType !== "all") {
        params.mediaType = searchFilters.mediaType;
      }

      const { data } = await api.get(`/messages/search/${ticketId}`, { params });

      const endTime = Date.now();
      setSearchTime(endTime - startTime);

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

  // Effects
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
      setSearchTime(0);
      setFilters({
        dateFrom: "",
        dateTo: "",
        fromMe: "all",
        mediaType: "all",
      });
    } else {
      // Auto-focus no campo de busca
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
  }, [open]);

  // Handlers
  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
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
    if (scrollHeight - scrollTop === clientHeight && hasMore && !loading) {
      loadMoreResults();
    }
  };

  const exportResults = () => {
    if (searchResults.length === 0) return;
    
    const exportData = searchResults.map(msg => ({
      id: msg.id,
      data: formatDate(msg.createdAt),
      remetente: msg.fromMe ? "Você" : "Cliente",
      mensagem: msg.body.replace(/"/g, '""'), // Escape aspas duplas para CSV
      tipo: getMediaTypeLabel(msg.mediaType)
    }));

    const csvContent = [
      ["ID", "Data", "Remetente", "Mensagem", "Tipo"],
      ...exportData.map(row => [row.id, row.data, row.remetente, `"${row.mensagem}"`, row.tipo])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `busca-mensagens-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: "",
      dateTo: "",
      fromMe: "all",
      mediaType: "all",
    });
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
      case "audio": return <AudioTrack className={classes.mediaTypeIcon} />;
      case "video": return <VideoLibrary className={classes.mediaTypeIcon} />;
      case "document": return <Description className={classes.mediaTypeIcon} />;
      default: return <Message className={classes.mediaTypeIcon} />;
    }
  };

  const getMediaTypeLabel = (mediaType) => {
    switch (mediaType) {
      case "image": return "Imagem";
      case "audio": return "Áudio";
      case "video": return "Vídeo";
      case "document": return "Documento";
      default: return "Texto";
    }
  };

  const getResultsStats = () => {
    const fromMeCount = searchResults.filter(msg => msg.fromMe).length;
    const fromContactCount = searchResults.length - fromMeCount;
    return { fromMeCount, fromContactCount };
  };

  const stats = getResultsStats();

  return (
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

      {/* Campo de busca principal */}
      <div className={classes.searchContainer}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
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
                endAdornment: loading && searchQuery.length >= 2 ? (
                  <InputAdornment position="end">
                    <CircularProgress size={20} />
                  </InputAdornment>
                ) : null,
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
          <Grid item xs={12} md={4}>
            <Box display="flex" alignItems="center" justifyContent="flex-end">
              <Tooltip title="Filtros Avançados">
                <Badge badgeContent={getActiveFiltersCount()} color="primary">
                  <IconButton
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={classes.filterToggle}
                    color={showAdvancedFilters ? "primary" : "default"}
                  >
                    <FilterList />
                  </IconButton>
                </Badge>
              </Tooltip>
              
              {searchResults.length > 0 && (
                <Tooltip title="Exportar Resultados (CSV)">
                  <IconButton onClick={exportResults} className={classes.exportButton}>
                    <GetApp />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Grid>
        </Grid>
      </div>

      {/* Filtros avançados */}
      <Collapse in={showAdvancedFilters}>
        <div className={classes.advancedFilters}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                label="Data Inicial"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                size="small"
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Data Final"
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                size="small"
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small" variant="outlined">
                <InputLabel>Remetente</InputLabel>
                <Select
                  value={filters.fromMe}
                  onChange={(e) => handleFilterChange("fromMe", e.target.value)}
                  label="Remetente"
                >
                  <MenuItem value="all">Todos</MenuItem>
                  <MenuItem value="true">Apenas Você</MenuItem>
                  <MenuItem value="false">Apenas Cliente</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small" variant="outlined">
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={filters.mediaType}
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
            <Grid item xs={12} md={2}>
              <Box display="flex" justifyContent="space-between">
                <Tooltip title="Limpar Filtros">
                  <IconButton onClick={clearFilters} size="small">
                    <Clear />
                  </IconButton>
                </Tooltip>
                <IconButton 
                  onClick={() => setShowAdvancedFilters(false)}
                  size="small"
                >
                  <KeyboardArrowUp />
                </IconButton>
              </Box>
            </Grid>
          </Grid>
        </div>
      </Collapse>

      {/* Estatísticas da busca */}
      {searchQuery.length >= 2 && totalResults > 0 && (
        <div className={classes.searchStats}>
          <Box>
            <Typography variant="body2" component="span">
              <strong>{totalResults}</strong> resultado(s) em <strong>{searchTime}ms</strong>
              {searchQuery && ` para "${searchQuery}"`}
            </Typography>
            <div className={classes.quickStats}>
              <span className={classes.statItem}>
                <Person style={{ fontSize: '1rem', marginRight: 4 }} />
                Você: {stats.fromMeCount}
              </span>
              <span className={classes.statItem}>
                <Message style={{ fontSize: '1rem', marginRight: 4 }} />
                Cliente: {stats.fromContactCount}
              </span>
            </div>
          </Box>
        </div>
      )}

      {/* Lista de resultados */}
      <DialogContent style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
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
        ) : searchResults.length > 0 ? (
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
                    secondary={
                      <div className={classes.messagePreview}>
                        <Typography className={classes.messageText}>
                          {highlightText(message.body, searchQuery)}
                        </Typography>
                      </div>
                    }
                  />
                </ListItem>
                {index < searchResults.length - 1 && <Divider />}
              </React.Fragment>
            ))}

            {hasMore && (
              <div className={classes.loadMoreButton}>
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
              </div>
            )}
          </List>
        ) : searchQuery.length >= 2 && !loading ? (
          <div className={classes.noResults}>
            <Typography variant="h6" gutterBottom>
              Nenhuma mensagem encontrada
            </Typography>
            <Typography color="textSecondary">
              Nenhuma mensagem encontrada para "{searchQuery}"
            </Typography>
            <Typography variant="body2" style={{ marginTop: 16 }}>
              Tente ajustar sua busca ou remover alguns filtros
            </Typography>
          </div>
        ) : loading ? (
          <div className={classes.loadingContainer}>
            <CircularProgress />
            <Typography style={{ marginLeft: 16 }}>
              Buscando mensagens...
            </Typography>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default MessageSearchModal;