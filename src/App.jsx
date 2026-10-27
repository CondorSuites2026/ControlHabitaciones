import React, { useState, useEffect } from 'react';

// Extracción segura de variables de entorno de Supabase
const getEnvVar = (key) => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {}
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

const getSupabaseClient = () => {
  if (typeof window !== 'undefined' && window.supabase && supabaseUrl && supabaseAnonKey) {
    try {
      return window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    } catch (e) {}
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
      on: function() { return this; },
      subscribe: () => ({ unsubscribe: () => {} })
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

// Helper defensivo estricto para garantizar que nunca se inserte un Objeto React/Supabase en el DOM
const safeVal = (val, fallback = '') => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string' || typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 'Sí' : 'No';
  if (typeof val === 'object') {
    // Si la BD devuelve un objeto relacional JSON o Supabase wrapper
    if (val.nombre && typeof val.nombre === 'string') return val.nombre;
    if (val.name && typeof val.name === 'string') return val.name;
    if (val.number && typeof val.number === 'string') return val.number;
    return fallback;
  }
  return String(val);
};

export default function App() {
  const [role, setRole] = useState('recepcion');
  const [habitaciones, setHabitaciones] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomToBill, setRoomToBill] = useState(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [tasaBCV, setTasaBCV] = useState(65.00);

  // Modal para Ama de Llaves / Supervisión de Limpieza
  const [showAmaDeLlavesModal, setShowAmaDeLlavesModal] = useState(false);
  const [selectedAmaRoom, setSelectedAmaRoom] = useState(null);
  const [amaCamareraAsignada, setAmaCamareraAsignada] = useState('');
  const [amaEstadoNuevo, setAmaEstadoNuevo] = useState('Limpia / Disponible');
  const [amaNotas, setAmaNotas] = useState('');

  // Estado para la edición de producto
  const [editingProduct, setEditingProduct] = useState(null);

  const defaultInventario = [
    { id: 'agua', name: 'Agua Mineral 500ml', category: 'minibar', price_usd: 1.00, stock: 100 },
    { id: 'refresco', name: 'Refresco Lata', category: 'minibar', price_usd: 1.50, stock: 80 },
    { id: 'cerveza', name: 'Cerveza Nacional', category: 'minibar', price_usd: 2.00, stock: 120 },
    { id: 'snack', name: 'Snacks / Chocolates', category: 'minibar', price_usd: 1.25, stock: 60 },
    { id: 'toalla_c', name: 'Toalla de Cuerpo', category: 'lenceria', price_usd: 12.00, stock: 40 },
    { id: 'toalla_m', name: 'Toalla de Manos', category: 'lenceria', price_usd: 6.00, stock: 50 },
    { id: 'shampoo', name: 'Kit Shampoo / Jabón', category: 'amenidad', price_usd: 0.80, stock: 200 }
  ];

  const defaultPersonal = [
    { id: 1, nombre: 'María Rodríguez', rol: 'Ama de Llaves', turno: 'Mañana (Pisos 3-5)' },
    { id: 2, nombre: 'Carmen Silva', rol: 'Asistente', turno: 'Mañana (Pisos 6-8)' },
    { id: 3, nombre: 'Rosa Gómez', rol: 'Supervisora', turno: 'General (Pisos 3-10)' },
    { id: 4, nombre: 'Ana Pérez', rol: 'Asistente', turno: 'Tarde (Pisos 3-5)' },
    { id: 5, nombre: 'José Luces', rol: 'Equipo Nocturno', turno: 'Nocturno (7 PM - 7 AM)' },
    { id: 6, nombre: 'Linares Castillo', rol: 'Equipo Nocturno', turno: 'Nocturno (7 PM - 7 AM)' }
  ];

  const [inventario, setInventario] = useState(() => {
    try {
      const saved = localStorage.getItem('condor_inventario');
      return saved ? JSON.parse(saved) : defaultInventario;
    } catch (e) {
      return defaultInventario;
    }
  });

  const [personal, setPersonal] = useState(() => {
    try {
      const saved = localStorage.getItem('condor_personal');
      return saved ? JSON.parse(saved) : defaultPersonal;
    } catch (e) {
      return defaultPersonal;
    }
  });

  const [asistenteSeleccionada, setAsistenteSeleccionada] = useState('');
  const [supervisoraSeleccionada, setSupervisoraSeleccionada] = useState('');
  const [equipoNocturnoSeleccionado, setEquipoNocturnoSeleccionado] = useState('');
  const [consumosSeleccionados, setConsumosSeleccionados] = useState({});
  const [archivoEvidencia, setArchivoEvidencia] = useState(null);

  const [nuevoItem, setNuevoItem] = useState({ id: '', name: '', category: 'minibar', price_usd: 0, stock: 0 });
  const [nuevoPersonal, setNuevoPersonal] = useState({ nombre: '', rol: 'Asistente', turno: '' });

  useEffect(() => {
    try { localStorage.setItem('condor_inventario', JSON.stringify(inventario)); } catch (e) {}
  }, [inventario]);

  useEffect(() => {
    try { localStorage.setItem('condor_personal', JSON.stringify(personal)); } catch (e) {}
  }, [personal]);

  useEffect(() => {
    inicializarApp();
    sincronizarTasaBCVOnline();

    // Sincronización en Tiempo Real de Alta Fidelidad mediante Supabase Channels
    let channel;
    try {
      if (supabase && typeof supabase.channel === 'function') {
        channel = supabase
          .channel('hotel-realtime-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'habitaciones' },
            (payload) => {
              if (payload.new && payload.new.id) {
                setHabitaciones(prev => {
                  const existe = prev.some(h => String(h.id) === String(payload.new.id));
                  if (existe) {
                    return prev.map(h => String(h.id) === String(payload.new.id) ? { ...h, ...payload.new } : h);
                  }
                  return [...prev, payload.new];
                });
              } else {
                fetchHabitacionesSilencioso();
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'inventario' },
            (payload) => {
              if (payload.new && payload.new.id) {
                setInventario(prev => {
                  const existe = prev.some(i => String(i.id) === String(payload.new.id));
                  if (existe) {
                    return prev.map(i => String(i.id) === String(payload.new.id) ? { ...i, ...payload.new } : i);
                  }
                  return [...prev, payload.new];
                });
              } else {
                fetchInventario();
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'personal' },
            (payload) => {
              if (payload.new && payload.new.id) {
                setPersonal(prev => {
                  const existe = prev.some(p => String(p.id) === String(payload.new.id));
                  if (existe) {
                    return prev.map(p => String(p.id) === String(payload.new.id) ? { ...p, ...payload.new } : p);
                  }
                  return [...prev, payload.new];
                });
              } else {
                fetchPersonal();
              }
            }
          )
          .subscribe((status) => {
            console.log('Suscripción Supabase Realtime Status:', status);
          });
      }
    } catch (e) {}

    // Poll secundario de respaldo en tiempo real cada 3 segundos
    const interval = setInterval(() => {
      fetchHabitacionesSilencioso();
      fetchInventario();
      fetchPersonal();
    }, 3000);

    return () => {
      if (channel && supabase.removeChannel) {
        supabase.removeChannel(channel);
      }
      clearInterval(interval);
    };
  }, []);

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

  const inicializarApp = async () => {
    await fetchHabitaciones();
    fetchInventario();
    fetchPersonal();
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
      } catch (error) {}
    }
  };

  const fetchHabitaciones = async () => {
    try {
      const savedHab = localStorage.getItem('condor_habitaciones');
      if (savedHab) {
        setHabitaciones(JSON.parse(savedHab));
      } else {
        const def = getDefaultRoomsArray();
        setHabitaciones(def);
        localStorage.setItem('condor_habitaciones', JSON.stringify(def));
      }

      const { data, error } = await supabase.from('habitaciones').select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        setHabitaciones(data);
        localStorage.setItem('condor_habitaciones', JSON.stringify(data));
      }
    } catch {
      if (habitaciones.length === 0) setHabitaciones(getDefaultRoomsArray());
    }
  };

  const fetchHabitacionesSilencioso = async () => {
    try {
      const { data } = await supabase.from('habitaciones').select('*');
      if (Array.isArray(data) && data.length > 0) {
        setHabitaciones(data);
        localStorage.setItem('condor_habitaciones', JSON.stringify(data));
      }
    } catch (e) {}
  };

  const fetchInventario = async () => {
    try {
      const { data, error } = await supabase.from('inventario').select('*');
      if (!error && Array.isArray(data) && data.length > 0) setInventario(data);
    } catch (e) {}
  };

  const fetchPersonal = async () => {
    try {
      const { data, error } = await supabase.from('personal').select('*');
      if (!error && Array.isArray(data) && data.length > 0) setPersonal(data);
    } catch (e) {}
  };

  // Función para guardar actualizaciones en el Modal de Ama de Llaves
  const handleGuardarAmaDeLlaves = async (e) => {
    e.preventDefault();
    if (!selectedAmaRoom) return;

    const newStatus = amaEstadoNuevo === 'Limpia / Disponible' ? 'Disponible' : amaEstadoNuevo;

    const habActualizadas = habitaciones.map(room => {
      if (String(room.id) === String(selectedAmaRoom.id)) {
        return {
          ...room,
          status: newStatus,
          reporte: {
            ...room.reporte,
            amaDeLlaves: amaCamareraAsignada,
            notasAma: amaNotas,
            fechaInspeccionAma: new Date().toISOString()
          }
        };
      }
      return room;
    });

    setHabitaciones(habActualizadas);
    localStorage.setItem('condor_habitaciones', JSON.stringify(habActualizadas));

    try {
      await supabase.from('habitaciones').upsert({
        id: selectedAmaRoom.id,
        number: safeVal(selectedAmaRoom.number),
        floor: selectedAmaRoom.floor,
        type: safeVal(selectedAmaRoom.type),
        status: newStatus,
        reporte: {
          ...selectedAmaRoom.reporte,
          amaDeLlaves: amaCamareraAsignada,
          notasAma: amaNotas,
          fechaInspeccionAma: new Date().toISOString()
        }
      });
    } catch (e) {}

    setShowAmaDeLlavesModal(false);
    setSelectedAmaRoom(null);
    setAmaNotas('');
    alert(`✅ Estado de Habitación ${safeVal(selectedAmaRoom.number)} actualizado por Ama de Llaves a: ${newStatus}`);
  };

  const handleAgregarPersonal = async (e) => {
    e.preventDefault();
    if (!nuevoPersonal.nombre || !nuevoPersonal.turno) {
      return alert('⚠️ Ingrese el nombre y el turno del personal.');
    }
    
    const numericId = Math.floor(Date.now() % 2147483647);
    
    const nuevoObj = {
      id: numericId,
      nombre: String(nuevoPersonal.nombre),
      rol: String(nuevoPersonal.rol),
      turno: String(nuevoPersonal.turno)
    };

    setPersonal(prev => [...prev, nuevoObj]);

    try {
      const { error } = await supabase.from('personal').insert([nuevoObj]);
      if (error) {
        alert(`⚠️ Supabase: ${error.message || 'Error guardando en base de datos'}`);
      } else {
        alert(`✅ Personal (${nuevoObj.nombre}) guardado con éxito.`);
      }
    } catch (err) {}

    setNuevoPersonal({ nombre: '', rol: 'Asistente', turno: '' });
  };

  const handleEliminarPersonal = async (id) => {
    if (!window.confirm('¿Desea eliminar a este integrante del personal?')) return;
    setPersonal(prev => prev.filter(p => p.id !== id));
    try {
      await supabase.from('personal').delete().eq('id', id);
    } catch (err) {}
  };

  const handleEliminarInventario = async (id) => {
    if (!window.confirm('¿Desea eliminar este producto del inventario?')) return;
    setInventario(prev => prev.filter(i => i.id !== id));
    try {
      await supabase.from('inventario').delete().eq('id', id);
    } catch (err) {}
  };

  const handleGuardarEdicionProducto = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    const updated = inventario.map(item => item.id === editingProduct.id ? editingProduct : item);
    setInventario(updated);

    try {
      const { error } = await supabase.from('inventario').upsert(editingProduct);
      if (error) {
        alert(`⚠️ Supabase Error: ${error.message}`);
      } else {
        alert(`✅ Producto "${editingProduct.name}" actualizado correctamente (Precio: $${editingProduct.price_usd}).`);
      }
    } catch (err) {}

    setEditingProduct(null);
  };

  const handleQtyChange = (id, delta) => {
    setConsumosSeleccionados(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  const getStatusClass = (status) => {
    const s = safeVal(status).toLowerCase();
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
        return { url: '', tipo: file.type.startsWith('video') ? 'video' : 'imagen', nombre: file.name };
      }

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
    if (!asistenteSeleccionada && !equipoNocturnoSeleccionado) {
      alert('⚠️ Por favor seleccione la Asistente Encargada o el integrante del Equipo Nocturno.');
      return;
    }

    try {
      let totalUSD = 0;
      inventario.forEach(item => {
        const qty = Number(consumosSeleccionados[item.id]) || 0;
        totalUSD += qty * (Number(item.price_usd) || 0);
      });

      const totalBs = totalUSD * tasaBCV;
      let datosEvidencia = null;

      if (archivoEvidencia) {
        datosEvidencia = await subirEvidenciaASupabase(archivoEvidencia);
      }

      const responsable = equipoNocturnoSeleccionado ? `[Nocturno] ${equipoNocturnoSeleccionado}` : asistenteSeleccionada;

      const reporteCompleto = {
        asistente: safeVal(responsable, 'N/A'),
        supervisora: safeVal(supervisoraSeleccionada, 'N/A'),
        fecha: new Date().toISOString(),
        consumos: { ...consumosSeleccionados },
        totalUSD,
        totalBs,
        tasaBCV,
        evidencia: datosEvidencia
      };

      const newStatus = 'Sucia / Por Facturar';

      const habActualizadas = habitaciones.map(room => {
        if (String(room.id) === String(selectedRoom.id)) {
          return { ...room, status: newStatus, amount: totalUSD, reporte: reporteCompleto };
        }
        return room;
      });

      setHabitaciones(habActualizadas);
      localStorage.setItem('condor_habitaciones', JSON.stringify(habActualizadas));

      try {
        await supabase.from('habitaciones').upsert({
          id: selectedRoom.id,
          number: safeVal(selectedRoom.number),
          floor: selectedRoom.floor,
          type: safeVal(selectedRoom.type),
          status: newStatus,
          amount: totalUSD,
          reporte: reporteCompleto
        });
      } catch (e) {}

      setConsumosSeleccionados({});
      setArchivoEvidencia(null);
      setSelectedRoom(null);
      alert(`✅ Check-Out registrado en Habitación ${safeVal(selectedRoom.number)}. Notificación enviada en tiempo real.`);
    } catch (err) {
      alert('⚠️ Ocurrió un error al procesar el check-out.');
    }
  };

  const handleConfirmarFacturacion = async (roomId) => {
    const habActualizadas = habitaciones.map(room => {
      if (String(room.id) === String(roomId)) {
        return { ...room, status: 'Sucia', amount: 0 };
      }
      return room;
    });

    setHabitaciones(habActualizadas);
    localStorage.setItem('condor_habitaciones', JSON.stringify(habActualizadas));

    try {
      await supabase.from('habitaciones').update({
        status: 'Sucia',
        amount: 0
      }).eq('id', roomId);
    } catch (e) {}

    setRoomToBill(null);
    alert('✅ Facturación completada. La habitación pasa a estatus SUCIA.');
  };

  const habitacionesPendientes = habitaciones.filter(h => safeVal(h.status).toLowerCase().includes('por facturar'));

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: '#f1f5f9', color: '#0f172a', padding: '16px' }}>
      <style>{`
        .nav-btn { background: #1e293b; color: #fff; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; }
        .nav-btn.active { background: #2563eb; }
        .card-box { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; gap: 12px; }
        .badge-disponible { background: #dcfce7; color: #166534; }
        .badge-sucia { background: #fef9c3; color: #854d0e; }
        .badge-ocupada { background: #e0f2fe; color: #075985; }
        .badge-reservada { background: #f3e8ff; color: #6b21a8; }
        .badge-danger { background: #fee2e2; color: #991b1b; }
        .alerta-parpadeante { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
        th { background: #f8fafc; }
        select, input, textarea { padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box; }
        button.primary { background: #2563eb; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; }
        button.success { background: #16a34a; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal-card { background: #fff; padding: 20px; border-radius: 12px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; }
      `}</style>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', background: '#fff', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>Hotel Condor Suites</h1>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Tasa BCV Oficial: <strong>Bs. {tasaBCV.toFixed(2)} / USD</strong></span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'recepcion', label: 'Recepción' },
            { id: 'asistente', label: 'Piso / Móvil' },
            { id: 'supervisora', label: 'Supervisión' },
            { id: 'amadeclaves', label: '🔑 Ama de Llaves' },
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
                      Facturar Hab. {safeVal(h.number)} (${Number(h.amount || 0).toFixed(2)})
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
                        const hab = habitaciones.find(h => String(safeVal(h.number)) === String(numStr));
                        if (!hab) return <td key={numCol} style={{ background: '#f1f5f9' }}></td>;
                        const badgeClass = getStatusClass(hab.status);
                        const esAlerta = safeVal(hab.status).toLowerCase().includes('por facturar');

                        return (
                          <td 
                            key={hab.id} 
                            onClick={() => esAlerta && setRoomToBill(hab)}
                            className={`${badgeClass} ${esAlerta ? 'alerta-parpadeante' : ''}`}
                            style={{ cursor: esAlerta ? 'pointer' : 'default', height: '70px', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 'bold' }}>{safeVal(hab.number)} / {safeVal(hab.type).substring(0,3)}</div>
                            <div style={{ fontSize: '10px', marginTop: '4px', fontWeight: 'bold' }}>{safeVal(hab.status)}</div>
                            {Number(hab.amount) > 0 && (
                              <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '2px' }}>
                                ${Number(hab.amount).toFixed(2)} USD
                                <div style={{ fontSize: '10px', fontWeight: 'normal' }}>
                                  (Bs. {(Number(hab.amount) * tasaBCV).toFixed(2)})
                                </div>
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

        {/* MODAL DE AMA DE LLAVES */}
        {showAmaDeLlavesModal && selectedAmaRoom && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>🔑 Gestión Ama de Llaves — Habitación {safeVal(selectedAmaRoom.number)}</h3>
              <form onSubmit={handleGuardarAmaDeLlaves} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Asignar Camarera / Asistente Responsable</label>
                  <select value={amaCamareraAsignada} onChange={e => setAmaCamareraAsignada(e.target.value)} required>
                    <option value="">Seleccionar del personal...</option>
                    {personal.map(p => (
                      <option key={p.id} value={safeVal(p.nombre)}>{safeVal(p.nombre)} ({safeVal(p.rol)} - {safeVal(p.turno)})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Cambiar Estatus de Limpieza</label>
                  <select value={amaEstadoNuevo} onChange={e => setAmaEstadoNuevo(e.target.value)}>
                    <option value="Limpia / Disponible">🟢 Limpia / Disponible</option>
                    <option value="Sucia / En Limpieza">🟡 Sucia / En Limpieza</option>
                    <option value="Bloqueada / Mantenimiento">🔴 Bloqueada / Mantenimiento</option>
                    <option value="Inspeccionada">🔵 Inspeccionada y Verificada</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Notas u Observaciones del Ama de Llaves</label>
                  <textarea rows="3" placeholder="Ej: Cambio de lencería completo, minibar reabastecido..." value={amaNotas} onChange={e => setAmaNotas(e.target.value)} />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button type="submit" className="success" style={{ flex: 1 }}>💾 Guardar Estado & Sincronizar</button>
                  <button type="button" onClick={() => setShowAmaDeLlavesModal(false)} style={{ background: '#cbd5e1', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VISTA AMA DE LLAVES */}
        {role === 'amadeclaves' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }} className="card-box">
            <h2 style={{ fontSize: '20px', margin: 0 }}>🔑 Panel Directivo de Ama de Llaves</h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Supervisión en vivo de pisos, asignación de camareras y cambio de estatus de limpieza en tiempo real.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Filtrar por Piso</label>
                <select value={selectedFloor} onChange={(e) => setSelectedFloor(e.target.value)}>
                  <option value="">Todos los pisos (3 - 10)</option>
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(p => <option key={p} value={p}>Piso {p}</option>)}
                </select>
              </div>
            </div>

            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Hab.</th>
                    <th>Piso</th>
                    <th>Tipo</th>
                    <th>Estatus Actual</th>
                    <th>Camarera / Asignada</th>
                    <th>Acción Ama de Llaves</th>
                  </tr>
                </thead>
                <tbody>
                  {habitaciones
                    .filter(h => !selectedFloor || String(h.floor) === String(selectedFloor))
                    .map(h => (
                      <tr key={h.id}>
                        <td><strong>{safeVal(h.number)}</strong></td>
                        <td>Piso {safeVal(h.floor)}</td>
                        <td>{safeVal(h.type)}</td>
                        <td>
                          <span className={getStatusClass(h.status)} style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                            {safeVal(h.status)}
                          </span>
                        </td>
                        <td>{safeVal(h.reporte?.amaDeLlaves || h.reporte?.asistente, 'Sin asignar')}</td>
                        <td>
                          <button 
                            onClick={() => {
                              setSelectedAmaRoom(h);
                              setAmaCamareraAsignada(h.reporte?.amaDeLlaves || '');
                              setAmaEstadoNuevo(h.status === 'Disponible' ? 'Limpia / Disponible' : h.status);
                              setShowAmaDeLlavesModal(true);
                            }}
                            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>
                            ✏️ Modificar / Asignar
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL DE EDICIÓN DE PRECIO */}
        {editingProduct && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>✏️ Modificar Producto: {safeVal(editingProduct.name)}</h3>
              <form onSubmit={handleGuardarEdicionProducto} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Nombre del Producto</label>
                  <input value={editingProduct.name || ''} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} required />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Precio USD ($)</label>
                  <input type="number" step="0.01" value={editingProduct.price_usd || 0} onChange={e => setEditingProduct({ ...editingProduct, price_usd: parseFloat(e.target.value) || 0 })} required />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Stock Disponible</label>
                  <input type="number" value={editingProduct.stock || 0} onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })} required />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button type="submit" className="success" style={{ flex: 1 }}>💾 Guardar Cambios</button>
                  <button type="button" onClick={() => setEditingProduct(null)} style={{ background: '#cbd5e1', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE FACTURACIÓN */}
        {roomToBill && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>🧾 Facturación Check-Out — Habitación {safeVal(roomToBill.number)}</h3>
              <p style={{ fontSize: '12px', color: '#64748b' }}>Responsable: <strong>{safeVal(roomToBill.reporte?.asistente, 'N/A')}</strong></p>

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
                {roomToBill.reporte?.consumos && typeof roomToBill.reporte.consumos === 'object' ? (
                  Object.entries(roomToBill.reporte.consumos).map(([id, qty]) => {
                    const numQty = Number(qty) || 0;
                    if (numQty <= 0) return null;
                    const item = inventario.find(i => String(i.id) === String(id));
                    const itemName = item ? safeVal(item.name) : safeVal(id);
                    const itemPrice = Number(item?.price_usd) || 0;
                    return (
                      <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', margin: '4px 0' }}>
                        <span>{numQty}x {itemName}</span>
                        <strong>${(numQty * itemPrice).toFixed(2)} USD</strong>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ fontSize: '12px', color: '#64748b' }}>Sin consumos detallados registrados.</p>
                )}
                <hr style={{ margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
                  <span>TOTAL USD:</span>
                  <span>${Number(roomToBill.reporte?.totalUSD || roomToBill.amount || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', color: '#059669', marginTop: '4px' }}>
                  <span>TOTAL BS (BCV {tasaBCV.toFixed(2)}):</span>
                  <span>Bs. {Number(roomToBill.reporte?.totalBs || (roomToBill.amount || 0) * tasaBCV).toFixed(2)}</span>
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
                <select 
                  value={selectedFloor} 
                  onChange={(e) => {
                    setSelectedFloor(e.target.value);
                    setSelectedRoom(null);
                  }}>
                  <option value="">Seleccione piso...</option>
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(p => <option key={p} value={p}>Piso {p}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Asistente Encargada</label>
                <select value={asistenteSeleccionada} onChange={(e) => setAsistenteSeleccionada(e.target.value)}>
                  <option value="">Seleccionar Asistente...</option>
                  {personal.filter(p => safeVal(p.rol).toLowerCase().includes('asistente') || safeVal(p.rol).toLowerCase().includes('nocturno')).map(a => (
                    <option key={a.id} value={safeVal(a.nombre)}>{safeVal(a.nombre)} ({safeVal(a.turno)})</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedFloor && (
              <div className="card-box" style={{ background: '#f8fafc', marginTop: '8px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Habitación del Piso {selectedFloor}</label>
                  <select 
                    value={selectedRoom ? selectedRoom.id : ''} 
                    onChange={(e) => setSelectedRoom(habitaciones.find(h => String(h.id) === e.target.value) || null)}>
                    <option value="">-- Seleccionar Habitación --</option>
                    {habitaciones
                      .filter(h => String(h.floor) === String(selectedFloor))
                      .map(h => (
                        <option key={h.id} value={h.id}>Habitación {safeVal(h.number)} ({safeVal(h.type)}) — {safeVal(h.status)}</option>
                      ))}
                  </select>
                </div>

                {selectedRoom && (
                  <>
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase' }}>📦 Consumos Minibar</h4>
                      {inventario.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '8px' }}>
                          <div>
                            <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{safeVal(item.name)}</span>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>${(Number(item.price_usd) || 0).toFixed(2)} USD</div>
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
                      {subiendoArchivo ? 'Subiendo Evidencia...' : '🚨 Ejecutar Check-Out'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* VISTA SUPERVISORA */}
        {role === 'supervisora' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }} className="card-box">
            <h2 style={{ fontSize: '20px', margin: 0 }}>📋 Panel de Inspección y Control de Supervisión</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Supervisora en Turno</label>
                <select value={supervisoraSeleccionada} onChange={(e) => setSupervisoraSeleccionada(e.target.value)}>
                  <option value="">Seleccionar Supervisora...</option>
                  {personal.filter(p => safeVal(p.rol).toLowerCase().includes('supervisora')).map(s => (
                    <option key={s.id} value={safeVal(s.nombre)}>{safeVal(s.nombre)}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Filtrar Piso</label>
                <select value={selectedFloor} onChange={(e) => setSelectedFloor(e.target.value)}>
                  <option value="">Todos los pisos</option>
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(p => <option key={p} value={p}>Piso {p}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <h3 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>Habitaciones Sucias / Pendientes por Inspección</h3>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Hab.</th>
                      <th>Piso</th>
                      <th>Tipo</th>
                      <th>Estatus Actual</th>
                      <th>Reporte Asistente</th>
                      <th>Acción Supervisora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {habitaciones
                      .filter(h => !selectedFloor || String(h.floor) === String(selectedFloor))
                      .filter(h => safeVal(h.status).toLowerCase().includes('sucia') || safeVal(h.status).toLowerCase().includes('por facturar'))
                      .map(h => (
                        <tr key={h.id}>
                          <td><strong>{safeVal(h.number)}</strong></td>
                          <td>Piso {safeVal(h.floor)}</td>
                          <td>{safeVal(h.type)}</td>
                          <td>
                            <span className={getStatusClass(h.status)} style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                              {safeVal(h.status)}
                            </span>
                          </td>
                          <td>{safeVal(h.reporte?.asistente, 'Sin asignar')}</td>
                          <td>
                            <button 
                              onClick={async () => {
                                if (!supervisoraSeleccionada) {
                                  return alert('⚠️ Seleccione la supervisora a cargo antes de liberar la habitación.');
                                }
                                const habActualizadas = habitaciones.map(room => 
                                  String(room.id) === String(h.id) ? { ...room, status: 'Disponible', amount: 0, reporte: null } : room
                                );
                                setHabitaciones(habActualizadas);
                                localStorage.setItem('condor_habitaciones', JSON.stringify(habActualizadas));
                                try {
                                  await supabase.from('habitaciones').update({ status: 'Disponible', amount: 0, reporte: null }).eq('id', h.id);
                                } catch (e) {}
                                alert(`✅ Habitación ${safeVal(h.number)} inspeccionada por ${supervisoraSeleccionada} y marcada como DISPONIBLE.`);
                              }}
                              style={{ background: '#059669', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>
                              Aprobar y Liberar (Disponible)
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

        {/* VISTA 4: ADMINISTRACIÓN */}
        {role === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* GESTIÓN DE INVENTARIO */}
            <div className="card-box">
              <h3 style={{ margin: 0, fontSize: '18px' }}>📦 Gestión de Inventario</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!nuevoItem.name || !nuevoItem.id) return alert('Complete los datos del producto');
                
                setInventario(prev => {
                  const existe = prev.some(i => i.id === nuevoItem.id);
                  return existe ? prev.map(i => i.id === nuevoItem.id ? nuevoItem : i) : [...prev, nuevoItem];
                });

                try {
                  const { error } = await supabase.from('inventario').upsert(nuevoItem);
                  if (error) alert(`⚠️ Supabase Error: ${error.message}`);
                } catch (err) {}

                setNuevoItem({ id: '', name: '', category: 'minibar', price_usd: 0, stock: 0 });
                alert('✅ Producto guardado en inventario.');
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
                        <td><code>{safeVal(item.id)}</code></td>
                        <td><strong>{safeVal(item.name)}</strong></td>
                        <td style={{ textTransform: 'capitalize' }}>{safeVal(item.category)}</td>
                        <td>${(Number(item.price_usd) || 0).toFixed(2)}</td>
                        <td>{safeVal(item.stock)} unidades</td>
                        <td style={{ textAlign: 'center', display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button onClick={() => setEditingProduct(item)} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                            Modificar
                          </button>
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
                  <option value="Ama de Llaves">Ama de Llaves</option>
                  <option value="Supervisora">Supervisora</option>
                  <option value="Equipo Nocturno">Equipo Nocturno (7 PM - 7 AM)</option>
                </select>
                <input 
                  placeholder="Turno / Pisos Asignados" 
                  value={nuevoPersonal.turno} 
                  onChange={e => setNuevoPersonal({...nuevoPersonal, turno: e.target.value})} 
                  style={{ flex: 1, minWidth: '200px' }} 
                />
                <button type="submit" className="primary" style={{ width: 'auto' }}>+ Agregar Personal</button>
              </form>

              {/* TABLA ASISTENTES */}
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '14px' }}>🧹 Asistentes de Piso</h4>
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
                    {personal.filter(p => safeVal(p.rol).toLowerCase().includes('asistente')).map(p => (
                      <tr key={p.id}>
                        <td><strong>{safeVal(p.nombre)}</strong></td>
                        <td><span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{safeVal(p.rol)}</span></td>
                        <td>{safeVal(p.turno)}</td>
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
                <h4 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '14px' }}>📋 Supervisoras / Ama de Llaves</h4>
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
                    {personal.filter(p => safeVal(p.rol).toLowerCase().includes('supervisora') || safeVal(p.rol).toLowerCase().includes('llaves')).map(p => (
                      <tr key={p.id}>
                        <td><strong>{safeVal(p.nombre)}</strong></td>
                        <td><span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{safeVal(p.rol)}</span></td>
                        <td>{safeVal(p.turno)}</td>
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
                    {personal.filter(p => safeVal(p.rol).toLowerCase().includes('nocturno')).map(p => (
                      <tr key={p.id}>
                        <td><strong>{safeVal(p.nombre)}</strong></td>
                        <td><span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{safeVal(p.rol)}</span></td>
                        <td>{safeVal(p.turno)}</td>
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