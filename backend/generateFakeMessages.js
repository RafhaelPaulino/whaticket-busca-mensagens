const { Sequelize, DataTypes } = require("sequelize");
const dotenv = require("dotenv");
const { faker } = require("@faker-js/faker");

// Carrega as variáveis de ambiente do seu .env
dotenv.config({ path: "./.env" });

// Array de mensagens em português para variar o conteúdo
const mensagensPortugues = [
  "Olá, como você está?",
  "Preciso falar sobre o projeto urgente",
  "Vou enviar o documento agora mesmo",
  "Reunião marcada para amanhã às 14h",
  "Obrigado pela informação detalhada",
  "Podemos conversar sobre isso?",
  "Estou enviando o relatório por email",
  "Confirmado para segunda-feira",
  "Perfeito, vamos seguir com o plano",
  "Necessito de mais detalhes sobre isso",
  "Ótima ideia, vamos implementar",
  "Preciso verificar com a equipe primeiro",
  "Combinado, falamos depois",
  "Enviei a proposta por WhatsApp",
  "Pode me ligar quando tiver tempo?",
  "Estou no trânsito, respondo em 30 min",
  "Documento aprovado pela diretoria",
  "Vamos remarcar para próxima semana",
  "Excelente trabalho da equipe",
  "Preciso da sua aprovação para prosseguir",
  "Sistema funcionando perfeitamente",
  "Erro corrigido com sucesso",
  "Deploy realizado sem problemas",
  "Backup concluído às 23:30",
  "Servidor respondendo normalmente",
  "Banco de dados otimizado",
  "Performance melhorou 50%",
  "Teste de integração passou",
  "Code review agendado para hoje",
  "Pull request aprovado",
  "Feature pronta para produção",
  "Bug corrigido na versão 2.1",
  "Documentação atualizada",
  "API funcionando perfeitamente",
  "Frontend responsivo implementado",
  "Backend escalável desenvolvido",
  "Database indexado corretamente",
  "Query otimizada executando em 0.2s",
  "Cache implementado com Redis",
  "Monitoramento ativo 24/7",
  "Bom dia! Como posso ajudar?",
  "Boa tarde, preciso de suporte",
  "Boa noite, até amanhã",
  "Parabéns pelo excelente resultado",
  "Obrigado pela dedicação do time",
  "Projeto entregue dentro do prazo",
  "Cliente muito satisfeito com entrega",
  "Próxima sprint começa segunda",
  "Retrospectiva marcada para sexta",
  "Daily às 9h todos os dias",
  "Planning poker na quarta-feira",
  "Estimativa: 8 story points",
  "Sprint review confirmada",
  "Impedimento removido com sucesso",
  "Velocity da equipe aumentou",
  "Burndown chart atualizado",
  "Backlog priorizado pelo PO",
  "User story refinada",
  "Acceptance criteria definido",
  "Definition of done revisado",
  "Arquitetura aprovada pelos seniors",
  "Code smell removido",
  "Refactoring necessário no módulo X",
  "Unit tests cobrindo 95% do código",
  "Integration tests passando",
  "E2E tests automatizados",
  "CI/CD pipeline funcionando",
  "Deployment automatizado configurado",
  "Rollback realizado com sucesso",
  "Hotfix aplicado em produção",
  "Monitoring alerts configurados",
  "Logs centralizados implementados",
  "Métricas de negócio coletadas",
  "Dashboard atualizado em tempo real",
  "Relatório gerado automaticamente",
  "Backup incremental executado",
  "Disaster recovery testado",
  "Security scan passou",
  "Vulnerabilities corrigidas",
  "Penetration test agendado",
  "Compliance LGPD verificado",
  "Auditoria de segurança aprovada",
  "Certificado SSL renovado",
  "HTTPS implementado em todos endpoints",
  "Rate limiting configurado",
  "Load balancer distribuindo requisições",
  "Auto scaling funcionando",
  "Infrastructure as code implementado",
  "Terraform aplicado com sucesso",
  "Kubernetes cluster estável",
  "Docker images otimizadas",
  "Microservices comunicando bem",
  "Event sourcing implementado",
  "CQRS pattern aplicado",
  "Domain driven design seguido",
  "Clean architecture implementada",
  "SOLID principles aplicados",
  "Design patterns utilizados corretamente",
  "Código limpo e legível",
  "Documentação técnica atualizada",
  "README.md completo",
  "Changelog mantido atualizado",
  "Versioning semântico seguido",
  "Git flow implementado",
  "Branch protection rules ativas",
  "Code owners definidos",
  "Pull request template criado",
  "Issue templates configurados",
  "GitHub Actions configuradas",
  "Sonarqube análise passou",
  "Code coverage acima de 80%",
  "Technical debt baixo"
];

// Configurações do banco de dados
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    port: process.env.DB_PORT,
    logging: false
  }
);

// --- Modelos Simplificados ---
const Contact = sequelize.define("Contact", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  isGroup: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  profilePicUrl: DataTypes.STRING
});

const Ticket = sequelize.define("Ticket", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: "open"
  },
  lastMessage: DataTypes.STRING,
  unreadMessages: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isGroup: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  contactId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
});

const Message = sequelize.define("Message", {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  fromMe: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  ticketId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  contactId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
});

// Associações
Ticket.belongsTo(Contact, { foreignKey: "contactId" });
Message.belongsTo(Ticket, { foreignKey: "ticketId" });
Message.belongsTo(Contact, { foreignKey: "contactId" });

// Função para gerar mensagem em português
function gerarMensagemPortugues() {
  const random = Math.random();
  
  if (random < 0.7) {
    // 70% das vezes usa mensagens do array
    return mensagensPortugues[Math.floor(Math.random() * mensagensPortugues.length)];
  } else if (random < 0.9) {
    // 20% das vezes combina duas mensagens
    const msg1 = mensagensPortugues[Math.floor(Math.random() * mensagensPortugues.length)];
    const msg2 = mensagensPortugues[Math.floor(Math.random() * mensagensPortugues.length)];
    return `${msg1} ${msg2}`;
  } else {
    // 10% das vezes adiciona variações
    const msg = mensagensPortugues[Math.floor(Math.random() * mensagensPortugues.length)];
    const variacao = Math.floor(Math.random() * 1000);
    return `${msg} #${variacao}`;
  }
}

// --- Geração de Dados ---
const NUM_MESSAGES = 1000;  // 1000 mensagens por execução
const BATCH_SIZE = 1000;

async function generateFakeData() {
  try {
    await sequelize.authenticate();
    console.log("Conexão com o banco de dados estabelecida com sucesso.");

    await Contact.sync();
    await Ticket.sync();
    await Message.sync();
    console.log("Modelos sincronizados.");

    // 1. Criar Contato de teste
    let testContact = await Contact.findOne({
      where: { number: "5511999999999" }
    });
    if (!testContact) {
      testContact = await Contact.create({
        name: "Cliente Teste Performance",
        number: "5511999999999",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log("Contato de teste criado.");
    } else {
      console.log("Contato de teste já existe.");
    }

    // 2. Criar Ticket de teste
    let testTicket = await Ticket.findOne({
      where: { contactId: testContact.id }
    });
    if (!testTicket) {
      testTicket = await Ticket.create({
        status: "open",
        contactId: testContact.id,
        userId: 1, 
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log("Ticket de teste criado.");
    } else {
      console.log("Ticket de teste já existe.");
    }

    console.log(`Gerando ${NUM_MESSAGES} mensagens em português para o ticket ${testTicket.id}...`);

    for (let i = 0; i < NUM_MESSAGES; i += BATCH_SIZE) {
      const messagesBatch = [];
      for (let j = 0; j < BATCH_SIZE; j++) {
        if (i + j >= NUM_MESSAGES) break;

        const timestamp = faker.date.between({
          from: "2023-01-01T00:00:00.000Z",
          to: "2024-12-31T23:59:59.000Z"
        });
        const fromMe = faker.datatype.boolean();
        const messageBody = gerarMensagemPortugues(); // Usando função personalizada
        const messageId = `${testTicket.id}_${faker.string.uuid()}`; 

        messagesBatch.push({
          id: messageId,
          body: messageBody,
          fromMe,
          ticketId: testTicket.id,
          contactId: testContact.id,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }

      if (messagesBatch.length > 0) {
        await Message.bulkCreate(messagesBatch, { ignoreDuplicates: true });
        console.log(
          `Inserido lote de ${messagesBatch.length} mensagens em português. Total: ${
            i + messagesBatch.length
          }/${NUM_MESSAGES}`
        );
      }
    }

    console.log(`Geração de ${NUM_MESSAGES} mensagens em português concluída!`);
    
    // Exibe algumas mensagens de exemplo
    const exemplos = await Message.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']]
    });
    
    console.log("\n--- Exemplos de mensagens criadas ---");
    exemplos.forEach((msg, index) => {
      console.log(`${index + 1}. ${msg.body}`);
    });
    
  } catch (error) {
    console.error("Erro ao gerar dados falsos:", error);
  } finally {
    await sequelize.close();
    console.log("Conexão com o banco de dados fechada.");
  }
}

generateFakeData();