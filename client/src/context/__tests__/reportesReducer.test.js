const { reducer, initialState, actionTypes } = require('../reportesReducer');

describe('reportesReducer', () => {
  it('should return initial state when unknown action', () => {
    const state = reducer(undefined, { type: 'UNKNOWN' });
    expect(state).toEqual(initialState);
  });

  it('should handle START and FAIL', () => {
    const s1 = reducer(initialState, { type: actionTypes.START });
    expect(s1.loading).toBe(true);
    expect(s1.error).toBeNull();

    const err = new Error('boom');
    const s2 = reducer(s1, { type: actionTypes.FAIL, payload: err });
    expect(s2.loading).toBe(false);
    expect(s2.error).toBe(err);
  });

  it('should set tasks and add/update/remove task', () => {
    const tasks = [{ id: 1, title: 'a' }];
    const s = reducer(initialState, { type: actionTypes.SET_TASKS, payload: tasks });
    expect(s.tasks).toEqual(tasks);

    const s2 = reducer(s, { type: actionTypes.ADD_TASK, payload: { id: 2, title: 'b' } });
    expect(s2.tasks[0].id).toBe(2);

    const s3 = reducer(s2, { type: actionTypes.UPDATE_TASK, payload: { id: 2, title: 'b2' } });
    expect(s3.tasks.find(t => t.id === 2).title).toBe('b2');

    const s4 = reducer(s3, { type: actionTypes.REMOVE_TASK, payload: 1 });
    expect(s4.tasks.find(t => t.id === 1)).toBeUndefined();
  });

  it('should set eventos and add/remove evento for task', () => {
    const taskId = 10;
    const eventos = [{ id: 100, text: 'e1' }];
    const s = reducer(initialState, { type: actionTypes.SET_EVENTOS, taskId, payload: eventos });
    expect(s.eventos[taskId]).toEqual(eventos);

    const s2 = reducer(s, { type: actionTypes.ADD_EVENTO, taskId, payload: { id: 101, text: 'e2' } });
    expect(s2.eventos[taskId].length).toBe(2);

    const s3 = reducer(s2, { type: actionTypes.REMOVE_EVENTO, taskId, eventId: 100 });
    expect(s3.eventos[taskId].find(e => e.id === 100)).toBeUndefined();
  });
});
