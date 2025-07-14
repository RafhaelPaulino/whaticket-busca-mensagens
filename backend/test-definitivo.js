const axios = require("axios");

// =================================================================
// 🚀 CONFIGURAÇÕES - EDITE APENAS AQUI 🚀
// =================================================================

// 1. PEGUE UM TOKEN NOVO E COLE AQUI DENTRO DAS ASPAS
// Como pegar: Abra o WhaTicket > F12 > Network > Clique em algo >
// Procure uma requisição > Headers > Authorization: Bearer [copie_o_token]
const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IlJhZmhhZWwiLCJwcm9maWxlIjoiYWRtaW4iLCJpZCI6MywiaWF0IjoxNzUyNDcyNjcyLCJleHAiOjE3NTI0NzM1NzJ9.R707auyqp0fptfHNtzBi2QBkrMCfuPgsuXw63sznojQ";

// 2. INFORME O ID DO TICKET COM MUITAS MENSAGENS
const TICKET_ID_GRANDE = 3;

// 3. INFORME UM TERMO QUE VOCÊ SABE QUE EXISTE NAS MENSAGENS
const TERMO_DE_BUSCA = "doc"; // ou "sistema", "projeto", etc.

// 4. URL DA SUA API
const BASE_URL = "http://localhost:8080";

// =================================================================
// 🧪 SCRIPT DE TESTE - NÃO PRECISA EDITAR DAQUI PARA BAIXO 🧪
// =================================================================

const api = axios.create({
  baseURL: BASE_URL,
  headers: { Authorization: `Bearer ${TOKEN}` }
});

const printHeader = title => {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`🧪 ${title}`);
  console.log("=".repeat(50));
};

const checkResult = (testName, startTime, response) => {
  const duration = Date.now() - startTime;
  // CORREÇÃO: Agora o 'response' é obrigatório para esta função
  const { status } = response;
  const { data } = response;

  console.log(`✅ SUCESSO: ${testName}`);
  console.log(`   - Duração: ${duration}ms`);
  console.log(`   - Status HTTP: ${status}`);
  if (data.messages) {
    console.log(`   - Mensagens encontradas: ${data.messages.length}`);
  }
  return true;
};

const checkError = (testName, error) => {
  console.error(`❌ FALHA: ${testName}`);
  if (error.response) {
    console.error(`   - Status HTTP: ${error.response.status}`);
    console.error(
      `   - Erro retornado: ${JSON.stringify(error.response.data)}`
    );
    if (error.response.status === 401) {
      console.error(
        "   - CAUSA PROVÁVEL: Token expirado ou inválido. Pegue um novo!"
      );
    }
  } else if (error.code === "ECONNREFUSED") {
    console.error(
      `   - CAUSA PROVÁVEL: O servidor backend não está rodando em ${BASE_URL}.`
    );
  } else {
    console.error(`   - Erro: ${error.message}`);
  }
  return false;
};

const runTests = async () => {
  // CORREÇÃO: A verificação agora compara com o valor placeholder original.
  if (TOKEN === "COLE_SEU_TOKEN_MAIS_RECENTE_AQUI") {
    console.error(
      "❌ ERRO DE CONFIGURAÇÃO: Você não atualizou a variável TOKEN no script."
    );
    return;
  }

  printHeader("Diagnóstico Completo da API de Busca");

  // --- Teste 1: Validar Conexão e Token ---
  let isTokenValid = false;
  const test1_start = Date.now();
  try {
    // Usamos um endpoint que sabemos que existe e é rápido
    const response = await api.get(`/tickets/${TICKET_ID_GRANDE}`);
    // CORREÇÃO: Passando o objeto 'response' para a função de verificação
    isTokenValid = checkResult(
      "Teste de Conexão e Token",
      test1_start,
      response
    );
  } catch (error) {
    checkError("Teste de Conexão e Token", error);
  }

  if (!isTokenValid) {
    console.log(
      "\n🛑 Testes abortados. O token ou a conexão com a API falhou."
    );
    return;
  }

  // --- Teste 2: Busca no Ticket com 1M+ de mensagens ---
  console.log(
    "\nIniciando Teste 2: Busca pesada. Isso pode demorar vários minutos..."
  );
  const test2_start = Date.now();
  try {
    const response = await api.get(`/messages/search/${TICKET_ID_GRANDE}`, {
      params: { q: TERMO_DE_BUSCA, limit: 10 },
      // Timeout aumentado para 2 minutos especificamente para esta chamada
      timeout: 120000
    });
    checkResult(
      `Busca por "${TERMO_DE_BUSCA}" no Ticket ${TICKET_ID_GRANDE}`,
      test2_start,
      response
    );
  } catch (error) {
    checkError(
      `Busca por "${TERMO_DE_BUSCA}" no Ticket ${TICKET_ID_GRANDE}`,
      error
    );
  }
};

runTests();
