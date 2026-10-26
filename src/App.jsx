import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [role, setRole] = useState('recepcion');
  const [habitaciones, setHabitaciones] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomToBill, setRoomToBill] = useState(null);
  const [loading, setLoading] = useState(false);

  // Tasa BCV automática
  const [tasaBCV, setTasaBCV] = useState(65.00);

  const [inventario, setInventario] = useState([
    { id: 'agua', name: 'Agua Mineral 500ml', category: 'minibar', price_usd: 1.00, stock: 100 },
    { id: 'refresco', name: 'Refresco Lata', category: 'minibar', price_usd: 1.50, stock: 80 },
    { id: 'cerveza', name: 'Cerveza Nacional', category: 'minibar', price_usd: 2.00, stock: 120 },
    { id: 'snack', name: 'Snacks / Chocolates', category: 'minibar', price_usd: 1.25, stock: 60 },
    { id: 'toalla_c', name: 'Toalla de Cuerpo', category: 'lenceria', price_usd: 12.00, stock: 40 },
    { id: 'toalla_m', name: 'Toalla de Manos', category: 'lenceria', price_usd: 6.00, stock: 50 },
    { id: 'shampoo', name: 'Kit Shampoo / Jabón', category: 'amenidad', price_usd: 0.80, stock: 200 }
  ]);

  const [personal, setPersonal] = useState([
    { id: 1, nombre: 'María Rodríguez', rol: 'Asistente', turno: 'Mañana (Pisos 3-5)' },
    { id: 2, nombre: 'Carmen Silva', rol: 'Asistente', turno: 'Mañana (Pisos 6-8)' },
    { id: 3, nombre: 'Rosa Gómez', rol: 'Supervisora', turno: 'General (Pisos 3-10)' },
    { id: 4, nombre: 'Ana Pérez', rol: 'Asistente', turno: 'Tarde (Pisos 3-5)' }
  ]);

  const [reportesHistorial, setReportesHistorial] = useState([]);
  const [filtroReporte, setFiltroReporte] = useState('diario');
  const [asistenteSeleccionada, setAsistenteSeleccionada] = useState('');
  const [supervisoraSeleccionada, setSupervisoraSeleccionada] = useState('');
  const [consumosSeleccionados, setConsumosSeleccionados] = useState({});
  
  // Estado para la evidencia multimedia (fotos / videos)
  const [archivoEvidencia, setArchivoEvidencia] = useState(null);

  // Estados para formularios en Administración
  const [nuevoItem, setNuevoItem] = useState({ id: '', name: '', category: 'minibar', price_usd: 0, stock: 0 });
  const [nuevoPersonal, setNuevoPersonal] = useState({ nombre: '', rol: 'Asistente', turno: '' });

  useEffect(() => {
    fetchHabitaciones();
    fetchInventario();
    fetchPersonal();
    fetchReportes();
    sincronizarTasaBCVAutomatico();

    const channel = supabase
      .channel('realtime_hotel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habitaciones' }, () => fetchHabitaciones())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sincronizarTasaBCVAutomatico = async () => {
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/bcv');
      const data = await response.json();
      if (data && data.promedio) {
        setTasaBCV(data.promedio);
      }
    } catch (error) {
      console.error("Usando tasa por defecto o manual.", error);
    }
  };

  const fetchHabitaciones = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('habitaciones').select('*');
      if (!data || data.length === 0) generateDefaultRooms();
      else setHabitaciones(data);
    } catch {
      generateDefaultRooms();
    } finally {
      setLoading(false);
    }
  };

  const fetchInventario = async () => {
    try {
      const { data } = await supabase.from('inventario').select('*');
      if (data && data.length > 0) setInventario(data);
    } catch (e) { console.error(e); }
  };

  const fetchPersonal = async () => {
    try {
      const { data } = await supabase.from('personal').select('*');
      if (data && data.length > 0) setPersonal(data);
    } catch (e) { console.error(e); }
  };

  const fetchReportes = async () => {
    try {
      const { data } = await supabase.from('reportes_consumo').select('*').order('fecha', { ascending: false });
      if (data) setReportesHistorial(data);
    } catch (e) { console.error(e); }
  };

  const generateDefaultRooms = () => {
    const rooms = [];
    for (let f = 3; f <= 9; f++) {
      for (let n = 1; n <= 9; n++) {
        rooms.push({ id: `${f}0${n}`, number: `${f}0${n}`, floor: f, type: n <= 4 ? 'MASTER' : n <= 7 ? 'JUNIOR' : 'SENCILLA', status: 'Disponible', amount: 0, reporte: null });
      }
    }
    const p10 = [
      { num: '1001', type: 'EJECUTIVA' }, { num: '1002', type: 'EJECUTIVA' },
      { num: '1003', type: 'PRESIDENCIAL' }, { num: '1004', type: 'PRESIDENCIAL' }
    ];
    p10.forEach(r => rooms.push({ id: r.num, number: r.num, floor: 10, type: r.type, status: 'Disponible', amount: 0, reporte: null }));
    setHabitaciones(rooms);
  };

  const handleQtyChange = (id, delta) => {
    setConsumosSeleccionados(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('por facturar')) return { bg: '#ef4444', text: '#ffffff' };
    if (s.includes('ocupada')) return { bg: '#99f6e4', text: '#155e75' };
    if (s.includes('reservada')) return { bg: '#fed7aa', text: '#9a3412' };
    if (s.includes('bloqueada')) return { bg: '#ef4444', text: '#ffffff' };
    if (s.includes('sucia')) return { bg: '#fef08a', text: '#854d0e' };
    return { bg: '#bbf7d0', text: '#065f46' };
  };

  const handleEjecutarCheckout = async () => {
    if (!selectedRoom) return;
    if (!asistenteSeleccionada) {
      alert('⚠️ Por favor seleccione la Asistente Encargada.');
      return;
    }

    let totalUSD = 0;
    inventario.forEach(item => {
      const qty = consumosSeleccionados[item.id] || 0;
      totalUSD += qty * item.price_usd;
    });

    const totalBs = totalUSD * tasaBCV;

    const reporteCompleto = {
      asistente: asistenteSeleccionada,
      supervisora: supervisoraSeleccionada || 'N/A',
      fecha: new Date().toISOString(),
      consumos: consumosSeleccionados,
      totalUSD,
      totalBs,
      tasaBCV,
      tieneEvidencia: archivoEvidencia ? archivoEvidencia.name : 'Sin archivo adjunto'
    };

    const newStatus = 'Sucia / Por Facturar';
    const updated = habitaciones.map(h => h.id === selectedRoom.id ? { ...h, status: newStatus, amount: totalUSD, reporte: reporteCompleto } : h);
    setHabitaciones(updated);

    try {
      await supabase.from('habitaciones').upsert({
        id: selectedRoom.id,
        number: selectedRoom.number,
        status: newStatus,
        amount: totalUSD,
        reporte: reporteCompleto
      });

      await supabase.from('reportes_consumo').insert({
        habitacion: selectedRoom.number,
        asistente: asistenteSeleccionada,
        supervisora: supervisoraSeleccionada || 'N/A',
        total_usd: totalUSD,
        total_bs: totalBs,
        tasa_bcv: tasaBCV,
        desglose: consumosSeleccionados
      });
    } catch (e) { console.error(e); }

    alert(`⚠️ Check-out enviado para la Habitación ${selectedRoom.number}. Recepción notificada.`);
    setConsumosSeleccionados({});
    setArchivoEvidencia(null);
    setSelectedRoom(null);
    fetchReportes();
  };

  const handleConfirmarFacturacion = async (roomId) => {
    const updated = habitaciones.map(h => h.id === roomId ? { ...h, status: 'Sucia', amount: 0, reporte: null } : h);
    setHabitaciones(updated);

    try {
      await supabase.from('habitaciones').upsert({ id: roomId, status: 'Sucia', amount: 0, reporte: null });
    } catch (e) { console.error(e); }

    setRoomToBill(null);
    alert('✅ Facturación completada. La habitación pasa a color amarillo (Sucia) para Ama de Llaves.');
  };

  const handleAgregarInventario = async (e) => {
    e.preventDefault();
    if (!nuevoItem.name || !nuevoItem.id) return alert('Complete los datos del producto');
    
    setInventario([...inventario, nuevoItem]);
    try {
      await supabase.from('inventario').upsert(nuevoItem);
    } catch (e) { console.error(e); }
    setNuevoItem({ id: '', name: '', category: 'minibar', price_usd: 0, stock: 0 });
    alert('✅ Producto guardado con éxito.');
  };

  const handleAgregarPersonal = async (e) => {
    e.preventDefault();
    if (!nuevoPersonal.nombre) return alert('Ingrese el nombre del personal');

    const item = { ...nuevoPersonal, id: Date.now() };
    setPersonal([...personal, item]);
    try {
      await supabase.from('personal').insert({ nombre: nuevoPersonal.nombre, rol: nuevoPersonal.rol, turno: nuevoPersonal.turno });
    } catch (e) { console.error(e); }
    setNuevoPersonal({ nombre: '', rol: 'Asistente', turno: '' });
    alert('✅ Personal registrado con éxito.');
  };

  const handleBorrarPersonal = async (id) => {
    if (confirm('¿Desea eliminar este registro de personal?')) {
      setPersonal(personal.filter(p => p.id !== id));
      try {
        await supabase.from('personal').delete().eq('id', id);
      } catch (e) { console.error(e); }
    }
  };

  const habitacionesPendientes = habitaciones.filter(h => (h.status || '').includes('Por Facturar'));

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', color: '#1e293b', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      
      <style>{`
        @keyframes pulseAlert {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.97); }
          100% { opacity: 1; transform: scale(1); }
        }
        .alerta-parpadeante {
          animation: pulseAlert 1s infinite ease-in-out;
        }
      `}</style>

      {/* HEADER */}
      <header style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155', padding: '12px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#f59e0b', color: '#0f172a', padding: '6px 10px', borderRadius: '6px', fontWeight: '900', fontSize: '16px' }}>CS</div>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>HOTEL CÓNDOR SUITES</h1>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Control en Vivo con Sincronización Automática BCV</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', background: '#1e293b', padding: '6px 14px', borderRadius: '8px', border: '1px solid #334155', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 'bold' }}>💵 TASA BCV OFICIAL:</span>
          <span style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold' }}>Bs. {tasaBCV.toFixed(2)}</span>
        </div>

        <div style={{ display: 'flex', backgroundColor: '#1e293b', padding: '4px', borderRadius: '8px', gap: '4px' }}>
          {[
            { id: 'recepcion', label: 'Recepción' },
            { id: 'asistente', label: 'Piso / Móvil' },
            { id: 'supervisora', label: 'Supervisora' },
            { id: 'amadelhaves', label: 'Ama de Llaves' },
            { id: 'admin', label: 'Administración' }
          ].map(m => (
            <button 
              key={m.id} 
              onClick={() => setRole(m.id)}
              style={{
                padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', border: 'none',
                backgroundColor: role === m.id ? '#f59e0b' : 'transparent',
                color: role === m.id ? '#0f172a' : '#cbd5e1'
              }}>
              {m.label}
            </button>
          ))}
        </div>
      </header>

      <main style={{ flex: 1, padding: '16px', maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* VISTA 1: RECEPCIÓN */}
        {role === 'recepcion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <span style={{ background: '#0f172a', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold' }}>
                Total Habitaciones: {habitaciones.length}
              </span>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                <span style={{ padding: '6px 12px', borderRadius: '6px', background: '#bbf7d0', color: '#065f46' }}>Disponible</span>
                <span style={{ padding: '6px 12px', borderRadius: '6px', background: '#99f6e4', color: '#155e75' }}>Ocupada</span>
                <span style={{ padding: '6px 12px', borderRadius: '6px', background: '#fed7aa', color: '#9a3412' }}>Reservada</span>
                <span style={{ padding: '6px 12px', borderRadius: '6px', background: '#fef08a', color: '#854d0e' }}>Sucia</span>
                <span style={{ padding: '6px 12px', borderRadius: '6px', background: '#ef4444', color: '#ffffff' }}>Por Facturar (Alerta)</span>
              </div>
            </div>

            {habitacionesPendientes.length > 0 && (
              <div className="alerta-parpadeante" style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: '8px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#991b1b', fontWeight: 'bold' }}>
                  🔔 ¡ATENCIÓN RECEPCIÓN! Hay {habitacionesPendientes.length} salida(s) pendientes por facturar.
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {habitacionesPendientes.map(h => (
                    <button key={h.id} onClick={() => setRoomToBill(h)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Facturar Hab. {h.number} (${h.amount})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#e2e8f0', color: '#0f172a' }}>
                    <th style={{ padding: '10px', borderRight: '1px solid #cbd5e1' }}>Ubicación</th>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <th key={n} style={{ padding: '10px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>0{n}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(piso => (
                    <tr key={piso} style={{ borderBottom: '1px solid #cbd5e1' }}>
                      <td style={{ padding: '10px', fontWeight: 'bold', background: '#f8fafc', borderRight: '1px solid #cbd5e1' }}>PISO {piso}</td>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(numCol => {
                        const numStr = piso === 10 ? (numCol <= 4 ? `100${numCol}` : null) : `${piso}0${numCol}`;
                        const hab = habitaciones.find(h => h.number === numStr);
                        if (!hab) return <td key={numCol} style={{ background: '#f1f5f9' }}></td>;
                        const colors = getStatusColor(hab.status);
                        const esAlerta = (hab.status || '').includes('Por Facturar');

                        return (
                          <td 
                            key={hab.id} 
                            onClick={() => esAlerta && setRoomToBill(hab)}
                            className={esAlerta ? 'alerta-parpadeante' : ''}
                            style={{ padding: '8px', backgroundColor: colors.bg, color: colors.text, borderRight: '1px solid #cbd5e1', cursor: esAlerta ? 'pointer' : 'default', height: '70px', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 'bold' }}>{hab.number} / {hab.type.substring(0,3)}</div>
                            <div style={{ fontSize: '10px', marginTop: '4px', fontWeight: 'bold' }}>{hab.status}</div>
                            {hab.amount > 0 && (
                              <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '2px' }}>
                                ${hab.amount} USD <br/><small>(Bs. {(hab.amount * tasaBCV).toFixed(2)})</small>
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

        {/* MODAL DE FACTURACIÓN */}
        {roomToBill && roomToBill.reporte && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '500px', width: '100%' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold' }}>🧾 Facturación Check-Out — Habitación {roomToBill.number}</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px 0' }}>
                Asistente: <strong>{roomToBill.reporte.asistente}</strong>
              </p>
              <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 16px 0' }}>
                Evidencia adjunta: <strong>{roomToBill.reporte.tieneEvidencia}</strong>
              </p>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', textTransform: 'uppercase' }}>Consumos Registrados:</h4>
                {Object.entries(roomToBill.reporte.consumos).map(([id, qty]) => {
                  if (qty <= 0) return null;
                  const item = inventario.find(i => i.id === id);
                  return (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', margin: '4px 0' }}>
                      <span>{qty}x {item?.name}</span>
                      <strong>${(qty * (item?.price_usd || 0)).toFixed(2)} USD</strong>
                    </div>
                  );
                })}
                <hr style={{ margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
                  <span>TOTAL EN DÓLARES:</span>
                  <span>${roomToBill.reporte.totalUSD.toFixed(2)} USD</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', color: '#059669', marginTop: '4px' }}>
                  <span>TOTAL EN BOLÍVARES (BCV {tasaBCV.toFixed(2)}):</span>
                  <span>Bs. {roomToBill.reporte.totalBs.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleConfirmarFacturacion(roomToBill.id)} style={{ flex: 1, background: '#059669', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  ✅ Cobrado / Cambiar a Sucia (Amarillo)
                </button>
                <button onClick={() => setRoomToBill(null)} style={{ background: '#cbd5e1', color: '#334155', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: ASISTENTE MÓVIL (CON SECCIÓN DE FOTOS Y VIDEOS) */}
        {role === 'asistente' && (
          <div style={{ maxWidth: '650px', margin: '0 auto', background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Check-Out e Inspección Móvil</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Seleccionar Piso</label>
                <select onChange={(e) => setSelectedRoom(habitaciones.find(h => h.floor === parseInt(e.target.value)) || null)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <option value="">Seleccione piso...</option>
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(p => <option key={p} value={p}>Piso {p}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Asistente Encargada</label>
                <select value={asistenteSeleccionada} onChange={(e) => setAsistenteSeleccionada(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
                  <option value="">Seleccionar Asistente...</option>
                  {personal.filter(p => p.rol === 'Asistente').map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                </select>
              </div>
            </div>

            {selectedRoom && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Habitación del Piso {selectedRoom.floor}</label>
                  <select value={selectedRoom.id} onChange={(e) => setSelectedRoom(habitaciones.find(h => h.id === e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
                    {habitaciones.filter(h => h.floor === selectedRoom.floor).map(h => <option key={h.id} value={h.id}>Habitación {h.number} ({h.type}) — {h.status}</option>)}
                  </select>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase' }}>📦 Consumos de Minibar y Lencería</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {inventario.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <div>
                          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.name}</span>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>${item.price_usd.toFixed(2)} USD (Bs. {(item.price_usd * tasaBCV).toFixed(2)})</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button type="button" onClick={() => handleQtyChange(item.id, -1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', fontWeight: 'bold' }}>-</button>
                          <span style={{ width: '24px', textAlign: 'center', fontWeight: 'bold' }}>{consumosSeleccionados[item.id] || 0}</span>
                          <button type="button" onClick={() => handleQtyChange(item.id, 1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: '#0f172a', color: '#fff', fontWeight: 'bold' }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECCIÓN ADJUNTAR FOTOS O VIDEOS DE EVIDENCIA */}
                <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase' }}>
                    📸 Adjuntar Fotos o Videos de Evidencia (Daños / Estado)
                  </label>
                  <input 
                    type="file" 
                    accept="image/*,video/*"
                    onChange={(e) => setArchivoEvidencia(e.target.files[0])}
                    style={{ width: '100%', fontSize: '12px', color: '#475569' }}
                  />
                  {archivoEvidencia && (
                    <p style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold', margin: '4px 0 0 0' }}>
                      Archivo seleccionado: {archivoEvidencia.name}
                    </p>
                  )}
                </div>

                <button onClick={handleEjecutarCheckout} style={{ width: '100%', background: '#0f172a', color: '#fff', padding: '14px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                  🚨 Ejecutar Check-Out y Activar Alerta en Recepción
                </button>
              </div>
            )}
          </div>
        )}

        {/* VISTA 3: SUPERVISORA */}
        {role === 'supervisora' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>Panel de Control de Supervisoras</h2>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Auditoría e Inspección de Pisos</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {habitaciones.filter(h => h.status !== 'Disponible').map(h => (
                  <div key={h.id} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <span>Habitación {h.number}</span>
                      <span style={{ fontSize: '11px', background: '#0f172a', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>Piso {h.floor}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0' }}>Estado: <strong>{h.status}</strong></p>
                    <button 
                      onClick={() => {
                        supabase.from('habitaciones').upsert({ id: h.id, status: 'Disponible' });
                        fetchHabitaciones();
                      }}
                      style={{ background: '#059669', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', width: '100%', marginTop: '8px' }}>
                      Aprobar Auditoría / Marcar Disponible
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VISTA 4: AMA DE LLAVES */}
        {role === 'amadelhaves' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>Panel de Ama de Llaves</h2>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: '0 0 12px 0' }}>Habitaciones Sucias (Amarillas — Pendientes por Limpieza)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {habitaciones.filter(h => (h.status || '').toLowerCase() === 'sucia').map(h => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef08a', padding: '10px', borderRadius: '6px', border: '1px solid #fde047' }}>
                    <div>
                      <strong style={{ color: '#854d0e' }}>Habitación {h.number}</strong> — Piso {h.floor}
                    </div>
                    <button onClick={() => { supabase.from('habitaciones').upsert({ id: h.id, status: 'Disponible' }); fetchHabitaciones(); }} style={{ background: '#059669', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Marcar Aseada / Disponible
                    </button>
                  </div>
                ))}
                {habitaciones.filter(h => (h.status || '').toLowerCase() === 'sucia').length === 0 && (
                  <p style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>No hay habitaciones sucias en este momento.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VISTA 5: ADMINISTRACIÓN */}
        {role === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>Panel Administrativo e Inventario General</h2>

            {/* SECCIÓN INVENTARIO */}
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>📦 Gestión y Registro de Inventario (Minibar, Lencería, Amenidades)</h3>
              
              <form onSubmit={handleAgregarInventario} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input placeholder="ID único (ej: agua)" value={nuevoItem.id} onChange={e => setNuevoItem({...nuevoItem, id: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                <input placeholder="Nombre del producto..." value={nuevoItem.name} onChange={e => setNuevoItem({...nuevoItem, name: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 1 }} />
                <select value={nuevoItem.category} onChange={e => setNuevoItem({...nuevoItem, category: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="minibar">Minibar</option>
                  <option value="lenceria">Lencería</option>
                  <option value="amenidad">Amenidad</option>
                </select>
                <input type="number" step="0.01" placeholder="Precio ($ USD)" value={nuevoItem.price_usd || ''} onChange={e => setNuevoItem({...nuevoItem, price_usd: parseFloat(e.target.value) || 0})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '110px' }} />
                <input type="number" placeholder="Stock" value={nuevoItem.stock || ''} onChange={e => setNuevoItem({...nuevoItem, stock: parseInt(e.target.value) || 0})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '90px' }} />
                <button type="submit" style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>+ Guardar Producto</button>
              </form>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '8px' }}>Producto</th>
                    <th style={{ padding: '8px' }}>Categoría</th>
                    <th style={{ padding: '8px' }}>Precio ($ USD)</th>
                    <th style={{ padding: '8px' }}>Precio (Bs. BCV {tasaBCV.toFixed(2)})</th>
                    <th style={{ padding: '8px' }}>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {inventario.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{item.name}</td>
                      <td style={{ padding: '8px', textTransform: 'uppercase', fontSize: '11px', color: '#64748b' }}>{item.category}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: '#059669' }}>${item.price_usd.toFixed(2)} USD</td>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>Bs. {(item.price_usd * tasaBCV).toFixed(2)}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{item.stock} unids.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SECCIÓN PERSONAL (ASISTENTES Y SUPERVISORAS) */}
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>👥 Registro de Personal (Asistentes y Supervisoras)</h3>
              
              <form onSubmit={handleAgregarPersonal} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input placeholder="Nombre completo..." value={nuevoPersonal.nombre} onChange={e => setNuevoPersonal({...nuevoPersonal, nombre: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 1 }} />
                <select value={nuevoPersonal.rol} onChange={e => setNuevoPersonal({...nuevoPersonal, rol: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="Asistente">Asistente</option>
                  <option value="Supervisora">Supervisora</option>
                </select>
                <input placeholder="Turno / Pisos asignados..." value={nuevoPersonal.turno} onChange={e => setNuevoPersonal({...nuevoPersonal, turno: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 1 }} />
                <button type="submit" style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>+ Registrar Personal</button>
              </form>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '8px' }}>Nombre</th>
                    <th style={{ padding: '8px' }}>Rol</th>
                    <th style={{ padding: '8px' }}>Turno / Asignación</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {personal.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{p.nombre}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: p.rol === 'Supervisora' ? '#fef3c7' : '#e2e8f0', color: p.rol === 'Supervisora' ? '#92400e' : '#334155', fontWeight: 'bold' }}>
                          {p.rol}
                        </span>
                      </td>
                      <td style={{ padding: '8px', color: '#64748b' }}>{p.turno}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button onClick={() => handleBorrarPersonal(p.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SECCIÓN REPORTES */}
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>📊 Reportes de Consumo y Reposición</h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['diario', 'semanal', 'mensual'].map(f => (
                    <button key={f} onClick={() => setFiltroReporte(f)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', textTransform: 'capitalize', fontWeight: 'bold', background: filtroReporte === f ? '#0f172a' : '#f8fafc', color: filtroReporte === f ? '#fff' : '#334155', cursor: 'pointer' }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '8px' }}>Fecha</th>
                    <th style={{ padding: '8px' }}>Habitación</th>
                    <th style={{ padding: '8px' }}>Asistente</th>
                    <th style={{ padding: '8px' }}>Supervisora</th>
                    <th style={{ padding: '8px' }}>Total ($ USD)</th>
                    <th style={{ padding: '8px' }}>Total (Bs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportesHistorial.map(rep => (
                    <tr key={rep.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px' }}>{new Date(rep.fecha).toLocaleString()}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>Hab. {rep.habitacion}</td>
                      <td style={{ padding: '8px' }}>{rep.asistente}</td>
                      <td style={{ padding: '8px' }}>{rep.supervisora}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: '#059669' }}>${parseFloat(rep.total_usd).toFixed(2)} USD</td>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>Bs. {parseFloat(rep.total_bs).toFixed(2)}</td>
                    </tr>
                  ))}
                  {reportesHistorial.length === 0 && (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>No hay consumos registrados aún.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}