import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { TechDetails } from '../../components/ui/TechDetails';
import { api, Catalogs, AuditChainStatus } from '../../api/client';
import { UserProfile, AuditEvent, SystemSetting, SystemRoleCode } from '../../types/domain';
import { formatDateTime } from '../../utils/formatters';
import {
  Users,
  FolderTree,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Plus,
  Edit,
  History
} from 'lucide-react';

export const AdminPanelView: React.FC = () => {
  const [activeSubmodule, setActiveSubmodule] = useState<'users' | 'catalogs' | 'settings' | 'audit'>('users');

  // Estado de Usuarios SSO (FR-002..004)
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isEditRolesModalOpen, setIsEditRolesModalOpen] = useState(false);
  const [userRoles, setUserRoles] = useState<SystemRoleCode[]>([]);
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', full_name: '', department_id: '', title: '', roles: ['researcher'] as SystemRoleCode[] });

  // Parámetros Configurables (NFR-019)
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [settingDrafts, setSettingDrafts] = useState<Record<string, number>>({});

  // Catálogos y bitácora
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [newCatalogName, setNewCatalogName] = useState<Record<string, string>>({});
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [chain, setChain] = useState<AuditChainStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reloadUsers = () => api.getUsers().then(setUsers);
  const reloadCatalogs = () => api.getCatalogs(true).then(setCatalogs);
  const reloadAudit = () => Promise.all([api.getAuditEvents().then(setAuditEvents), api.verifyAuditChain().then(setChain)]);

  useEffect(() => {
    setError(null);
    Promise.all([
      reloadUsers(),
      reloadCatalogs(),
      api.getSettings().then(list => {
        setSettings(list);
        setSettingDrafts(Object.fromEntries(list.map(x => [x.key, Number(x.value)])));
      }),
      reloadAudit(),
    ]).catch(err => setError(err.message));
  }, []);

  useEffect(() => {
    if (activeSubmodule === 'audit') reloadAudit().catch(() => undefined);
  }, [activeSubmodule]);

  const toggleUserActive = async (u: UserProfile) => {
    try {
      const updated = await api.updateUser(u.id, { active: !u.active });
      setUsers(prev => prev.map(x => (x.id === updated.id ? updated : x)));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEditRoles = (user: UserProfile) => {
    setSelectedUser(user);
    setUserRoles([...user.roles]);
    setIsEditRolesModalOpen(true);
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;
    try {
      const updated = await api.updateUser(selectedUser.id, { roles: userRoles });
      setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
      setIsEditRolesModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleRoleSelection = (role: SystemRoleCode) => {
    setUserRoles(prev => (prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]));
  };

  const handleCreateUser = async () => {
    try {
      await api.createUser({ ...newUser, department_id: newUser.department_id || catalogs?.departments[0]?.id || '' });
      setIsNewUserOpen(false);
      setNewUser({ email: '', full_name: '', department_id: '', title: '', roles: ['researcher'] });
      reloadUsers();
    } catch (err: any) {
      alert(err.fields?.map((f: any) => f.message).join('\n') || err.message);
    }
  };

  const handleUpdateSetting = async (key: string) => {
    try {
      const updated = await api.updateSetting(key, settingDrafts[key]);
      setSettings(prev => prev.map(s => (s.key === key ? updated : s)));
      alert(`Parámetro ${key} actualizado en caliente (NFR-019).`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddCatalog = async (type: string) => {
    const name = (newCatalogName[type] || '').trim();
    if (!name) return;
    try {
      await api.createCatalogItem(type, name);
      setNewCatalogName(prev => ({ ...prev, [type]: '' }));
      reloadCatalogs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleCatalog = async (id: string, active: boolean) => {
    try {
      await api.updateCatalogItem(id, { active: !active });
      reloadCatalogs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Columnas para Usuarios SSO
  const userColumns: Column<UserProfile>[] = [
    {
      key: 'full_name',
      header: 'Nombre Completo / Correo',
      render: u => (
        <div>
          <span className="font-bold text-primary block">{u.full_name}</span>
          <span className="text-[11px] text-slate-500 font-mono">{u.email}</span>
        </div>
      ),
      mobileLabel: 'Usuario',
    },
    {
      key: 'department_name',
      header: 'Facultad / Departamento',
      render: u => <span className="text-xs text-slate-700">{u.department_name}</span>,
      mobileLabel: 'Departamento',
    },
    {
      key: 'roles',
      header: 'Roles Asignados (BR-015)',
      render: u => (
        <div className="flex flex-wrap gap-1">
          {u.roles.map(r => (
            <Badge key={r} role={r} size="sm" />
          ))}
        </div>
      ),
      mobileLabel: 'Roles',
    },
    {
      key: 'active',
      header: 'Estado',
      render: u => (
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {u.active ? 'Activo' : 'Inactivo'}
        </span>
      ),
      mobileLabel: 'Estado',
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: u => (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openEditRoles(u)}
          >
            Editar Roles
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => toggleUserActive(u)}
          >
            {u.active ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      ),
      mobileLabel: 'Acciones',
    },
  ];

  // Columnas para Bitácora de Auditoría Inmutable (FR-042, FR-043)
  const auditColumns: Column<AuditEvent>[] = [
    {
      key: 'at',
      header: 'Fecha / Hora (UTC)',
      render: a => (
        <span className="font-mono text-xs tabular-nums text-slate-700">
          {formatDateTime(a.at)}
        </span>
      ),
      mobileLabel: 'Fecha',
    },
    {
      key: 'actor_name',
      header: 'Actor / Rol',
      render: a => (
        <div>
          <span className="font-semibold text-primary block">{a.actor_name}</span>
          <span className="text-[10px] font-mono text-slate-400 uppercase">{a.actor_role}</span>
        </div>
      ),
      mobileLabel: 'Actor',
    },
    {
      key: 'action',
      header: 'Acción Auditada',
      render: a => (
        <span className="font-mono text-xs font-bold text-secondary">
          {a.action}
        </span>
      ),
      mobileLabel: 'Acción',
    },
    {
      key: 'event_hash',
      header: 'Hash de Integridad SHA-256',
      render: a => (
        <span className="font-mono text-[11px] text-slate-500 tabular-nums truncate block max-w-[180px]">
          {a.event_hash}
        </span>
      ),
      mobileLabel: 'Hash SHA-256',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-mono font-semibold text-secondary uppercase tracking-wider">
            Administración del Sistema • Seguridad y Parámetros (NFR-019)
          </span>
          <h1 className="text-2xl font-bold text-primary tracking-tight mt-1">
            Panel de Administración y Control Institucional
          </h1>
        </div>
      </div>

      {/* Navegación de los 4 Submódulos Oficiales (BASE.md Sección 5.1 Pantalla 9) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'users', label: '1. Directorio Usuarios SSO', icon: Users },
          { key: 'catalogs', label: '2. Catálogos Institucionales', icon: FolderTree },
          { key: 'settings', label: '3. Parámetros de Sistema', icon: Sliders },
          { key: 'audit', label: '4. Bitácora de Auditoría', icon: ShieldCheck },
        ].map(m => {
          const Icon = m.icon;
          const isActive = activeSubmodule === m.key;
          return (
            <button
              type="button"
              key={m.key}
              onClick={() => setActiveSubmodule(m.key as any)}
              className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2.5 transition-all ${
                isActive
                  ? 'bg-secondary text-white border-secondary shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}

      {/* SUBMÓDULO 1: Usuarios SSO (FR-002..004, BR-015) */}
      {activeSubmodule === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button type="button" variant="primary" size="sm" onClick={() => setIsNewUserOpen(true)} icon={<Plus className="w-4 h-4" />}>
              Registrar Usuario Institucional
            </Button>
          </div>
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-primary flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Regla de Seguridad CON-002:</strong> Está estrictamente prohibido gestionar contraseñas locales. Las cuentas corresponden al SSO federado institucional (@urpmp.edu.pe).
            </p>
          </div>

          <DataTable
            columns={userColumns}
            data={users}
            keyExtractor={u => u.id}
          />
        </div>
      )}

      {/* SUBMÓDULO 2: Catálogos Institucionales (FR-006) */}
      {activeSubmodule === 'catalogs' && catalogs && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {([
            ['departments', 'Facultades y Departamentos'],
            ['research_areas', 'Áreas de Investigación'],
            ['research_lines', 'Líneas de Investigación'],
            ['project_types', 'Tipos de Proyecto'],
          ] as const).map(([type, label]) => (
            <Card key={type} padding="p-6" className="space-y-3">
              <h2 className="text-sm font-bold text-primary">{label}</h2>
              <div className="divide-y divide-slate-100 text-xs">
                {catalogs[type].map(d => (
                  <div key={d.id} className="py-2 flex items-center justify-between gap-2">
                    <span className={d.active ? '' : 'text-slate-400 line-through'}>{d.name}</span>
                    <button type="button" onClick={() => toggleCatalog(d.id, d.active)} className="shrink-0">
                      <Badge variant={d.active ? 'success' : 'neutral'} size="sm">
                        {d.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </button>
                  </div>
                ))}
              </div>
              {type !== 'research_lines' && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={newCatalogName[type] || ''}
                    onChange={e => setNewCatalogName(prev => ({ ...prev, [type]: e.target.value }))}
                    placeholder="Nuevo elemento…"
                    aria-label={`Nuevo elemento en ${label}`}
                    className="flex-1 px-2 py-1.5 bg-surface-sunken border border-slate-200 rounded-md text-xs"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={() => handleAddCatalog(type)} icon={<Plus className="w-3.5 h-3.5" />}>
                    Agregar
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* SUBMÓDULO 3: Parámetros Configurables del Sistema (NFR-019) */}
      {activeSubmodule === 'settings' && (
        <Card padding="p-6" className="space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-primary">
              Ajustes Configurables en Caliente (NFR-019)
            </h2>
            <p className="text-xs text-slate-500">
              Modificación de parámetros sin necesidad de alterar código fuente ni reiniciar el servidor.
            </p>
          </div>

          <div className="space-y-4">
            {settings.map(s => (
              <div
                key={s.key}
                className="p-4 bg-surface-sunken rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <span className="font-mono font-bold text-secondary">{s.key}</span>
                  <p className="text-[11px] text-slate-500">
                    Rango permitido: {s.min_allowed} a {s.max_allowed} • Versión: v{s.version} • Actualizado: {formatDateTime(s.updated_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    min={s.min_allowed}
                    max={s.max_allowed}
                    value={settingDrafts[s.key] ?? Number(s.value)}
                    onChange={e => setSettingDrafts(prev => ({ ...prev, [s.key]: Number(e.target.value) }))}
                    aria-label={s.key}
                    className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-md font-mono font-bold text-right tabular-nums"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={settingDrafts[s.key] === Number(s.value)}
                    onClick={() => handleUpdateSetting(s.key)}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* SUBMÓDULO 4: Bitácora de Auditoría Inmutable (FR-042, FR-043, NFR-008) */}
      {activeSubmodule === 'audit' && (
        <div className="space-y-6">
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Bitácora Inmutable de Auditoría (Append-only):</strong> Ningún rol (incluyendo administradores) puede editar o eliminar registros de esta bitácora. Retención mínima de 5 años con encadenamiento SHA-256 (NFR-008).
            </p>
          </div>

          <DataTable
            columns={auditColumns}
            data={auditEvents}
            keyExtractor={a => a.id}
          />

          {chain && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                chain.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {chain.valid ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <History className="w-4 h-4 text-red-600" />}
              <span>
                {chain.valid
                  ? `Cadena íntegra: ${chain.total} eventos verificados recalculando cada hash SHA-256.`
                  : `¡Cadena alterada! Inconsistencia detectada en el evento ${chain.broken_at}.`}
              </span>
            </div>
          )}

          <TechDetails
            title="Integridad Criptográfica de la Bitácora (Cadena de Hash de Auditoría)"
            hash={chain?.head_hash}
            blockNumber={chain?.total}
          />
        </div>
      )}

      {/* Modal de Alta de Usuario (FR-003) */}
      <Modal
        isOpen={isNewUserOpen}
        onClose={() => setIsNewUserOpen(false)}
        title="Registrar Usuario Institucional"
        description="FR-003: El correo institucional debe ser único. No se gestionan contraseñas (CON-002)."
        footer={
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsNewUserOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={handleCreateUser}>
              Registrar
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <input
            type="email"
            value={newUser.email}
            onChange={e => setNewUser({ ...newUser, email: e.target.value })}
            placeholder="nombre.apellido@urpmp.edu.pe"
            aria-label="Correo institucional"
            className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
          />
          <input
            type="text"
            value={newUser.full_name}
            onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
            placeholder="Nombre completo con grado (Dr., Mg., Br.)"
            aria-label="Nombre completo"
            className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
          />
          <input
            type="text"
            value={newUser.title}
            onChange={e => setNewUser({ ...newUser, title: e.target.value })}
            placeholder="Cargo (opcional)"
            aria-label="Cargo"
            className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
          />
          <select
            value={newUser.department_id}
            onChange={e => setNewUser({ ...newUser, department_id: e.target.value })}
            aria-label="Departamento"
            className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
          >
            {(catalogs?.departments || []).filter(d => d.active).map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={newUser.roles[0]}
            onChange={e => setNewUser({ ...newUser, roles: [e.target.value as SystemRoleCode] })}
            aria-label="Rol inicial"
            className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
          >
            <option value="researcher">Investigador Principal</option>
            <option value="student_researcher">Estudiante Investigador</option>
            <option value="research_coordinator">Coordinador de Investigación</option>
            <option value="committee_member">Comité Evaluador</option>
            <option value="department_coordinator">Coordinador de Departamento</option>
            <option value="university_authority">Autoridad Universitaria</option>
            <option value="administrator">Administrador del Sistema</option>
          </select>
        </div>
      </Modal>

      {/* Modal para Editar Roles de Usuario (BR-015) */}
      <Modal
        isOpen={isEditRolesModalOpen}
        onClose={() => setIsEditRolesModalOpen(false)}
        title={`Asignación de Roles: ${selectedUser?.full_name}`}
        description="BR-015: Un usuario institucional puede desempeñar múltiples roles en la plataforma."
        footer={
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsEditRolesModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSaveRoles}
            >
              Guardar Roles
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-xs">
          {[
            { code: 'researcher', name: 'Investigador Principal (PI)' },
            { code: 'student_researcher', name: 'Estudiante Investigador' },
            { code: 'research_coordinator', name: 'Coordinador de Investigación' },
            { code: 'committee_member', name: 'Comité Evaluador' },
            { code: 'department_coordinator', name: 'Coordinador de Departamento' },
            { code: 'university_authority', name: 'Autoridad Universitaria' },
            { code: 'administrator', name: 'Administrador del Sistema' },
          ].map(r => (
            <label
              key={r.code}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={userRoles.includes(r.code as SystemRoleCode)}
                onChange={() => toggleRoleSelection(r.code as SystemRoleCode)}
                className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary"
              />
              <span className="font-semibold text-primary">{r.name}</span>
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
};
