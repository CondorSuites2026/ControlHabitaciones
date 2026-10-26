import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Inicialización de Supabase usando tus variables de entorno
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [role, setRole] = useState('recepcion'); // recepcion, asistente, amadelhaves, admin
  const [habitaciones, setHabitaciones] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(false);

  // Estados para inventario y check-out
  const [minibarStock, setMinibarStock] = useState([
    { id: 1, name: 'Agua Mineral 500ml', price: 3.50, stock: 24 },
    { id: 2, name: 'Refresco Lata', price: 4.00, stock: 18 },
    { id: 3, name: 'Cerveza Nacional', price: 5.50, stock: 30 },
    { id: 4, name: 'Snacks / Chocolates', price: 4.50, stock: 15 },
  ]);

  const [lenceriaList, setLenceriaList] = useState([
    { id: 'toalla_c', name: 'Toalla de Cuerpo', missing: 0 },
    { id: 'toalla_m', name: 'Toalla de Manos', missing: 0 },
    { id: 'sabana_k', name: 'Juego de Sábana King/Master', missing: 0 },
    { id: 'almohada', name: 'Funda de Almohada', missing: 0 },
    { id: 'bata', name: 'Bata de Baño', missing: 0 },
  ]);

  const [consumoMinibar, setConsumoMinibar] = useState({});
  const [faltantesLenceria, setFaltantesLenceria] = useState({});
  const [evidenceFile, setEvidenceFile] = useState(null);

  // Cargar habitaciones iniciales o de Supabase
  useEffect(() => {
    fetchHabitaciones();
  }, []);

  const fetchHabitaciones = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('habitaciones').select('*');
      if (error || !data || data.length === 0) {
        // Generar estructura por defecto si la tabla está vacía
        generateDefaultRooms();
      } else {
        setHabitaciones(data);
      }
    } catch (err) {
      generateDefaultRooms();
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultRooms = () => {
    const rooms = [];
    // Pisos 3 al 9 (9 habitaciones por piso)
    for (let f = 3; f <= 9; f++) {
      for (let n = 1; n <= 9; n++) {
        let type = 'SENCILLA';
        if (n <= 4) type = 'MASTER';
        else if (n <= 7) type = 'JUNIOR';

        rooms.push({
          id: `${f}0${n}`,
          number: `${f}0${n}`,
          floor: f,
          type: type,
          status: 'Disponible', // Disponible, Ocupada, Sucia, Reservada, Bloqueada
          guest: '',
          amount: '0.00',
          phone: '',
          evidence_url: ''
        });
      }
    }
    // Piso 10 (4 habitaciones especiales)
    const p10 = [
      { num: '1001', type: 'PRESIDENCIAL' },
      { num: '1002', type: 'PRESIDENCIAL' },
      { num: '1003', type: 'EJECUTIVA' },
      { num: '1004', type: 'EJECUTIVA' },
    ];
    p10.forEach(r => {
      rooms.push({
        id: r.num,
        number: r.num,
        floor: 10,
        type: r.type,
        status: 'Disponible',
        guest: '',
        amount: '0.00',
        phone: '',
        evidence_url: ''
      });
    });
    setHabitaciones(rooms);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Disponible': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Ocupada': return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      case 'Sucia': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Reservada': return 'bg-pink-100 text-pink-800 border-pink-300';
      case 'Bloqueada': return 'bg-red-500 text-white border-red-700';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const handleUpdateRoomStatus = async (roomId, newStatus, extraData = {}) => {
    const updated = habitaciones.map(h => {
      if (h.id === roomId) {
        return { ...h, status: newStatus, ...extraData };
      }
      return h;
    });
    setHabitaciones(updated);

    // Sincronizar con Supabase
    try {
      await supabase.from('habitaciones').upsert({
        id: roomId,
        number: roomId,
        status: newStatus,
        ...extraData
      });
    } catch (e) {
      console.error("Error al sincronizar con Supabase", e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Barra superior de navegación por roles */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-amber-500 text-slate-900 p-2 rounded-lg font-black text-xl">CS</div>
          <div>
            <h1 className="text-lg font-bold tracking-wide">HOTEL CÓNDOR SUITES</h1>
            <p className="text-xs text-slate-400">Lechería, Estado Anzoátegui — Control en Línea</p>
          </div>
        </div>

        {/* Selector de Roles */}
        <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-700 text-sm overflow-x-auto">
          <button 
            onClick={() => setRole('recepcion')} 
            className={`px-4 py-2 rounded-lg font-medium transition ${role === 'recepcion' ? 'bg-amber-500 text-slate-900 shadow' : 'text-slate-300 hover:text-white'}`}>
            Recepción (PC)
          </button>
          <button 
            onClick={() => setRole('asistente')} 
            className={`px-4 py-2 rounded-lg font-medium transition ${role === 'asistente' ? 'bg-amber-500 text-slate-900 shadow' : 'text-slate-300 hover:text-white'}`}>
            Piso / Móvil
          </button>
          <button 
            onClick={() => setRole('amadelhaves')} 
            className={`px-4 py-2 rounded-lg font-medium transition ${role === 'amadelhaves' ? 'bg-amber-500 text-slate-900 shadow' : 'text-slate-300 hover:text-white'}`}>
            Ama de Llaves
          </button>
          <button 
            onClick={() => setRole('admin')} 
            className={`px-4 py-2 rounded-lg font-medium transition ${role === 'admin' ? 'bg-amber-500 text-slate-900 shadow' : 'text-slate-300 hover:text-white'}`}>
            Administración
          </button>
        </div>
      </header>

      {/* Contenido principal según rol */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        
        {/* VISTA 1: RECEPCIÓN */}
        {role === 'recepcion' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Matriz de Control en Tiempo Real</h2>
                <p className="text-sm text-slate-400">Monitoreo de ocupación, check-out, consumos de minibar y lencería.</p>
              </div>
              <div className="flex gap-2 text-xs font-semibold">
                <span className="px-3 py-1 rounded bg-emerald-100 text-emerald-800">Disponible</span>
                <span className="px-3 py-1 rounded bg-cyan-100 text-cyan-800">Ocupada</span>
                <span className="px-3 py-1 rounded bg-amber-100 text-amber-800">Sucia</span>
                <span className="px-3 py-1 rounded bg-pink-100 text-pink-800">Reservada</span>
                <span className="px-3 py-1 rounded bg-red-500 text-white">Bloqueada</span>
              </div>
            </div>

            {/* Cuadrícula de Habitaciones */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-9 gap-3">
              {habitaciones.map((room) => (
                <div 
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className={`p-3 rounded-xl border cursor-pointer transition transform hover:scale-105 shadow-sm flex flex-col justify-between h-32 ${getStatusColor(room.status)}`}>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-base">{room.number}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/10">{room.type.substring(0,3)}</span>
                  </div>
                  <div className="my-1">
                    <p className="text-xs font-semibold truncate">{room.guest || 'Sin huésped'}</p>
                    <p className="text-[11px] opacity-75 font-mono">Bs. {room.amount || '0.00'}</p>
                  </div>
                  <span className="text-[10px] font-bold text-right uppercase tracking-wider">{room.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA 2: ASISTENTE / SUPERVISORA MÓVIL */}
        {role === 'asistente' && (
          <div className="max-w-2xl mx-auto space-y-6 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <div>
              <h2 className="text-xl font-bold">Reporte Móvil de Piso / Check-Out</h2>
              <p className="text-xs text-slate-400">Asistente integral: registre consumo de minibar, amenidades y faltantes de lencería.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Seleccionar Habitación a Revisar</label>
                <select 
                  onChange={(e) => {
                    const r = habitaciones.find(item => item.id === e.target.value);
                    setSelectedRoom(r);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm">
                  <option value="">Seleccione habitación...</option>
                  {habitaciones.map(h => (
                    <option key={h.id} value={h.id}>Habitación {h.number} ({h.type}) - {h.status}</option>
                  ))}
                </select>
              </div>

              {selectedRoom && (
                <div className="space-y-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                  <h3 className="font-semibold text-amber-400">Inspección Habitación {selectedRoom.number}</h3>
                  
                  {/* Minibar */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Consumo de Minibar</h4>
                    <div className="space-y-2">
                      {minibarStock.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-slate-800 p-2.5 rounded-lg text-sm">
                          <span>{item.name} (Bs. {item.price})</span>
                          <input 
                            type="number" 
                            min="0" 
                            defaultValue="0"
                            onChange={(e) => setConsumoMinibar({...consumoMinibar, [item.id]: e.target.value})}
                            className="w-16 bg-slate-900 border border-slate-700 text-center rounded py-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lencería */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Faltantes o Daños de Lencería</h4>
                    <div className="space-y-2">
                      {lenceriaList.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-slate-800 p-2.5 rounded-lg text-sm">
                          <span>{item.name}</span>
                          <input 
                            type="number" 
                            min="0" 
                            defaultValue="0"
                            onChange={(e) => setFaltantesLenceria({...faltantesLenceria, [item.id]: e.target.value})}
                            className="w-16 bg-slate-900 border border-slate-700 text-center rounded py-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Evidencia Fotográfica */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Evidencia Fotográfica (Daños / Estado)</label>
                    <input 
                      type="file" 
                      onChange={(e) => setEvidenceFile(e.target.files[0])}
                      className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-amber-500 file:text-slate-900 hover:file:bg-amber-400 cursor-pointer"
                    />
                  </div>

                  <button 
                    onClick={() => {
                      handleUpdateRoomStatus(selectedRoom.id, 'Sucia', { amount: '45.00' });
                      alert(`Reporte enviado con éxito para la Habitación ${selectedRoom.number}. Recepción notificada.`);
                      setSelectedRoom(null);
                    }}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 rounded-xl transition shadow-lg">
                    Enviar Check-Out / Marcar como Sucia
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VISTA 3: AMA DE LLAVES */}
        {role === 'amadelhaves' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Panel de Ama de Llaves</h2>
            <p className="text-sm text-slate-400">Control de habitaciones pendientes por aseo post-salida y asignación de personal por piso.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <h3 className="font-bold text-amber-400 mb-2">Habitaciones Sucias (Por Asear)</h3>
                <div className="space-y-2 mt-4">
                  {habitaciones.filter(h => h.status === 'Sucia').map(h => (
                    <div key={h.id} className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-700">
                      <div>
                        <p className="font-bold">Habitación {h.number}</p>
                        <p className="text-xs text-slate-400">Piso {h.floor} — {h.type}</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateRoomStatus(h.id, 'Disponible')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition">
                        Aseada / Disponible
                      </button>
                    </div>
                  ))}
                  {habitaciones.filter(h => h.status === 'Sucia').length === 0 && (
                    <p className="text-sm text-slate-500 italic">No hay habitaciones sucias en este momento.</p>
                  )}
                </div>
              </div>

              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 md:col-span-2">
                <h3 className="font-bold text-amber-400 mb-2">Asignación de Asistentes Integrales por Piso</h3>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400">
                        <th className="pb-3">Piso</th>
                        <th className="pb-3">Asistente Asignada</th>
                        <th className="pb-3">Estado de Limpieza</th>
                        <th className="pb-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {[3, 4, 5, 6, 7, 8, 9, 10].map(piso => (
                        <tr key={piso}>
                          <td className="py-3 font-semibold">Piso {piso}</td>
                          <td className="py-3 text-slate-300">Asistente Turno A ({piso <= 6 ? 'Grupo 1' : 'Grupo 2'})</td>
                          <td className="py-3">
                            <span className="px-2.5 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-400 font-medium">Al día</span>
                          </td>
                          <td className="py-3 text-right">
                            <button className="text-amber-400 hover:underline text-xs font-semibold">Reasignar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 4: ADMINISTRACIÓN E INVENTARIO */}
        {role === 'admin' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Panel Administrativo e Inventario</h2>
            <p className="text-sm text-slate-400">Gestión de insumos, minibar, lencería y control de personal.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-amber-400">Inventario de Minibar y Productos</h3>
                  <button onClick={() => alert('Función de agregar producto')} className="bg-amber-500 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-amber-400 transition">
                    + Nuevo Producto
                  </button>
                </div>
                <div className="space-y-2">
                  {minibarStock.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-700">
                      <div>
                        <p className="font-semibold text-sm">{item.name}</p>
                        <p className="text-xs text-slate-400">Precio: Bs. {item.price.toFixed(2)} — Stock: {item.stock}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded text-xs">Modificar</button>
                        <button className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1 rounded text-xs">Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-4">
                <h3 className="font-bold text-amber-400">Control y Registro de Personal</h3>
                <p className="text-xs text-slate-400">Administre las asistentes integrales asignadas a los pisos 3 al 10.</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-700">
                    <div>
                      <p className="font-semibold text-sm">María Rodríguez</p>
                      <p className="text-xs text-slate-400">Asistente Integral — Pisos 3 y 4</p>
                    </div>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">Activa</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-700">
                    <div>
                      <p className="font-semibold text-sm">Carmen Silva</p>
                      <p className="text-xs text-slate-400">Asistente Integral — Pisos 5 y 6</p>
                    </div>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">Activa</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-700">
                    <div>
                      <p className="font-semibold text-sm">Rosa Gómez</p>
                      <p className="text-xs text-slate-400">Asistente Integral — Pisos 7 y 8</p>
                    </div>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">Activa</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
