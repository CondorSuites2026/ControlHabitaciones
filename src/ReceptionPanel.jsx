import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function () {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fetchRooms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('habitaciones')
      .select('*')
      .order('number', { ascending: true });

    if (error) {
      console.error('Error al cargar habitaciones:', error.message);
    } else {
      setRooms(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'disponible':
        return 'bg-emerald-200 text-emerald-900 border-emerald-300';
      case 'ocupada':
        return 'bg-cyan-200 text-cyan-900 border-cyan-300';
      case 'reservada':
        return 'bg-pink-200 text-pink-900 border-pink-300';
      case 'sucia':
        return 'bg-amber-200 text-amber-900 border-amber-300';
      case 'bloqueada':
        return 'bg-red-500 text-white border-red-600';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const handleImageUpload = async (e, roomNumber) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `evidencia_${roomNumber}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('evidencias-habitaciones')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('evidencias-habitaciones')
        .getPublicUrl(fileName);

      const imageUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('habitaciones')
        .update({ evidence_url: imageUrl })
        .eq('number', roomNumber);

      if (updateError) throw updateError;

      alert('¡Evidencia subida exitosamente!');
      fetchRooms();
    } catch (error) {
      console.error('Error al subir:', error.message);
      alert('Error al subir la evidencia.');
    } finally {
      setUploading(false);
    }
  };

  const floors = [3, 4, 5, 6, 7, 8, 9, 10];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', fontWeight: 'bold' }}>Cargando panel de Condor Suites...</div>;
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px', backgroundColor: '#ffffff', fontFamily: 'sans-serif' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Hotel Cóndor Suites Lechería</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>Gestión Operativa de Habitaciones (Pisos 3 - 10)</p>
        </div>
        
        {/* Leyenda */}
        <div style={{ display: 'flex', gap: '8px', fontSize: '12px', fontWeight: '600', flexWrap: 'wrap' }}>
          <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#b2f2bb', color: '#1b4332' }}>Disponible</span>
          <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#a5f3fc', color: '#083344' }}>Ocupada</span>
          <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#fbcfe8', color: '#831843' }}>Reservada</span>
          <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#fef08a', color: '#713f12' }}>Sucia</span>
          <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#ef4444', color: '#ffffff' }}>Bloqueada</span>
        </div>
      </div>

      {/* Matriz de Pisos con Estilo en Línea Seguro para evitar colapsos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {floors.map((floorNum) => {
          const floorRooms = rooms.filter((r) => r.floor === floorNum);

          return (
            <div key={floorNum} style={{ display: 'flex', gap: '10px', alignItems: 'stretch', flexWrap: 'wrap' }}>
              {/* Etiqueta de Piso */}
              <div style={{ width: '90px', backgroundColor: '#1f2937', color: '#ffffff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', fontSize: '13px', padding: '8px' }}>
                PISO {floorNum}
              </div>

              {/* Contenedor de Habitaciones en Grilla */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', flex: 1 }}>
                {floorRooms.map((room) => (
                  <div
                    key={room.number}
                    onClick={() => setSelectedRoom(room)}
                    className={getStatusColor(room.status)}
                    style={{
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '6px',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '90px',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'transform 0.1s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '4px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{room.number}</span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {room.evidence_url && <span style={{ fontSize: '9px', background: '#2563eb', color: '#fff', padding: '1px 3px', borderRadius: '3px' }}>📷</span>}
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', opacity: 0.8 }}>{room.type}</span>
                      </div>
                    </div>

                    <div style={{ fontSize: '11px', lineHeight: '1.2', marginTop: '4px' }}>
                      <p style={{ fontWeight: 'bold', margin: 0 }}>{room.status}</p>
                      {room.guest && <p style={{ margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.guest}</p>}
                      {room.amount && <p style={{ margin: '2px 0 0', fontFamily: 'monospace', fontSize: '10px' }}>{room.amount}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Detalle / Evidencias */}
      {selectedRoom && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: '#111827' }}>
              Habitación {selectedRoom.number} ({selectedRoom.type})
            </h3>
            <p style={{ fontSize: '13px', color: '#4b5563', marginBottom: '12px' }}>Estado: <strong>{selectedRoom.status}</strong></p>
            {selectedRoom.guest && <p style={{ fontSize: '13px', marginBottom: '4px' }}>Huésped: <strong>{selectedRoom.guest}</strong></p>}
            {selectedRoom.amount && <p style={{ fontSize: '13px', marginBottom: '16px' }}>Monto: <strong>{selectedRoom.amount}</strong></p>}

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Evidencia Fotográfica:</label>
              {selectedRoom.evidence_url ? (
                <div style={{ marginBottom: '12px' }}>
                  <a href={selectedRoom.evidence_url} target="_blank" rel="noopener noreferrer">
                    <img src={selectedRoom.evidence_url} alt="Evidencia" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                  </a>
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>No hay evidencia cargada.</p>
              )}

              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, selectedRoom.number)}
                disabled={uploading}
                style={{ fontSize: '12px', width: '100%' }}
              />
              {uploading && <p style={{ fontSize: '12px', color: '#7c3aed', marginTop: '4px' }}>Subiendo imagen...</p>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedRoom(null)}
                style={{ padding: '8px 16px', backgroundColor: '#e5e7eb', color: '#1f2937', borderRadius: '6px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}