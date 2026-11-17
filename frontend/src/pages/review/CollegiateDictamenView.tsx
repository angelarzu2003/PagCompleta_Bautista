import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TechDetails } from '../../components/ui/TechDetails';
import { useAuth } from '../../context/AuthContext';
import { api, CommitteeSession } from '../../api/client';
import { formatDateTime } from '../../utils/formatters';
import { ShieldCheck, CheckCircle2, AlertTriangle, Vote, XCircle, MinusCircle } from 'lucide-react';

const VOTE_LABELS: Record<string, { label: string; cls: string }> = {
  favor: { label: 'A FAVOR', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  contra: { label: 'EN CONTRA', cls: 'bg-red-50 text-red-800 border-red-200' },
  abstencion: { label: 'ABSTENCIÓN', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
};

/**
 * V08: Reevaluación por Comité y Dictamen Colegiado (SCREEN_6 | RF-07).
 * Control de Quórum: los votos se firman (SHA-256) en el servidor y la resolución
 * solo puede emitirse cuando el quórum requerido está completo.
 */
export const CollegiateDictamenView: React.FC = () => {
  const { activeRole } = useAuth();
  const [sessions, setSessions] = useState<CommitteeSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getCommitteeSessions()
      .then(list => {
        setSessions(list);
        setSessionId(prev => prev || list[0]?.id || '');
        if (!list.length) setError('No hay sesiones colegiadas en las que usted participe.');
      })
      .catch(err => setError(err.message));
  }, [activeRole]);

  const session = sessions.find(s => s.id === sessionId) || null;
  const replace = (s: CommitteeSession) => setSessions(prev => prev.map(x => (x.id === s.id ? s : x)));

  if (error || !session) {
    return (
      <Card padding="p-8" className="text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <p className="text-sm text-slate-600">{error || 'Cargando sesión colegiada…'}</p>
      </Card>
    );
  }

  const cast = session.votes.filter(v => v.vote !== null);
  const favor = cast.filter(v => v.vote === 'favor').length;
  const isQuorumComplete = cast.length >= session.required_quorum;
  const myVote = session.votes.find(v => v.is_current_user);
  const resolutionIssued = Boolean(session.resolution_number);
  const canIssue = activeRole === 'research_coordinator' || Boolean(myVote);

  const handleVote = async (vote: 'favor' | 'contra' | 'abstencion') => {
    if (!confirm(`¿Confirma su voto "${VOTE_LABELS[vote].label}"? El voto se firma y no puede modificarse.`)) return;
    setBusy(true);
    try {
      replace(await api.castCommitteeVote(session.id, vote));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleEmitResolution = async () => {
    if (!isQuorumComplete) {
      alert(`Control de Quórum Incompleto: se requieren ${session.required_quorum} votos.`);
      return;
    }
    setBusy(true);
    try {
      const updated = await api.issueCollegiateResolution(session.id);
      replace(updated);
      alert(`${updated.resolution_number} emitida y sellada (SHA-256) en la bitácora institucional.`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-0.5 rounded-full bg-primary text-white font-bold uppercase tracking-wider">Exp. {session.anonymous_code}</span>
            <span className="px-2.5 py-0.5 rounded-full bg-surface-sunken text-slate-700 font-medium">{session.session_number}</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold border ${
                isQuorumComplete ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isQuorumComplete ? 'bg-emerald-600' : 'bg-amber-500'} animate-pulse`} />
              Quórum {cast.length}/{session.required_quorum} {isQuorumComplete ? 'Completo' : 'Pendiente'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-primary tracking-tight mt-1">Reevaluación por Comité y Dictamen Colegiado (V08)</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {session.project_title} ({session.project_code}).
          </p>
          {sessions.length > 1 && (
            <select value={sessionId} onChange={e => setSessionId(e.target.value)} aria-label="Sesión" className="mt-2 px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.session_number} — {s.project_code}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {canIssue && (
            <Button type="button" variant="primary" isLoading={busy} disabled={!isQuorumComplete || resolutionIssued} onClick={handleEmitResolution} icon={<ShieldCheck className="w-4 h-4" />}>
              {resolutionIssued ? 'Dictamen Colegiado Emitido' : 'Emitir Resolución Colegiada'}
            </Button>
          )}
        </div>
      </div>

      {resolutionIssued && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>
            <strong>{session.resolution_number}</strong> emitida el {formatDateTime(session.resolution_issued_at)} · {favor} de {cast.length} votos a favor.
          </span>
        </div>
      )}

      <Card padding="p-8" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-primary">Subsanaciones Evaluadas por el Tribunal</h2>
            <span className="text-xs text-slate-500">Observaciones formuladas al expediente y su estado de subsanación</span>
          </div>
          <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
            {session.observations.filter(o => o.resolved).length}/{session.observations.length} SUBSANADAS
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {session.observations.map((o, i) => (
            <div key={o.id} className="p-4 rounded-xl bg-surface-sunken border border-slate-200 space-y-1">
              <div className="flex items-center justify-between font-bold text-primary">
                <span>
                  {i + 1}. {o.section_name}
                </span>
                {o.resolved ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
              </div>
              <p className="text-slate-600 leading-relaxed">{o.corrected_text_v2 || 'Pendiente de subsanación.'}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="p-8" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-primary">Votación Colegiada del Tribunal (Quórum {session.required_quorum})</h2>
            <p className="text-xs text-slate-500">Cada voto se firma con SHA-256 en el servidor y queda en la bitácora inmutable.</p>
          </div>
          <span className="font-mono text-xs font-bold text-secondary bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            {favor} a favor · {cast.length - favor} otros · {session.votes.length - cast.length} pendientes
          </span>
        </div>

        <div className="space-y-3">
          {session.votes.map(v => (
            <div key={v.id} className="p-5 rounded-xl border border-slate-200 bg-white shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-primary">{v.name}</span>
                  {v.vote ? (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${VOTE_LABELS[v.vote].cls}`}>Voto: {VOTE_LABELS[v.vote].label}</span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">Pendiente</span>
                  )}
                  {v.is_current_user && <span className="text-[10px] text-secondary font-semibold">(usted)</span>}
                </div>
                <p className="text-xs text-slate-500">{v.role}</p>
                {v.signatureHash && <span className="font-mono text-[11px] text-slate-400 block truncate max-w-md">Firma SHA-256: {v.signatureHash}</span>}
              </div>

              <div className="text-right shrink-0">
                {v.vote ? (
                  <>
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5 md:justify-end">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Firma registrada
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 block mt-0.5">{formatDateTime(v.votedAt)}</span>
                  </>
                ) : v.is_current_user && !resolutionIssued ? (
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => handleVote('favor')} icon={<Vote className="w-3.5 h-3.5" />}>
                      A favor
                    </Button>
                    <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => handleVote('contra')} icon={<XCircle className="w-3.5 h-3.5" />}>
                      En contra
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => handleVote('abstencion')} icon={<MinusCircle className="w-3.5 h-3.5" />}>
                      Abstención
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Esperando voto</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <TechDetails
        title={`Trazabilidad Criptográfica — ${session.session_number}`}
        hash={session.resolution_hash || undefined}
        cvd={session.resolution_number || undefined}
        blockNumber={cast.length}
        oid="2.16.604.1.101.44"
      >
        <div className="text-xs text-slate-600 space-y-1 pt-2">
          <p>• El hash de la resolución se calcula sobre el número de resolución y las firmas de todos los votos emitidos.</p>
          <p>• Validez del quórum: {session.required_quorum} votos registrados como mínimo.</p>
        </div>
      </TechDetails>
    </div>
  );
};
