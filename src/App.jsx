import React, { useState, useEffect } from 'react';

// Safe extraction of Supabase environment variables without triggering esbuild import.meta issues
const getEnvVar = (key) => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {
    // Ignore error
  }
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

const getSupabaseClient = () => {
  if (typeof window !== 'undefined' && window.supabase && supabaseUrl && supabaseAnonKey) {
    return window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  
  const createMockQuery = () => {
    const query = {
      select: () => query,
      order: () => query,
      eq: () => query,
      upsert: () => Promise.resolve({ data: null, error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => query,
      delete: () => query,
      then: (onfulfilled) => Promise.resolve({ data: [], error: null }).then(onfulfilled),
      catch: (onrejected) => Promise.resolve({ data: [], error: null }).catch(onrejected)
    };
    return query;
  };

  return {
    from: () => createMockQuery(),
    channel: () => ({
      on: () => ({ subscribe: () => {} }),
      subscribe: () => {}
    }),
    removeChannel: () => {},
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
        getPublicUrl: (path) => ({ data: { publicUrl: path } })
      })
    }
  };
};

const supabase = getSupabaseClient();

export default function App() {
  const [role, setRole] = useState('recepcion');
  const [habitaciones, setHabitaciones] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomToBill, setRoomToBill] = useState(null);
  const [roomToEditStatus, setRoomToEditStatus] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(3);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
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
    { id: 1, nombre: 'María Rodríguez', rol: 'Asistente', turno: 'Mañana (Pisos 3-5)' }
  ]);

  const [reportesHistorial, setReportesHistorial] = useState([]);
  const [asistenteSeleccionada, setAsistenteSeleccionada] = useState('');
  const [consumosSeleccionados, setConsumosSeleccionados] = useState({});
  const [archivoEvidencia, setArchivoEvidencia] = useState(null);

  const [nuevoItem, setNuevoItem] = useState({ id: '', name: '', category: 'minibar', price_usd: 0, stock: 0 });
  const [editandoItem, setEditandoItem] = useState(null);
  const [nuevoPersonal, setNuevoPersonal] = useState({ nombre: '', rol: 'Asistente', turno: '' });

  useEffect(() => {
    inicializarApp();
    sincronizarTasaBCVOnline();

    const interval = setInterval(() => {
      fetchHabitacionesSilencioso();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const inicializarApp = async () => {
    await fetchHabitaciones();
    fetchInventario();
    fetchPersonal();
    fetchReportes();
  };

  const sincronizarTasaBCVOnline = async () => {
    const endpoints = [
      'https://ve.dolarapi.com/v1/dolares/oficial',
      'https://pydolarvenezuela-api.vercel.app/api/v1/dollar/unit/bcv'
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) continue;
        const data = await response.json();
        
        const price = data.promedio || data.price;
        if (price && !isNaN(price)) {
          setTasaBCV(parseFloat(price));
          return;
        }
      } catch (error) {
        // Continue fallback
      }
    }
  };

  const getDefaultRoomsArray = () => {
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
    return rooms;
  };

  const fetchHabitaciones = async () => {
    try {
      const { data, error } = await supabase.from('habitaciones').select('*');
      if (error || !data || data.length === 0) {
        const defaultRooms = getDefaultRoomsArray();
        setHabitaciones(defaultRooms);
        for (const room of defaultRooms) {
          await supabase.from('habitaciones').upsert(room);
        }
      } else {
        setHabitaciones(data);
      }
    } catch {
      setHabitaciones(getDefaultRoomsArray());
    }
  };

  const fetchHabitacionesSilencioso = async () => {
    try {
      const { data } = await supabase.from('habitaciones').select('*');
      if (data && data.length > 0) setHabitaciones(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchInventario = async () => {
    try {
      const { data, error } = await supabase.from('inventario').select('*');
      if (!error && data && data.length > 0) setInventario(data);
    } catch (e) { console.error(e); }
  };

  const fetchPersonal = async () => {
    try {
      const { data, error } = await supabase.from('personal').select('*');
      if (!error && data && data.length > 0) setPersonal(data);
    } catch (e) { console.error(e); }
  };

  const fetchReportes = async () => {
    try {
      const { data } = await supabase.from('reportes_consumo').select('*').order('fecha', { ascending: false });
      if (data) setReportesHistorial(data);
    } catch (e) { console.error(e); }
  };

  const handleAgregarPersonal = async (e) => {
    e.preventDefault();
    if (!nuevoPersonal.nombre.trim() || !nuevoPersonal.turno.trim()) {
      return alert('⚠️ Ingrese el nombre y el turno del personal.');
    }
    
    // Objeto limpio sin enviar ID manual para que Supabase autogenere el correlativo
    const nuevoObj = {
      nombre: nuevoPersonal.nombre.trim(),
      rol: nuevoPersonal.rol,
      turno: nuevoPersonal.turno.trim()
    };

    try {
      const { error } = await supabase.from('personal').insert([nuevoObj]);
      if (error) throw error;
      
      await fetchPersonal();
      setNuevoPersonal({ nombre: '', rol: 'Asistente', turno: '' });
      alert(`✅ Personal (${nuevoObj.nombre}) agregado y guardado en Supabase exitosamente.`);
    } catch (err) {
      console.error('Error al guardar personal:', err);
      alert('❌ Error al guardar en Supabase: ' + (err.message || 'Verifique conexión o permisos RLS'));
    }
  };

  const handleEliminarPersonal = async (id) => {
    if (!confirm('¿Desea eliminar a este integrante del personal?')) return;
    try {
      await supabase.from('personal').delete().eq('id', id);
      setPersonal(prev => prev.filter(p => p.id !== id));
      alert('🗑️ Personal eliminado.');
    } catch (err) {
      setPersonal(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleEliminarInventario = async (id) => {
    if (!confirm('¿Desea eliminar este producto del inventario?')) return;
    try {
      await supabase.from('inventario').delete().eq('id', id);
      setInventario(prev => prev.filter(i => i.id !== id));
      alert('🗑️ Producto eliminado.');
    } catch (err) {
      setInventario(prev => prev.filter(i => i.id !== id));
    }
  };

  const handleActualizarPrecioInventario = async (item) => {
    try {
      const { error } = await supabase.from('inventario').upsert(item);
      if (error) throw error;
      setInventario(prev => prev.map(i => i.id === item.id ? item : i));
      setEditandoItem(null);
      alert('✅ Producto actualizado exitosamente.');
    } catch (err) {
      alert('❌ Error al actualizar producto: ' + err.message);
    }
  };

  const handleQtyChange = (id, delta) => {
    setConsumosSeleccionados(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  const getStatusClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('por facturar') || s.includes('sucia / por facturar')) return 'badge-danger';
    if (s.includes('ocupada')) return 'badge-ocupada';
    if (s.includes('reservada')) return 'badge-reservada';
    if (s.includes('sucia')) return 'badge-sucia';
    return 'badge-disponible';
  };

  const subirEvidenciaASupabase = async (file) => {
    if (!file) return null;
    try {
      setSubiendoArchivo(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `evidencia_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `checkout_evidencias/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('evidencias').upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

      if (uploadError) return null;

      const { data } = supabase.storage.from('evidencias').getPublicUrl(filePath);
      return {
        url: data?.publicUrl || '',
        tipo: file.type.startsWith('video') ? 'video' : 'imagen',
        nombre: file.name
      };
    } catch (err) {
      return null;
    } finally {
      setSubiendoArchivo(false);
    }
  };

  const handleEjecutarCheckout = async () => {
    if (!selectedRoom) {
      alert('⚠️ Por favor seleccione una habitación.');
      return;
    }
    if (!asistenteSeleccionada) {
      alert('⚠️ Por favor seleccione la Asistente Encargada.');
      return;
    }

    try {
      let totalUSD = 0;
      inventario.forEach(item => {
        const qty = consumosSeleccionados[item.id] || 0;
        totalUSD += qty * item.price_usd;
      });

      const totalBs = totalUSD * tasaBCV;
      let datosEvidencia = null;

      if (archivoEvidencia) {
        datosEvidencia = await subirEvidenciaASupabase(archivoEvidencia);
      }

      const reporteCompleto = {
        asistente: asistenteSeleccionada,
        supervisora: 'N/A',
        fecha: new Date().toISOString(),
        consumos: { ...consumosSeleccionados },
        totalUSD,
        totalBs,
        tasaBCV,
        evidencia: datosEvidencia
      };

      const newStatus = 'Sucia / Por Facturar';
      const roomTargetId = selectedRoom.id;

      const { error: errorHab } = await supabase.from('habitaciones').upsert({
        id: roomTargetId,
        number: selectedRoom.number,
        floor: selectedRoom.floor,
        type: selectedRoom.type,
        status: newStatus,
        amount: totalUSD,
        reporte: reporteCompleto
      });

      if (errorHab) throw errorHab;

      await supabase.from('reportes_consumo').insert({
        habitacion: selectedRoom.number,
        asistente: asistenteSeleccionada,
        supervisora: 'N/A',
        total_usd: totalUSD,
        total_bs: totalBs,
        tasa_bcv: tasaBCV,
        desglose: consumosSeleccionados
      });

      setHabitaciones(prev => prev.map(h => h.id === roomTargetId || h.number === selectedRoom.number ? {
        ...h,
        status: newStatus,
        amount: totalUSD,
        reporte: reporteCompleto
      } : h));

      alert(`✅ Check-out ejecutado exitosamente para la Habitación ${selectedRoom.number}.`);
      setConsumosSeleccionados({});
      setArchivoEvidencia(null);
      setSelectedRoom(null);
      await fetchHabitaciones();
      fetchReportes();
    } catch (e) {
      alert('❌ Error al procesar el check-out: ' + (e.message || 'Error desconocido'));
    } finally {
      setSubiendoArchivo(false);
    }
  };

  const handleConfirmarFacturacion = async (roomItem) => {
    try {
      const targetId = roomItem.id;
      await supabase.from('habitaciones').update({ status: 'Sucia', amount: 0, reporte: null }).eq('id', targetId);
      
      setHabitaciones(prev => prev.map(h => h.id === targetId || h.number === roomItem.number ? {
        ...h,
        status: 'Sucia',
        amount: 0,
        reporte: null
      } : h));

      setRoomToBill(null);
      await fetchHabitaciones();
      alert('✅ Facturación completada. La habitación pasa a Sucia.');
    } catch (e) {
      alert('Error al confirmar facturación.');
    }
  };

  const handleCambiarEstadoHabitacion = async (roomItem, nuevoEstado) => {
    try {
      const targetId = roomItem.id;
      await supabase.from('habitaciones').update({ status: nuevoEstado }).eq('id', targetId);

      setHabitaciones(prev => prev.map(h => h.id === targetId || h.number === roomItem.number ? {
        ...h,
        status: nuevoEstado
      } : h));

      setRoomToEditStatus(null);
      await fetchHabitaciones();
      alert(`✅ Habitación ${roomItem.number} actualizada a: ${nuevoEstado}`);
    } catch (e) {
      alert('Error al actualizar estado.');
    }
  };

  const habitacionesPendientes = habitaciones.filter(h => {
    const st = (h.status || '').toLowerCase();
    return st.includes('por facturar') || st.includes('sucia / por facturar');
  });

  return (
    <div className="app-container">
      <style>{`
        body { margin: 0; background-color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; color: #1e293b; }
        .app-container { min-height: 100vh; display: flex; flex-direction: column; }
        header { background-color: #1e3a8a; border-bottom: 1px solid #3b82f6; padding: 12px 20px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; color: #fff; }
        .logo-box { display: flex; align-items: center; gap: 10px; background: #ffffff; padding: 4px 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .nav-buttons { display: flex; background: #1d4ed8; padding: 4px; border-radius: 8px; gap: 4px; flex-wrap: wrap; }
        .nav-btn { padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer; border: none; background: transparent; color: #e2e8f0; }
        .nav-btn.active { background: #f59e0b; color: #0f172a; }
        main { flex: 1; padding: 16px; max-width: 1440px; margin: 0 auto; width: 100%; box-sizing: border-box; }
        .bcv-box { display: flex; align-items: center; background: #1d4ed8; padding: 6px 12px; border-radius: 8px; border: 1px solid #3b82f6; gap: 8px; color: #fef08a; font-weight: bold; font-size: 12px; }
        .btn-update { background: #f59e0b; color: #0f172a; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px; }
        
        .badge-disponible { background: #bbf7d0; color: #065f46; }
        .badge-ocupada { background: #99f6e4; color: #155e75; }
        .badge-reservada { background: #fed7aa; color: #9a3412; }
        .badge-sucia { background: #fef08a; color: #854d0e; }
        .badge-danger { background: #ef4444; color: #ffffff; }

        @keyframes pulseAlert { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.97); } 100% { opacity: 1; transform: scale(1); } }
        .alerta-parpadeante { animation: pulseAlert 1s infinite ease-in-out; }

        table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; background: #fff; border-radius: 8px; }
        th, td { padding: 10px; border: 1px solid #cbd5e1; }
        th { background: #e2e8f0; color: #0f172a; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 16px; }
        .modal-card { background: #fff; padding: 24px; border-radius: 12px; max-width: 520px; width: 100%; max-height: 90vh; overflow-y: auto; }
        .card-box { background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #cbd5e1; display: flex; flex-direction: column; gap: 16px; }
        input, select { padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box; }
        button.primary { background: #1e3a8a; color: #fff; padding: 12px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; width: 100%; transition: opacity 0.2s; }
        button.primary:disabled { opacity: 0.6; cursor: not-allowed; }
        button.success { background: #059669; color: #fff; padding: 12px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; }
      `}</style>

      {/* HEADER */}
      <header>
        <div className="logo-box">
          <svg width="150" height="42" viewBox="0 0 500 180" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', maxWidth: '100%', height: 'auto' }}>
            <text x="110" y="45" fontFamily="'Times New Roman', Times, serif" fontSize="48" fontWeight="bold" fill="#000000" letterSpacing="2">HOTEL</text>
            <text x="15" y="115" fontFamily="'Times New Roman', Times, serif" fontSize="82" fontWeight="bold" fill="#000000" letterSpacing="1">CONDOR</text>
            <text x="215" y="155" fontFamily="'Times New Roman', Times, serif" fontSize="38" fontWeight="bold" fill="#000000" letterSpacing="8">SUITES</text>
            <g transform="translate(385, 10)">
              <path d="M 0 0 L 80 120 C 90 135 105 125 95 105 L 15 0 Z" fill="#000000" />
              <path d="M 25 25 L 95 130 C 105 145 120 135 110 115 L 40 25 Z" fill="#000000" />
            </g>
          </svg>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="bcv-box">
            <span>💵 BCV:</span>
            <span style={{ color: '#fff' }}>Bs. {tasaBCV.toFixed(2)}</span>
          </div>

          <button 
            onClick={() => setRole('asistente')}
            className="btn-update"
            style={{ background: role === 'asistente' ? '#10b981' : '#f59e0b', color: role === 'asistente' ? '#fff' : '#0f172a' }}>
            📱 Asistente Móvil
          </button>
        </div>

        <div className="nav-buttons">
          {[
            { id: 'recepcion', label: 'Recepción' },
            { id: 'supervisora', label: 'Supervisora' },
            { id: 'amadelhaves', label: 'Ama de Llaves' },
            { id: 'admin', label: 'Administración' }
          ].map(m => (
            <button 
              key={m.id} 
              onClick={() => setRole(m.id)}
              className={`nav-btn ${role === m.id ? 'active' : ''}`}>
              {m.label}
            </button>
          ))}
        </div>
      </header>

      <main>
        {/* VISTA 1: RECEPCIÓN */}
        {role === 'recepcion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {habitacionesPendientes.length > 0 && (
              <div className="alerta-parpadeante" style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: '8px', padding: '14px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
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
              <table>
                <thead>
                  <tr>
                    <th>Ubicación</th>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <th key={n} style={{ textAlign: 'center' }}>0{n}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(piso => (
                    <tr key={piso}>
                      <td style={{ fontWeight: 'bold', background: '#f1f5f9' }}>PISO {piso}</td>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(numCol => {
                        const numStr = piso === 10 ? (numCol <= 4 ? `100${numCol}` : null) : `${piso}0${numCol}`;
                        const hab = habitaciones.find(h => h.number === numStr);
                        if (!hab) return <td key={numCol} style={{ background: '#f8fafc' }}></td>;
                        const badgeClass = getStatusClass(hab.status);
                        const esAlerta = (hab.status || '').toLowerCase().includes('por facturar');

                        return (
                          <td 
                            key={hab.id} 
                            onClick={() => {
                              if (esAlerta) setRoomToBill(hab);
                              else setRoomToEditStatus(hab);
                            }}
                            className={`${badgeClass} ${esAlerta ? 'alerta-parpadeante' : ''}`}
                            style={{ cursor: 'pointer', height: '70px', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 'bold' }}>{hab.number} / {(hab.type || '').substring(0,3)}</div>
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

        {/* MODAL CAMBIAR ESTADO / OCUPAR */}
        {roomToEditStatus && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>🏨 Gestionar Habitación {roomToEditStatus.number}</h3>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Estado actual: <strong>{roomToEditStatus.status}</strong></p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button className="primary" onClick={() => handleCambiarEstadoHabitacion(roomToEditStatus, 'Ocupada')} style={{ background: '#0284c7' }}>
                  🔴 Marcar como OCUPADA
                </button>
                <button className="primary" onClick={() => handleCambiarEstadoHabitacion(roomToEditStatus, 'Reservada')} style={{ background: '#d97706' }}>
                  🟡 Marcar como RESERVADA
                </button>
                <button className="primary" onClick={() => handleCambiarEstadoHabitacion(roomToEditStatus, 'Disponible')} style={{ background: '#059669' }}>
                  🟢 Marcar como DISPONIBLE
                </button>
                <button onClick={() => setRoomToEditStatus(null)} style={{ background: '#cbd5e1', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE FACTURACIÓN */}
        {roomToBill && roomToBill.reporte && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>🧾 Facturación Check-Out — Habitación {roomToBill.number}</h3>
              <p style={{ fontSize: '12px', color: '#64748b' }}>Asistente: <strong>{roomToBill.reporte?.asistente || 'N/A'}</strong></p>

              {roomToBill.reporte?.evidencia?.url && (
                <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>📸 EVIDENCIA MULTIMEDIA:</span>
                  {roomToBill.reporte.evidencia.tipo === 'video' ? (
                    <video src={roomToBill.reporte.evidencia.url} controls style={{ width: '100%', maxHeight: '180px', borderRadius: '6px' }} />
                  ) : (
                    <img src={roomToBill.reporte.evidencia.url} alt="Evidencia" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '6px' }} />
                  )}
                </div>
              )}

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', textTransform: 'uppercase' }}>Consumos:</h4>
                {Object.entries(roomToBill.reporte?.consumos || {}).map(([id, qty]) => {
                  if (qty <= 0) return null;
                  const item = inventario.find(i => i.id === id);
                  return (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', margin: '4px 0' }}>
                      <span>{qty}x {item?.name || id}</span>
                      <strong>${(qty * (item?.price_usd || 0)).toFixed(2)} USD</strong>
                    </div>
                  );
                })}
                <hr style={{ margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
                  <span>TOTAL USD:</span>
                  <span>${(roomToBill.reporte?.totalUSD || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', color: '#059669', marginTop: '4px' }}>
                  <span>TOTAL BS (BCV {tasaBCV.toFixed(2)}):</span>
                  <span>Bs. {(roomToBill.reporte?.totalBs || 0).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="success" onClick={() => handleConfirmarFacturacion(roomToBill)} style={{ flex: 1 }}>
                  ✅ Cobrado / Cambiar a Sucia
                </button>
                <button onClick={() => setRoomToBill(null)} style={{ background: '#cbd5e1', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: ASISTENTE MÓVIL */}
        {role === 'asistente' && (
          <div style={{ maxWidth: '650px', margin: '0 auto', width: '100%' }} className="card-box">
            <h2 style={{ fontSize: '20px', margin: 0 }}>Check-Out e Inspección Móvil</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Seleccionar Piso</label>
                <select value={selectedFloor} onChange={(e) => {
                  const pisoNum = parseInt(e.target.value);
                  setSelectedFloor(pisoNum);
                  const habsPiso = habitaciones.filter(h => h.floor === pisoNum);
                  setSelectedRoom(habsPiso[0] || null);
                }} style={{ width: '100%' }}>
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(p => <option key={p} value={p}>Piso {p}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Asistente Encargada</label>
                <select value={asistenteSeleccionada} onChange={(e) => setAsistenteSeleccionada(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Seleccionar Asistente...</option>
                  {personal.filter(p => p.rol === 'Asistente').map(a => <option key={a.id} value={a.nombre}>{a.nombre} ({a.turno})</option>)}
                </select>
              </div>
            </div>

            <div className="card-box" style={{ background: '#f8fafc', width: '100%', boxSizing: 'border-box' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Habitación del Piso {selectedFloor}</label>
                <select value={selectedRoom?.id || ''} onChange={(e) => setSelectedRoom(habitaciones.find(h => h.id === e.target.value))} style={{ width: '100%' }}>
                  <option value="">Seleccione habitación...</option>
                  {habitaciones.filter(h => h.floor === selectedFloor).map(h => <option key={h.id} value={h.id}>Habitación {h.number} ({h.type}) — {h.status}</option>)}
                </select>
              </div>

              {selectedRoom && (
                <>
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase' }}>📦 Consumos</h4>
                    {inventario.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '8px', width: '100%', boxSizing: 'border-box' }}>
                        <div>
                          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.name}</span>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>${item.price_usd.toFixed(2)} USD</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button type="button" onClick={() => handleQtyChange(item.id, -1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', fontWeight: 'bold' }}>-</button>
                          <span style={{ width: '24px', textAlign: 'center', fontWeight: 'bold' }}>{consumosSeleccionados[item.id] || 0}</span>
                          <button type="button" onClick={() => handleQtyChange(item.id, 1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: '#1e3a8a', color: '#fff', fontWeight: 'bold' }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>📸 ADJUNTAR EVIDENCIA (FOTO/VIDEO)</label>
                    <input type="file" accept="image/*,video/*" onChange={(e) => setArchivoEvidencia(e.target.files[0] || null)} style={{ fontSize: '12px', width: '100%' }} />
                    {archivoEvidencia && <p style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold', margin: '4px 0 0 0' }}>Archivo: {archivoEvidencia.name}</p>}
                  </div>

                  <button 
                    type="button"
                    disabled={subiendoArchivo} 
                    className="primary" 
                    onClick={handleEjecutarCheckout}
                    style={{ width: '100%', padding: '14px', fontSize: '14px' }}>
                    {subiendoArchivo ? 'Subiendo Evidencia a Supabase...' : '🚨 Ejecutar Check-Out'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* VISTA 3: SUPERVISORA */}
        {role === 'supervisora' && (
          <div className="card-box">
            <h3 style={{ margin: 0, fontSize: '18px' }}>📋 Panel de Supervisión</h3>
            <p style={{ fontSize: '12px', color: '#64748b' }}>Monitoreo de habitaciones y estado general del hotel.</p>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Habitación</th>
                    <th>Piso</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Saldo USD</th>
                  </tr>
                </thead>
                <tbody>
                  {habitaciones.map(h => (
                    <tr key={h.id}>
                      <td><strong>{h.number}</strong></td>
                      <td>Piso {h.floor}</td>
                      <td>{h.type}</td>
                      <td><span className={getStatusClass(h.status)} style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{h.status}</span></td>
                      <td>${h.amount || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA 4: AMA DE LLAVES */}
        {role === 'amadelhaves' && (
          <div className="card-box">
            <h3 style={{ margin: 0, fontSize: '18px' }}>🔑 Gestión de Ama de Llaves</h3>
            <p style={{ fontSize: '12px', color: '#64748b' }}>Control de habitaciones sucias y asignación de limpieza.</p>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Habitación</th>
                    <th>Estatus Actual</th>
                    <th style={{ textAlign: 'center' }}>Acciones de Limpieza</th>
                  </tr>
                </thead>
                <tbody>
                  {habitaciones.filter(h => (h.status || '').toLowerCase().includes('sucia') || h.status === 'Disponible').map(h => (
                    <tr key={h.id}>
                      <td><strong>Hab. {h.number}</strong></td>
                      <td>{h.status}</td>
                      <td style={{ textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button onClick={() => handleCambiarEstadoHabitacion(h, 'Disponible')} style={{ background: '#059669', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>
                          Marcar Limpia (Disponible)
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA 5: ADMINISTRACIÓN */}
        {role === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* GESTIÓN DE INVENTARIO */}
            <div className="card-box">
              <h3 style={{ margin: 0, fontSize: '18px' }}>📦 Gestión de Inventario y Precios</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!nuevoItem.name || !nuevoItem.id) return alert('Complete los datos del producto');
                try {
                  await supabase.from('inventario').upsert(nuevoItem);
                  setInventario(prev => [...prev.filter(i => i.id !== nuevoItem.id), nuevoItem]);
                  setNuevoItem({ id: '', name: '', category: 'minibar', price_usd: 0, stock: 0 });
                  alert('✅ Producto guardado en inventario.');
                } catch (err) {
                  alert('Error al guardar.');
                }
              }} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input placeholder="ID (ej: cerveza)" value={nuevoItem.id} onChange={e => setNuevoItem({...nuevoItem, id: e.target.value})} style={{ width: '120px' }} />
                <input placeholder="Nombre del Producto" value={nuevoItem.name} onChange={e => setNuevoItem({...nuevoItem, name: e.target.value})} style={{ flex: 1, minWidth: '180px' }} />
                <select value={nuevoItem.category} onChange={e => setNuevoItem({...nuevoItem, category: e.target.value})} style={{ width: '130px' }}>
                  <option value="minibar">Minibar</option>
                  <option value="lenceria">Lencería</option>
                  <option value="amenidad">Amenidad</option>
                </select>
                <input type="number" step="0.01" placeholder="Precio ($)" value={nuevoItem.price_usd || ''} onChange={e => setNuevoItem({...nuevoItem, price_usd: parseFloat(e.target.value) || 0})} style={{ width: '100px' }} />
                <input type="number" placeholder="Stock" value={nuevoItem.stock || ''} onChange={e => setNuevoItem({...nuevoItem, stock: parseInt(e.target.value) || 0})} style={{ width: '80px' }} />
                <button type="submit" className="primary" style={{ width: 'auto' }}>+ Guardar</button>
              </form>

              <div style={{ overflowX: 'auto', marginTop: '12px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Producto</th>
                      <th>Categoría</th>
                      <th>Precio (USD)</th>
                      <th>Stock</th>
                      <th style={{ width: '140px', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventario.map(item => (
                      <tr key={item.id}>
                        <td><code>{item.id}</code></td>
                        <td><strong>{item.name}</strong></td>
                        <td style={{ textTransform: 'capitalize' }}>{item.category}</td>
                        <td>
                          {editandoItem?.id === item.id ? (
                            <input 
                              type="number" 
                              step="0.01" 
                              value={editandoItem.price_usd} 
                              onChange={e => setEditandoItem({...editandoItem, price_usd: parseFloat(e.target.value) || 0})} 
                              style={{ width: '80px', padding: '4px' }} 
                            />
                          ) : (
                            `$${item.price_usd.toFixed(2)}`
                          )}
                        </td>
                        <td>{item.stock} unidades</td>
                        <td style={{ textAlign: 'center', display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          {editandoItem?.id === item.id ? (
                            <button onClick={() => handleActualizarPrecioInventario(editandoItem)} style={{ background: '#059669', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                              Guardar
                            </button>
                          ) : (
                            <button onClick={() => setEditandoItem(item)} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                              Modificar
                            </button>
                          )}
                          <button onClick={() => handleEliminarInventario(item.id)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* GESTIÓN DE PERSONAL */}
            <div className="card-box">
              <h3 style={{ margin: 0, fontSize: '18px' }}>👥 Gestión de Personal</h3>
              <form onSubmit={handleAgregarPersonal} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input 
                  placeholder="Nombre y Apellido" 
                  value={nuevoPersonal.nombre} 
                  onChange={e => setNuevoPersonal({...nuevoPersonal, nombre: e.target.value})} 
                  style={{ flex: 1, minWidth: '180px' }} 
                />
                <select 
                  value={nuevoPersonal.rol} 
                  onChange={e => setNuevoPersonal({...nuevoPersonal, rol: e.target.value})} 
                  style={{ width: '180px' }}>
                  <option value="Asistente">Asistente (Piso)</option>
                  <option value="Supervisora">Supervisora</option>
                  <option value="Equipo Nocturno">Equipo Nocturno</option>
                </select>
                <input 
                  placeholder="Turno / Pisos Asignados" 
                  value={nuevoPersonal.turno} 
                  onChange={e => setNuevoPersonal({...nuevoPersonal, turno: e.target.value})} 
                  style={{ flex: 1, minWidth: '200px' }} 
                />
                <button type="submit" className="primary" style={{ width: 'auto' }}>+ Agregar Personal</button>
              </form>

              <div style={{ marginTop: '16px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Rol</th>
                      <th>Turno / Asignación</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personal.map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.nombre}</strong></td>
                        <td>{p.rol}</td>
                        <td>{p.turno}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button onClick={() => handleEliminarPersonal(p.id)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}