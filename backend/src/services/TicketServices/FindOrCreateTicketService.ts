import { subHours } from "date-fns";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Distribution from "../../models/Distribution";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import ShowTicketService from "./ShowTicketService";

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  groupContact?: Contact
): Promise<Ticket> => {
  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending"]
      },
      contactId: groupContact ? groupContact.id : contact.id,
      whatsappId: whatsappId
    }
  });

  if (ticket) {
    await ticket.update({ unreadMessages });
  }

  if (!ticket && groupContact) {
    ticket = await Ticket.findOne({
      where: {
        contactId: groupContact.id,
        whatsappId: whatsappId
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      await ticket.update({
        status: "pending",
        userId: null,
        unreadMessages
      });
    }
  }

  if (!ticket && !groupContact) {
    ticket = await Ticket.findOne({
      where: {
        updatedAt: {
          [Op.between]: [+subHours(new Date(), 2), +new Date()]
        },
        contactId: contact.id,
        whatsappId: whatsappId
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      await ticket.update({
        status: "pending",
        userId: null,
        unreadMessages
      });
    }
  }

  if (!ticket) {
    let assignedUserId = null;
    let queueId = null;

    const whatsapp = await Whatsapp.findByPk(whatsappId, {
      include: [{ model: Queue, as: "queues" }]
    });

    if (whatsapp?.queues && whatsapp.queues.length > 0) {
      queueId = whatsapp.queues[0].id;

      const distribution = await Distribution.findOne({
        where: { queueId, isActive: true }
      });

      if (distribution) {
        const users = await User.findAll({
          include: [{
            model: Queue,
            as: "queues",
            where: { id: queueId },
            through: { attributes: [] }
          }],
          order: [['id', 'ASC']]
        });

        if (users.length > 0) {
          const currentUserIndex = users.findIndex(user => user.id === distribution.nextUserId);
          
          if (currentUserIndex !== -1) {
            assignedUserId = users[currentUserIndex].id;
            
            const nextUserIndex = (currentUserIndex + 1) % users.length;
            const nextUser = users[nextUserIndex];
            
            await distribution.update({ nextUserId: nextUser.id });
          }
        }
      }
    }

    ticket = await Ticket.create({
      contactId: groupContact ? groupContact.id : contact.id,
      status: "pending",
      isGroup: !!groupContact,
      unreadMessages,
      whatsappId,
      userId: assignedUserId,
      queueId
    });
  }

  ticket = await ShowTicketService(ticket.id);

  return ticket;
};

export default FindOrCreateTicketService;