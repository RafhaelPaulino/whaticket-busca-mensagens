import { useState, useEffect } from "react";
import api from "../services/api";

const useDistribution = (queueId) => {
  const [distribution, setDistribution] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDistribution = async () => {
    if (!queueId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data } = await api.get(`/distribution/${queueId}`);
      setDistribution(data);
    } catch (err) {
      if (err.response?.status !== 404) {
        setError(err.response?.data?.error || "Erro ao buscar distribuição");
      }
      setDistribution(null);
    } finally {
      setLoading(false);
    }
  };

  const createDistribution = async (isActive = true) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data } = await api.post("/distribution", {
        queueId,
        isActive
      });
      setDistribution(data);
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Erro ao criar distribuição";
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const updateDistribution = async (isActive) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data } = await api.put(`/distribution/${queueId}`, {
        isActive
      });
      setDistribution(prev => ({ ...prev, isActive }));
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Erro ao atualizar distribuição";
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getNextUser = async () => {
    try {
      const { data } = await api.get(`/distribution/${queueId}/next-user`);
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.error || "Erro ao obter próximo usuário");
    }
  };

  useEffect(() => {
    fetchDistribution();
  }, [queueId]);

  return {
    distribution,
    loading,
    error,
    fetchDistribution,
    createDistribution,
    updateDistribution,
    getNextUser
  };
};

export default useDistribution;