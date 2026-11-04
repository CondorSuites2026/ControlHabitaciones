import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [role, setRole] = useState('recepcion');
  const [habitaciones, setHabitaciones] = useState([]);
  const [habitacionesPendientes, setHabitacionesPendientes] = useState([]);
  const [roomToBill, setRoomToBill] = useState(null);
  const [roomToEditStatus, setRoomToEditStatus] = useState(null);
  const [mostrarReporteRecepcion, setMostrarReporteRecepcion] = useState(false);
  const [tasaBCV, setTasaBCV] = useState(36.5);
  const [personal, setPersonal] = useState([]);
  const [nuevoPersonal, setNuevoPersonal] = useState({ nombre: '', rol: '', turno: '' });

  useEffect(() => {
    // Carga inicial o simulación de datos para evitar errores de render
    fetchHabitaciones();
  }, []);

  const fetchHabitaciones = async () => {
    try {
      const { data, error } = await supabase.from('habitaciones').select('*');
      if (error) throw error;
      if (data) setHabitaciones(data);
    } catch (e) {
      console.log('Modo local o error de conexión con Supabase:', e.message);
    }
  };

  const getStatusClass = (status) => {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s.includes('ocupada')) return 'badge-ocupada';
    if (s.includes('disponible')) return 'badge-disponible';
    if (s.includes('limpieza')) return 'badge-limpieza';
    return '';
  };

  return (
    <div className="app-container">
      <header style={{ backgroundColor: '#1e3a8a', padding: '16px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>🏨 Hotel Condor Suites - Sistema de Control</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setRole('recepcion')} style={{ background: role === 'recepcion' ? '#3b82f6' : '#1e293b', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>Recepción</button>
          <button onClick={() => setRole('personal')} style={{ background: role === 'personal' ? '#3b82f6' : '#1e293b', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>Personal</button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '20px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        
        {/* VISTA 1: RECEPCIÓN */}
        {role === 'recepcion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
  
  {/* Título y Cuadro de Ocupación del Día */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
    <h2 style={{ margin: 0, fontSize: '18px', color: '#1e3a8a' }}>🏨 Estado General de Habitaciones</h2>
    
    <div style={{ 
      background: '#eff6ff', 
      border: '1px solid #bfdbfe', 
      padding: '5px 12px', 
      borderRadius: '6px', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    }}>
      <span style={{ fontSize: '12px', color: '#1e40af', fontWeight: 'bold' }}>📅 Ocupación del Día:</span>
      <span style={{ fontSize: '13px', color: '#1e3a8a', fontWeight: '900' }}>
        {habitaciones.filter(h => (h.status || '').toLowerCase().includes('ocupada')).length} Hab.
      </span>
    </div>
  </div>

  <button 
    onClick={() => setMostrarReporteRecepcion(true)}
    style={{ background: '#059669', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
    📊 Reporte de Consumos Facturados (Cierre de Turno)
  </button>
</div>     
              {/* Título y Cuadro de Ocupación */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#1e3a8a' }}>🏨 Estado General de Habitaciones</h2>
                
                <div style={{ 
                  background: '#eff6ff', 
                  border: '1px solid #bfdbfe', 
                  padding: '4px 10px', 
                  borderRadius: '6px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold' }}>📊 Ocupación:</span>
                  <span style={{ fontSize: '12px', color: '#1e3a8a', fontWeight: '900' }}>
                    {habitaciones.filter(h => (h.status || '').toLowerCase().includes('ocupada')).length} Hab.
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setMostrarReporteRecepcion(true)}
                style={{ background: '#059669', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
                📊 Reporte de Consumos Facturados (Cierre de Turno)
              </button>
            </div>

            {habitacionesPendientes.length > 0 && (
              <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: '8px', padding: '14px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <div style={{ color: '#991b1b', fontWeight: 'bold' }}>
                  🔔 ¡ATENCIÓN RECEPCIÓN! Hay {habitacionesPendientes.length} salida(s) pendientes por facturar.
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {habitacionesPendientes.map(h => (
                    <button key={h.id} onClick={() => setRoomToBill(h)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Facturar Hab. {h.number} (${h.amount})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '10px', border: '1px solid #e2e8f0' }}>Ubicación</th>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <th key={n} style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>0{n}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(piso => (
                    <tr key={piso}>
                      <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 'bold', background: '#f1f5f9' }}>PISO {piso}</td>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(numCol => {
                        const numStr = piso === 10 ? (numCol <= 4 ? `100${numCol}` : null) : `${piso}0${numCol}`;
                        const hab = habitaciones.find(h => h.number === numStr);
                        if (!hab) return <td key={numCol} style={{ padding: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}></td>;
                        const badgeClass = getStatusClass(hab.status);

                        return (
                          <td 
                            key={hab.id} 
                            onClick={() => setRoomToEditStatus(hab)}
                            className={badgeClass}
                            style={{ padding: '10px', border: '1px solid #e2e8f0', cursor: 'pointer', height: '70px', verticalAlign: 'top', position: 'relative' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{hab.number}</div>
                            <div style={{ fontSize: '10px', marginTop: '4px', fontWeight: 'bold' }}>{hab.status}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA 2: PERSONAL */}
        {role === 'personal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2>👥 Gestión de Personal</h2>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Nombre</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Rol</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Turno</th>
                  </tr>
                </thead>
                <tbody>
                  {personal.map(p => (
                    <tr key={p.id}>
                      <td style={{ padding: '10px' }}><strong>{p.nombre}</strong></td>
                      <td style={{ padding: '10px' }}>{p.rol}</td>
                      <td style={{ padding: '10px' }}>{p.turno}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}