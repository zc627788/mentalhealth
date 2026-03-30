import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Slider from "@radix-ui/react-slider";

interface SliderCaptchaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type CaptchaStatus = "idle" | "error" | "success";

const CAPTCHA_WIDTH = 320;
const CAPTCHA_HEIGHT = 176;
const PIECE_SIZE = 54;
const PIECE_START = 8;
const TOLERANCE = 6;

const createSeededRandom = (seed: number) => {
  let current = seed % 2147483647;
  if (current <= 0) {
    current += 2147483646;
  }

  return () => {
    current = (current * 16807) % 2147483647;
    return (current - 1) / 2147483646;
  };
};

const createSceneDataUri = (seed: number) => {
  const random = createSeededRandom(seed);
  const themes = [
    {
      skyTop: "#dbeafe",
      skyBottom: "#f8fbff",
      sun: "#f59e0b",
      sunGlow: "#fde68a",
      layerA: "#bfdbfe",
      layerB: "#93c5fd",
      layerC: "#60a5fa",
      accent: "#1d4ed8",
      cloud: "#ffffff",
    },
    {
      skyTop: "#dcfce7",
      skyBottom: "#f7fee7",
      sun: "#fb7185",
      sunGlow: "#fecdd3",
      layerA: "#bbf7d0",
      layerB: "#86efac",
      layerC: "#4ade80",
      accent: "#15803d",
      cloud: "#f0fdf4",
    },
    {
      skyTop: "#ede9fe",
      skyBottom: "#f8fafc",
      sun: "#f97316",
      sunGlow: "#fdba74",
      layerA: "#ddd6fe",
      layerB: "#c4b5fd",
      layerC: "#8b5cf6",
      accent: "#5b21b6",
      cloud: "#ffffff",
    },
    {
      skyTop: "#cffafe",
      skyBottom: "#f0fdfa",
      sun: "#0ea5e9",
      sunGlow: "#bae6fd",
      layerA: "#a5f3fc",
      layerB: "#67e8f9",
      layerC: "#06b6d4",
      accent: "#155e75",
      cloud: "#ecfeff",
    },
  ];

  const theme = themes[seed % themes.length];
  const sunX = 42 + Math.round(random() * 46);
  const sunY = 34 + Math.round(random() * 20);
  const cloudX = 168 + Math.round(random() * 52);
  const cloudY = 26 + Math.round(random() * 16);
  const cloudX2 = 230 + Math.round(random() * 28);
  const cloudY2 = 52 + Math.round(random() * 12);
  const waveA = 96 + Math.round(random() * 12);
  const waveB = 116 + Math.round(random() * 10);
  const waveC = 134 + Math.round(random() * 10);
  const waveD = 150 + Math.round(random() * 12);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CAPTCHA_WIDTH} ${CAPTCHA_HEIGHT}">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${theme.skyTop}" />
          <stop offset="100%" stop-color="${theme.skyBottom}" />
        </linearGradient>
        <radialGradient id="sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${theme.sunGlow}" />
          <stop offset="100%" stop-color="${theme.sun}" />
        </radialGradient>
      </defs>
      <rect width="${CAPTCHA_WIDTH}" height="${CAPTCHA_HEIGHT}" fill="url(#sky)" />
      <circle cx="${sunX}" cy="${sunY}" r="24" fill="url(#sun)" opacity="0.95" />
      <g opacity="0.95" fill="${theme.cloud}">
        <circle cx="${cloudX}" cy="${cloudY}" r="14" />
        <circle cx="${cloudX + 20}" cy="${cloudY - 4}" r="18" />
        <circle cx="${cloudX + 38}" cy="${cloudY}" r="13" />
        <rect x="${cloudX - 6}" y="${cloudY}" width="52" height="16" rx="8" />
        <circle cx="${cloudX2}" cy="${cloudY2}" r="10" />
        <circle cx="${cloudX2 + 18}" cy="${cloudY2 - 3}" r="13" />
        <circle cx="${cloudX2 + 33}" cy="${cloudY2}" r="9" />
        <rect x="${cloudX2 - 4}" y="${cloudY2}" width="42" height="12" rx="6" />
      </g>
      <path d="M0 118 C 42 ${waveA}, 92 ${waveB}, 156 118 C 210 ${waveC}, 262 ${waveD}, 320 112 V 176 H 0 Z" fill="${theme.layerA}" />
      <path d="M0 132 C 62 104, 124 148, 188 126 C 240 112, 280 142, 320 132 V 176 H 0 Z" fill="${theme.layerB}" />
      <path d="M0 148 C 48 130, 98 166, 154 148 C 214 128, 262 164, 320 150 V 176 H 0 Z" fill="${theme.layerC}" />
      <path d="M38 138 h44" stroke="${theme.accent}" stroke-width="4" stroke-linecap="round" opacity="0.24" />
      <path d="M232 144 h52" stroke="${theme.accent}" stroke-width="4" stroke-linecap="round" opacity="0.24" />
      <circle cx="${96 + Math.round(random() * 20)}" cy="146" r="4" fill="${theme.sun}" opacity="0.75" />
      <circle cx="${136 + Math.round(random() * 20)}" cy="154" r="3" fill="${theme.sun}" opacity="0.6" />
      <circle cx="${252 + Math.round(random() * 16)}" cy="150" r="4" fill="${theme.sun}" opacity="0.7" />
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const drawPuzzleShape = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
) => {
  const corner = 10;
  const dent = 10;
  const mid = size / 2;

  ctx.beginPath();
  ctx.moveTo(x + corner, y);
  ctx.lineTo(x + mid - dent, y);
  ctx.quadraticCurveTo(x + mid, y + dent, x + mid + dent, y);
  ctx.lineTo(x + size - corner, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + corner);
  ctx.lineTo(x + size, y + mid - dent);
  ctx.quadraticCurveTo(x + size - dent, y + mid, x + size, y + mid + dent);
  ctx.lineTo(x + size, y + size - corner);
  ctx.quadraticCurveTo(x + size, y + size, x + size - corner, y + size);
  ctx.lineTo(x + corner, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - corner);
  ctx.lineTo(x, y + corner);
  ctx.quadraticCurveTo(x, y, x + corner, y);
  ctx.closePath();
};

export default function SliderCaptchaDialog({
  open,
  onOpenChange,
  onSuccess,
}: SliderCaptchaDialogProps) {
  const { t } = useTranslation();
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pieceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  const [sliderValue, setSliderValue] = useState(0);
  const [targetX, setTargetX] = useState(0);
  const [targetY, setTargetY] = useState(0);
  const [status, setStatus] = useState<CaptchaStatus>("idle");
  const [isReady, setIsReady] = useState(false);
  const [seed, setSeed] = useState(0);

  const maxOffset = CAPTCHA_WIDTH - PIECE_SIZE - PIECE_START - 12;

  const clearTimers = () => {
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const resetChallenge = () => {
    clearTimers();
    setSliderValue(0);
    setStatus("idle");
    setIsReady(false);
    setSeed(Date.now() + Math.floor(Math.random() * 1000));
  };

  useEffect(() => {
    if (open) {
      resetChallenge();
      return;
    }

    clearTimers();
    setSliderValue(0);
    setStatus("idle");
    setIsReady(false);
  }, [open]);

  useEffect(() => {
    if (!open || !seed) return;

    let cancelled = false;
    const random = createSeededRandom(seed);
    const nextTargetX = 144 + Math.round(random() * 82);
    const nextTargetY = 84 + Math.round(random() * 24);

    setTargetX(nextTargetX);
    setTargetY(nextTargetY);

    const image = new Image();
    image.src = createSceneDataUri(seed);
    image.onload = () => {
      if (cancelled) return;

      const backgroundCanvas = backgroundCanvasRef.current;
      const pieceCanvas = pieceCanvasRef.current;
      if (!backgroundCanvas || !pieceCanvas) return;

      const backgroundCtx = backgroundCanvas.getContext("2d");
      const pieceCtx = pieceCanvas.getContext("2d");
      if (!backgroundCtx || !pieceCtx) return;

      backgroundCtx.clearRect(0, 0, CAPTCHA_WIDTH, CAPTCHA_HEIGHT);
      backgroundCtx.drawImage(image, 0, 0, CAPTCHA_WIDTH, CAPTCHA_HEIGHT);
      backgroundCtx.save();
      drawPuzzleShape(backgroundCtx, nextTargetX, nextTargetY, PIECE_SIZE);
      backgroundCtx.fillStyle = "rgba(255, 255, 255, 0.72)";
      backgroundCtx.fill();
      backgroundCtx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      backgroundCtx.lineWidth = 1.5;
      backgroundCtx.stroke();
      backgroundCtx.restore();

      pieceCtx.clearRect(0, 0, PIECE_SIZE, PIECE_SIZE);
      pieceCtx.save();
      drawPuzzleShape(pieceCtx, 0, 0, PIECE_SIZE);
      pieceCtx.clip();
      pieceCtx.drawImage(
        image,
        nextTargetX,
        nextTargetY,
        PIECE_SIZE,
        PIECE_SIZE,
        0,
        0,
        PIECE_SIZE,
        PIECE_SIZE
      );
      pieceCtx.restore();
      pieceCtx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      pieceCtx.lineWidth = 1.5;
      drawPuzzleShape(pieceCtx, 0, 0, PIECE_SIZE);
      pieceCtx.stroke();

      setIsReady(true);
    };

    return () => {
      cancelled = true;
    };
  }, [open, seed]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const handleCommit = (value: number[]) => {
    const finalValue = value[0] ?? 0;
    const finalPosition = finalValue + PIECE_START;

    if (!isReady || status === "success") {
      return;
    }

    if (Math.abs(finalPosition - targetX) <= TOLERANCE) {
      setStatus("success");
      successTimerRef.current = window.setTimeout(() => {
        onSuccess();
      }, 360);
      return;
    }

    setStatus("error");
    resetTimerRef.current = window.setTimeout(() => {
      setSliderValue(0);
      setStatus("idle");
    }, 700);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
      <div className="w-full max-w-[27rem] rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {t("captcha.dialogTitle")}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t("captcha.dialogSubtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetChallenge}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              {t("captcha.refresh")}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div
            className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"
            style={{ width: CAPTCHA_WIDTH, height: CAPTCHA_HEIGHT }}
          >
            <canvas
              ref={backgroundCanvasRef}
              width={CAPTCHA_WIDTH}
              height={CAPTCHA_HEIGHT}
              className="block"
            />
            <div
              className="pointer-events-none absolute top-0 rounded-2xl border-2 border-dashed border-sky-100 bg-white/28 shadow-[0_0_0_4px_rgba(255,255,255,0.2),inset_0_0_0_1px_rgba(59,130,246,0.35)] animate-pulse"
              style={{
                width: PIECE_SIZE,
                height: PIECE_SIZE,
                transform: `translate3d(${targetX}px, ${targetY}px, 0)`,
              }}
            />
            <canvas
              ref={pieceCanvasRef}
              width={PIECE_SIZE}
              height={PIECE_SIZE}
              className={`pointer-events-none absolute top-0 z-10 rounded-2xl shadow-[0_22px_48px_rgba(15,23,42,0.35)] ring-[3px] ring-white/95 transition-opacity ${
                isReady ? "opacity-100" : "opacity-0"
              }`}
              style={{
                transform: `translate3d(${sliderValue + PIECE_START}px, ${targetY}px, 0)`,
              }}
            />
            {!isReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-sm">
                <p className="text-sm font-medium text-slate-600">
                  {t("captcha.loading")}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4">
            <Slider.Root
              value={[sliderValue]}
              max={maxOffset}
              step={1}
              disabled={!isReady || status === "success"}
              onValueChange={(value) => {
                clearTimers();
                setSliderValue(value[0] ?? 0);
                if (status !== "idle") {
                  setStatus("idle");
                }
              }}
              onValueCommit={handleCommit}
              className="group relative flex h-14 w-full touch-none select-none items-center"
              aria-label={t("captcha.sliderLabel")}
            >
              <Slider.Track className="relative h-14 grow overflow-hidden rounded-full border border-slate-200 bg-white shadow-inner">
                <Slider.Range className="absolute h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 opacity-90" />
                <div className="pointer-events-none absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-sky-100 bg-sky-50 text-lg font-semibold text-sky-500 shadow-sm">
                  &gt;
                </div>
                <div className="pointer-events-none absolute left-16 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {t("captcha.sliderChip")}
                </div>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-16 text-xs font-medium tracking-[0.18em] text-slate-400 uppercase">
                  {status === "success"
                    ? t("captcha.success")
                    : status === "error"
                    ? t("captcha.error")
                    : t("captcha.drag")}
                </div>
              </Slider.Track>
              <Slider.Thumb className="block h-14 w-14 rounded-full border border-sky-200 bg-white shadow-lg outline-none ring-0 transition-transform group-active:scale-95">
                <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-sky-600">
                  &gt;&gt;
                </span>
              </Slider.Thumb>
            </Slider.Root>

            <p
              className={`mt-3 text-xs ${
                status === "success"
                  ? "text-emerald-600"
                  : status === "error"
                  ? "text-rose-600"
                  : "text-slate-500"
              }`}
            >
              {status === "success"
                ? t("captcha.successHint")
                : status === "error"
                ? t("captcha.errorHint")
                : t("captcha.footerHint")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
