import React from "react";
import { useHistory } from "react-router-dom";
import { Card, Button, makeStyles } from "@material-ui/core";
import { ArrowBackIos } from "@material-ui/icons";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";

const useStyles = makeStyles((theme) => ({
    ticketHeader: {
        display: "flex",
        backgroundColor: "#eee",
        flex: "none",
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        alignItems: "center",
        [theme.breakpoints.down("sm")]: {
            flexWrap: "wrap",
        },
    },
}));


const TicketHeader = ({ loading, children }) => {
    const classes = useStyles();
    const history = useHistory();

    const handleBack = () => {
        history.push("/tickets");
    };

    return (
        <>
            {loading ? (
                <TicketHeaderSkeleton />
            ) : (
                <Card square className={classes.ticketHeader}>
                    <Button color="primary" onClick={handleBack}>
                        <ArrowBackIos />
                    </Button>
                    {children}
                </Card>
            )}
        </>
    );
};

export default TicketHeader;
