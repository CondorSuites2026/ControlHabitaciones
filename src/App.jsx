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

  // Modal para cambio rápido de estado desde Recepción (Ocupar, Reservar, Disponible)
  const [showChangeStatusModal, setShowChangeStatusModal] = useState(false);
  const [roomToChangeStatus, setRoomToChangeStatus] = useState(null);
  const [nuevoEstatusRecepcion, setNuevoEstatusRecepcion] = useState('Ocupada');

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

  const handleCambiarEstatusRecepcion = async (e) => {
    e.preventDefault();
    if (!roomToChangeStatus) return;

    const habActualizadas = habitaciones.map(room => {
      if (String(room.id) === String(roomToChangeStatus.id)) {
        return {
          ...room,
          status: nuevoEstatusRecepcion
        };
      }
      return room;
    });

    setHabitaciones(habActualizadas);
    localStorage.setItem('condor_habitaciones', JSON.stringify(habActualizadas));

    try {
      const { error } = await supabase.from('habitaciones').upsert({
        id: String(roomToChangeStatus.id),
        number: safeVal(roomToChangeStatus.number),
        floor: roomToChangeStatus.floor,
        type: safeVal(roomToChangeStatus.type),
        status: nuevoEstatusRecepcion,
        amount: roomToChangeStatus.amount || 0,
        reporte: roomToChangeStatus.reporte || null
      });

      if (error) {
        console.error('Error enviando estatus a Supabase:', error);
      }
    } catch (err) {}

    setShowChangeStatusModal(false);
    setRoomToChangeStatus(null);
    alert(`✅ Habitación ${safeVal(roomToChangeStatus.number)} marcada como: ${nuevoEstatusRecepcion.toUpperCase()}`);
  };

  const handleAgregarPersonal = async (e) => {
    e.preventDefault();
    if (!nuevoPersonal.nombre || !nuevoPersonal.turno) {
      return alert('⚠️ Ingrese el nombre y el turno del personal.');
    }
    
    // Generación de ID numérico único seguro
    const numericId = Math.floor(Date.now() % 2147483647);
    
    const nuevoObj = {
      id: numericId,
      nombre: String(nuevoPersonal.nombre).trim(),
      rol: String(nuevoPersonal.rol).trim(),
      turno: String(nuevoPersonal.turno).trim()
    };

    // Actualizamos el estado local inmediatamente
    const nuevoPersonalLista = [...personal, nuevoObj];
    setPersonal(nuevoPersonalLista);
    try {
      localStorage.setItem('condor_personal', JSON.stringify(nuevoPersonalLista));
    } catch (err) {}

    // Intentamos guardar / upsert en Supabase
    try {
      const { data, error } = await supabase.from('personal').upsert([nuevoObj]);
      if (error) {
        console.error('Error al insertar en Supabase:', error);
        alert(`⚠️ Guardado localmente. Nota de Supabase: ${error.message}\n(Asegúrate de revisar las políticas RLS en Supabase si no aparece)`);
      } else {
        alert(`✅ Personal (${nuevoObj.nombre}) guardado con éxito en Supabase y localmente.`);
      }
    } catch (err) {
      console.error('Error inesperado:', err);
    }

    setNuevoPersonal({ nombre: '', rol: 'Asistente', turno: '' });
  };

  const handleEliminarPersonal = async (id) => {
    const nuevaLista = personal.filter(p => p.id !== id);
    setPersonal(nuevaLista);
    try {
      localStorage.setItem('condor_personal', JSON.stringify(nuevaLista));
    } catch (e) {}

    try {
      await supabase.from('personal').delete().eq('id', id);
    } catch (e) {}
  };

  const handleEliminarInventario = async (id) => {
    setInventario(prev => prev.filter(i => i.id !== id));
    try {
      await supabase.from('inventario').delete().eq('id', id);
    } catch (e) {}
  };

  const handleGuardarEdicionProducto = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    setInventario(prev => prev.map(item => item.id === editingProduct.id ? editingProduct : item));

    try {
      await supabase.from('inventario').upsert(editingProduct);
    } catch (e) {}

    setEditingProduct(null);
    alert('✅ Producto actualizado correctamente.');
  };

  const handleQtyChange = (itemId, change) => {
    setConsumosSeleccionados(prev => {
      const actual = prev[itemId] || 0;
      const nuevo = Math.max(0, actual + change);
      return { ...prev, [itemId]: nuevo };
    });
  };

  const handleEjecutarCheckout = async () => {
    if (!selectedRoom) return alert('⚠️ Seleccione una habitación.');
    if (!asistenteSeleccionada) return alert('⚠️ Seleccione la asistente encargada.');

    setSubiendoArchivo(true);
    let evidenciaData = null;

    if (archivoEvidencia) {
      try {
        const fileExt = archivoEvidencia.name.split('.').pop();
        const fileName = `${Date.now()}_${selectedRoom.number}.${fileExt}`;
        const filePath = `evidencias/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('hotel_evidencias')
          .upload(filePath, archivoEvidencia);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('hotel_evidencias')
            .getPublicUrl(filePath);

          evidenciaData = {
            url: urlData.publicUrl,
            tipo: archivoEvidencia.type.startsWith('video') ? 'video' : 'imagen'
          };
        }
      } catch (e) {}
    }

    let totalUSD = 0;
    Object.entries(consumosSeleccionados).forEach(([id, qty]) => {
      if (qty > 0) {
        const item = inventario.find(i => String(i.id) === String(id));
        if (item) totalUSD += (Number(item.price_usd) || 0) * qty;
      }
    });

    const totalBs = totalUSD * tasaBCV;
    const nuevoEstatus = 'Sucia (Por Facturar)';

    const reporteObj = {
      asistente: asistenteSeleccionada,
      consumos: consumosSeleccionados,
      totalUSD,
      totalBs,
      evidencia: evidenciaData,
      fecha: new Date().toISOString()
    };

    const habActualizadas = habitaciones.map(r => {
      if (String(r.id) === String(selectedRoom.id)) {
        return {
          ...r,
          status: nuevoEstatus,
          amount: totalUSD,
          reporte: reporteObj
        };
      }
      return r;
    });

    setHabitaciones(habActualizadas);
    localStorage.setItem('condor_habitaciones', JSON.stringify(habActualizadas));

    try {
      await supabase.from('habitaciones').upsert({
        id: String(selectedRoom.id),
        number: safeVal(selectedRoom.number),
        floor: selectedRoom.floor,
        type: safeVal(selectedRoom.type),
        status: nuevoEstatus,
        amount: totalUSD,
        reporte: reporteObj
      });
    } catch (e) {}

    setSubiendoArchivo(false);
    setSelectedRoom(null);
    setConsumosSeleccionados({});
    setArchivoEvidencia(null);
    alert(`✅ Check-Out registrado para Hab. ${safeVal(selectedRoom.number)}. Enviado a Recepción para Facturación.`);
  };

  const handleConfirmarFacturacion = async (roomId) => {
    const habActualizadas = habitaciones.map(r => {
      if (String(r.id) === String(roomId)) {
        return {
          ...r,
          status: 'Sucia',
          amount: 0,
          reporte: null
        };
      }
      return r;
    });

    setHabitaciones(habActualizadas);
    localStorage.setItem('condor_habitaciones', JSON.stringify(habActualizadas));

    const habToUpdate = habitaciones.find(h => String(h.id) === String(roomId));

    try {
      await supabase.from('habitaciones').upsert({
        id: String(roomId),
        number: safeVal(habToUpdate?.number),
        floor: habToUpdate?.floor,
        type: safeVal(habToUpdate?.type),
        status: 'Sucia',
        amount: 0,
        reporte: null
      });
    } catch (e) {}

    setRoomToBill(null);
    alert('✅ Cobro confirmado. Habitación marcada como SUCIA para limpieza.');
  };

  const habitacionesPendientes = habitaciones.filter(h => safeVal(h.status).toLowerCase().includes('por facturar'));

  const getStatusClass = (statusStr) => {
    const s = safeVal(statusStr).toLowerCase();
    if (s.includes('disponible') || s.includes('limpia')) return 'badge-disponible';
    if (s.includes('ocupada')) return 'badge-ocupada';
    if (s.includes('reservada')) return 'badge-reservada';
    if (s.includes('facturar')) return 'badge-facturar';
    if (s.includes('sucia')) return 'badge-sucia';
    return 'badge-bloqueada';
  };

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
      <style>{`
        .alerta-parpadeante { animation: parpadeo 1.2s infinite; }
        @keyframes parpadeo { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; font-size: 13px; }
        th, td { padding: 10px; border: 1px solid #e2e8f0; text-align: left; }
        th { background: #f1f5f9; font-weight: bold; color: #334155; }
        .badge-disponible { background: #dcfce7; color: #166534; }
        .badge-ocupada { background: #fee2e2; color: #991b1b; }
        .badge-reservada { background: #f3e8ff; color: #6b21a8; }
        .badge-facturar { background: #fef3c7; color: #92400e; }
        .badge-sucia { background: #fef08a; color: #854d0e; }
        .badge-bloqueada { background: #e2e8f0; color: #475569; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
        .modal-card { background: #fff; padding: 20px; border-radius: 12px; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); }
        .card-box { background: #fff; padding: 16px; border-radius: 10px; border: 1px solid #cbd5e1; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; width: 100%; }
        button.primary { background: #1e40af; color: #fff; border: none; padding: 10px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }
        button.primary:hover { background: #1d4ed8; }
        button.success { background: #16a34a; color: #fff; border: none; padding: 10px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }
        select, input, textarea { width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px; box-sizing: border-box; }
        .grid-responsive { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 640px) {
          .grid-responsive { grid-template-columns: 1fr 1fr; }
        }
        .btn-asistente-banner {
          background: #3b82f6;
          color: #ffffff;
          border: 1px solid #93c5fd;
          padding: 8px 14px;
          border-radius: 6px;
          font-weight: bold;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease-in-out;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .btn-asistente-banner:hover {
          background: #2563eb;
          transform: translateY(-1px);
        }
        .btn-asistente-banner.active {
          background: #10b981;
          border-color: #6ee7b7;
          color: #ffffff;
        }
      `}</style>

      {/* HEADER AMIGABLE CON LOGO Y ACCESO RÁPIDO A ASISTENTE MÓVIL */}
      <header style={{ background: '#1e3a8a', color: '#fff', padding: '12px 20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
        {/* LOGO DEL HOTEL CONDOR SUITES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#ffffff', padding: '4px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="130" height="36" viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', maxWidth: '100%', height: 'auto' }}>
              <text x="10" y="70" fontFamily="serif" fontSize="58" fontWeight="bold" fill="#000000" letterSpacing="1">CONDOR</text>
              <text x="120" y="105" fontFamily="serif" fontSize="26" fontWeight="bold" fill="#000000" letterSpacing="6">SUITES</text>
              <path d="M 285 30 L 325 100 C 330 108 340 108 345 100 L 360 75 Z" fill="#000000" />
              <path d="M 295 15 L 340 90 C 345 98 355 98 360 90 L 380 50 Z" fill="#000000" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', color: '#bfdbfe', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>Sistema Integral de Control</span>
          </div>
        </div>

        {/* CONTROLES SUPERIORES: TASA BCV, BOTÓN ASISTENTE MÓVIL Y SELECTOR DE VISTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* TASA BCV */}
          <div style={{ background: 'rgba(255,255,255,0.15)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.25)', color: '#ffffff', flexShrink: 0 }}>
            💵 Tasa BCV: <strong>Bs. {tasaBCV.toFixed(2)}</strong>
          </div>

          {/* BOTÓN DIRECTO DE ASISTENTE MÓVIL */}
          <button 
            type="button"
            className={`btn-asistente-banner ${role === 'asistente' ? 'active' : ''}`}
            onClick={() => setRole('asistente')}
            title="Acceso directo rápido para Asistentes Móviles">
            📱 Asistente Móvil {role === 'asistente' && '✓'}
          </button>

          {/* SELECTOR DE ROL/VISTA */}
          <select 
            value={role} 
            onChange={e => setRole(e.target.value)}
            style={{ background: '#ffffff', color: '#1e3a8a', border: '1px solid #93c5fd', fontWeight: 'bold', padding: '8px 12px', minWidth: '170px', borderRadius: '6px', cursor: 'pointer' }}>
            <option value="recepcion">🏢 Recepción / Tablero</option>
            <option value="amadeclaves">🔑 Ama de Llaves</option>
            <option value="asistente">📱 Asistente Móvil</option>
            <option value="supervisora">📋 Supervisora</option>
            <option value="admin">⚙️ Administración</option>
          </select>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ padding: '16px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* VISTA RECEPCIÓN */}
        {role === 'recepcion' && (
          <div className="card-box">
            <h2 style={{ fontSize: '18px', margin: 0, color: '#1e3a8a' }}>🏢 Tablero Control de Recepción</h2>
            {habitacionesPendientes.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                            onClick={() => {
                              if (esAlerta) {
                                setRoomToBill(hab);
                              } else {
                                setRoomToChangeStatus(hab);
                                setNuevoEstatusRecepcion(hab.status || 'Ocupada');
                                setShowChangeStatusModal(true);
                              }
                            }}
                            className={`${badgeClass} ${esAlerta ? 'alerta-parpadeante' : ''}`}
                            style={{ cursor: 'pointer', height: '70px', verticalAlign: 'top', position: 'relative' }}>
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
                            <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px', textAlign: 'right' }}>✏️ cambiar</div>
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

        {/* MODAL CAMBIO DE ESTATUS RECEPCIÓN */}
        {showChangeStatusModal && roomToChangeStatus && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>🏢 Estado de Habitación {safeVal(roomToChangeStatus.number)}</h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 12px 0' }}>Piso {safeVal(roomToChangeStatus.floor)} — Tipo: {safeVal(roomToChangeStatus.type)}</p>
              
              <form onSubmit={handleCambiarEstatusRecepcion} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Seleccionar Nuevo Estatus</label>
                  <select 
                    value={nuevoEstatusRecepcion} 
                    onChange={e => setNuevoEstatusRecepcion(e.target.value)}
                    style={{ padding: '10px', fontSize: '14px', fontWeight: 'bold' }}>
                    <option value="Ocupada">🔴 OCUPADA (Huésped en Habitación)</option>
                    <option value="Disponible">🟢 DISPONIBLE (Lista para Check-In)</option>
                    <option value="Reservada">🟣 RESERVADA (Confirmada)</option>
                    <option value="Sucia">🟡 SUCIA (Pendiente por Limpieza)</option>
                    <option value="Bloqueada / Mantenimiento">⚙️ BLOQUEADA / MANTENIMIENTO</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button type="submit" className="primary" style={{ flex: 1, padding: '12px' }}>💾 Aplicar y Sincronizar</button>
                  <button type="button" onClick={() => setShowChangeStatusModal(false)} style={{ background: '#cbd5e1', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                </div>
              </form>
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
          <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }} className="card-box">
            <h2 style={{ fontSize: '18px', margin: 0, color: '#1e3a8a' }}>📱 Check-Out e Inspección Móvil</h2>

            <div className="grid-responsive">
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
              <div className="card-box" style={{ background: '#f8fafc', marginTop: '4px' }}>
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
                    <div style={{ marginTop: '8px' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', color: '#1e3a8a' }}>📦 Consumos Minibar</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {inventario.map(item => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div>
                              <span style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', color: '#1e293b' }}>{safeVal(item.name)}</span>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>${(Number(item.price_usd) || 0).toFixed(2)} USD</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button type="button" onClick={() => handleQtyChange(item.id, -1)} style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>-</button>
                              <span style={{ width: '20px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>{consumosSeleccionados[item.id] || 0}</span>
                              <button type="button" onClick={() => handleQtyChange(item.id, 1)} style={{ width: '34px', height: '34px', borderRadius: '6px', border: 'none', background: '#1e40af', color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px', color: '#1e293b' }}>📸 ADJUNTAR EVIDENCIA (FOTO/VIDEO)</label>
                      <input type="file" accept="image/*,video/*" onChange={(e) => setArchivoEvidencia(e.target.files[0] || null)} style={{ fontSize: '12px' }} />
                      {archivoEvidencia && <p style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold', margin: '4px 0 0 0' }}>Archivo: {archivoEvidencia.name}</p>}
                    </div>

                    <button 
                      type="button"
                      disabled={subiendoArchivo} 
                      className="primary" 
                      onClick={handleEjecutarCheckout}
                      style={{ padding: '14px', fontSize: '15px', marginTop: '4px' }}>
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