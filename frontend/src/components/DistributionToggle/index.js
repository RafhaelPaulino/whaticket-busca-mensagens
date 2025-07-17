import React, { useState, useEffect } from "react";
import {
	FormControlLabel,
	Switch,
	Box,
	CircularProgress,
	Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(2), 
	},
	label: {
		fontWeight: 500,
	}
}));

const DistributionToggle = ({ queueId, initialStatus, onToggle }) => {
	const classes = useStyles();
	const [isActive, setIsActive] = useState(initialStatus);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		setIsActive(initialStatus);
	}, [initialStatus]);

	const handleToggle = async (event) => {
		const newStatus = event.target.checked;
		setLoading(true);

		try {

			await onToggle(newStatus);
			setIsActive(newStatus);
		} catch (err) {

			if (err.response?.data?.error === "ERR_NO_USERS_IN_QUEUE") {
				toast.error("Não há usuários nesta fila para ativar a distribuição.");
			} else {
				toastError(err, "Erro ao alterar a distribuição.");
			}
			event.target.checked = !newStatus;
		} finally {
			setLoading(false);
		}
	};

	return (
		<Box className={classes.root}>
			<Typography variant="subtitle1" className={classes.label}>
				Distribuição Automática
			</Typography>
			<FormControlLabel
				control={
					<Switch
						checked={isActive}
						onChange={handleToggle}
						disabled={loading}
						color="primary"
					/>
				}
				label={isActive ? "Ativada" : "Desativada"}
			/>
			{loading && <CircularProgress size={20} />}
		</Box>
	);
};

export default DistributionToggle;
