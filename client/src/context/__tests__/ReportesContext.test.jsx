/* @jest-environment jsdom */

import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReportesProvider, useReportes } from '../ReportesContext';
import * as tasksApi from '../../api/tasks.api';

jest.mock('../../api/tasks.api');

describe('ReportesContext createTask flow', () => {
  it('should add a new task to context state when createTask is called', async () => {
    // Arrange: mock API response
    const newTask = { id: 1, title: 'Test Task', descripcion: 'Test description' };
    tasksApi.createTask.mockResolvedValue({ data: newTask });

    let testRender;
    // Test component that calls createTask and displays tasks length
    const TestComponent = () => {
      const { tasks, createTask } = useReportes();
      useEffect(() => {
        createTask({ title: 'Test Task', descripcion: 'Test description' });
      }, [createTask]);
      return <div data-testid="task-count">{tasks.length}</div>;
    };

    // Act: render provider and component
    await act(async () => {
      testRender = render(
        <ReportesProvider>
          <TestComponent />
        </ReportesProvider>
      );
    });

    // Assert: tasks length updated to 1
    const { getByTestId } = testRender;
    expect(getByTestId('task-count')).toHaveTextContent('1');
  });
});
