import React from 'react';

export default function Timeline({ items = [] }) {
  if (!Array.isArray(items)) return null;

  return (
    <div className="space-y-4">
      {items.map((it, idx) => {
        const date = it.date ? new Date(it.date).toLocaleString() : 'Sin fecha';
        if (it.type === 'evento') {
          return (
            <div key={idx} className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">{date} · Evento</div>
              <div className="mt-2 text-gray-900">{it.data.descripcion}</div>
            </div>
          );
        }
        return (
          <div key={idx} className="p-4 bg-yellow-50 rounded shadow">
            <div className="text-sm text-gray-500">{date} · Compromiso</div>
            <div className="mt-2 text-gray-900">{it.data.descripcion}</div>
          </div>
        );
      })}
    </div>
  );
}
