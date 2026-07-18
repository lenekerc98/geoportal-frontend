import React, { createContext, useState, useEffect } from 'react';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [activeEmpresa, setActiveEmpresa] = useState(null);
  const [activeProyecto, setActiveProyecto] = useState(null);
  
  useEffect(() => {
    const savedEmpresa = localStorage.getItem('catastro_active_empresa');
    if (savedEmpresa) {
        try { setActiveEmpresa(JSON.parse(savedEmpresa)); } catch(e){}
    }
    
    const savedProyecto = localStorage.getItem('catastro_active_proyecto');
    if (savedProyecto) {
        try { setActiveProyecto(JSON.parse(savedProyecto)); } catch(e){}
    }
  }, []);

  const setGlobalEmpresa = (empresa) => {
    setActiveEmpresa(empresa);
    if (empresa) {
      localStorage.setItem('catastro_active_empresa', JSON.stringify(empresa));
    } else {
      localStorage.removeItem('catastro_active_empresa');
    }
  };

  const setGlobalProyecto = (proyecto) => {
    setActiveProyecto(proyecto);
    if (proyecto) {
      localStorage.setItem('catastro_active_proyecto', JSON.stringify(proyecto));
    } else {
      localStorage.removeItem('catastro_active_proyecto');
    }
  };

  return (
    <AppContext.Provider value={{ activeEmpresa, setGlobalEmpresa, activeProyecto, setGlobalProyecto }}>
      {children}
    </AppContext.Provider>
  );
};
