import React, { useState, useEffect } from "react";
import {
  FormControlLabel,
  Switch,
  Box,
  Chip,
  Typography,
  CircularProgress
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { green, grey } from "@material-ui/core/colors";
import api from "../../services/api";
import { toast } from "react-toastify";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  chip: {
    fontSize: "0.75rem",
    height: 20
  },
  nextUser: {
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(1)
  }
}));

const DistributionToggle = ({ queueId, onUpdate }) => {
  const classes = useStyles();
  const [distribution, setDistribution] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    fetchDistribution();
  }, [queueId]);

  useEffect(() => {
    const handleDistributionUpdate = (event) => {
      const updatedDistribution = event.detail;
      if (updatedDistribution.queueId === queueId) {
        setDistribution(updatedDistribution);
      }
    };

    window.addEventListener("distributionUpdate", handleDistributionUpdate);
    
    return () => {
      window.removeEventListener("distributionUpdate", handleDistributionUpdate);
    };
  }, [queueId]);

  const fetchDistribution = async () => {
    try {
      const { data } = await api.get(`/distribution/${queueId}`);
      setDistribution(data);
    } catch (err) {
      setDistribution(null);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleToggle = async (event) => {
    const isActive = event.target.checked;
    setLoading(true);

    try {
      if (!distribution && isActive) {
        const { data } = await api.post("/distribution", {
          queueId,
          isActive: true
        });
        setDistribution(data);
        toast.success("Distribuição automática ativada!");
      } else if (distribution) {
        const { data } = await api.put(`/distribution/${queueId}`, {
          isActive
        });
        setDistribution({ ...distribution, isActive });
        toast.success(
          isActive 
            ? "Distribuição automática ativada!" 
            : "Distribuição automática desativada!"
        );
      }
      
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Erro ao alterar distribuição:", err);
      toast.error(
        err.response?.data?.error === "ERR_NO_USERS_IN_QUEUE"
          ? "Não há usuários nesta fila para distribuição"
          : "Erro ao alterar distribuição automática"
      );
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <CircularProgress size={20} />;
  }

  return (
    <Box className={classes.root}>
      <FormControlLabel
        control={
          <Switch
            checked={distribution?.isActive || false}
            onChange={handleToggle}
            disabled={loading}
            color="primary"
            size="small"
          />
        }
        label="Distribuição Automática"
      />
      
      {loading && <CircularProgress size={16} />}
      
      {distribution?.isActive && (
        <>
          <Chip
            label="ATIVO"
            size="small"
            className={classes.chip}
            style={{ 
              backgroundColor: green[100], 
              color: green[800] 
            }}
          />
          {distribution.nextUser && (
            <Typography className={classes.nextUser}>
              Próximo: {distribution.nextUser.name}
            </Typography>
          )}
        </>
      )}
      
      {distribution && !distribution.isActive && (
        <Chip
          label="INATIVO"
          size="small"
          className={classes.chip}
          style={{ 
            backgroundColor: grey[200], 
            color: grey[700] 
          }}
        />
      )}
    </Box>
  );
};

export default DistributionToggle;