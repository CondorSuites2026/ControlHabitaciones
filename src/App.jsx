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
          status: 'Disponible',
          guest: '',
          amount: '0.00',
          phone: '',
          evidence_url: ''
        });
      }
    }
    // Piso 10 (4 habitaciones especiales)
    const p10 = [
      { num: '1003', type: 'PRESIDENCIAL' },
      { num: '1004', type: 'PRESIDENCIAL' },
      { num: '1001', type: 'EJECUTIVA' },
      { num: '1002', type: 'EJECUTIVA' },
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
      case 'Disponible': return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Ocupada': return 'bg-cyan-100 text-cyan-900 border-cyan-300';
      case 'Sucia': return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Reservada': return 'bg-pink-100 text-pink-900 border-pink-300';
      case 'Bloqueada': return 'bg-red-500 text-white border-red-700';
      default: return 'bg-gray-100 text-gray-900 border-gray-300';
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
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      {/* Barra superior de navegación por roles */}
      <header style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '16px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#f59e0b', color: '#0f172a', padding: '8px 12px', borderRadius: '8px', fontWeight: '900', fontSize: '18px' }}>CS</div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>HOTEL CÓNDOR SUITES</h1>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Lechería, Estado Anzoátegui — Control de check-out en línea</p>
          </div>
        </div>

        {/* Selector de Roles */}
        <div style={{ display: 'flex', backgroundColor: '#0f172a', padding: '6px', borderRadius: '12px', border: '1px solid #334155', gap: '4px' }}>
          {['recepcion', 'asistente', 'amadelhaves', 'admin'].map((r) => (
            <button 
              key={r}
              onClick={() => setRole(r)} 
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: '500',
                fontSize: '14px',
                cursor: 'pointer',
                border: 'none',
                backgroundColor: role === r ? '#f59e0b' : 'transparent',
                color: role === r ? '#0f172a' : '#cbd5e1',
                transition: 'all 0.2s'
              }}>
              {r === 'recepcion' && 'Recepción (PC)'}
              {r === 'asistente' && 'Piso / Móvil'}
              {r === 'amadelhaves' && 'Ama de Llaves'}
              {r === 'admin' && 'Administración'}
            </button>
          ))}
        </div>
      </header>

      {/* Contenido principal según rol */}
      <main style={{ flex: 1, padding: '24px', maxWidth: '1280px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* VISTA 1: RECEPCIÓN */}
        {role === 'recepcion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Matriz de Control en Tiempo Real</h2>
                <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Monitoreo de ocupación, check-out, consumos de minibar y lencería.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px', fontWeight: '600', flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#d1fae5', color: '#065f46' }}>Disponible</span>
                <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#cffafe', color: '#155e75' }}>Ocupada</span>
                <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#fef3c7', color: '#92400e' }}>Sucia</span>
                <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#fce7f3', color: '#831843' }}>Reservada</span>
                <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#ef4444', color: '#ffffff' }}>Bloqueada</span>
              </div>
            </div>

            {/* Cuadrícula de Habitaciones Garantizada por CSS Grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
              gap: '12px', 
              marginTop: '8px' 
            }}>
              {habitaciones.map((room) => (
                <div 
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className={getStatusColor(room.status)}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    height: '110px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    transition: 'transform 0.2s'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{room.number}</span>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.1)' }}>
                      {room.type ? room.type.substring(0,3) : ''}
                    </span>
                  </div>
                  <div style={{ margin: '4px 0' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {room.guest || 'Sin huésped'}
                    </p>
                    <p style={{ fontSize: '11px', opacity: 0.8, fontFamily: 'monospace', margin: '2px 0 0 0' }}>
                      Bs. {room.amount || '0.00'}
                    </p>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', textAlign: 'right', textTransform: 'uppercase' }}>
                    {room.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA 2: ASISTENTE / SUPERVISORA MÓVIL */}
        {role === 'asistente' && (
          <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', backgroundColor: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Reporte Móvil de Piso / Check-Out</h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Asistente integral: registre consumo de minibar, amenidades y faltantes de lencería.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Seleccionar Habitación a Revisar</label>
                <select 
                  onChange={(e) => {
                    const r = habitaciones.find(item => item.id === e.target.value);
                    setSelectedRoom(r);
                  }}
                  style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', color: '#fff' }}>
                  <option value="">Seleccione habitación...</option>
                  {habitaciones.map(h => (
                    <option key={h.id} value={h.id}>Habitación {h.number} ({h.type}) - {h.status}</option>
                  ))}
                </select>
              </div>

              {selectedRoom && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                  <h3 style={{ fontWeight: '600', color: '#f59e0b', margin: 0 }}>Inspección Habitación {selectedRoom.number}</h3>
                  
                  {/* Minibar */}
                  <div>
                    <h4 style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#94a3b8', margin: '0 0 8px 0' }}>Consumo de Minibar</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {minibarStock.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px', fontSize: '14px' }}>
                          <span>{item.name} (Bs. {item.price})</span>
                          <input 
                            type="number" 
                            min="0" 
                            defaultValue="0"
                            onChange={(e) => setConsumoMinibar({...consumoMinibar, [item.id]: e.target.value})}
                            style={{ width: '60px', backgroundColor: '#0f172a', border: '1px solid #334155', textAlign: 'center', borderRadius: '6px', padding: '4px', color: '#fff' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lencería */}
                  <div>
                    <h4 style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#94a3b8', margin: '0 0 8px 0' }}>Faltantes o Daños de Lencería</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {lenceriaList.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px', fontSize: '14px' }}>
                          <span>{item.name}</span>
                          <input 
                            type="number" 
                            min="0" 
                            defaultValue="0"
                            onChange={(e) => setFaltantesLenceria({...faltantesLenceria, [item.id]: e.target.value})}
                            style={{ width: '60px', backgroundColor: '#0f172a', border: '1px solid #334155', textAlign: 'center', borderRadius: '6px', padding: '4px', color: '#fff' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Evidencia Fotográfica */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px' }}>Evidencia Fotográfica (Daños / Estado)</label>
                    <input 
                      type="file" 
                      onChange={(e) => setEvidenceFile(e.target.files[0])}
                      style={{ width: '100%', fontSize: '13px', color: '#94a3b8', cursor: 'pointer' }}
                    />
                  </div>

                  <button 
                    onClick={() => {
                      handleUpdateRoomStatus(selectedRoom.id, 'Sucia', { amount: '45.00' });
                      alert(`Reporte enviado con éxito para la Habitación ${selectedRoom.number}. Recepción notificada.`);
                      setSelectedRoom(null);
                    }}
                    style={{ width: '100%', backgroundColor: '#f59e0b', color: '#0f172a', fontWeight: 'bold', padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}>
                    Enviar Check-Out / Marcar como Sucia
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VISTA 3: AMA DE LLAVES */}
        {role === 'amadelhaves' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Panel de Ama de Llaves</h2>
              <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Control de habitaciones pendientes por aseo post-salida y asignación de personal por piso.</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '16px', border: '1px solid #334155' }}>
                <h3 style={{ fontWeight: 'bold', color: '#f59e0b', margin: '0 0 12px 0' }}>Habitaciones Sucias (Por Asear)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {habitaciones.filter(h => h.status === 'Sucia').map(h => (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '12px', borderRadius: '10px', border: '1px solid #334155' }}>
                      <div>
                        <p style={{ fontWeight: 'bold', margin: 0 }}>Habitación {h.number}</p>
                        <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Piso {h.floor} — {h.type}</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateRoomStatus(h.id, 'Disponible')}
                        style={{ backgroundColor: '#059669', color: '#fff', fontSize: '12px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                        Aseada / Disponible
                      </button>
                    </div>
                  ))}
                  {habitaciones.filter(h => h.status === 'Sucia').length === 0 && (
                    <p style={{ fontSize: '14px', color: '#64748b', fontStyle: 'italic', margin: 0 }}>No hay habitaciones sucias en este momento.</p>
                  )}
                </div>
              </div>

              <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '16px', border: '1px solid #334155' }}>
                <h3 style={{ fontWeight: 'bold', color: '#f59e0b', margin: '0 0 12px 0' }}>Asignación de Personal por Piso</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(piso => (
                    <div key={piso} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '10px 12px', borderRadius: '10px', border: '1px solid #334155', fontSize: '14px' }}>
                      <div>
                        <span style={{ fontWeight: '600' }}>Piso {piso}</span>
                        <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Asistente Turno A</p>
                      </div>
                      <span style={{ padding: '4px 8px', borderRadius: '20px', fontSize: '11px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: '500' }}>Al día</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 4: ADMINISTRACIÓN E INVENTARIO */}
        {role === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Panel Administrativo e Inventario</h2>
              <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Gestión de insumos, minibar, lencería y control de personal.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>Inventario de Minibar y Productos</h3>
                  <button onClick={() => alert('Función de agregar producto')} style={{ backgroundColor: '#f59e0b', color: '#0f172a', fontSize: '12px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                    + Nuevo
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {minibarStock.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '12px', borderRadius: '10px', border: '1px solid #334155' }}>
                      <div>
                        <p style={{ fontWeight: '600', fontSize: '14px', margin: 0 }}>{item.name}</p>
                        <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Precio: Bs. {item.price.toFixed(2)} — Stock: {item.stock}</p>
                      </div>
                      <button style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Modificar</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>Control y Registro de Personal</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '12px', borderRadius: '10px', border: '1px solid #334155' }}>
                    <div>
                      <p style={{ fontWeight: '600', fontSize: '14px', margin: 0 }}>María Rodríguez</p>
                      <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Asistente Integral — Pisos 3 y 4</p>
                    </div>
                    <span style={{ fontSize: '11px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '4px 8px', borderRadius: '6px' }}>Activa</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '12px', borderRadius: '10px', border: '1px solid #334155' }}>
                    <div>
                      <p style={{ fontWeight: '600', fontSize: '14px', margin: 0 }}>Carmen Silva</p>
                      <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Asistente Integral — Pisos 5 y 6</p>
                    </div>
                    <span style={{ fontSize: '11px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '4px 8px', borderRadius: '6px' }}>Activa</span>
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