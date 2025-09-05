import { createContext, useReducer, useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import * as tasksApi from '../api/tasks.api';

export const ReportesContext = createContext(null);

import { initialState, reducer, actionTypes } from './reportesReducer.js';

// reducer and actionTypes are imported from reportesReducer.js

export const ReportesProvider = ({ children }) => {
	const [state, dispatch] = useReducer(reducer, initialState);

	const start = () => dispatch({ type: actionTypes.START });
	const fail = err => dispatch({ type: actionTypes.FAIL, payload: err });

	const fetchTasks = useCallback(async () => {
		start();
		try {
			const res = await tasksApi.getAllTasks();
			// If the API returns { data: [...] }
			let tasks = res.data || res;
			// Normalize date fields to ISO strings so UI can parse consistently
			if (Array.isArray(tasks)) {
				tasks = tasks.map(t => ({
					...t,
					fecha_creacion: t.fecha_creacion ? new Date(t.fecha_creacion) : t.fecha_creacion,
					fecha_resolucion: t.fecha_resolucion ? new Date(t.fecha_resolucion) : t.fecha_resolucion,
				}));
			}
			dispatch({ type: actionTypes.SET_TASKS, payload: tasks });
			return tasks;
		} catch (error) {
			fail(error);
			throw error;
		}
	}, []);

	const fetchTask = useCallback(async id => {
		start();
		try {
			const res = await tasksApi.getTask(id);
			let task = res.data || res;
			if (task) {
				task = {
					...task,
					fecha_creacion: task.fecha_creacion ? new Date(task.fecha_creacion) : task.fecha_creacion,
					fecha_resolucion: task.fecha_resolucion ? new Date(task.fecha_resolucion) : task.fecha_resolucion,
				};
			}
			dispatch({ type: actionTypes.SET_CURRENT_TASK, payload: task });
			return task;
		} catch (error) {
			fail(error);
			throw error;
		}
	}, []);

	const createTask = useCallback(async (taskData) => {
		start();
		try {
			const res = await tasksApi.createTask(taskData);
			const created = res.data || res;
			dispatch({ type: actionTypes.ADD_TASK, payload: created });
			return created;
		} catch (error) {
			fail(error);
			throw error;
		}
	}, []);

	const updateTask = useCallback(async (id, taskData) => {
		start();
		try {
			const res = await tasksApi.updateTask(id, taskData);
			const updated = res.data || res;
			dispatch({ type: actionTypes.UPDATE_TASK, payload: updated });
			return updated;
		} catch (error) {
			fail(error);
			throw error;
		}
	}, []);

	const removeTask = useCallback(async id => {
		start();
		try {
			await tasksApi.deleteTask(id);
			dispatch({ type: actionTypes.REMOVE_TASK, payload: id });
			return true;
		} catch (error) {
			fail(error);
			throw error;
		}
	}, []);

		const deleteTaskImage = useCallback(async (id, imageField) => {
			start();
			try {
				const res = await tasksApi.deleteTaskImage(id, imageField);
				dispatch({ type: actionTypes.UPDATE_TASK, payload: res.data });
				return res.data;
			} catch (error) {
				fail(error);
				throw error;
			}
		}, []);

	const fetchEmpleados = useCallback(async () => {
		start();
		try {
			const res = await tasksApi.getAllEmpleados();
			const empleados = res.data || res;
			dispatch({ type: actionTypes.SET_EMPLEADOS, payload: empleados });
			return empleados;
		} catch (error) {
			fail(error);
			throw error;
		}
	}, []);

	const fetchEventos = useCallback(async (taskId) => {
		start();
		try {
			const eventos = await tasksApi.getEventos(taskId);
			dispatch({ type: actionTypes.SET_EVENTOS, taskId, payload: eventos });
			return eventos;
		} catch (error) {
			fail(error);
			throw error;
		}
	}, []);

	const createEvento = useCallback(async (taskId, evento) => {
		start();
		try {
			const created = await tasksApi.createEvento(taskId, evento);
			dispatch({ type: actionTypes.ADD_EVENTO, taskId, payload: created });
			return created;
		} catch (error) {
			fail(error);
			throw error;
		}
	}, []);

	const updateEvento = useCallback(async (taskId, eventId, evento) => {
		start();
		try {
			const updated = await tasksApi.updateEvento(taskId, eventId, evento);
			dispatch({ type: actionTypes.UPDATE_EVENTO, taskId, payload: updated });
			return updated;
		} catch (error) {
			fail(error);
			throw error;
		}
	}, []);

	const deleteEvento = useCallback(async (taskId, eventId) => {
		start();
		try {
			const deleted = await tasksApi.deleteEvento(taskId, eventId);
			dispatch({ type: actionTypes.REMOVE_EVENTO, taskId, eventId });
			return deleted;
		} catch (error) {
			fail(error);
			throw error;
		}
	}, []);

	// Expose a compact API for consumers
	const value = {
		...state,
		fetchTasks,
		fetchTask,
		createTask,
		updateTask,
		removeTask,
		fetchEmpleados,
		fetchEventos,
		createEvento,
		updateEvento,
		deleteEvento,
		deleteTaskImage,
	};

	return (
		<ReportesContext.Provider value={value}>
			{children}
		</ReportesContext.Provider>
	);
};

ReportesProvider.propTypes = {
	children: PropTypes.node.isRequired,
};

export const useReportes = () => {
	const context = useContext(ReportesContext);
	if (!context) {
		throw new Error('useReportes must be used within a ReportesProvider');
	}
	return context;
};
