const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../movil/src/App.jsx');

const code = `import React from 'react';
import { useMobile } from './context/MobileContext';
import LoginMobile from './pages/Login/LoginMobile';
import MobileHeader from './components/MobileHeader';
import BottomNavBar from './components/BottomNavBar';
import MapTab from './pages/MapTab/MapTab';
import PredioFormMobile from './pages/FormTab/PredioFormMobile';
import SyncCenterMobile from './pages/SyncTab/SyncCenterMobile';
import SettingsMobile from './pages/SettingsTab/SettingsMobile';
import SwipeableToast from './components/SwipeableToast';
import './App.css';

export default function App() {
  const { activeTab, auth, authLoaded, toast, dismissToast } = useMobile();

  // Esperar a cargar estado local
  if (!authLoaded) {
    return (
      <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#0284c7', fontSize: '14px' }}>
        Iniciando Catastro Móvil...
      </div>
    );
  }

  // Si no está autenticado, mostrar pantalla de Login
  if (!auth || !auth.token) {
    return <LoginMobile />;
  }

  return (
    <div className="app-container">
      {/* Alerta / Notificación Flotante Ligera y Deslizable (Swipeable) */}
      {toast && <SwipeableToast toast={toast} onDismiss={dismissToast} />}

      {/* Barra de Estado y Cabecera Superior con Usuario y Proyecto */}
      <MobileHeader />

      {/* Contenido Dinámico según la Pestaña Activa */}
      <main className="main-content">
        {activeTab === 'map' && <MapTab />}
        {activeTab === 'form' && <PredioFormMobile />}
        {activeTab === 'sync' && <SyncCenterMobile />}
        {activeTab === 'settings' && <SettingsMobile />}
      </main>

      {/* Barra de Navegación Inferior */}
      <BottomNavBar />
    </div>
  );
}
`;

fs.writeFileSync(targetPath, code, 'utf8');
console.log('App.jsx updated with SwipeableToast!');
