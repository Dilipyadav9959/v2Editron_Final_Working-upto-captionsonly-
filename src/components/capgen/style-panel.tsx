"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CAPGEN_FONTS } from "@/lib/languages";
import type { CaptionPosition, CaptionStyle, CaptionTemplate } from "@/lib/captions";
import { Bold, Italic, CaseSensitive, AlignStartVertical, AlignCenter, AlignEndVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  style: CaptionStyle;
  onChange: (patch: Partial<CaptionStyle>) => void;
};

const TEMPLATES: { value: CaptionTemplate; label: string }[] = [
  { value: "plain", label: "Plain" },
  { value: "active-word", label: "Active Word" },
  { value: "boxed", label: "Boxed" },
  { value: "outline", label: "Outline" },
];

const POSITIONS: { value: CaptionPosition; label: string; icon: React.ReactNode }[] = [
  { value: "top", label: "Top", icon: <AlignStartVertical className="size-4" /> },
  { value: "center", label: "Center", icon: <AlignCenter className="size-4" /> },
  { value: "bottom", label: "Bottom", icon: <AlignEndVertical className="size-4" /> },
];

export function StylePanel({ style, onChange }: Props) {
  return (
    <div className="space-y-5">
      {/* Font family */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-[#888888]">
          Font
        </Label>
        <Select value={style.fontFamily} onValueChange={(v) => onChange({ fontFamily: v })}>
          <SelectTrigger className="w-full bg-[#141414]">
            <SelectValue placeholder="Pick a font" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Display &amp; body fonts</SelectLabel>
              {CAPGEN_FONTS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  <span style={{ fontFamily: f.cssFamily, fontSize: "15px", fontWeight: 700 }}>
                    {f.label}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Font size */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-[#888888]">
            Font size
          </Label>
          <span className="text-xs font-semibold text-[#FF6B1A]">{style.fontSize}px</span>
        </div>
        <Slider
          min={12}
          max={120}
          step={1}
          value={[style.fontSize]}
          onValueChange={(v) => onChange({ fontSize: v[0] })}
        />
      </div>

      {/* Colors */}
      <div className="grid grid-cols-3 gap-2">
        <ColorField
          label="Text"
          value={style.textColor}
          onChange={(v) => onChange({ textColor: v })}
        />
        <ColorField
          label="Highlight"
          value={style.highlightColor}
          onChange={(v) => onChange({ highlightColor: v })}
        />
        <ColorField
          label="Box bg"
          value={style.bgColor}
          onChange={(v) => onChange({ bgColor: v })}
        />
      </div>

      {/* Background opacity */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-[#888888]">
            Background opacity
          </Label>
          <span className="text-xs font-semibold text-[#FF6B1A]">{style.bgOpacity}%</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[style.bgOpacity]}
          onValueChange={(v) => onChange({ bgOpacity: v[0] })}
        />
      </div>

      {/* Position */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-[#888888]">
          Position
        </Label>
        <ToggleGroup
          type="single"
          value={style.position}
          onValueChange={(v) => {
            if (v) onChange({ position: v as CaptionPosition });
          }}
          className="grid w-full grid-cols-3 gap-1 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-1"
        >
          {POSITIONS.map((p) => (
            <ToggleGroupItem
              key={p.value}
              value={p.value}
              aria-label={p.label}
              className="flex-col gap-1 py-2 text-xs data-[state=on]:bg-[#2a1a0d] data-[state=on]:text-[#FF6B1A] data-[state=on]:shadow-sm"
            >
              {p.icon}
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Template */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-[#888888]">
          Template
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ template: t.value })}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-semibold transition-all",
                style.template === t.value
                  ? "border-[#FF6B1A] bg-[#2a1a0d] text-[#FF6B1A] shadow-sm"
                  : "border-[#2a2a2a] bg-[#141414] text-[#a0a0a0] hover:border-[#FF6B1A]/40 hover:text-[#FF6B1A]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Outline stroke (only when outline template) */}
      {style.template === "outline" && (
        <div className="space-y-1.5 rounded-lg border border-dashed border-[#FF6B1A]/40 bg-[#2a1a0d] p-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wide text-[#888888]">
              Stroke width
            </Label>
            <span className="text-xs font-semibold text-[#FF6B1A]">{style.strokeWidth}px</span>
          </div>
          <Slider
            min={0}
            max={12}
            step={1}
            value={[style.strokeWidth]}
            onValueChange={(v) => onChange({ strokeWidth: v[0] })}
          />
          <ColorField
            label="Stroke color"
            value={style.strokeColor}
            onChange={(v) => onChange({ strokeColor: v })}
          />
        </div>
      )}

      {/* Letter spacing */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-[#888888]">
            Letter spacing
          </Label>
          <span className="text-xs font-semibold text-[#FF6B1A]">{style.letterSpacing}px</span>
        </div>
        <Slider
          min={-2}
          max={12}
          step={1}
          value={[style.letterSpacing]}
          onValueChange={(v) => onChange({ letterSpacing: v[0] })}
        />
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-3 gap-2">
        <ToggleBtn
          active={style.bold}
          onClick={() => onChange({ bold: !style.bold })}
          icon={<Bold className="size-4" />}
          label="Bold"
        />
        <ToggleBtn
          active={style.italic}
          onClick={() => onChange({ italic: !style.italic })}
          icon={<Italic className="size-4" />}
          label="Italic"
        />
        <ToggleBtn
          active={style.uppercase}
          onClick={() => onChange({ uppercase: !style.uppercase })}
          icon={<CaseSensitive className="size-4" />}
          label="Upper"
        />
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-wide text-[#888888]">
        {label}
      </Label>
      <div className="flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#141414] px-2 py-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-6 rounded"
          aria-label={label}
        />
        <span className="font-mono text-[11px] text-[#a0a0a0]">{value.toUpperCase()}</span>
      </div>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="ghost"
      className={cn(
        "flex-col gap-1 py-2 text-xs",
        active
          ? "bg-[#FF6B1A] text-white hover:bg-[#E55A0E]"
          : "bg-[#1a1a1a] text-[#a0a0a0] hover:bg-[#2a1a0d]"
      )}
    >
      {icon}
      {label}
    </Button>
  );
}
