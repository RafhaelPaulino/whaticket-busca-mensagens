import React, { useState, useEffect } from "react";
import Routes from "./routes";
import "react-toastify/dist/ReactToastify.css";

import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { ptBR } from "@material-ui/core/locale";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1>Oops! Algo deu errado</h1>
          <p>Houve um erro inesperado na aplicação.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2576d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  const [locale, setLocale] = useState();
  const [isReady, setIsReady] = useState(false);

  const theme = createTheme(
    {
      scrollbarStyles: {
        "&::-webkit-scrollbar": {
          width: "8px",
          height: "8px",
        },
        "&::-webkit-scrollbar-thumb": {
          boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
          backgroundColor: "#e8e8e8",
        },
      },
      palette: {
        primary: { main: "#2576d2" },
      },
    },
    locale
  );

  useEffect(() => {
    try {
      const i18nlocale = localStorage.getItem("i18nextLng") || "pt-BR";
      const browserLocale = i18nlocale.substring(0, 2) + i18nlocale.substring(3, 5);

      if (browserLocale === "ptBR") {
        setLocale(ptBR);
      }

      setIsReady(true);
    } catch (error) {
      console.error("Erro na inicialização do App:", error);
      setIsReady(true);
    }
  }, []);
  if (!isReady) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh'
      }}>
        <div>Carregando...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <Routes />
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;