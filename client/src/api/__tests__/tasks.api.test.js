/* eslint-env jest */

describe('tasks.api', () => {
  let mockInstance;

  beforeEach(() => {
    jest.resetModules();

    mockInstance = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
      defaults: { headers: { common: {} } },
    };

    // Mock axios module to return our instance when .create is called
    jest.doMock('axios', () => ({ create: jest.fn(() => mockInstance) }));
  });

  afterEach(() => {
    jest.dontMock('axios');
  });

  it('should call POST / with task data when createTask is invoked', async () => {
    const axios = require('axios');
    const tasksApi = require('../tasks.api');

    const taskData = { title: 'New Task', description: 'Demo' };
    const mockResponse = { data: { id: 123, ...taskData } };
    mockInstance.post.mockResolvedValueOnce(mockResponse);

  const result = await tasksApi.createTask(taskData);

  expect(mockInstance.post).toHaveBeenCalledWith('/', taskData);
  // tasks.api.createTask returns the axios response object; tests should assert accordingly
  expect(result).toEqual(mockResponse);
  });

  it('should propagate errors when createTask fails', async () => {
    const axios = require('axios');
    const tasksApi = require('../tasks.api');

    const error = new Error('Network error');
    mockInstance.post.mockRejectedValueOnce(error);

    await expect(tasksApi.createTask({})).rejects.toThrow('Network error');
  });
});
