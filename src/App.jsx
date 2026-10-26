import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Smartphone, Monitor, RefreshCw, CheckCircle2, AlertTriangle, 
  DollarSign, Plus, Minus, Camera, Check, ShieldCheck, Settings, Trash2, 
  PackagePlus, Save, Upload, ClipboardCheck, Eye, Database, Cloud, CloudOff 
} from 'lucide-react';

// Catalogo inicial de items del minibar y amenidades
const INITIAL_CATALOG_ITEMS = [
  { id: 'm1', name: 'Agua Mineral 500ml', category: 'MINIBAR', priceUSD: 2.0, defaultQty: 2, isLinen: false },
  { id: 'm2', name: 'Refresco en Lata', category: 'MINIBAR', priceUSD: 2.5, defaultQty: 2, isLinen: false },
  { id: 'm3', name: 'Cerveza Nacional', category: 'MINIBAR', priceUSD: 3.0, defaultQty: 4, isLinen: false },
  { id: 'm4', name: 'Snack / Papitas', category: 'MINIBAR', priceUSD: 2.5, defaultQty: 2, isLinen: false },
  { id: 'm5', name: 'Chocolate Importado', category: 'MINIBAR', priceUSD: 4.0, defaultQty: 1, isLinen: false },
  { id: 'a1', name: 'Kit Dental Premium', category: 'AMENIDADES', priceUSD: 1.5, defaultQty: 2, isLinen: false },
  { id: 'a2', name: 'Shampoo / Acondicionador 50ml', category: 'AMENIDADES', priceUSD: 1.0, defaultQty: 2, isLinen: false },
  { id: 'a3', name: 'Crema Corporal', category: 'AMENIDADES', priceUSD: 1.5, defaultQty: 2, isLinen: false },
  { id: 'a4', name: 'Gorro de Ducha', category: 'AMENIDADES', priceUSD: 0.5, defaultQty: 0, isLinen: false },
  { id: 'l1', name: 'Toalla de Baño Grande', category: 'LENCERIA', priceUSD: 25.0, defaultQty: 0, isLinen: true },
  { id: 'l2', name: 'Toalla de Mano', category: 'LENCERIA', priceUSD: 12.0, defaultQty: 0, isLinen: true },
  { id: 'l3', name: 'Sábana Matrimonial / King', category: 'LENCERIA', priceUSD: 45.0, defaultQty: 0, isLinen: true },
  { id: 'l4', name: 'Funda de Almohada', category: 'LENCERIA', priceUSD: 10.0, defaultQty: 0, isLinen: true },
  { id: 'v1', name: 'Taza de Café con Plato', category: 'VAJILLA', priceUSD: 8.0, defaultQty: 0, isLinen: true },
  { id: 'v2', name: 'Vaso de Vidrio', category: 'VAJILLA', priceUSD: 5.0, defaultQty: 0, isLinen: true },
  { id: 'v3', name: 'Copa de Vino', category: 'VAJILLA', priceUSD: 10.0, defaultQty: 0, isLinen: true },
];

// Dos asistentes asignadas por cada piso (Pisos 3 al 10)
const INITIAL_ASSISTANTS_BY_FLOOR = {
  3: ['Asistente 3A (Ana G.)', 'Asistente 3B (Rosa F.)'],
  4: ['Asistente 4A (Carmen T.)', 'Asistente 4B (Luisa P.)'],
  5: ['Asistente 5A (Mariela R.)', 'Asistente 5B (Elena V.)'],
  6: ['Asistente 6A (Patricia S.)', 'Asistente 6B (Yajaira N.)'],
  7: ['Asistente 7A (Zulay K.)', 'Asistente 7B (Norelys C.)'],
  8: ['Asistente 8A (Milagros D.)', 'Asistente 8B (Daniela F.)'],
  9: ['Asistente 9A (Solange B.)', 'Asistente 9B (Maritza I.)'],
  10: ['Asistente 10A (Victoria P.)', 'Asistente 10B (Carolina M.)'],
};

// Generacion dinamica de habitaciones por piso
const generateDefaultRooms = () => {
  const rooms = [];
  for (let floor = 3; floor <= 10; floor++) {
    let roomTypes = [];
    if (floor === 10) {
      roomTypes = ['MASTER', 'ESPECIAL', 'PRESIDENCIAL', 'PRESIDENCIAL'];
    } else {
      roomTypes = ['MASTER', 'MASTER', 'MASTER', 'JUNIOR', 'JUNIOR', 'SENCILLA', 'SENCILLA'];
    }

    roomTypes.forEach((type, idx) => {
      const roomNum = floor * 100 + (idx + 1);
      let status = 'DISPONIBLE';
      let guest = '';
      let balanceBs = 0;
      let checkOutDate = '';
      let phone = '';

      if (roomNum === 304) { status = 'SUCIA'; }
      if (roomNum === 305) { status = 'OCUPADA'; guest = 'Velásquez Alfonso'; balanceBs = 3.45; phone = '04141234567'; }
      if (roomNum === 308) { status = 'RESERVADA'; guest = 'Chiarello Luigi'; phone = '04145670117'; }
      if (roomNum === 403) { status = 'OCUPADA'; guest = 'Sánchez Jenny'; balanceBs = 36957.55; checkOutDate = '2026-10-26'; }
      if (roomNum === 406) { status = 'OCUPADA'; guest = 'Rivera Hernán'; balanceBs = 96137.76; checkOutDate = '2026-10-26'; }
      if (roomNum === 407) { status = 'OCUPADA'; guest = 'Coello Katalina'; balanceBs = 96137.76; checkOutDate = '2026-10-26'; }
      if (roomNum === 408) { status = 'OCUPADA'; guest = 'Ortega Carla'; balanceBs = 3.45; }
      if (roomNum === 409) { status = 'OCUPADA'; guest = 'Correa Victoria'; balanceBs = 3.45; }
      if (roomNum === 506) { status = 'OCUPADA'; guest = 'Santamaría Juan'; balanceBs = 96137.76; checkOutDate = '2026-10-26'; }
      if (roomNum === 508) { status = 'OCUPADA'; guest = 'Cairos Braulio'; balanceBs = -3.15; }
      if (roomNum === 509) { status = 'OCUPADA'; guest = 'Pérez Renzo'; balanceBs = -3.15; }
      if (roomNum === 602) { status = 'OCUPADA'; guest = 'Rosenkilde Paul'; balanceBs = -127223.26; }
      if (roomNum === 603) { status = 'BLOQUEADA'; }
      if (roomNum === 702) { status = 'SUCIA'; }
      if (roomNum === 705) { status = 'OCUPADA'; guest = 'Oliveros Erika'; balanceBs = -1170494.78; }
      if (roomNum === 709) { status = 'RESERVADA'; guest = 'Cardona Hernando'; }
      if (roomNum === 802) { status = 'SUCIA'; }
      if (roomNum === 803) { status = 'SUCIA'; }
      if (roomNum === 804) { status = 'OCUPADA'; guest = 'Rondón Javier'; balanceBs = 96137.76; }
      if (roomNum === 805) { status = 'SUCIA'; }
      if (roomNum === 806) { status = 'OCUPADA'; guest = 'Burgos Milagros'; balanceBs = 12633221.06; }
      if (roomNum === 807) { status = 'SUCIA'; }
      if (roomNum === 808) { status = 'SUCIA'; }
      if (roomNum === 809) { status = 'SUCIA'; }
      if (roomNum === 901) { status = 'DISPONIBLE'; }
      if (roomNum === 1001) { status = 'DISPONIBLE'; }
      if (roomNum === 1003) { status = 'OCUPADA'; guest = 'VIP Invitado Presidencial'; }

      rooms.push({
        id: roomNum,
        floor,
        type,
        status,
        guest,
        balanceBs,
        checkOutDate,
        phone
      });
    });
  }
  return rooms;
};

export default function App() {
  const [role, setRole] = useState('RECEPCION');
  
  // Tasa BCV fija a dos decimales y bloqueada contra edicion manual
  const [bcvRate] = useState(887.30);
  
  const [catalogItems, setCatalogItems] = useState(INITIAL_CATALOG_ITEMS);
  const [assistantsByFloor, setAssistantsByFloor] = useState(INITIAL_ASSISTANTS_BY_FLOOR);
  const [rooms, setRooms] = useState(generateDefaultRooms());
  const [inspections, setInspections] = useState({});
  const [selectedRoom, setSelectedRoom] = useState(null);
  
  // Formularios de administracion y edicion
  const [newItem, setNewItem] = useState({ name: '', category: 'MINIBAR', priceUSD: 0, isLinen: false });
  const [editingItem, setEditingItem] = useState(null);
  const [newAssistantFloor, setNewAssistantFloor] = useState(3);
  const [newAssistantName, setNewAssistantName] = useState('');
  
  // Modulo de reportes
  const [reportType, setReportType] = useState('DAILY');
  const [reportFloor, setReportFloor] = useState('ALL');
  const [reportAssistant, setReportAssistant] = useState('ALL');
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleStatusChange = (roomId, newStatus) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status: newStatus } : r));
    showToast(`Habitación ${roomId} actualizada a ${newStatus}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-4 md:p-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Header Principal */}
      <header className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-600 text-white p-3 rounded-xl shadow-md">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Hotel Cóndor Suites Lechería</h1>
            <p className="text-sm text-slate-500">Gestión Operativa de Habitaciones (Pisos 3 - 10)</p>
          </div>
        </div>

        {/* Tasa BCV Fija */}
        <div className="flex items-center gap-6">
          <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg text-right">
            <span className="text-xs text-slate-500 block font-medium">TASA BCV OFICIAL</span>
            <span className="text-lg font-bold text-emerald-600">
              Bs. {bcvRate.toFixed(2)}
            </span>
          </div>

          {/* Selector de Roles */}
          <div className="flex bg-slate-200 p-1 rounded-lg text-xs md:text-sm font-semibold">
            {['RECEPCION', 'ASISTENTE', 'SUPERVISORA', 'ADMINISTRACION'].map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  role === r 
                    ? 'bg-amber-600 text-white shadow' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL SEGUN EL ROL */}
      <main>
        {/* PANEL DE RECEPCION Y SUPERVISORA: VISTA DE PISOS */}
        {(role === 'RECEPCION' || role === 'SUPERVISORA' || role === 'ASISTENTE') && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {rooms.map((room) => (
                <div 
                  key={room.id} 
                  className={`bg-white rounded-xl border p-4 shadow-sm relative overflow-hidden transition-all ${
                    room.status === 'SUCIA' ? 'border-amber-400 bg-amber-50/30' :
                    room.status === 'OCUPADA' ? 'border-blue-300' :
                    room.status === 'BLOQUEADA' ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        PISO {room.floor}
                      </span>
                      <h3 className="text-2xl font-black text-slate-900 mt-1">
                        Hab. {room.id}
                      </h3>
                      <span className="text-xs text-amber-700 font-semibold">{room.type}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      room.status === 'DISPONIBLE' ? 'bg-emerald-100 text-emerald-800' :
                      room.status === 'OCUPADA' ? 'bg-blue-100 text-blue-800' :
                      room.status === 'SUCIA' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {room.status}
                    </span>
                  </div>

                  {room.guest && (
                    <p className="text-sm font-medium text-slate-700 mt-2 truncate">
                      Huésped: {room.guest}
                    </p>
                  )}

                  {/* Acciones Rápidas */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                    {role === 'SUPERVISORA' && room.status === 'SUCIA' && (
                      <button 
                        onClick={() => handleStatusChange(room.id, 'DISPONIBLE')}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 rounded flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar Limpieza
                      </button>
                    )}
                    {role === 'ASISTENTE' && room.status === 'DISPONIBLE' && (
                      <button 
                        onClick={() => handleStatusChange(room.id, 'SUCIA')}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-1.5 rounded"
                      >
                        Marcar para Limpieza
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PANEL DE ADMINISTRACION */}
        {role === 'ADMINISTRACION' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-600" /> Registro y Edición de Asistentes Integrales
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Piso de Asignación</label>
                  <select 
                    value={newAssistantFloor}
                    onChange={(e) => setNewAssistantFloor(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  >
                    {[3, 4, 5, 6, 7, 8, 9, 10].map((f) => (
                      <option key={f} value={f}>Piso {f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nombre Completo de la Asistente</label>
                  <input 
                    type="text"
                    placeholder="Ej. María Delgado"
                    value={newAssistantName}
                    onChange={(e) => setNewAssistantName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button 
                    onClick={() => {
                      if(!newAssistantName) return;
                      setAssistantsByFloor(prev => ({
                        ...prev,
                        [newAssistantFloor]: [...(prev[newAssistantFloor] || []), newAssistantName]
                      }));
                      setNewAssistantName('');
                      showToast('Asistente agregada con éxito');
                    }}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Registrar Asistente
                  </button>
                </div>
              </div>

              {/* Lista de Asistentes Configurada */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                {Object.entries(assistantsByFloor).map(([floor, list]) => (
                  <div key={floor} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <h4 className="font-bold text-xs text-amber-800 uppercase mb-2">Piso {floor}</h4>
                    <ul className="space-y-1">
                      {list.map((name, idx) => (
                        <li key={idx} className="text-xs font-medium text-slate-700 flex justify-between items-center bg-white p-1.5 rounded border border-slate-100">
                          <span>{name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* GENERACION DE REPORTES IMPRIMIBLES */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-amber-600" /> Reportes Operativos e Inspecciones
                </h2>
                <button 
                  onClick={handlePrint}
                  className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  Imprimir Reporte
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipo de Reporte</label>
                  <select 
                    value={reportType} 
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  >
                    <option value="DAILY">Reporte Diario</option>
                    <option value="WEEKLY">Reporte Semanal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Filtrar por Piso</label>
                  <select 
                    value={reportFloor} 
                    onChange={(e) => setReportFloor(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  >
                    <option value="ALL">Todos los Pisos (3 - 10)</option>
                    {[3,4,5,6,7,8,9,10].map(f => <option key={f} value={f}>Piso {f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Fecha</label>
                  <input 
                    type="date" 
                    value={reportStartDate} 
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              {/* Vista Previa Imprimible */}
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 print:bg-white print:p-0">
                <div className="text-center pb-4 border-b border-slate-200 mb-4">
                  <h3 className="font-bold text-lg text-slate-900 uppercase">Hotel Cóndor Suites Lechería</h3>
                  <p className="text-xs text-slate-500">Resumen Operativo de Habitaciones y Consumos</p>
                  <p className="text-xs font-semibold text-slate-700 mt-1">Tasa BCV: Bs. {bcvRate.toFixed(2)}</p>
                </div>

                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-200">
                      <th className="p-2">Habitación</th>
                      <th className="p-2">Piso</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Estado</th>
                      <th className="p-2">Huésped</th>
                      <th className="p-2 text-right">Saldo (Bs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms
                      .filter(r => reportFloor === 'ALL' || r.floor === Number(reportFloor))
                      .map(r => (
                        <tr key={r.id} className="border-b border-slate-200">
                          <td className="p-2 font-bold">{r.id}</td>
                          <td className="p-2">Piso {r.floor}</td>
                          <td className="p-2">{r.type}</td>
                          <td className="p-2 font-semibold">{r.status}</td>
                          <td className="p-2">{r.guest || 'N/A'}</td>
                          <td className="p-2 text-right font-mono">Bs. {r.balanceBs.toFixed(2)}</td>
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
