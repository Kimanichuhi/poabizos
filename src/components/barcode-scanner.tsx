import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Keyboard } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onScan: (code: string) => void;
  title?: string;
}

/**
 * Combined barcode scanner:
 * - "Camera" tab uses html5-qrcode (mobile / laptop cameras)
 * - "Keyboard / HID" tab accepts input from USB or Bluetooth scanners
 *   (they type into a focused input and hit Enter)
 */
export function BarcodeScanner({ open, onOpenChange, onScan, title = "Scan barcode" }: Props) {
  const [mode, setMode] = useState<"camera" | "hid">("hid");
  const [manual, setManual] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<any>(null);
  const containerId = "barcode-scanner-region";

  useEffect(() => {
    if (!open) return;
    setManual("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, mode]);

  useEffect(() => {
    if (!open || mode !== "camera") return;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new mod.Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 140 } },
          (decoded) => {
            onScan(decoded);
            stop();
            onOpenChange(false);
          },
          () => {},
        );
      } catch (e) {
        console.error("Scanner start error", e);
      }
    })();
    const stop = async () => {
      try {
        if (scannerRef.current?.isScanning) await scannerRef.current.stop();
        await scannerRef.current?.clear();
      } catch {}
      scannerRef.current = null;
    };
    return () => { cancelled = true; stop(); };
  }, [open, mode, onScan, onOpenChange]);

  const submit = (val: string) => {
    const v = val.trim();
    if (!v) return;
    onScan(v);
    setManual("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="flex gap-2 mb-3">
          <Button size="sm" variant={mode === "hid" ? "default" : "outline"} onClick={() => setMode("hid")}>
            <Keyboard className="h-3.5 w-3.5 mr-1" /> Scanner / manual
          </Button>
          <Button size="sm" variant={mode === "camera" ? "default" : "outline"} onClick={() => setMode("camera")}>
            <Camera className="h-3.5 w-3.5 mr-1" /> Camera
          </Button>
        </div>
        {mode === "camera" ? (
          <div>
            <div id={containerId} className="rounded-md overflow-hidden bg-black min-h-[240px]" />
            <p className="text-xs text-muted-foreground mt-2">
              Point the camera at a barcode. Allow camera access when prompted.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Barcode / SKU</Label>
            <Input
              ref={inputRef} value={manual}
              onChange={e => setManual(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(manual); } }}
              placeholder="Scan or type code, then press Enter"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => submit(manual)} disabled={!manual.trim()}>Use code</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Works with USB / Bluetooth barcode scanners that behave as keyboards.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
