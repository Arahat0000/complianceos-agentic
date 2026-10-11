import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchProfile, saveProfile } from "@/lib/profile";

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

const DEMO = {
  entityType: "NBFC - Upper Layer",
  regulators: "RBI",
  assetSizeCrore: "25000",
  licenses: "NBFC-ICC",
  jurisdictions: "India",
  products: "retail lending, MSME loans",
  notes: "",
};

export function EntityProfileForm({ isDemo }: { isDemo: boolean }) {
  const [f, setF] = useState(isDemo ? DEMO : { entityType: "", regulators: "", assetSizeCrore: "", licenses: "", jurisdictions: "", products: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDemo) return;
    fetchProfile()
      .then((p) => {
        if (!p) return;
        setF({
          entityType: p.entityType ?? "",
          regulators: (p.regulators ?? []).join(", "),
          assetSizeCrore: p.assetSizeCrore === null ? "" : String(p.assetSizeCrore),
          licenses: (p.licenses ?? []).join(", "),
          jurisdictions: (p.jurisdictions ?? []).join(", "),
          products: (p.products ?? []).join(", "),
          notes: p.notes ?? "",
        });
      })
      .catch(() => toast.error("Failed to load entity profile"));
  }, [isDemo]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      if (!isDemo) {
        await saveProfile({
          entityType: f.entityType,
          regulators: list(f.regulators),
          assetSizeCrore: f.assetSizeCrore.trim() === "" ? null : Number(f.assetSizeCrore),
          licenses: list(f.licenses),
          jurisdictions: list(f.jurisdictions),
          products: list(f.products),
          notes: f.notes,
        });
      }
      toast.success("Entity profile saved");
    } catch {
      toast.error("Failed to save entity profile");
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof typeof f, label: string, placeholder?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`ep-${k}`}>{label}</Label>
      <Input id={`ep-${k}`} value={f[k]} onChange={set(k)} placeholder={placeholder} />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Describes what your institution is. The applicability agent uses it to decide which obligations bind you.
        Lists are comma-separated.
      </p>
      {field("entityType", "Entity type", "e.g. Scheduled Commercial Bank, NBFC-UL")}
      {field("regulators", "Regulators", "RBI, SEBI")}
      {field("assetSizeCrore", "Asset size (INR crore)", "25000")}
      {field("licenses", "Licenses")}
      {field("jurisdictions", "Jurisdictions")}
      {field("products", "Products", "retail lending, payments, custody")}
      {field("notes", "Notes")}
      <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
    </div>
  );
}
