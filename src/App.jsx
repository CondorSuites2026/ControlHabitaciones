import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [role, setRole] = useState('recepcion');
  const [habitaciones, setHabitaciones] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomToBill, setRoomToBill] = useState(null); // Habitación seleccionada para facturar
  const [loading, setLoading] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('Todas');

  // Asistentes por piso
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

  // Lista de Minibar con precios
  const minibarStock = [
    { id: 'agua', name: 'Agua Mineral 500ml', price: 3.50 },
    { id: 'refresco', name: 'Refresco Lata', price: 4.00 },
    { id: 'cerveza', name: 'Cerveza Nacional', price: 5.50 },
    { id: 'snack', name: 'Snacks / Chocolates', price: 4.50 },
  ];

  // Lista de Lencería con costos de reposición
  const lenceriaList = [
    { id: 'toalla_c', name: 'Toalla de Cuerpo', price: 15.00 },
    { id: 'toalla_m', name: 'Toalla de Manos', price: 8.00 },
    { id: 'sabana_k', name: 'Juego de Sábana King/Master', price: 35.00 },
    { id: 'almohada', name: 'Funda de Almohada', price: 5.00 },
    { id: 'bata', name: 'Bata de Baño', price: 25.00 },
  ];

  // Cantidades temporales en el módulo de Asistente
  const [consumoMinibar, setConsumoMinibar] = useState({ agua: 0, refresco: 0, cerveza: 0, snack: 0 });
  const [faltantesLenceria, setFaltantesLenceria] = useState({ toalla_c: 0, toalla_m: 0, sabana_k: 0, almohada: 0, bata: 0 });

  useEffect(() => {
    fetchHabitaciones();

    // Sincronización en tiempo real con Supabase
    const channel = supabase
      .channel('realtime_habitaciones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habitaciones' }, () => {
        fetchHabitaciones();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
          reporte: null
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
        reporte: null
      });
    });
    setHabitaciones(rooms);
  };

  const handleMinibarQty = (id, delta) => {
    setConsumoMinibar(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
  };

  const handleLenceriaQty = (id, delta) => {
    setFaltantesLenceria(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Disponible': return { bg: '#bbf7d0', text: '#065f46' };
      case 'Ocupada': return { bg: '#99f6e4', text: '#155e75' };
      case 'Reservada': return { bg: '#fed7aa', text: '#9a3412' };
      case 'Bloqueada': return { bg: '#ef4444', text: '#ffffff' };
      case 'Sucia / Por Facturar': return { bg: '#fef08a', text: '#854d0e' }; // Alerta para recepción
      default: return { bg: '#e2e8f0', text: '#334155' };
    }
  };

  // Guardar reporte y enviar alerta a Recepción
  const handleEjecutarCheckout = async () => {
    if (!selectedRoom) return;

    // Calcular total de consumo
    let totalMinibar = 0;
    minibarStock.forEach(item => {
      totalMinibar += (consumoMinibar[item.id] || 0) * item.price;
    });

    let totalLenceria = 0;
    lenceriaList.forEach(item => {
      totalLenceria += (faltantesLenceria[item.id] || 0) * item.price;
    });

    const totalCalculado = totalMinibar + totalLenceria;
    const encargada = asistentesPiso[selectedRoom.floor] || 'Asistente Integral';

    const reporteCompleto = {
      asistente: encargada,
      fecha: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      consumoMinibar,
      faltantesLenceria,
      subtotalMinibar: totalMinibar,
      subtotalLenceria: totalLenceria,
      total: totalCalculado
    };

    const newStatus = 'Sucia / Por Facturar';
    const updated = habitaciones.map(h => {
      if (h.id === selectedRoom.id) {
        return { ...h, status: newStatus, amount: totalCalculado.toFixed(2), reporte: reporteCompleto };
      }
      return h;
    });
    setHabitaciones(updated);

    try {
      await supabase.from('habitaciones').upsert({
        id: selectedRoom.id,
        number: selectedRoom.number,
        status: newStatus,
        amount: totalCalculado.toFixed(2),
        reporte: reporteCompleto
      });
    } catch (e) {
      console.error(e);
    }

    alert(`⚠️ ALERTA ENVIADA A RECEPCIÓN ⚠️\n\nCheck-out reportado por ${encargada} para la Habitación ${selectedRoom.number}.\nTotal Consumos / Cargos: Bs. ${totalCalculado.toFixed(2)}`);
    
    // Resetear contadores
    setConsumoMinibar({ agua: 0, refresco: 0, cerveza: 0, snack: 0 });
    setFaltantesLenceria({ toalla_c: 0, toalla_m: 0, sabana_k: 0, almohada: 0, bata: 0 });
    setSelectedRoom(null);
  };

  // Recepción procesa el pago y pasa a disponible o sucia normal
  const handleConfirmarFacturacion = async (roomId) => {
    const updated = habitaciones.map(h => {
      if (h.id === roomId) {
        return { ...h, status: 'Sucia', guest: '', amount: '0.00', reporte: null };
      }
      return h;
    });
    setHabitaciones(updated);

    try {
      await supabase.from('habitaciones').upsert({
        id: roomId,
        number: roomId,
        status: 'Sucia',
        guest: '',
        amount: '0.00',
        reporte: null
      });
    } catch (e) {
      console.error(e);
    }

    setRoomToBill(null);
    alert('✅ Facturación completada. La habitación pasa a Ama de Llaves para limpieza final.');
  };

  const habitacionesPendientesFacturar = habitaciones.filter(h => h.status === 'Sucia / Por Facturar');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', color: '#1e293b', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* HEADER PRINCIPAL CON BOTONES Y BADGE DE ALERTAS */}
      <header style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155', padding: '12px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#f59e0b', color: '#0f172a', padding: '6px 10px', borderRadius: '6px', fontWeight: '900', fontSize: '16px' }}>CS</div>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>HOTEL CÓNDOR SUITES</h1>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Sistema Integral en Vivo — Lechería</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Badge Alerta Recepción */}
          {habitacionesPendientesFacturar.length > 0 && (
            <div style={{ background: '#ef4444', color: '#fff', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>
              ⚠️ {habitacionesPendientesFacturar.length} Check-out por facturar
            </div>
          )}

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
                  color: role === r ? '#0f172a' : '#cbd5e1'
                }}>
                {r === 'recepcion' && 'Recepción (PC)'}
                {r === 'asistente' && 'Piso / Móvil'}
                {r === 'amadelhaves' && 'Ama de Llaves'}
                {r === 'admin' && 'Administración'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: '16px', maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* VISTA 1: RECEPCIÓN CON ALERTA DE FACTURACIÓN */}
        {role === 'recepcion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* BANNER DE ALERTA DE CHECK-OUT EN RECEPCIÓN */}
            {habitacionesPendientesFacturar.length > 0 && (
              <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: '8px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ color: '#991b1b', fontWeight: 'bold', fontSize: '14px' }}>
                  🔔 ¡ATENCIÓN RECEPCIÓN! Se han registrado {habitacionesPendientesFacturar.length} salida(s) con consumos pendientes por cobrar.
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {habitacionesPendientesFacturar.map(h => (
                    <button 
                      key={h.id}
                      onClick={() => setRoomToBill(h)}
                      style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                      Facturar Hab. {h.number} (Bs. {h.amount})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Matriz Completa por Pisos */}
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
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(piso => (
                    <tr key={piso} style={{ borderBottom: '1px solid #cbd5e1' }}>
                      <td style={{ padding: '10px', fontWeight: 'bold', background: '#f8fafc', borderRight: '1px solid #cbd5e1', color: '#0f172a' }}>
                        PISO {piso < 10 ? `0${piso}` : piso}
                      </td>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(numCol => {
                        const numHabStr = piso === 10 ? (numCol === 1 ? '1001' : numCol === 2 ? '1002' : numCol === 3 ? '1003' : numCol === 4 ? '1004' : null) : `${piso}0${numCol}`;
                        const hab = habitaciones.find(h => h.number === numHabStr);

                        if (!hab) return <td key={numCol} style={{ background: '#f1f5f9', borderRight: '1px solid #cbd5e1' }}></td>;

                        const colors = getStatusColor(hab.status);

                        return (
                          <td 
                            key={hab.id}
                            onClick={() => {
                              if (hab.status === 'Sucia / Por Facturar') setRoomToBill(hab);
                            }}
                            style={{
                              padding: '8px',
                              backgroundColor: colors.bg,
                              color: colors.text,
                              borderRight: '1px solid #cbd5e1',
                              cursor: hab.status === 'Sucia / Por Facturar' ? 'pointer' : 'default',
                              verticalAlign: 'top',
                              height: '75px'
                            }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px' }}>
                              <span>{hab.number} / {hab.type.substring(0,3)}</span>
                            </div>
                            <div style={{ fontSize: '10px', marginTop: '4px', fontWeight: 'bold' }}>{hab.status}</div>
                            {hab.amount !== '0.00' && (
                              <div style={{ fontSize: '10px', color: '#b91c1c', fontWeight: '900', marginTop: '2px' }}>
                                Bs. {hab.amount}
                              </div>
                            )}
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

        {/* MODAL DE FACTURACIÓN PARA RECEPCIÓN */}
        {roomToBill && roomToBill.reporte && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '500px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>
                🧾 Comanda de Check-Out — Habitación {roomToBill.number}
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>
                Reportado por: <strong>{roomToBill.reporte.asistente}</strong> a las {roomToBill.reporte.fecha}
              </p>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '13px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', textTransform: 'uppercase', color: '#0f172a' }}>Desglose de Consumos:</h4>
                
                {/* Consumos Minibar */}
                {Object.entries(roomToBill.reporte.consumoMinibar).map(([id, qty]) => {
                  if (qty <= 0) return null;
                  const item = minibarStock.find(i => i.id === id);
                  return (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                      <span>{qty}x {item?.name}</span>
                      <strong>Bs. {(qty * (item?.price || 0)).toFixed(2)}</strong>
                    </div>
                  );
                })}

                {/* Faltantes Lencería */}
                {Object.entries(roomToBill.reporte.faltantesLenceria).map(([id, qty]) => {
                  if (qty <= 0) return null;
                  const item = lenceriaList.find(i => i.id === id);
                  return (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', color: '#b91c1c' }}>
                      <span>{qty}x {item?.name} (Daño/Faltante)</span>
                      <strong>Bs. {(qty * (item?.price || 0)).toFixed(2)}</strong>
                    </div>
                  );
                })}

                <hr style={{ margin: '10px 0', borderColor: '#cbd5e1' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold' }}>
                  <span>TOTAL A COBRAR EN RECEPCIÓN:</span>
                  <span style={{ color: '#059669' }}>Bs. {roomToBill.reporte.total.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => handleConfirmarFacturacion(roomToBill.id)}
                  style={{ flex: 1, background: '#059669', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  ✅ Cobrado / Confirmar Factura
                </button>
                <button 
                  onClick={() => setRoomToBill(null)}
                  style={{ background: '#cbd5e1', color: '#334155', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: ASISTENTE MÓVIL (BARRAS DE BOTONES + Y -) */}
        {role === 'asistente' && (
          <div style={{ maxWidth: '650px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#0f172a' }}>Check-Out e Inspección Móvil</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Marque los consumos de minibar o faltantes y envíe la alerta directa a Recepción.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                    {[3, 4, 5, 6, 7, 8, 9, 10].map(p => (
                      <option key={p} value={p}>Piso {p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Asistente Encargada</label>
                  <input 
                    type="text" 
                    readOnly
                    value={selectedRoom ? (asistentesPiso[selectedRoom.floor] || 'Asistente Integral') : 'Seleccione piso'}
                    style={{ width: '100%', backgroundColor: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 'bold' }}
                  />
                </div>
              </div>

              {selectedRoom && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', backgroundColor: '#f8fafc', padding: '18px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Habitación a Inspeccionar</label>
                    <select 
                      value={selectedRoom.id}
                      onChange={(e) => {
                        const r = habitaciones.find(item => item.id === e.target.value);
                        setSelectedRoom(r);
                      }}
                      style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 'bold' }}>
                      {habitaciones.filter(h => h.floor === selectedRoom.floor).map(h => (
                        <option key={h.id} value={h.id}>Habitación {h.number} ({h.type}) — {h.status}</option>
                      ))}
                    </select>
                  </div>

                  {/* MINIBAR */}
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px' }}>📦 Consumo de Minibar</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {minibarStock.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>{item.name} <small style={{ color: '#64748b' }}>(Bs. {item.price.toFixed(2)})</small></span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button type="button" onClick={() => handleMinibarQty(item.id, -1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>-</button>
                            <span style={{ width: '24px', textAlign: 'center', fontWeight: 'bold' }}>{consumoMinibar[item.id] || 0}</span>
                            <button type="button" onClick={() => handleMinibarQty(item.id, 1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', backgroundColor: '#0f172a', color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* LENCERÍA */}
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px' }}>🧺 Lencería Faltante / Dañada</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {lenceriaList.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>{item.name} <small style={{ color: '#64748b' }}>(Bs. {item.price.toFixed(2)})</small></span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button type="button" onClick={() => handleLenceriaQty(item.id, -1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>-</button>
                            <span style={{ width: '24px', textAlign: 'center', fontWeight: 'bold' }}>{faltantesLenceria[item.id] || 0}</span>
                            <button type="button" onClick={() => handleLenceriaQty(item.id, 1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', backgroundColor: '#f59e0b', color: '#0f172a', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={handleEjecutarCheckout}
                    style={{ width: '100%', backgroundColor: '#0f172a', color: '#fff', fontWeight: 'bold', padding: '14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', marginTop: '8px' }}>
                    🚨 Ejecutar Check-Out y Alertar a Recepción
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}