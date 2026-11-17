import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileDrawer } from './MobileDrawer';
import { Footer } from './Footer';
import { PrivacyConsentModal } from './PrivacyConsentModal';
import { useAuth } from '../../context/AuthContext';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isPrivacyModalOpen, acceptPrivacy } = useAuth();

  return (
    <div className="min-h-screen bg-bg-base flex flex-col font-sans text-primary">
      {/* Drawer Off-canvas para dispositivos móviles */}
      <MobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Contenedor principal con Sidebar desktop y área de contenido */}
      <div className="flex-1 flex w-full">
        {/* Sidebar Fijo en Desktop (hidden en móviles) */}
        <div className="hidden md:flex">
          <Sidebar />
        </div>

        {/* Columna Derecha: Header + Main Content + Footer */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header onToggleMobileMenu={() => setIsMobileMenuOpen(true)} />

          <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl w-full mx-auto">
            {children}
          </main>

          <Footer />
        </div>
      </div>

      {/* Modal Bloqueante de Aviso de Privacidad en Primer Ingreso (NFR-009) */}
      <PrivacyConsentModal
        isOpen={isPrivacyModalOpen}
        onAccept={acceptPrivacy}
      />
    </div>
  );
};
