import React, { useState, useEffect } from 'react';
import { Printer, X, Loader2, CheckCircle2, AlertCircle, FileText, Copy } from 'lucide-react';

export default function BatchPrintModal({
  isOpen,
  onClose,
  allPredios = [],
  onStartBatch,
  loading = false,
  progress = { current: 0, total: 0, message: '' },
  initialDuplex = true
}) {
  const total = allPredios.length;
  const BATCH_SIZE = 200;
  const totalLotes = Math.max(1, Math.ceil(total / BATCH_SIZE));
  const [printMode, setPrintMode] = useState('lote200'); // 'lote200', 'range', 'all'
  const [selectedLote, setSelectedLote] = useState(1);
  const [fromNum, setFromNum] = useState(1);
  const [toNum, setToNum] = useState(Math.min(total, 200));
  const [duplexMode, setDuplexMode] = useState(initialDuplex);

  // Listener para cerrar con tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (!loading) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleStart = () => {
    let fromIdx = 1;
    let toIdx = total;
    if (printMode === 'lote200') {
      fromIdx = (selectedLote - 1) * BATCH_SIZE + 1;
      toIdx = Math.min(total, selectedLote * BATCH_SIZE);
    } else if (printMode === 'range') {
      fromIdx = Math.max(1, parseInt(fromNum) || 1);
      toIdx = Math.min(total, Math.max(fromIdx, parseInt(toNum) || total));
    }
    onStartBatch(fromIdx, toIdx, duplexMode, selectedLote);
  };

  let countToPrint = total;
  if (printMode === 'lote200') {
    const fromI = (selectedLote - 1) * BATCH_SIZE + 1;
    const toI = Math.min(total, selectedLote * BATCH_SIZE);
    countToPrint = Math.max(0, toI - fromI + 1);
  } else if (printMode === 'range') {
    countToPrint = Math.max(0, Math.min(total, parseInt(toNum) || total) - Math.max(1, parseInt(fromNum) || 1) + 1);
  }

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="no-print" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(5px)',
      zIndex: 99999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '14px',
        width: '520px',
        maxWidth: '95vw',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
          borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#059669',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(5, 150, 105, 0.3)'
            }}>
              <Printer size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: '#065f46' }}>
                Impresión Masiva de Reportes
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Generación del lote de Levantamientos Planimétricos
              </p>
            </div>
          </div>
          {!loading && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '25px 10px' }}>
              <Loader2 size={42} className="spin" color="#059669" style={{ margin: '0 auto 16px auto' }} />
              <h4 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: '#0f172a' }}>
                Preparando documentos para impresión...
              </h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>
                {progress.message || `Procesando ${progress.current} de ${progress.total} predios`}
              </p>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{
                  width: `${percent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #059669 0%, #10b981 100%)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#059669' }}>
                {percent}% completado
              </div>
            </div>
          ) : (
            <>
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.88rem', color: '#475569' }}>Total de predios en catálogo:</span>
                <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{total} predios</strong>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.88rem', marginBottom: '10px', color: '#334155' }}>
                  Selecciona la modalidad de generación:
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* OPCIÓN 1: LOTES DE 200 PREDIOS (RECOMENDADO) */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${printMode === 'lote200' ? '#059669' : '#cbd5e1'}`,
                    background: printMode === 'lote200' ? 'rgba(5, 150, 105, 0.06)' : 'white',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}>
                    <input
                      type="radio"
                      name="printMode"
                      checked={printMode === 'lote200'}
                      onChange={() => setPrintMode('lote200')}
                      style={{ marginTop: '4px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong style={{ color: '#065f46' }}>Lotes de 200 predios (Recomendado)</strong>
                        <span style={{ fontSize: '0.72rem', background: '#d1fae5', color: '#047857', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                          Óptimo y Seguro
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', marginBottom: '8px' }}>
                        Genera ~400 páginas por lote para que el navegador y la impresora trabajen fluidos sin congelarse.
                      </div>

                      {printMode === 'lote200' && (
                        <div style={{ marginTop: '8px', background: 'white', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#047857', marginBottom: '6px' }}>
                            Selecciona el lote a procesar ({totalLotes} lotes en total):
                          </label>
                          <select
                            value={selectedLote}
                            onChange={(e) => setSelectedLote(Number(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1.5px solid #059669',
                              fontWeight: '600',
                              fontSize: '0.85rem',
                              color: '#0f172a',
                              background: '#f0fdf4',
                              cursor: 'pointer'
                            }}
                          >
                            {Array.from({ length: totalLotes }, (_, i) => {
                              const lNum = i + 1;
                              const startP = (lNum - 1) * BATCH_SIZE + 1;
                              const endP = Math.min(total, lNum * BATCH_SIZE);
                              const count = endP - startP + 1;
                              return (
                                <option key={lNum} value={lNum}>
                                  Lote {lNum} de {totalLotes}: Predios {startP} al {endP} ({count} predios)
                                </option>
                              );
                            })}
                          </select>

                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '8px' }}>
                            <button
                              type="button"
                              disabled={selectedLote <= 1}
                              onClick={(e) => { e.preventDefault(); setSelectedLote(prev => Math.max(1, prev - 1)); }}
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: selectedLote <= 1 ? '#f1f5f9' : '#ffffff',
                                color: selectedLote <= 1 ? '#94a3b8' : '#334155',
                                fontSize: '0.78rem',
                                fontWeight: '600',
                                cursor: selectedLote <= 1 ? 'not-allowed' : 'pointer'
                              }}
                            >
                              ⬅ Lote Anterior
                            </button>
                            <button
                              type="button"
                              disabled={selectedLote >= totalLotes}
                              onClick={(e) => { e.preventDefault(); setSelectedLote(prev => Math.min(totalLotes, prev + 1)); }}
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: selectedLote >= totalLotes ? '#f1f5f9' : '#ffffff',
                                color: selectedLote >= totalLotes ? '#94a3b8' : '#334155',
                                fontSize: '0.78rem',
                                fontWeight: '600',
                                cursor: selectedLote >= totalLotes ? 'not-allowed' : 'pointer'
                              }}
                            >
                              Siguiente Lote ➡
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </label>

                  {/* OPCIÓN 2: RANGO PERSONALIZADO */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${printMode === 'range' ? '#059669' : '#cbd5e1'}`,
                    background: printMode === 'range' ? 'rgba(5, 150, 105, 0.06)' : 'white',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}>
                    <input
                      type="radio"
                      name="printMode"
                      checked={printMode === 'range'}
                      onChange={() => setPrintMode('range')}
                      style={{ marginTop: '4px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <strong>Rango específico personalizado</strong>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Define manualmente el número de predio inicial y final.
                      </div>

                      {printMode === 'range' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                          <span style={{ fontSize: '0.85rem' }}>Desde:</span>
                          <input
                            type="number"
                            min="1"
                            max={total}
                            value={fromNum}
                            onChange={(e) => setFromNum(e.target.value)}
                            style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          />
                          <span style={{ fontSize: '0.85rem' }}>Hasta:</span>
                          <input
                            type="number"
                            min="1"
                            max={total}
                            value={toNum}
                            onChange={(e) => setToNum(e.target.value)}
                            style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          />
                        </div>
                      )}
                    </div>
                  </label>

                  {/* OPCIÓN 3: TODOS LOS PREDIOS (CON ADVERTENCIA) */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${printMode === 'all' ? '#ef4444' : '#cbd5e1'}`,
                    background: printMode === 'all' ? 'rgba(239, 68, 68, 0.04)' : 'white',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}>
                    <input
                      type="radio"
                      name="printMode"
                      checked={printMode === 'all'}
                      onChange={() => setPrintMode('all')}
                      style={{ marginTop: '4px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: printMode === 'all' ? '#b91c1c' : '#334155' }}>
                        Todos los predios ({total} predios)
                      </strong>
                      <div style={{ fontSize: '0.76rem', color: '#dc2626', marginTop: '2px' }}>
                        ⚠️ No recomendado directamente en el navegador: generará ~8,832 páginas en memoria y puede colgar la pestaña. Usa Lotes de 200.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Opción: Modo Dúplex Inteligente */}
              <div 
                style={{
                  background: duplexMode ? 'rgba(16, 185, 129, 0.08)' : '#f8fafc',
                  border: `1px solid ${duplexMode ? 'rgba(16, 185, 129, 0.4)' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setDuplexMode(!duplexMode)}
              >
                <input
                  type="checkbox"
                  id="chk-duplex-mode"
                  checked={duplexMode}
                  onChange={(e) => setDuplexMode(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#059669', marginTop: '2px', cursor: 'pointer' }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div style={{ flex: 1 }}>
                  <label htmlFor="chk-duplex-mode" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '0.9rem', color: '#065f46', cursor: 'pointer' }}>
                    <Copy size={16} color="#059669" /> Modo Dúplex Inteligente
                  </label>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#475569', lineHeight: '1.35' }}>
                    Si un predio tiene un número impar de hojas (ej. 3 páginas), inserta automáticamente una hoja en blanco en su reverso para que el siguiente predio empiece siempre en una hoja física nueva limpia (evita que el plano de un predio se imprima al reverso del anterior).
                  </p>
                </div>
              </div>

              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.82rem',
                color: '#1e40af',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FileText size={18} />
                <span>
                  Se enviarán a la impresora <strong>{countToPrint} predios</strong> (Plano e Informe de Linderación paginado según la cantidad de vértices).
                </span>
              </div>

              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '9px 14px',
                fontSize: '0.80rem',
                color: '#92400e',
                marginBottom: '20px',
                lineHeight: '1.4'
              }}>
                📐 <strong>Configuración en diálogo de impresión:</strong> En la ventana de impresión de Chrome/Windows, confirme que el <strong>Diseño esté en Horizontal</strong>, <strong>Tamaño de papel: A4</strong>, <strong>Márgenes: Ninguno</strong> y <strong>Escala: Predeterminado</strong> para que el plano llene el 100% de la hoja sin reducción de escala.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#64748b',
                    fontWeight: '600',
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={countToPrint <= 0}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Printer size={16} />
                  Generar e Imprimir ({countToPrint})
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
