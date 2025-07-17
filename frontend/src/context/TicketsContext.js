import React, { createContext, useState } from "react";

const TicketsContext = createContext();

export const TicketsContextProvider = ({ children }) => {
    const [key, setKey] = useState(0);

    const refreshTickets = () => {
        console.log("🔄 Forçando atualização das listas de tickets...");
        setKey(prevKey => prevKey + 1);
    };

    return (
        <TicketsContext.Provider value={{ key, refreshTickets }}>
            {children}
        </TicketsContext.Provider>
    );
};

export default TicketsContext;
