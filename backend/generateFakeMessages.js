const { Sequelize, DataTypes } = require("sequelize");
const dotenv = require("dotenv");
const { faker } = require("@faker-js/faker"); // Usaremos a biblioteca Faker para dados aleatórios

// Carrega as variáveis de ambiente do seu .env
dotenv.config({ path: "./.env" });

// Configurações do banco de dados (pode ajustar conforme seu .env)
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    port: process.env.DB_PORT,
    logging: false // Desativa os logs do Sequelize para não poluir o console
  }
);

// --- Modelos Simplificados (Apenas o essencial para as mensagens) ---
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
  // tenantId: { // <--- REMOVIDO
  //   type: DataTypes.INTEGER,
  //   defaultValue: 1
  // }
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
    allowNull: true // Pode ser nulo se não atribuído
  }
  // tenantId: { // <--- REMOVIDO
  //   type: DataTypes.INTEGER,
  //   defaultValue: 1
  // }
});

const Message = sequelize.define("Message", {
  id: {
    type: DataTypes.STRING, // No Whaticket o ID da mensagem pode ser string (ex: remoteJid_id)
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
  // Removendo campos que podem não existir em todas as versões do Whaticket ou que não são essenciais para o teste de busca
  // read: {
  //   type: DataTypes.BOOLEAN,
  //   defaultValue: false
  // },
  // mediaUrl: DataTypes.STRING,
  // mediaType: DataTypes.STRING,
  ticketId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  contactId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  // fromMe: { // <--- REMOVIDO (DUPLICADO)
  //   type: DataTypes.BOOLEAN,
  //   defaultValue: false
  // },
  // quotedMsgId: DataTypes.STRING,
  // scheduleId: DataTypes.INTEGER,
  // status: { // <--- REMOVIDO (CAUSANDO ERRO 'Unknown column status')
  //   type: DataTypes.STRING,
  //   defaultValue: "sended"
  // },
  // isDeleted: {
  //   type: DataTypes.BOOLEAN,
  //   defaultValue: false
  // },
  // ack: {
  //   type: DataTypes.INTEGER,
  //   defaultValue: 0
  // },
  // queueId: DataTypes.INTEGER,
  // userId: DataTypes.INTEGER
  // tenantId: { // <--- REMOVIDO
  //   type: DataTypes.INTEGER,
  //   defaultValue: 1
  // }
});

// Associações
Ticket.belongsTo(Contact, { foreignKey: "contactId" });
Message.belongsTo(Ticket, { foreignKey: "ticketId" });
Message.belongsTo(Contact, { foreignKey: "contactId" });

// --- Geração de Dados ---
const NUM_MESSAGES = 100; // <--- ALTERADO PARA 100 MENSAGENS
const BATCH_SIZE = 100; // O BATCH_SIZE pode ser 100 ou menor que NUM_MESSAGES

async function generateFakeData() {
  try {
    await sequelize.authenticate();
    console.log("Conexão com o banco de dados estabelecida com sucesso.");

    // Sincroniza os modelos (cria as tabelas se não existirem)
    // CUIDADO: Isso pode apagar dados existentes se force: true for usado.
    // Como você já tem as tabelas via migração, não usaremos force: true.
    await Contact.sync();
    await Ticket.sync();
    await Message.sync();
    console.log("Modelos sincronizados.");

    // 1. Criar um Contacto de teste se não existir
    let testContact = await Contact.findOne({
      where: { number: "5511999999999" }
    });
    if (!testContact) {
      testContact = await Contact.create({
        name: "Cliente Teste Milhões",
        number: "5511999999999",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log("Contato de teste criado.");
    } else {
      console.log("Contato de teste já existe.");
    }

    // 2. Criar um Ticket de teste se não existir
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

    
    console.log(
      `Gerando ${NUM_MESSAGES} mensagens para o ticket ${testTicket.id}...`
    );

    for (let i = 0; i < NUM_MESSAGES; i += BATCH_SIZE) {
      const messagesBatch = [];
      for (let j = 0; j < BATCH_SIZE; j++) {
        
        if (i + j >= NUM_MESSAGES) break;

        const timestamp = faker.date.between({
          from: "2023-01-01T00:00:00.000Z",
          to: "2024-12-31T23:59:59.000Z"
        });
        const fromMe = faker.datatype.boolean();
        const messageBody = faker.lorem.sentences(
          faker.number.int({ min: 1, max: 3 })
        ); 
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
          `Inserido lote de ${messagesBatch.length} mensagens. Total: ${
            i + messagesBatch.length
          }/${NUM_MESSAGES}`
        );
      }
    }

    console.log(`Geração de ${NUM_MESSAGES} mensagens concluída!`);
  } catch (error) {
    console.error("Erro ao gerar dados falsos:", error);
  } finally {
    await sequelize.close();
    console.log("Conexão com o banco de dados fechada.");
  }
}

generateFakeData();
