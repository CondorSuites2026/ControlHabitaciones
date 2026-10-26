import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [role, setRole] = useState('recepcion');
  const [habitaciones, setHabitaciones] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(false);

  // Filtro de estado en vista recepción
  const [filtroEstado, setFiltroEstado] = useState('Todas');

  // Asistentes por piso para el módulo móvil
  const [asistentesPiso, setAsistentesPiso] = useState({
    3: 'María Rodríguez',
    4: 'Carmen Silva',
    5: 'Rosa Gómez',
    6: 'Ana Pérez',
    7: 'Luisa Martinez',
    8: 'Elena Torres',
    9: 'Patricia Rojas',
    10: 'Sofía Blanco'
  });

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
          phone: ''
        });
      }
    }
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
        phone: ''
      });
    });
    setHabitaciones(rooms);
  };

  // Colores exactos basados en la referencia visual del sistema
  const getStatusColor = (status) => {
    switch (status) {
      case 'Disponible': return { bg: '#bbf7d0', text: '#065f46', border: '#86efac' }; // Verde claro
      case 'Ocupada': return { bg: '#99f6e4', text: '#155e75', border: '#5eead4' }; // Celeste / Azul
      case 'Reservada': return { bg: '#fed7aa', text: '#9a3412', border: '#fdba74' }; // Naranja / Amarillo oscuro (Res. garantizada)
      case 'Bloqueada': return { bg: '#ef4444', text: '#ffffff', border: '#dc2626' }; // Rojo intenso
      case 'Sucia': return { bg: '#fef08a', text: '#854d0e', border: '#fde047' }; // Amarillo sucio / aseo
      default: return { bg: '#e2e8f0', text: '#334155', border: '#cbd5e1' };
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

  const habitacionesFiltradas = filtroEstado === 'Todas' 
    ? habitaciones 
    : habitaciones.filter(h => h.status.toLowerCase().includes(filtroEstado.toLowerCase()));

  // Agrupar por pisos (del 3 al 10)
  const pisosDisponibles = [3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', color: '#1e293b', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Barra superior de navegación */}
      <header style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155', padding: '12px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#f59e0b', color: '#0f172a', padding: '6px 10px', borderRadius: '6px', fontWeight: '900', fontSize: '16px' }}>CS</div>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>HOTEL CÓNDOR SUITES</h1>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Lechería, Estado Anzoátegui — Matriz de Control en Vivo</p>
          </div>
        </div>

        <div style={{ display: 'flex', backgroundColor: '#1e293b', padding: '4px', borderRadius: '8px', border: '1px solid #334155', gap: '4px' }}>
          {['recepcion', 'asistente', 'amadelhaves', 'admin'].map((r) => (
            <button 
              key={r}
              onClick={() => setRole(r)} 
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '13px',
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

      <main style={{ flex: 1, padding: '16px', maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* VISTA 1: RECEPCIÓN - MATRIZ TIPO SISTEMA HOTELERO */}
        {role === 'recepcion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Barra de Totales y Filtros */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#0f172a', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold' }}>
                  Total Hab.(s): {habitaciones.length}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['Todas', 'Disponible', 'Ocupada', 'Reservada', 'Bloqueada', 'Sucia'].map(filtro => (
                  <button
                    key={filtro}
                    onClick={() => setFiltroEstado(filtro)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      border: '1px solid #cbd5e1',
                      backgroundColor: filtroEstado === filtro ? '#0f172a' : '#f8fafc',
                      color: filtroEstado === filtro ? '#fff' : '#334155'
                    }}>
                    {filtro}
                  </button>
                ))}
              </div>
            </div>

            {/* Matriz Completa Estilo Tabla por Pisos */}
            <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#e2e8f0', color: '#0f172a', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '10px', borderRight: '1px solid #cbd5e1', width: '90px' }}>Ubicación</th>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                      <th key={n} style={{ padding: '10px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>0{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pisosDisponibles.map(piso => {
                    const habsPiso = habitacionesFiltradas.filter(h => h.floor === piso);
                    if (habsPiso.length === 0 && filtroEstado !== 'Todas') return null;

                    return (
                      <tr key={piso} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold', background: '#f8fafc', borderRight: '1px solid #cbd5e1', color: '#0f172a' }}>
                          PISO {piso < 10 ? `0${piso}` : piso}
                        </td>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(numCol => {
                          // Buscar habitación correspondiente a la columna
                          const numHabStr = piso === 10 ? (numCol === 1 ? '1001' : numCol === 2 ? '1002' : numCol === 3 ? '1003' : numCol === 4 ? '1004' : null) : `${piso}0${numCol}`;
                          const hab = habitaciones.find(h => h.number === numHabStr);

                          if (!hab) {
                            return <td key={numCol} style={{ background: '#f1f5f9', borderRight: '1px solid #cbd5e1' }}></td>;
                          }

                          const colors = getStatusColor(hab.status);

                          return (
                            <td 
                              key={hab.id}
                              onClick={() => setSelectedRoom(hab)}
                              style={{
                                padding: '8px',
                                backgroundColor: colors.bg,
                                color: colors.text,
                                borderRight: '1px solid #cbd5e1',
                                cursor: 'pointer',
                                verticalAlign: 'top',
                                height: '75px',
                                transition: 'filter 0.2s'
                              }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px', marginBottom: '2px' }}>
                                <span>{hab.number} / {hab.type.substring(0,3)}</span>
                              </div>
                              <div style={{ fontSize: '11px', lineHeight: '1.2' }}>
                                <div style={{ fontWeight: '600', textTransform: 'capitalize' }}>{hab.status}</div>
                                <div style={{ fontSize: '10px', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {hab.guest || 'Sin huésped'}
                                </div>
                                <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                  Bs. {hab.amount || '0.00'}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA 2: ASISTENTE / MÓVIL (SELECCIÓN POR PISO Y ASISTENTE ENCARGADA) */}
        {role === 'asistente' && (
          <div style={{ maxWidth: '650px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#0f172a' }}>Check-Out e Inspección por Piso</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Seleccione el piso y verifique la asistente integral encargada de ejecutar el proceso.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Selección de Piso */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Seleccionar Piso</label>
                  <select 
                    onChange={(e) => {
                      const pisoSel = parseInt(e.target.value);
                      const primerHab = habitaciones.find(h => h.floor === pisoSel);
                      setSelectedRoom(primerHab || null);
                    }}
                    style={{ width: '100%', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', fontSize: '14px' }}>
                    <option value="">Seleccione piso...</option>
                    {pisosDisponibles.map(p => (
                      <option key={p} value={p}>Piso {p} ({p === 10 ? '4 hab. especiales' : '9 habitaciones'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Asistente Encargada</label>
                  <input 
                    type="text" 
                    readOnly
                    value={selectedRoom ? (asistentesPiso[selectedRoom.floor] || 'Asignada Turno A') : 'Seleccione piso primero'}
                    style={{ width: '100%', backgroundColor: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}
                  />
                </div>
              </div>

              {/* Selección específica de Habitación en ese piso */}
              {selectedRoom && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Habitación del Piso {selectedRoom.floor}</label>
                    <select 
                      value={selectedRoom.id}
                      onChange={(e) => {
                        const r = habitaciones.find(item => item.id === e.target.value);
                        setSelectedRoom(r);
                      }}
                      style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px', fontSize: '14px' }}>
                      {habitaciones.filter(h => h.floor === selectedRoom.floor).map(h => (
                        <option key={h.id} value={h.id}>Habitación {h.number} ({h.type}) - Estado: {h.status}</option>
                      ))}
                    </select>
                  </div>

                  <h3 style={{ fontWeight: 'bold', fontSize: '14px', color: '#f59e0b', margin: 0 }}>Inspección Habitación {selectedRoom.number}</h3>
                  
                  {/* Minibar */}
                  <div>
                    <h4 style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Consumo de Minibar</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {minibarStock.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                          <span>{item.name} (Bs. {item.price})</span>
                          <input 
                            type="number" 
                            min="0" 
                            defaultValue="0"
                            onChange={(e) => setConsumoMinibar({...consumoMinibar, [item.id]: e.target.value})}
                            style={{ width: '50px', border: '1px solid #cbd5e1', textAlign: 'center', borderRadius: '4px', padding: '2px' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      const encargada = asistentesPiso[selectedRoom.floor];
                      handleUpdateRoomStatus(selectedRoom.id, 'Sucia', { amount: '45.00' });
                      alert(`Check-out registrado con éxito para la Habitación ${selectedRoom.number} por la asistente ${encargada}. Habitación marcada como Sucia.`);
                    }}
                    style={{ width: '100%', backgroundColor: '#0f172a', color: '#fff', fontWeight: 'bold', padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                    Ejecutar Check-Out / Marcar Sucia
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VISTA 3: AMA DE LLAVES */}
        {role === 'amadelhaves' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a' }}>Panel de Ama de Llaves</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <h3 style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '12px' }}>Habitaciones Sucias (Por Asear)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {habitaciones.filter(h => h.status === 'Sucia').map(h => (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <p style={{ fontWeight: 'bold', margin: 0 }}>Habitación {h.number}</p>
                        <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Piso {h.floor} — Encargada: {asistentesPiso[h.floor]}</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateRoomStatus(h.id, 'Disponible')}
                        style={{ backgroundColor: '#10b981', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '6px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                        Aseada / Disponible
                      </button>
                    </div>
                  ))}
                  {habitaciones.filter(h => h.status === 'Sucia').length === 0 && (
                    <p style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>No hay habitaciones sucias en este momento.</p>
                  )}
                </div>
              </div>

              <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <h3 style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '12px' }}>Asistentes Encargadas por Piso</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pisosDisponibles.map(piso => (
                    <div key={piso} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                      <span style={{ fontWeight: '600' }}>Piso {piso}</span>
                      <span style={{ color: '#0f172a', fontWeight: 'bold' }}>{asistentesPiso[piso]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 4: ADMINISTRACIÓN */}
        {role === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a' }}>Panel Administrativo</h2>
            <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <h3 style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '16px' }}>Configuración de Asistentes Integrales por Piso</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                {pisosDisponibles.map(piso => (
                  <div key={piso} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Piso {piso}</label>
                    <input 
                      type="text" 
                      value={asistentesPiso[piso]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAsistentesPiso({...asistentesPiso, [piso]: val});
                      }}
                      style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}