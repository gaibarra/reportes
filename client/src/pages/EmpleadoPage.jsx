import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

function EmpleadoPage() {
    const [empleados, setEmpleados] = useState([]);
    const [selectedEmpleado, setSelectedEmpleado] = useState({ numero_empleado: '', puesto: '', campus: '' });
    const { id } = useParams();

    useEffect(() => {
        if (id) {
            fetchEmpleado();
        } else {
            fetchEmpleados();
        }
    }, [id]);

    const fetchEmpleados = async () => {
        const response = await axios.get('/tasks/api/v1/tasks/empleado');
        setEmpleados(response.data);
    };

    const fetchEmpleado = async () => {
        const response = await axios.get(`/tasks/api/v1/tasks/empleado/${id}`);
        setSelectedEmpleado(response.data);
    };

    const handleDelete = async (id) => {
        await axios.delete(`/tasks/api/v1/tasks/empleado/${id}`);
        fetchEmpleados();
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        if (selectedEmpleado && selectedEmpleado.id) {
            await axios.put(`/tasks/api/v1/tasks/empleado/${selectedEmpleado.id}`, selectedEmpleado);
        } else {
            await axios.post('/tasks/api/v1/tasks/empleado', selectedEmpleado);
        }
        fetchEmpleados();
    };

    const handleInputChange = (event) => {
        setSelectedEmpleado({ ...selectedEmpleado, [event.target.name]: event.target.value });
    };

    return (
        <div className="container mx-auto py-10">
            <form onSubmit={handleFormSubmit} className="mb-10">
                <input name="numero_empleado" onChange={handleInputChange} value={selectedEmpleado.numero_empleado} placeholder="Número de empleado" className="border p-2 rounded mr-2 mb-2" />
                <input name="puesto" onChange={handleInputChange} value={selectedEmpleado.puesto} placeholder="Puesto" className="border p-2 rounded mr-2 mb-2" />
                <input name="campus" onChange={handleInputChange} value={selectedEmpleado.campus} placeholder="Campus" className="border p-2 rounded mr-2 mb-2" />
                <button type="submit" className="bg-blue-500 text-white p-2 rounded">Guardar</button>
            </form>
            <ul>
                {empleados.map(empleado => (
                    <li key={empleado.id} className="border p-2 rounded mb-2">
                        {empleado.numero_empleado} - {empleado.puesto} - {empleado.campus}
                        <button onClick={() => setSelectedEmpleado(empleado)} className="bg-yellow-500 text-white p-2 rounded ml-2">Editar</button>
                        <button onClick={() => handleDelete(empleado.id)} className="bg-red-500 text-white p-2 rounded ml-2">Eliminar</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default EmpleadoPage;