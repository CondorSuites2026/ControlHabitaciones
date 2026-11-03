import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [role, setRole] = useState('asistente');
  const [selectedFloor, setSelectedFloor] = useState(3);
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState('Asistente');
  const [asistenteSeleccionada, setAsistenteSeleccionada] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  
  const [habitaciones, setHabitaciones] = useState([
    { id: '1', floor: 3, number: '301', type: 'Master', status: 'Ocupada' },
    { id: '2', floor: 6, number: '601', type: 'Master', status: 'Ocupada' }
  ]);
  
  const [inventario, setInventario] = useState([
    { id: 'agua', name: 'Agua Mineral 600ml', category: 'minibar', price_usd: 3.00 },
    { id: 'gatorade', name: 'Gatorade 500ml', category: 'minibar', price_usd: 4.00 },
    { id: 'pepsi', name: 'Pepsi Original', category: 'minibar', price_usd: 3.00 },
    { id: 'polar', name: 'Polar Light', category: 'minibar', price_usd: 3.00 },
    { id: 'snickers', name: 'Snickers chocolate', category: 'minibar', price_usd: 3.00 },
    { id: 'toalla', name: 'Toalla de Cuerpo', category: 'utensilios', price_usd: 35.00 },
    { id: 'sabana', name: 'Juego de Sábana King/Master', category: 'lenceria', price_usd: 30.00 }
  ]);

  const [personal, setPersonal] = useState([
    { id: '1', nombre: 'Ana Pérez', rol: 'Asistente', turno: 'Mañana' },
    { id: '2', nombre: 'Carlos Gomez', rol: 'Supervisores', turno: 'Tarde' }
  ]);

  const [consumosSeleccionados, setConsumosSeleccionados] = useState({});
  const [itemPersonalizadoText, setItemPersonalizadoText] = useState('');
  const [archivoEvidencia, setArchivoEvidencia] = useState(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  const handleQtyChange = (id, delta) => {
    setConsumosSeleccionados(prev => {
      const actual = prev[id] || 0;
      const nuevo = Math.max(0, actual + delta);
      return { ...prev, [id]: nuevo };
    });
  };

  const obtenerPersonalPorDepartamento = () => {
    if (departamentoSeleccionado === 'Asistente') {
      return personal.filter(p => p.rol.toLowerCase().includes('asistente'));
    } else if (departamentoSeleccionado === 'supervisores') {
      return personal.filter(p => p.rol.toLowerCase().includes('supervisor'));
    }
    return personal;
  };

  const handleEjecutarCheckout = () => {
    alert('¡Check-out procesado con éxito!');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', background: '#f1f5f9', minHeight: '100vh' }}>
      {/* VISTA 2: ASISTENTE MÓVIL */}
      {role === 'asistente' && (
        <div style={{ maxWidth: '650px', margin: '0 auto', width: '100%' }} className="card-box">
          <h2 style={{ fontSize: '20px', margin: 0, color: '#1e3a8a' }}>Check-Out e Inspección Móvil</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginTop: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Seleccionar Piso</label>
              <select value={selectedFloor} onChange={(e) => {
                const pisoNum = parseInt(e.target.value);
                setSelectedFloor(pisoNum);
                const habsPiso = habitaciones.filter(h => h.floor === pisoNum);
                setSelectedRoom(habsPiso[0] || null);
              }} style={{ width: '100%', padding: '8px', borderRadius: '6px' }}>
                {[3, 4, 5, 6, 7, 8, 9, 10].map(p => <option key={p} value={p}>Piso {p}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Departamento / Rol</label>
              <select 
                value={departamentoSeleccionado} 
                onChange={(e) => {
                  setDepartamentoSeleccionado(e.target.value);
                  setAsistenteSeleccionada('');
                }} 
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 'bold' }}>
                <option value="Asistente">🧹 Asistentes (Piso)</option>
                <option value="supervisores">📋 Supervisores</option>
                <option value="Equipo Nocturno">🌙 Equipo Nocturno</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Encargado/a de Turno</label>
              <select 
                value={asistenteSeleccionada} 
                onChange={(e) => setAsistenteSeleccionada(e.target.value)} 
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff' }}>
                <option value="">-- Seleccionar Persona --</option>
                {obtenerPersonalPorDepartamento().map(a => (
                  <option key={a.id} value={a.nombre}>{a.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="card-box" style={{ background: '#fff', padding: '15px', borderRadius: '10px', width: '100%', boxSizing: 'border-box', marginTop: '12px', border: '1px solid #cbd5e1' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Habitación del Piso {selectedFloor}</label>
              <select value={selectedRoom?.id || ''} onChange={(e) => setSelectedRoom(habitaciones.find(h => h.id === e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px' }}>
                <option value="">Seleccione habitación...</option>
                {habitaciones.filter(h => h.floor === selectedFloor).map(h => <option key={h.id} value={h.id}>Habitación {h.number} ({h.type}) — {h.status}</option>)}
              </select>
            </div>

            {selectedRoom && (
              <>
                <div>
                  <h4 style={{ margin: '16px 0 12px 0', fontSize: '13px', textTransform: 'uppercase', color: '#1e3a8a', borderBottom: '2px solid #1e3a8a', paddingBottom: '4px' }}>📦 Registro de Consumos e Inspección</h4>
                  
                  {/* 1. SECCIÓN: MINIBAR - BEBIDAS */}
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e3a8a', backgroundColor: '#e0f2fe', padding: '6px 10px', borderRadius: '6px', margin: '10px 0 6px 0', textTransform: 'uppercase' }}>
                    Minibar - Bebidas
                  </div>
                  {inventario.filter(item => {
                    const cat = (item.category || '').toLowerCase();
                    const id = (item.id || '').toLowerCase();
                    const name = (item.name || '').toLowerCase();
                    return cat === 'minibar' && (
                      id.includes('agua') || id.includes('gatorade') || id.includes('pepsi') || 
                      id.includes('polar') || id.includes('redbull') || id.includes('solera') || 
                      id.includes('golden') || name.includes('agua') || name.includes('gatorade') || 
                      name.includes('pepsi') || name.includes('polar') || name.includes('redbull') || 
                      name.includes('solera') || name.includes('kolita')
                    );
                  }).map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '8px', width: '100%', boxSizing: 'border-box' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.name}</span>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>${Number(item.price_usd || 0).toFixed(2)} USD</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button type="button" onClick={() => handleQtyChange(item.id, -1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', fontWeight: 'bold' }}>-</button>
                        <span style={{ width: '24px', textAlign: 'center', fontWeight: 'bold' }}>{consumosSeleccionados[item.id] || 0}</span>
                        <button type="button" onClick={() => handleQtyChange(item.id, 1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: '#1e3a8a', color: '#fff', fontWeight: 'bold' }}>+</button>
                      </div>
                    </div>
                  ))}

                  {/* 2. SECCIÓN: MINIBAR - DULCES Y SNACKS */}
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e3a8a', backgroundColor: '#e0f2fe', padding: '6px 10px', borderRadius: '6px', margin: '14px 0 6px 0', textTransform: 'uppercase' }}>
                    Minibar - Dulces y Snacks
                  </div>
                  {inventario.filter(item => {
                    const cat = (item.category || '').toLowerCase();
                    const id = (item.id || '').toLowerCase();
                    const name = (item.name || '').toLowerCase();
                    const esBebida = id.includes('agua') || id.includes('gatorade') || id.includes('pepsi') || 
                      id.includes('polar') || id.includes('redbull') || id.includes('solera') || 
                      id.includes('golden') || name.includes('agua') || name.includes('gatorade') || 
                      name.includes('pepsi') || name.includes('polar') || name.includes('redbull') || 
                      name.includes('solera') || name.includes('kolita');
                    return cat === 'minibar' && !esBebida;
                  }).map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '8px', width: '100%', boxSizing: 'border-box' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.name}</span>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>${Number(item.price_usd || 0).toFixed(2)} USD</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button type="button" onClick={() => handleQtyChange(item.id, -1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', fontWeight: 'bold' }}>-</button>
                        <span style={{ width: '24px', textAlign: 'center', fontWeight: 'bold' }}>{consumosSeleccionados[item.id] || 0}</span>
                        <button type="button" onClick={() => handleQtyChange(item.id, 1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: '#1e3a8a', color: '#fff', fontWeight: 'bold' }}>+</button>
                      </div>
                    </div>
                  ))}

                  {/* 3. SECCIÓN: UTENSILIOS */}
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e3a8a', backgroundColor: '#e0f2fe', padding: '6px 10px', borderRadius: '6px', margin: '14px 0 6px 0', textTransform: 'uppercase' }}>
                    Utensilios
                  </div>
                  {inventario.filter(item => (item.category || '').toLowerCase() === 'utensilios').map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '8px', width: '100%', boxSizing: 'border-box' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.name}</span>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>${Number(item.price_usd || 0).toFixed(2)} USD</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button type="button" onClick={() => handleQtyChange(item.id, -1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', fontWeight: 'bold' }}>-</button>
                        <span style={{ width: '24px', textAlign: 'center', fontWeight: 'bold' }}>{consumosSeleccionados[item.id] || 0}</span>
                        <button type="button" onClick={() => handleQtyChange(item.id, 1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: '#1e3a8a', color: '#fff', fontWeight: 'bold' }}>+</button>
                      </div>
                    </div>
                  ))}

                  {/* 4. SECCIÓN: LENCERÍA */}
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e3a8a', backgroundColor: '#e0f2fe', padding: '6px 10px', borderRadius: '6px', margin: '14px 0 6px 0', textTransform: 'uppercase' }}>
                    Lencería
                  </div>
                  {inventario.filter(item => {
                    const cat = (item.category || '').toLowerCase();
                    return cat === 'lenceria' || cat === 'lencería';
                  }).map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '8px', width: '100%', boxSizing: 'border-box' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.name}</span>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>${Number(item.price_usd || 0).toFixed(2)} USD</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button type="button" onClick={() => handleQtyChange(item.id, -1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', fontWeight: 'bold' }}>-</button>
                        <span style={{ width: '24px', textAlign: 'center', fontWeight: 'bold' }}>{consumosSeleccionados[item.id] || 0}</span>
                        <button type="button" onClick={() => handleQtyChange(item.id, 1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: '#1e3a8a', color: '#fff', fontWeight: 'bold' }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CAMPO DE NOTIFICACIÓN DE FALTANTE / PIEZA EDITABLE */}
                <div style={{ background: '#fff3cd', padding: '12px', borderRadius: '8px', border: '1px solid #ffeeba', marginTop: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#856404', marginBottom: '4px' }}>
                    ⚠️ NOTIFICAR FALTANTE / DAÑO DE PIEZA (OPCIONAL)
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ej: Control de TV faltante, Toalla dañada..."
                    value={itemPersonalizadoText}
                    onChange={(e) => setItemPersonalizadoText(e.target.value)}
                    style={{ background: '#fff', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>📸 ADJUNTAR EVIDENCIA (FOTO O VIDEO)</label>
                  <input type="file" accept="image/*,video/*" onChange={(e) => setArchivoEvidencia(e.target.files[0] || null)} />
                  {archivoEvidencia && <p style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold', margin: '4px 0 0 0' }}>Archivo seleccionado: {archivoEvidencia.name}</p>}
                </div>

                <button className="primary" onClick={handleEjecutarCheckout} disabled={subiendoArchivo} style={{ marginTop: '10px', width: '100%', padding: '12px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  {subiendoArchivo ? '⏳ Subiendo evidencia y procesando...' : '🚀 PROCESAR CHECK-OUT'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}