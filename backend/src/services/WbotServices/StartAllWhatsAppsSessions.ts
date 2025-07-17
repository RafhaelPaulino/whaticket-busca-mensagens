import Whatsapp from "../../models/Whatsapp";
import StartWhatsAppSession from "./StartWhatsAppSession"; 

const StartAllWhatsAppsSessions = async (): Promise<void> => {
  const whatsapps = await Whatsapp.findAll();

  whatsapps.forEach(whatsapp => {
    StartWhatsAppSession(whatsapp);
  });
};

export default StartAllWhatsAppsSessions;
