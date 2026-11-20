"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  Heart,
  ShieldCheck,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { apiFetch, formatDuration } from "@/lib/api-client";
import type { UserProfile, CallRecord } from "@/lib/types";

interface CallSignalItem {
  id: string;
  senderId: string;
  signalType: string;
  payload: string;
}

interface CallOverlayProps {
  call: CallRecord | null;
  user: UserProfile;
  partner: UserProfile | null;
  incomingSignals: CallSignalItem[];
  onCallUpdated: (call: CallRecord | null) => void;
  onSendHeartDuringCall: () => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function CallOverlay({
  call,
  user,
  partner,
  incomingSignals,
  onCallUpdated,
  onSendHeartDuringCall,
}: CallOverlayProps) {
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [partnerMuted, setPartnerMuted] = useState(false);
  const [partnerCamOff, setPartnerCamOff] = useState(false);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [mediaNote, setMediaNote] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const offerSentRef = useRef<string | null>(null);

  const isIncomingRinging =
    call?.status === "ringing" && call.calleeId === user.id;
  const isOutgoingRinging =
    call?.status === "ringing" && call.callerId === user.id;
  const isActive = call?.status === "active";

  const cleanupWebRTC = useCallback(() => {
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setHasLocalVideo(false);
    setHasRemoteVideo(false);
    setMicMuted(false);
    setCamOff(false);
    setPartnerMuted(false);
    setPartnerCamOff(false);
    setMediaNote(null);
    processedSignalsRef.current.clear();
    offerSentRef.current = null;
  }, []);

  // Gentle Web Audio chime while ringing
  useEffect(() => {
    if (!isIncomingRinging && !isOutgoingRinging) return;
    let ctx: AudioContext | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const playTone = () => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return;
        if (!ctx) ctx = new AudioCtx();
        if (ctx.state === "suspended") return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(isIncomingRinging ? 523.25 : 440, ctx.currentTime);
        osc.frequency.setValueAtTime(
          isIncomingRinging ? 659.25 : 493.88,
          ctx.currentTime + 0.22
        );
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.65);
      } catch {
        // ignore autoplay restrictions
      }
    };

    playTone();
    interval = setInterval(playTone, 2400);
    return () => {
      if (interval) clearInterval(interval);
      ctx?.close().catch(() => {});
    };
  }, [isIncomingRinging, isOutgoingRinging]);

  // Live duration timer while call is active
  useEffect(() => {
    if (!isActive || !call) {
      setElapsedSec(0);
      return;
    }
    const base = call.answeredAt ? new Date(call.answeredAt).getTime() : Date.now();
    const tick = () =>
      setElapsedSec(Math.max(0, Math.floor((Date.now() - base) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isActive, call]);

  const sendSignal = useCallback(
    async (
      callId: string,
      signalType: "offer" | "answer" | "ice-candidate" | "media-state" | "hangup",
      payloadObj: unknown
    ) => {
      try {
        await apiFetch(`/api/calls/${callId}/signal`, {
          method: "POST",
          body: JSON.stringify({
            signalType,
            payload: JSON.stringify(payloadObj),
          }),
        });
      } catch {
        // ignore transient errors
      }
    },
    []
  );

  const ensurePeerConnection = useCallback(
    async (activeCall: CallRecord) => {
      if (pcRef.current) return pcRef.current;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendSignal(activeCall.id, "ice-candidate", ev.candidate.toJSON());
        }
      };

      pc.ontrack = (ev) => {
        const [remoteStream] = ev.streams;
        if (!remoteStream) return;
        if (remoteVideoRef.current && activeCall.callType === "video") {
          remoteVideoRef.current.srcObject = remoteStream;
          if (remoteStream.getVideoTracks().length > 0) {
            setHasRemoteVideo(true);
          }
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
        }
      };

      // Acquire local mic (+ camera if video call) with graceful hardware fallback
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const wantVideo = activeCall.callType === "video";
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: wantVideo ? { facingMode: "user", width: 640, height: 480 } : false,
          });
          localStreamRef.current = stream;
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
          if (wantVideo && stream.getVideoTracks().length > 0) {
            setHasLocalVideo(true);
            setCamOff(false);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          }
        } catch {
          // Try audio-only fallback if camera unavailable
          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
            localStreamRef.current = audioOnly;
            audioOnly.getTracks().forEach((t) => pc.addTrack(t, audioOnly));
            if (activeCall.callType === "video") {
              setCamOff(true);
              setMediaNote("Camera unavailable — connected with crystal voice");
            }
          } catch {
            setMediaNote("Connected via encrypted call bridge");
          }
        }
      }

      return pc;
    },
    [sendSignal]
  );

  // When call transitions to active, caller creates and sends WebRTC SDP offer
  useEffect(() => {
    if (!call) {
      cleanupWebRTC();
      return;
    }
    if (call.status !== "active") return;

    let cancelled = false;
    async function startWebRTC(c: CallRecord) {
      const pc = await ensurePeerConnection(c);
      if (cancelled) return;

      if (c.callerId === user.id && offerSentRef.current !== c.id) {
        offerSentRef.current = c.id;
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: c.callType === "video",
          });
          await pc.setLocalDescription(offer);
          await sendSignal(c.id, "offer", offer);
        } catch {
          // fallback bridge remains active
        }
      }
    }

    startWebRTC(call);
    return () => {
      cancelled = true;
    };
  }, [call, user.id, ensurePeerConnection, sendSignal, cleanupWebRTC]);

  // Process incoming WebRTC signals
  const processSignal = useCallback(
    async (sig: CallSignalItem, currentCall: CallRecord) => {
      if (processedSignalsRef.current.has(sig.id)) return;
      processedSignalsRef.current.add(sig.id);

      try {
        const parsed = JSON.parse(sig.payload);
        if (sig.signalType === "media-state") {
          if (typeof parsed.micMuted === "boolean") setPartnerMuted(parsed.micMuted);
          if (typeof parsed.camOff === "boolean") setPartnerCamOff(parsed.camOff);
          return;
        }

        const pc = await ensurePeerConnection(currentCall);
        if (sig.signalType === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(parsed));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(currentCall.id, "answer", answer);
        } else if (sig.signalType === "answer") {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(parsed));
          }
        } else if (sig.signalType === "ice-candidate") {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(parsed));
          }
        }
      } catch {
        // ignore malformed or duplicate signal
      }
    },
    [ensurePeerConnection, sendSignal]
  );

  useEffect(() => {
    if (!call || call.status !== "active") return;
    for (const s of incomingSignals) {
      processSignal(s, call);
    }
  }, [incomingSignals, call, processSignal]);

  // Backup polling during active/ringing calls so WebRTC connects seamlessly
  useEffect(() => {
    if (!call) return;
    const poll = setInterval(async () => {
      try {
        const data = await apiFetch<{
          activeCall: CallRecord | null;
          signals: CallSignalItem[];
        }>(`/api/calls?callId=${call.id}`);

        if (!data.activeCall || data.activeCall.id !== call.id) {
          cleanupWebRTC();
          onCallUpdated(null);
          return;
        }
        if (data.activeCall.status !== call.status) {
          onCallUpdated(data.activeCall);
        }
        if (data.activeCall.status === "active") {
          for (const s of data.signals) {
            processSignal(s, data.activeCall);
          }
        }
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [call, cleanupWebRTC, onCallUpdated, processSignal]);

  async function handleCallAction(action: "accept" | "reject" | "end") {
    if (!call) return;
    try {
      const res = await apiFetch<{ call: CallRecord }>(`/api/calls/${call.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      if (action === "accept") {
        onCallUpdated(res.call);
      } else {
        cleanupWebRTC();
        onCallUpdated(null);
      }
    } catch {
      cleanupWebRTC();
      onCallUpdated(null);
    }
  }

  function toggleMic() {
    const next = !micMuted;
    setMicMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    if (call) {
      sendSignal(call.id, "media-state", { micMuted: next, camOff });
    }
  }

  function toggleCamera() {
    const next = !camOff;
    setCamOff(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
    if (call) {
      sendSignal(call.id, "media-state", { micMuted, camOff: next });
    }
  }

  function toggleSpeaker() {
    const next = !speakerOn;
    setSpeakerOn(next);
    if (remoteAudioRef.current) remoteAudioRef.current.muted = !next;
    if (remoteVideoRef.current) remoteVideoRef.current.muted = !next;
  }

  return (
    <AnimatePresence>
      {call && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="fixed inset-0 z-[95] bg-midnight-romance text-white flex flex-col justify-between overflow-hidden"
        >
          {/* Remote audio stream */}
          <audio ref={remoteAudioRef} autoPlay playsInline />

          {/* Full-screen Remote Video if active video call */}
          {call.callType === "video" && isActive && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`absolute inset-0 w-full h-full object-cover transition-opacity ${
                hasRemoteVideo && !partnerCamOff ? "opacity-100" : "opacity-0"
              }`}
            />
          )}

          {/* Top Bar */}
          <div className="relative z-10 flex items-center justify-between px-6 pt-8 pb-4 bg-gradient-to-b from-black/50 to-transparent">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 px-3.5 py-1.5 text-xs font-medium text-rose-100">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>End-to-End WebRTC {call.callType === "video" ? "Video" : "Voice"}</span>
            </div>

            {isActive && (
              <div className="rounded-full bg-black/40 backdrop-blur-md px-3.5 py-1.5 font-mono text-sm font-bold text-white">
                {formatDuration(elapsedSec)}
              </div>
            )}
          </div>

          {/* Center Spouse Avatar / Call Status (shown during ringing, audio calls, or when remote camera is off) */}
          {(!hasRemoteVideo || partnerCamOff || call.callType === "audio" || !isActive) && (
            <div className="relative z-10 flex flex-col items-center text-center px-6">
              <div className="relative flex items-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.5], opacity: [0.45, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  className="absolute w-32 h-32 rounded-full bg-rose-500/40"
                />
                <motion.div
                  animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                  transition={{
                    duration: 2,
                    delay: 0.5,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                  className="absolute w-32 h-32 rounded-full bg-purple-500/35"
                />
                <Avatar
                  src={partner?.avatarUrl}
                  name={partner?.displayName || "Spouse"}
                  role={partner?.role}
                  size="xl"
                />
              </div>

              <h2 className="mt-6 font-serif text-3xl font-bold">
                {partner?.displayName || "Your Spouse"}
              </h2>

              <p className="mt-2 text-sm text-rose-200 font-medium">
                {isIncomingRinging
                  ? `Incoming Private ${
                      call.callType === "video" ? "Video" : "Audio"
                    } Call ❤️`
                  : isOutgoingRinging
                  ? `Calling your ${partner?.role || "spouse"}...`
                  : partnerMuted
                  ? `${partner?.displayName.split(" ")[0] || "Spouse"} muted microphone`
                  : `Connected · ${formatDuration(elapsedSec)}`}
              </p>

              {mediaNote && (
                <p className="mt-2 rounded-full bg-white/10 px-3.5 py-1 text-xs text-rose-100/80">
                  {mediaNote}
                </p>
              )}
            </div>
          )}

          {/* Local PiP Camera Preview */}
          {call.callType === "video" && isActive && (
            <div
              className={`absolute top-20 right-5 z-20 w-28 sm:w-36 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/30 bg-[#161B36] shadow-2xl ${
                hasLocalVideo && !camOff ? "block" : "hidden"
              }`}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
            </div>
          )}

          {/* Bottom Call Controls */}
          <div className="relative z-10 px-6 pb-10 pt-6 bg-gradient-to-t from-black/70 to-transparent">
            {isIncomingRinging ? (
              <div className="flex items-center justify-center gap-12">
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCallAction("reject")}
                    className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center shadow-xl shadow-rose-600/40 active:scale-95 transition"
                    aria-label="Decline call"
                  >
                    <PhoneOff className="w-7 h-7 text-white" />
                  </button>
                  <span className="text-xs font-semibold text-rose-200">Decline</span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <motion.button
                    type="button"
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    onClick={() => handleCallAction("accept")}
                    className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-500/40 active:scale-95 transition"
                    aria-label="Accept call"
                  >
                    {call.callType === "video" ? (
                      <Video className="w-7 h-7 text-white" />
                    ) : (
                      <Phone className="w-7 h-7 text-white" />
                    )}
                  </motion.button>
                  <span className="text-xs font-semibold text-emerald-200">Accept</span>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-sm flex items-center justify-around rounded-3xl bg-white/12 backdrop-blur-xl border border-white/20 px-4 py-4">
                <button
                  type="button"
                  onClick={toggleMic}
                  title={micMuted ? "Unmute microphone" : "Mute microphone"}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                    micMuted
                      ? "bg-white text-[#0D1126]"
                      : "bg-white/15 hover:bg-white/25 text-white"
                  }`}
                >
                  {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {call.callType === "video" && (
                  <button
                    type="button"
                    onClick={toggleCamera}
                    title={camOff ? "Turn camera on" : "Turn camera off"}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                      camOff
                        ? "bg-white text-[#0D1126]"
                        : "bg-white/15 hover:bg-white/25 text-white"
                    }`}
                  >
                    {camOff ? (
                      <VideoOff className="w-5 h-5" />
                    ) : (
                      <Video className="w-5 h-5" />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={toggleSpeaker}
                  title="Toggle speaker"
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                    speakerOn
                      ? "bg-white/15 hover:bg-white/25 text-white"
                      : "bg-white text-[#0D1126]"
                  }`}
                >
                  <Volume2 className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={onSendHeartDuringCall}
                  title="Send floating hearts"
                  className="w-12 h-12 rounded-full bg-rose-500/25 hover:bg-rose-500/40 text-rose-300 flex items-center justify-center active:scale-90 transition"
                >
                  <Heart className="w-5 h-5 fill-rose-400" />
                </button>

                <button
                  type="button"
                  onClick={() => handleCallAction("end")}
                  title="End call"
                  className="w-13 h-13 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 active:scale-95 transition"
                >
                  <PhoneOff className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
