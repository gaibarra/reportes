# tasks/api.py

import requests, os 

BASE_URL = os.getenv('TASKS_API_URL', 'https://rerportes.click/tasks/api/v1/tasks')
#BASE_URL = os.getenv('TASKS_API_URL', 'https://rerportes.click/tasks/api/v1/tasks')
def get_task_events(task_id):
    response = requests.get(f'{BASE_URL}/{task_id}/eventos')
    return response.json()

def create_event(task_id, event):
    response = requests.post(f'{BASE_URL}/{task_id}/eventos', data=event)
    return response.json()