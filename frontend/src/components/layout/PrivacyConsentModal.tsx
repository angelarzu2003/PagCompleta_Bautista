import React, { useState } from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface PrivacyConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

/**
 * Modal Bloqueante de Aviso de Privacidad y Declaración Ética (NFR-009, UC-001 A1).
 * Exige checkboxes desmarcados por defecto antes de habilitar el acceso a la plataforma.
 */
export const PrivacyConsentModal: React.FC<PrivacyConsentModalProps> = ({ isOpen, onAccept }) => {
  const [checkPrivacy, setCheckPrivacy] = useState(false);
  const [checkEthics, setCheckEthics] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canProceed = checkPrivacy && checkEthics;

  const handleConfirm = async () => {
    if (!canProceed) return;
    setIsSubmitting(true);
    await onAccept();
    setIsSubmitting(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Bloqueante, no se cierra sin aceptar
      preventClose={true}
      title="Aviso de Privacidad y Declaración Jurada Ética"
      description="Requisito de primer ingreso para miembros de la comunidad investigadora"
      maxWidth="max-w-2xl"
      footer={
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500 text-left">
            {!canProceed && 'Debe aceptar ambas declaraciones para habilitar el acceso.'}
          </span>
          <Button
            type="button"
            variant="primary"
            disabled={!canProceed}
            isLoading={isSubmitting}
            onClick={handleConfirm}
          >
            Aceptar y Continuar
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
          <p className="text-primary font-medium">
            En cumplimiento de la legislación universitaria de protección de datos personales y
            la directiva de seguridad de la URPMP, su sesión será auditada y protegida criptográficamente.
          </p>
        </div>

        <div className="max-h-48 overflow-y-auto p-3 bg-surface-sunken rounded-lg border border-slate-200 text-[11px] space-y-2">
          <p className="font-semibold text-primary">Términos del Tratamiento de Información Académica:</p>
          <p>
            1. Los datos personales provistos a través del sistema SSO institucional se emplearán exclusivamente para fines de evaluación por pares, emisión de resoluciones rectorales y acreditación institucional.
          </p>
          <p>
            2. Queda estrictamente prohibida la suplantación de identidad o el uso compartido de credenciales federadas.
          </p>
          <p>
            3. Toda acción dentro de los expedientes queda registrada en la bitácora inmutable de auditoría (audit_event) con encadenamiento SHA-256.
          </p>
        </div>

        {/* Checkboxes desmarcados por defecto */}
        <div className="space-y-3 pt-2">
          <label className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checkPrivacy}
              onChange={e => setCheckPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary"
            />
            <span className="text-xs text-primary font-medium">
              He leído y acepto la Política Institucional de Privacidad y Tratamiento de Datos Personales.
            </span>
          </label>

          <label className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checkEthics}
              onChange={e => setCheckEthics(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary"
            />
            <span className="text-xs text-primary font-medium">
              Declaro bajo juramento cumplir con el Código de Ética y Buenas Prácticas en Publicación Científica de la URPMP.
            </span>
          </label>
        </div>
      </div>
    </Modal>
  );
};
