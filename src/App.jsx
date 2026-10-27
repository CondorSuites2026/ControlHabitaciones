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

// Helper to safely get or create Supabase client using CDN global or mock fallback
const getSupabaseClient = () => {
  if (typeof window !== 'undefined' && window.supabase && supabaseUrl && supabaseAnonKey) {
    return window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  
  // Safe mock client if CDN or env keys are missing to prevent runtime exceptions
  const createMockQuery = () => {
    const query = {
      select: () => query,
      order: () => query,
      eq: () => query,
      upsert: () => Promise.resolve({ data: null, error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => query,
      then: (onfulfilled) => Promise.resolve({ data: [], error: null }).then(onfulfilled),
      catch: (onrejected) => Promise.resolve({ data: [], error: null }).catch(onrejected)
    };
    return query;
  };

  return {
    from: () => createMockQuery(),
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
    { id: 1, nombre: 'María Rodríguez', rol: 'Asistente', turno: 'Mañana (Pisos 3-5)' },
    { id: 2, nombre: 'Carmen Silva', rol: 'Asistente', turno: 'Mañana (Pisos 6-8)' },
    { id: 3, nombre: 'Rosa Gómez', rol: 'Supervisora', turno: 'General (Pisos 3-10)' },
    { id: 4, nombre: 'Ana Pérez', rol: 'Asistente', turno: 'Tarde (Pisos 3-5)' },
    { id: 5, nombre: 'José Luces', rol: 'Equipo Nocturno', turno: 'Nocturno (7 PM - 7 AM)' },
    { id: 6, nombre: 'Linares Castillo', rol: 'Equipo Nocturno', turno: 'Nocturno (7 PM - 7 AM)' }
  ]);

  const [reportesHistorial, setReportesHistorial] = useState([]);
  const [asistenteSeleccionada, setAsistenteSeleccionada] = useState('');
  const [supervisoraSeleccionada, setSupervisoraSeleccionada] = useState('');
  const [equipoNocturnoSeleccionado, setEquipoNocturnoSeleccionado] = useState('');
  const [consumosSeleccionados, setConsumosSeleccionados] = useState({});
  const [archivoEvidencia, setArchivoEvidencia] = useState(null);

  const [nuevoItem, setNuevoItem] = useState({ id: '', name: '', category: 'minibar', price_usd: 0, stock: 0 });
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
    if (!nuevoPersonal.nombre || !nuevoPersonal.turno) {
      return alert('⚠️ Ingrese el nombre y el turno del personal.');
    }
    const nuevoObj = {
      nombre: nuevoPersonal.nombre,
      rol: nuevoPersonal.rol,
      turno: nuevoPersonal.turno
    };

    try {
      const { data, error } = await supabase.from('personal').insert([nuevoObj]).select();
      if (error) throw error;
      if (data && data.length > 0) {
        setPersonal(prev => [...prev, data[0]]);
      } else {
        setPersonal(prev => [...prev, { ...nuevoObj, id: Date.now() }]);
      }
      setNuevoPersonal({ nombre: '', rol: 'Asistente', turno: '' });
      alert(`✅ Personal (${nuevoObj.nombre}) agregado exitosamente.`);
    } catch (err) {
      console.error('Error al guardar personal:', err);
      setPersonal(prev => [...prev, { ...nuevoObj, id: Date.now() }]);
      setNuevoPersonal({ nombre: '', rol: 'Asistente', turno: '' });
      alert('✅ Personal guardado localmente.');
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

  const handleQtyChange = (id, delta) => {
    setConsumosSeleccionados(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  const getStatusClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('por facturar')) return 'badge-danger';
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

      if (uploadError) {
        console.error('Error al subir archivo a Supabase Storage:', uploadError);
        alert(`⚠️ No se pudo subir la foto/video (${uploadError.message}). El check-out continuará sin evidencia multimedia.`);
        return null;
      }

      const { data } = supabase.storage.from('evidencias').getPublicUrl(filePath);
      
      return {
        url: data?.publicUrl || '',
        tipo: file.type.startsWith('video') ? 'video' : 'imagen',
        nombre: file.name
      };
    } catch (err) {
      console.error('Excepción durante la carga de evidencia:', err);
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
    if (!asistenteSeleccionada && !equipoNocturnoSeleccionado) {
      alert('⚠️ Por favor seleccione la Asistente Encargada o el integrante del Equipo Nocturno.');
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

      const responsable = equipoNocturnoSeleccionado ? `[Nocturno] ${equipoNocturnoSeleccionado}` : asistenteSeleccionada;

      const reporteCompleto = {
        asistente: responsable,
        supervisora: supervisoraSeleccionada || 'N/A',
        fecha: new Date().toISOString(),
        consumos: { ...consumosSeleccionados },
        totalUSD,
        totalBs,
        tasaBCV,
        evidencia: datosEvidencia
      };

      const newStatus = 'Sucia / Por Facturar';

      const { error: errorHab } = await supabase.from('habitaciones').upsert({
        id: selectedRoom.id,
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
        asistente: responsable,
        supervisora: supervisoraSeleccionada || 'N/A',
        total_usd: totalUSD,
        total_bs: totalBs,
        tasa_bcv: tasaBCV,
        desglose: consumosSeleccionados
      });

      alert(`✅ Check-out ejecutado exitosamente para la Habitación ${selectedRoom.number}.`);
      setConsumosSeleccionados({});
      setArchivoEvidencia(null);
      setSelectedRoom(null);
      await fetchHabitaciones();
      fetchReportes();
    } catch (e) {
      console.error('Error al procesar el check-out:', e);
      alert('❌ Error al procesar el check-out: ' + (e.message || 'Error desconocido'));
    } finally {
      setSubiendoArchivo(false);
    }
  };

  const handleConfirmarFacturacion = async (roomId) => {
    try {
      await supabase.from('habitaciones').update({ status: 'Sucia', amount: 0, reporte: null }).eq('id', roomId);
      setRoomToBill(null);
      fetchHabitaciones();
      alert('✅ Facturación completada. La habitación pasa a color amarillo (Sucia).');
    } catch (e) {
      console.error(e);
      alert('Error al confirmar facturación.');
    }
  };

  const habitacionesPendientes = habitaciones.filter(h => (h.status || '').includes('Por Facturar'));

  return (
    <div className="app-container">
      <style>{`
        body { margin: 0; background-color: #f1f5f9; font-family: system-ui, -apple-system, sans-serif; color: #1e293b; }
        .app-container { min-height: 100vh; display: flex; flex-direction: column; }
        header { background-color: #0f172a; border-bottom: 1px solid #334155; padding: 12px 24px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; color: #fff; }
        .logo-box { display: flex; align-items: center; gap: 12px; }
        .logo-badge { background-color: #f59e0b; color: #0f172a; padding: 6px 10px; border-radius: 6px; font-weight: 900; font-size: 16px; }
        .nav-buttons { display: flex; background: #1e293b; padding: 4px; border-radius: 8px; gap: 4px; flex-wrap: wrap; }
        .nav-btn { padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer; border: none; background: transparent; color: #cbd5e1; }
        .nav-btn.active { background: #f59e0b; color: #0f172a; }
        main { flex: 1; padding: 16px; max-width: 1440px; margin: 0 auto; width: 100%; box-sizing: border-box; }
        .bcv-box { display: flex; align-items: center; background: #1e293b; padding: 6px 14px; border-radius: 8px; border: 1px solid #334155; gap: 8px; color: #f59e0b; font-weight: bold; font-size: 12px; }
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
        button.primary { background: #0f172a; color: #fff; padding: 12px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; width: 100%; transition: opacity 0.2s; }
        button.primary:disabled { opacity: 0.6; cursor: not-allowed; }
        button.success { background: #059669; color: #fff; padding: 12px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; }
      `}</style>

      {/* HEADER */}
      <header>
        <div className="logo-box">
          <div className="logo-badge">CS</div>
          <div>
            <h1 style={{ fontSize: '16px', margin: 0 }}>HOTEL CÓNDOR SUITES</h1>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Control en Vivo Supabase</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="bcv-box">
            <span>💵 TASA BCV OFICIAL:</span>
            <span style={{ color: '#fff' }}>Bs. {tasaBCV.toFixed(2)}</span>
          </div>
          <button className="btn-update" onClick={() => { fetchHabitaciones(); alert('🔄 Datos actualizados.'); }}>
            🔄 Actualizar PC
          </button>
        </div>

        <div className="nav-buttons">
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
                      <td style={{ fontWeight: 'bold', background: '#f8fafc' }}>PISO {piso}</td>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(numCol => {
                        const numStr = piso === 10 ? (numCol <= 4 ? `100${numCol}` : null) : `${piso}0${numCol}`;
                        const hab = habitaciones.find(h => h.number === numStr);
                        if (!hab) return <td key={numCol} style={{ background: '#f1f5f9' }}></td>;
                        const badgeClass = getStatusClass(hab.status);
                        const esAlerta = (hab.status || '').includes('Por Facturar');

                        return (
                          <td 
                            key={hab.id} 
                            onClick={() => esAlerta && setRoomToBill(hab)}
                            className={`${badgeClass} ${esAlerta ? 'alerta-parpadeante' : ''}`}
                            style={{ cursor: esAlerta ? 'pointer' : 'default', height: '70px', verticalAlign: 'top' }}>
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
                <button className="success" onClick={() => handleConfirmarFacturacion(roomToBill.id)} style={{ flex: 1 }}>
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
          <div style={{ maxWidth: '650px', margin: '0 auto' }} className="card-box">
            <h2 style={{ fontSize: '20px', margin: 0 }}>Check-Out e Inspección Móvil</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Seleccionar Piso</label>
                <select onChange={(e) => setSelectedRoom(habitaciones.find(h => h.floor === parseInt(e.target.value)) || null)}>
                  <option value="">Seleccione piso...</option>
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(p => <option key={p} value={p}>Piso {p}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Asistente Encargada (Diurno)</label>
                <select value={asistenteSeleccionada} onChange={(e) => { setAsistenteSeleccionada(e.target.value); if(e.target.value) setEquipoNocturnoSeleccionado(''); }}>
                  <option value="">Seleccionar Asistente...</option>
                  {personal.filter(p => p.rol === 'Asistente').map(a => <option key={a.id} value={a.nombre}>{a.nombre} ({a.turno})</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>🌙 Equipo Nocturno (7 PM - 7 AM)</label>
                <select value={equipoNocturnoSeleccionado} onChange={(e) => { setEquipoNocturnoSeleccionado(e.target.value); if(e.target.value) setAsistenteSeleccionada(''); }}>
                  <option value="">Seleccionar Personal Nocturno...</option>
                  {personal.filter(p => p.rol === 'Equipo Nocturno').map(a => <option key={a.id} value={a.nombre}>{a.nombre} ({a.turno})</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Supervisora de Turno</label>
                <select value={supervisoraSeleccionada} onChange={(e) => setSupervisoraSeleccionada(e.target.value)}>
                  <option value="">Seleccionar Supervisora (Opcional)...</option>
                  {personal.filter(p => p.rol === 'Supervisora').map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                </select>
              </div>
            </div>

            {selectedRoom && (
              <div className="card-box" style={{ background: '#f8fafc' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Habitación del Piso {selectedRoom.floor}</label>
                  <select value={selectedRoom.id} onChange={(e) => setSelectedRoom(habitaciones.find(h => h.id === e.target.value))}>
                    {habitaciones.filter(h => h.floor === selectedRoom.floor).map(h => <option key={h.id} value={h.id}>Habitación {h.number} ({h.type}) — {h.status}</option>)}
                  </select>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase' }}>📦 Consumos</h4>
                  {inventario.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.name}</span>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>${item.price_usd.toFixed(2)} USD</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button type="button" onClick={() => handleQtyChange(item.id, -1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', fontWeight: 'bold' }}>-</button>
                        <span style={{ width: '24px', textAlign: 'center', fontWeight: 'bold' }}>{consumosSeleccionados[item.id] || 0}</span>
                        <button type="button" onClick={() => handleQtyChange(item.id, 1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: '#0f172a', color: '#fff', fontWeight: 'bold' }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>📸 ADJUNTAR EVIDENCIA (FOTO/VIDEO)</label>
                  <input type="file" accept="image/*,video/*" onChange={(e) => setArchivoEvidencia(e.target.files[0] || null)} style={{ fontSize: '12px' }} />
                  {archivoEvidencia && <p style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold', margin: '4px 0 0 0' }}>Archivo: {archivoEvidencia.name}</p>}
                </div>

                <button 
                  type="button"
                  disabled={subiendoArchivo} 
                  className="primary" 
                  onClick={handleEjecutarCheckout}>
                  {subiendoArchivo ? 'Subiendo Evidencia a Supabase...' : '🚨 Ejecutar Check-Out'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* VISTA 5: ADMINISTRACIÓN */}
        {role === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* GESTIÓN DE INVENTARIO */}
            <div className="card-box">
              <h3 style={{ margin: 0, fontSize: '18px' }}>📦 Gestión de Inventario</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!nuevoItem.name || !nuevoItem.id) return alert('Complete los datos del producto');
                
                try {
                  await supabase.from('inventario').upsert(nuevoItem);
                  setInventario(prev => [...prev.filter(i => i.id !== nuevoItem.id), nuevoItem]);
                  setNuevoItem({ id: '', name: '', category: 'minibar', price_usd: 0, stock: 0 });
                  alert('✅ Producto guardado en inventario.');
                } catch (err) {
                  setInventario(prev => [...prev.filter(i => i.id !== nuevoItem.id), nuevoItem]);
                  setNuevoItem({ id: '', name: '', category: 'minibar', price_usd: 0, stock: 0 });
                  alert('✅ Producto guardado.');
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
                      <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventario.map(item => (
                      <tr key={item.id}>
                        <td><code>{item.id}</code></td>
                        <td><strong>{item.name}</strong></td>
                        <td style={{ textTransform: 'capitalize' }}>{item.category}</td>
                        <td>${item.price_usd.toFixed(2)}</td>
                        <td>{item.stock} unidades</td>
                        <td style={{ textAlign: 'center' }}>
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
              <h3 style={{ margin: 0, fontSize: '18px' }}>👥 Gestión de Personal (Asistentes, Supervisoras y Equipo Nocturno)</h3>
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
                  <option value="Equipo Nocturno">Equipo Nocturno (7 PM - 7 AM)</option>
                </select>
                <input 
                  placeholder="Turno / Pisos Asignados (ej: 7 PM a 7 AM / Pisos 3-10)" 
                  value={nuevoPersonal.turno} 
                  onChange={e => setNuevoPersonal({...nuevoPersonal, turno: e.target.value})} 
                  style={{ flex: 1, minWidth: '200px' }} 
                />
                <button type="submit" className="primary" style={{ width: 'auto' }}>+ Agregar Personal</button>
              </form>

              {/* TABLA ASISTENTES */}
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '14px' }}>🧹 Asistentes de Piso (Turno Diurno / Tarde)</h4>
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
                    {personal.filter(p => p.rol === 'Asistente').map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.nombre}</strong></td>
                        <td><span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{p.rol}</span></td>
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

              {/* TABLA SUPERVISORAS */}
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '14px' }}>📋 Supervisoras</h4>
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
                    {personal.filter(p => p.rol === 'Supervisora').map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.nombre}</strong></td>
                        <td><span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{p.rol}</span></td>
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

              {/* TABLA EQUIPO NOCTURNO */}
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '14px' }}>🌙 Equipo Nocturno (7 PM a 7 AM)</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Rol</th>
                      <th>Horario de Guardia</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personal.filter(p => p.rol === 'Equipo Nocturno').map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.nombre}</strong></td>
                        <td><span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{p.rol}</span></td>
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