/**
 * Utilidades para manejo, limpieza y extracción exacta de Claves Catastrales y Datos Prediales.
 * Garantiza que el código catastral SIEMPRE se maneje y extraiga como TEXTO exacto,
 * evitando y neutralizando cualquier conversión a número / notación científica (ej. '1.20651510500704e+18' -> '1206515105007040000').
 */

/**
 * Convierte cualquier valor (número, notación científica, float con .0) a su representación en TEXTO EXACTO.
 * @param {any} val
 * @returns {string} Código en texto limpio
 */
export function cleanCadastralCode(val) {
  if (val === null || val === undefined || Number.isNaN(val)) return '';
  let str = String(val).trim();
  if (!str || str.includes('*') || /^(nan|none|null|undefined|s\/c|s\/d)$/i.test(str)) return '';

  // Detección y expansión precisa de notación científica (ej. 1.20651510500704e+18)
  if (/e[+-]?\d+/i.test(str)) {
    const [mantissa, expStr] = str.toLowerCase().split('e');
    const exp = parseInt(expStr, 10);
    const [intPart, decPart = ''] = mantissa.split('.');
    if (exp >= 0) {
      if (exp >= decPart.length) {
        str = intPart + decPart + '0'.repeat(exp - decPart.length);
      } else {
        str = intPart + decPart.slice(0, exp) + '.' + decPart.slice(exp);
      }
    } else {
      const absExp = Math.abs(exp);
      if (absExp <= intPart.length) {
        str = intPart.slice(0, intPart.length - absExp) + '.' + intPart.slice(intPart.length - absExp) + decPart;
      } else {
        str = '0.' + '0'.repeat(absExp - intPart.length) + intPart + decPart;
      }
    }
  }

  // Eliminar .0 al final si es un número entero
  if (str.endsWith('.0')) {
    str = str.slice(0, -2);
  }
  // Eliminar punto decimal si solo tiene ceros decimales
  str = str.replace(/\.0+$/, '');

  return str.trim();
}

/**
 * Extrae y mapea de forma inteligente los atributos de un predio desde las propiedades de un GeoJSON / Shapefile DBF.
 * @param {Object} props
 * @returns {{ cod_catastral: string, cedula: string, nombre_posesionario: string, sector: string, parroquia: string }}
 */
export function extractPredioAttributes(props = {}) {
  let cod_catastral = '';
  let cedula = '';
  let nombre_posesionario = '';
  let sector = '';
  let parroquia = '';
  let rawDatos = '';

  Object.entries(props).forEach(([k, rawVal]) => {
    if (rawVal === null || rawVal === undefined) return;
    const val = cleanCadastralCode(rawVal);
    if (!val) return;
    const upper = k.toUpperCase().trim();

    // 1. Código Catastral / Clave
    const isClaveKey = upper.includes('CLAVE') || 
                       upper.includes('CATAST') || 
                       upper.includes('COD_CAT') || 
                       upper.includes('CODIGO') || 
                       upper === 'PREDIO' || 
                       upper === 'COD_PRED' || 
                       upper === 'COD_PREDIO' || 
                       upper === 'NUMERO_PRO' || 
                       upper.startsWith('CLV_') ||
                       upper === 'NUM_PREDIO';

    if (isClaveKey && val.length >= 4) {
      // Preferir el código más largo o que tenga formato numérico de al menos 6 dígitos
      if (!cod_catastral || val.length > cod_catastral.length) {
        cod_catastral = val;
      }
    }

    // 2. Cédula / RUC / Identificación
    const isCedulaKey = upper.includes('CEDULA') || 
                        upper.includes('RUC') || 
                        upper.includes('IDENTIFIC') || 
                        upper === 'NUMERO_IDE' || 
                        upper === 'DNI';
    if (isCedulaKey && !cedula) {
      // Limpiar cédula
      const cleanCed = val.replace(/[^\d]/g, '');
      if (cleanCed.length >= 9) {
        cedula = cleanCed.padStart(10, '0');
      } else if (cleanCed.length > 0) {
        cedula = cleanCed;
      } else {
        cedula = '';
      }
    }

    // 3. Propietario / Posesionario
    const isNombreKey = upper.includes('NOMBRE') || 
                        upper.includes('PROPIETARIO') || 
                        upper.includes('POSESION') || 
                        upper.includes('TITULAR') || 
                        upper.includes('DUENO') ||
                        upper === 'PROPIETRIO';
    if (isNombreKey && !nombre_posesionario && !/^\d+$/.test(val)) {
      nombre_posesionario = val;
    }

    // 4. Sector / Recinto
    const isSectorKey = upper.includes('SECTOR') || 
                        upper.includes('RECINTO') || 
                        upper.includes('BARRIO') || 
                        upper === 'SEC';
    if (isSectorKey && !sector) {
      sector = val;
    }

    // 5. Parroquia
    const isParroquiaKey = upper.includes('PARROQ') || 
                           upper.includes('DPA_DESPAR');
    if (isParroquiaKey && !parroquia) {
      parroquia = val;
    }

    // 6. Campo combinado 'DATOS' común en mosaicos de ArcGis
    if (upper === 'DATOS') {
      rawDatos = val;
    }
  });

  // Combinación Nombres y Apellidos si vienen separados
  const apeNom = [props.nombres || props.NOMBRES, props.apellidos || props.APELLIDOS]
    .filter(Boolean)
    .map(v => String(v).trim())
    .join(' ')
    .trim();
  if (apeNom && !nombre_posesionario) {
    nombre_posesionario = apeNom;
  }

  // Parsear campo combinado DATOS si faltan datos (ej: "JUAN BENITES. C.C. 1206292516. SEC. SAN FRANCISCO")
  if (rawDatos && (!cedula || !nombre_posesionario || !sector)) {
    // Buscar C.C.
    const ccMatch = rawDatos.match(/(?:C\.?C\.?|CEDULA|CI)\s*[:.]?\s*(\d{10})/i);
    if (ccMatch && !cedula) {
      cedula = ccMatch[1];
    }
    // Buscar Sector (SEC. o SECTOR:)
    const secMatch = rawDatos.match(/(?:SEC\.?|SECTOR|RECINTO)\s*[:.]?\s*([^,;.\n]+)/i);
    if (secMatch && !sector) {
      sector = secMatch[1].trim();
    }
    // Nombre: parte anterior a C.C. o SEC
    if (!nombre_posesionario) {
      const parts = rawDatos.split(/(?:C\.?C\.?|CEDULA|SEC\.?|SECTOR)/i);
      if (parts[0] && parts[0].trim().length > 3) {
        nombre_posesionario = parts[0].replace(/[.;,]+$/, '').trim();
      }
    }
  }

  return {
    cod_catastral,
    cedula,
    nombre_posesionario,
    sector,
    parroquia
  };
}

