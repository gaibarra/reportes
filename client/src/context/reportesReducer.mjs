// ESM version for Vite / browser runtime
const initialState = {
  tasks: [],
  currentTask: null,
  empleados: [],
  eventos: {},
  loading: false,
  error: null,
};

const actionTypes = {
  START: 'START',
  FAIL: 'FAIL',
  SET_TASKS: 'SET_TASKS',
  SET_CURRENT_TASK: 'SET_CURRENT_TASK',
  ADD_TASK: 'ADD_TASK',
  UPDATE_TASK: 'UPDATE_TASK',
  REMOVE_TASK: 'REMOVE_TASK',
  SET_EMPLEADOS: 'SET_EMPLEADOS',
  SET_EVENTOS: 'SET_EVENTOS',
  ADD_EVENTO: 'ADD_EVENTO',
  UPDATE_EVENTO: 'UPDATE_EVENTO',
  REMOVE_EVENTO: 'REMOVE_EVENTO',
};

function reducer(state = initialState, action) {
  switch (action.type) {
    case actionTypes.START:
      return { ...state, loading: true, error: null };
    case actionTypes.FAIL:
      return { ...state, loading: false, error: action.payload };
    case actionTypes.SET_TASKS:
      return { ...state, loading: false, tasks: action.payload };
    case actionTypes.SET_CURRENT_TASK:
      return { ...state, loading: false, currentTask: action.payload };
    case actionTypes.ADD_TASK:
      return { ...state, loading: false, tasks: [action.payload, ...state.tasks] };
    case actionTypes.UPDATE_TASK:
      return {
        ...state,
        loading: false,
        tasks: state.tasks.map(t => (t.id === action.payload.id ? action.payload : t)),
        currentTask: state.currentTask && state.currentTask.id === action.payload.id ? action.payload : state.currentTask,
      };
    case actionTypes.REMOVE_TASK:
      return { ...state, loading: false, tasks: state.tasks.filter(t => t.id !== action.payload) };
    case actionTypes.SET_EMPLEADOS:
      return { ...state, loading: false, empleados: action.payload };
    case actionTypes.SET_EVENTOS:
      return { ...state, loading: false, eventos: { ...state.eventos, [action.taskId]: action.payload } };
    case actionTypes.ADD_EVENTO:
      return {
        ...state,
        loading: false,
        eventos: { ...state.eventos, [action.taskId]: [...(state.eventos[action.taskId] || []), action.payload] },
      };
    case actionTypes.UPDATE_EVENTO:
      return {
        ...state,
        loading: false,
        eventos: {
          ...state.eventos,
          [action.taskId]: (state.eventos[action.taskId] || []).map(e => (e.id === action.payload.id ? action.payload : e)),
        },
      };
    case actionTypes.REMOVE_EVENTO:
      return {
        ...state,
        loading: false,
        eventos: {
          ...state.eventos,
          [action.taskId]: (state.eventos[action.taskId] || []).filter(e => e.id !== action.eventId),
        },
      };
    default:
      return state;
  }
}

export { initialState, actionTypes, reducer };
