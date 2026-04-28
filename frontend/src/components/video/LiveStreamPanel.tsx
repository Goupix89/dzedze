import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, VideoOff, PhoneOff, Wifi, WifiOff, Maximize2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { apiClient } from '../../services/api';

// ── Types ─────────────────────────────────────────────────────
interface Props {
  missionId: string;
  agentId:   string;
}

type StreamStatus =
  | 'idle' | 'requesting' | 'waiting_agent'
  | 'connecting' | 'live' | 'ended' | 'refused' | 'error';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ── Component ─────────────────────────────────────────────────
export function LiveStreamPanel({ missionId, agentId }: Props) {
  const { user } = useAuthStore();
  const videoRef  = useRef<HTMLVideoElement>(null);
  const pcRef     = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const [status, setStatus]     = useState<StreamStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [elapsed, setElapsed]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // ── Socket.IO ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const wsUrl = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'http://localhost:3000';
    const socket = io(wsUrl, { auth: { userId: user.id }, transports: ['websocket'] });

    socket.on('stream:response', (data: { accepted: boolean }) => {
      setStatus(data.accepted ? 'connecting' : 'refused');
    });

    socket.on('webrtc:offer', async (data: { fromUserId: string; sessionId: string; sdp: RTCSessionDescriptionInit }) => {
      await _handleOffer(data, socket);
    });

    socket.on('webrtc:ice', async (data: { candidate: RTCIceCandidateInit }) => {
      try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (_) {}
    });

    socket.on('webrtc:live', () => {
      setStatus('live');
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    });

    socket.on('stream:ended', () => _stop(socket));

    socketRef.current = socket;
    return () => { socket.disconnect(); clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── WebRTC offer handler ──────────────────────────────────
  const _handleOffer = useCallback(async (
    data: { fromUserId: string; sessionId: string; sdp: RTCSessionDescriptionInit },
    socket: Socket
  ) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.ontrack = (ev) => {
      if (videoRef.current && ev.streams[0]) {
        videoRef.current.srcObject = ev.streams[0];
        setStatus('live');
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      }
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        socket.emit('webrtc:ice', { targetUserId: data.fromUserId, sessionId: data.sessionId, candidate: ev.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') _stop(socket);
    };

    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('webrtc:answer', { targetUserId: data.fromUserId, sessionId: data.sessionId, sdp: answer });
  }, []);

  // ── Request stream ────────────────────────────────────────
  const requestStream = async () => {
    setStatus('requesting');
    try {
      const res = await apiClient.post('/stream/request', {
        missionId,
        reason: 'Supervision en temps réel',
        maxDurationMinutes: 15,
      });
      setSessionId(res.data.data.sessionId);
      setStatus('waiting_agent');
    } catch {
      setStatus('error');
    }
  };

  // ── Stop ─────────────────────────────────────────────────
  const _stop = useCallback((socket?: Socket) => {
    clearInterval(timerRef.current);
    pcRef.current?.close(); pcRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    (socket ?? socketRef.current)?.emit('stream:stop', { sessionId });
    setStatus('ended'); setElapsed(0);
  }, [sessionId]);

  const stopStream = async () => {
    if (sessionId) {
      try { await apiClient.delete(`/stream/${sessionId}`); } catch (_) {}
    }
    _stop();
  };

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={`relative bg-black rounded-2xl overflow-hidden border border-guin-border ${fullscreen ? 'fixed inset-4 z-50' : 'aspect-video w-full'}`}>
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />

      {/* Overlay */}
      {status !== 'live' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <Video size={48} className="text-guin-gold mx-auto mb-4 opacity-60" />
                <p className="text-white text-sm mb-5">Superviser l'agent en temps réel</p>
                <button onClick={requestStream}
                  className="px-6 py-2.5 bg-guin-terracotta hover:opacity-90 text-white rounded-xl text-sm font-semibold flex items-center gap-2 mx-auto">
                  <Video size={15} /> Demander un live
                </button>
              </motion.div>
            )}
            {status === 'requesting' && (
              <motion.div key="req" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <div className="w-8 h-8 border-2 border-guin-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-guin-muted text-sm">Envoi…</p>
              </motion.div>
            )}
            {status === 'waiting_agent' && (
              <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-2">
                <Wifi size={36} className="text-guin-gold mx-auto animate-pulse" />
                <p className="text-white text-sm">En attente de l'accord de l'agent…</p>
                <p className="text-guin-muted text-xs">L'agent doit accepter sur son mobile</p>
                <button onClick={stopStream} className="text-red-400 text-xs hover:underline pt-2">Annuler</button>
              </motion.div>
            )}
            {status === 'connecting' && (
              <motion.div key="conn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <WifiOff size={36} className="text-guin-gold mx-auto mb-2 animate-bounce" />
                <p className="text-white text-sm">Connexion pair-à-pair…</p>
              </motion.div>
            )}
            {(status === 'ended' || status === 'refused' || status === 'error') && (
              <motion.div key="end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-3">
                <VideoOff size={36} className="text-guin-muted mx-auto" />
                <p className="text-guin-muted text-sm">
                  {status === 'refused' ? 'L\'agent a refusé.' : status === 'error' ? 'Erreur lors de la demande.' : 'Live terminé.'}
                </p>
                <button onClick={() => { setStatus('idle'); setElapsed(0); }}
                  className="px-4 py-1.5 border border-guin-border text-white text-xs rounded-lg hover:bg-guin-card">
                  Nouvelle demande
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Live HUD */}
      {status === 'live' && (
        <>
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />LIVE
            </span>
            <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full font-mono">{fmtTime(elapsed)}</span>
          </div>
          <div className="absolute top-3 right-3 flex gap-2">
            <button onClick={() => setFullscreen(f => !f)}
              className="p-1.5 bg-black/60 rounded-lg text-white hover:bg-black/80"><Maximize2 size={14} /></button>
            <button onClick={stopStream}
              className="p-1.5 bg-red-600 rounded-lg text-white hover:bg-red-700"><PhoneOff size={14} /></button>
          </div>
        </>
      )}
    </div>
  );
}
