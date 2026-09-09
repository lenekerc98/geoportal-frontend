import React, { useState, useEffect, useMemo } from 'react';
import { Scissors, Check, X, CheckCircle2 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function SplitPredioModal({
  isOpen,
  onClose,
  splitData,
  onConfirmSplit,
  authToken,
  API_URL
}) {
  const matrizPredio = splitData?.matrizPredio;
  const part1 = splitData?.parts?.[0];
  const part2 = splitData?.parts?.[1];
  const originalArea_m2 = splitData?.originalArea_m2 || 0;
  const originalArea_ha = splitData?.originalArea_ha || 0;

  // Datos Lote 1 (Remanente)
  const [lote1Code, setLote1Code] = useState('');
  
  // Datos Lote 2 (Fracción Desmembrada)
  const [lote2Code, setLote2Code] = useState('');
  const [ownerMode, setOwnerMode] = useState('same'); // 'same' o 'new'
  const [lote2Cedula, setLote2Cedula] = useState('');
  const [lote2Nombre, setLote2Nombre] = useState('');
  const [lote2PosesionarioId, setLote2PosesionarioId] = useState(null);
  const [isSearchingCedula, setIsSearchingCedula] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sincronizar códigos al abrir o cambiar splitData
  useEffect(() => {
    if (matrizPredio?.properties?.cod_catastral) {
      const parentCode = matrizPredio.properties.cod_catastral;
      setLote1Code(parentCode);
      setLote2Code(`${parentCode}-01`);
    } else {
      setLote1Code('');
      setLote2Code('FRAC-01');
    }
    setOwnerMode('same');
    setLote2Cedula('');
    setLote2Nombre('');
    setLote2PosesionarioId(null);
  }, [matrizPredio]);

  // Buscar posesionario al ingresar 10 dígitos en la cédula
  const handleCedulaChange = async (val) => {
    setLote2Cedula(val);
    if (val.length === 10 && API_URL) {
      setIsSearchingCedula(true);
      try {
        const res = await fetch(`${API_URL}/api/gis/posesionarios/buscar/${val}`, {
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.nombre) {
            setLote2Nombre(data.nombre);
            setLote2PosesionarioId(data.id);
          }
        }
      } catch (err) {
        console.warn('Búsqueda de posesionario:', err);
      } finally {
        setIsSearchingCedula(false);
      }
    }
  };

  // Cálculo de polígonos normalizados para vista previa SVG
  const svgPreviewData = useMemo(() => {
    if (!part1?.geometry || !part2?.geometry) return null;
    try {
      const getPoints = (geom) => {
        if (!geom) return [];
        if (geom.type === 'Polygon') return geom.coordinates[0];
        if (geom.type === 'MultiPolygon') return geom.coordinates[0][0];
        return [];
      };

      const pts1 = getPoints(part1.geometry);
      const pts2 = getPoints(part2.geometry);
      const allPts = [...pts1, ...pts2];
      if (allPts.length === 0) return null;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      allPts.forEach(p => {
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      });

      const width = maxX - minX || 1e-6;
      const height = maxY - minY || 1e-6;
      const padding = 20;
      const svgW = 340;
      const svgH = 180;
      const scale = Math.min((svgW - padding * 2) / width, (svgH - padding * 2) / height);

      const transformPts = (pts) => {
        return pts.map(p => {
          const x = padding + (p[0] - minX) * scale;
          const y = svgH - (padding + (p[1] - minY) * scale);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
      };

      const calcCenter = (pts) => {
        if (!pts || pts.length === 0) return { x: svgW / 2, y: svgH / 2 };
        let sx = 0, sy = 0;
        pts.forEach(p => {
          sx += padding + (p[0] - minX) * scale;
          sy += svgH - (padding + (p[1] - minY) * scale);
        });
        return { x: (sx / pts.length).toFixed(1), y: (sy / pts.length).toFixed(1) };
      };

      return {
        path1: transformPts(pts1),
        path2: transformPts(pts2),
        center1: calcCenter(pts1),
        center2: calcCenter(pts2),
        svgW,
        svgH
      };
    } catch (e) {
      console.error('Error calculando preview SVG:', e);
      return null;
    }
  }, [part1, part2]);

  if (!isOpen || !splitData || !part1 || !part2) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!lote1Code || !lote2Code) {
      Swal.fire('Atención', 'Ambos lotes deben tener un código catastral asignado.', 'warning');
      return;
    }

    if (lote1Code.trim() === lote2Code.trim()) {
      Swal.fire('Atención', 'Los códigos catastrales de ambos lotes deben ser distintos.', 'warning');
      return;
    }

    if (ownerMode === 'new' && (!lote2Nombre.trim() || !lote2Cedula.trim())) {
      Swal.fire('Atención', 'Debe especificar Cédula y Nombre del nuevo posesionario para la fracción.', 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        matrizId: matrizPredio?.properties?.id,
        lote1: {
          cod_catastral: lote1Code.trim(),
          geometry: part1.geometry,
          area_m2: part1.area_m2,
          area_ha: part1.area_ha,
          perimeter_m: part1.perimeter_m
        },
        lote2: {
          cod_catastral: lote2Code.trim(),
          geometry: part2.geometry,
          area_m2: part2.area_m2,
          area_ha: part2.area_ha,
          perimeter_m: part2.perimeter_m,
          ownerMode,
          posesionario_id: ownerMode === 'same' ? matrizPredio?.properties?.posesionario_id : lote2PosesionarioId,
          cedula: ownerMode === 'same' ? matrizPredio?.properties?.cedula_posesionario : lote2Cedula.trim(),
          nombre: ownerMode === 'same' ? matrizPredio?.properties?.nombre_posesionario : lote2Nombre.trim(),
          empresa_id: matrizPredio?.properties?.empresa_id,
          proyecto_id: matrizPredio?.properties?.proyecto_id
        }
      };

      const success = await onConfirmSplit(payload);
      if (success) {
        onClose();
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo completar el fraccionamiento: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        maxWidth: '860px',
        width: '100%',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Cabecera del Modal */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Scissors size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                Asistente de Fraccionamiento de Predio
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Desmembración catastral del lote matriz en 2 fracciones independientes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido Principal */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Barra Resumen del Predio Matriz */}
          <div style={{
            background: '#f1f5f9',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid #e2e8f0',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                Predio Matriz
              </span>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                {matrizPredio?.properties?.cod_catastral || 'Sin Código'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                Propietario Actual
              </span>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                {matrizPredio?.properties?.nombre_posesionario || 'N/A'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                Área Matriz Original
              </span>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0369a1' }}>
                {originalArea_m2 ? originalArea_m2.toFixed(1) : '0.0'} m² ({originalArea_ha ? originalArea_ha.toFixed(4) : '0.0000'} ha)
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ecfdf5',
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid #a7f3d0'
            }}>
              <CheckCircle2 size={16} color="#059669" />
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#065f46' }}>
                Cuadre 100% exacto
              </span>
            </div>
          </div>

          {/* Gráfico Vectorial 2D de Vista Previa */}
          {svgPreviewData && (
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '0 8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                  Esquema Geométrico de Subdivisión
                </span>
                <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
                  <span style={{ color: '#2563eb', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '10px', background: '#93c5fd', border: '1px solid #2563eb', display: 'inline-block', borderRadius: '2px' }}></span>
                    Lote 1 (Remanente)
                  </span>
                  <span style={{ color: '#059669', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '10px', background: '#a7f3d0', border: '1px solid #059669', display: 'inline-block', borderRadius: '2px' }}></span>
                    Lote 2 (Fracción)
                  </span>
                </div>
              </div>
              <svg width={svgPreviewData.svgW} height={svgPreviewData.svgH} style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <polygon
                  points={svgPreviewData.path1}
                  fill="#dbeafe"
                  stroke="#2563eb"
                  strokeWidth="2"
                />
                <polygon
                  points={svgPreviewData.path2}
                  fill="#d1fae5"
                  stroke="#059669"
                  strokeWidth="2"
                />
                <text x={svgPreviewData.center1.x} y={svgPreviewData.center1.y} textAnchor="middle" fill="#1e40af" fontSize="11" fontWeight="bold">
                  Lote 1 ({part1.percentage.toFixed(1)}%)
                </text>
                <text x={svgPreviewData.center2.x} y={svgPreviewData.center2.y} textAnchor="middle" fill="#065f46" fontSize="11" fontWeight="bold">
                  Lote 2 ({part2.percentage.toFixed(1)}%)
                </text>
              </svg>
            </div>
          )}

          {/* Tarjetas lado a lado de los 2 Lotes resultantes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
            
            {/* Tarjeta LOTE 1 (Remanente) */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '18px',
              boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#1d4ed8',
                  background: '#dbeafe',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}>
                  LOTE 1 (REMANENTE)
                </span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1d4ed8' }}>
                  {part1.percentage.toFixed(1)}% del Total
                </span>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Código Catastral Lote 1
                </label>
                <input
                  type="text"
                  value={lote1Code}
                  onChange={(e) => setLote1Code(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontWeight: '600'
                  }}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Área resultante:</span>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>{part1.area_m2.toFixed(1)} m²</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Superficie (Ha):</span>
                  <span style={{ fontWeight: '600', color: '#0f172a' }}>{part1.area_ha.toFixed(4)} ha</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Perímetro:</span>
                  <span style={{ fontWeight: '600', color: '#0f172a' }}>{part1.perimeter_m.toFixed(1)} m</span>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#64748b' }}>
                <b>Propietario conservado:</b> {matrizPredio?.properties?.nombre_posesionario || 'Mismo de la Matriz'}
              </div>
            </div>

            {/* Tarjeta LOTE 2 (Fracción Desmembrada) */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #a7f3d0',
              borderRadius: '12px',
              padding: '18px',
              boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#047857',
                  background: '#d1fae5',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}>
                  LOTE 2 (NUEVA FRACCIÓN)
                </span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#047857' }}>
                  {part2.percentage.toFixed(1)}% del Total
                </span>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Código Catastral Lote 2
                </label>
                <input
                  type="text"
                  value={lote2Code}
                  onChange={(e) => setLote2Code(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontWeight: '600'
                  }}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Área resultante:</span>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>{part2.area_m2.toFixed(1)} m²</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Superficie (Ha):</span>
                  <span style={{ fontWeight: '600', color: '#0f172a' }}>{part2.area_ha.toFixed(4)} ha</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Perímetro:</span>
                  <span style={{ fontWeight: '600', color: '#0f172a' }}>{part2.perimeter_m.toFixed(1)} m</span>
                </div>
              </div>

              {/* Asignación de Propietario para la Fracción */}
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setOwnerMode('same')}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      fontSize: '11px',
                      fontWeight: '600',
                      borderRadius: '6px',
                      border: ownerMode === 'same' ? '1px solid #059669' : '1px solid #cbd5e1',
                      background: ownerMode === 'same' ? '#ecfdf5' : '#ffffff',
                      color: ownerMode === 'same' ? '#065f46' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    Mismo Titular
                  </button>
                  <button
                    type="button"
                    onClick={() => setOwnerMode('new')}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      fontSize: '11px',
                      fontWeight: '600',
                      borderRadius: '6px',
                      border: ownerMode === 'new' ? '1px solid #059669' : '1px solid #cbd5e1',
                      background: ownerMode === 'new' ? '#ecfdf5' : '#ffffff',
                      color: ownerMode === 'new' ? '#065f46' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    Nuevo Titular
                  </button>
                </div>

                {ownerMode === 'new' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <input
                        type="text"
                        placeholder="Cédula / RUC (10 dígitos)..."
                        value={lote2Cedula}
                        onChange={(e) => handleCedulaChange(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          fontSize: '12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1'
                        }}
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder={isSearchingCedula ? "Buscando datos..." : "Nombres y Apellidos del Adjudicatario"}
                        value={lote2Nombre}
                        onChange={(e) => setLote2Nombre(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          fontSize: '12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1'
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                    Se mantendrá el posesionario actual de la matriz ({matrizPredio?.properties?.nombre_posesionario || 'S/N'}).
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Botones de Acción */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            borderTop: '1px solid #e2e8f0',
            paddingTop: '16px'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#475569',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '9px 22px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#ffffff',
                background: isSubmitting ? '#94a3b8' : '#059669',
                border: 'none',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)'
              }}
            >
              <Check size={16} />
              {isSubmitting ? 'Guardando Fraccionamiento...' : 'Confirmar y Guardar Fraccionamiento'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
