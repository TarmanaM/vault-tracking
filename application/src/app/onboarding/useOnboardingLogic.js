import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLedgerStore } from "@/store/useLedgerStore";

export function useOnboardingLogic() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const enqueueToast = useLedgerStore((s) => s.enqueueToast);

  const [baseCurrency, setBaseCurrency] = useState("IDR");
  const [selectedModules, setSelectedModules] = useState({});
  const [vaultConfig, setVaultConfig] = useState([]);
  const [initialized, setInitialized] = useState(false);
  const [submittingMode, setSubmittingMode] = useState(null);
  const [error, setError] = useState("");
  const [infoAnchor, setInfoAnchor] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding");
      if (!res.ok) throw new Error("Failed to load setup wizard");
      const json = await res.json();
      return json.data;
    },
  });

  useEffect(() => {
    if (!data || initialized) return;

    const saved = data.savedProfile;
    setBaseCurrency(data.baseCurrency || "IDR");

    const moduleMap = {};
    const savedModules = new Set(Array.isArray(saved?.modules) ? saved.modules : []);
    for (const mod of data.onboardingModules || []) {
      moduleMap[mod.key] = saved?.modules ? savedModules.has(mod.key) : Boolean(mod.defaultChecked);
    }
    setSelectedModules(moduleMap);

    const initialVaults = (data.starterVaultTemplates || []).map((tpl) => ({
      key: tpl.key,
      defaultName: tpl.defaultName,
      vaultType: tpl.vaultType,
      colorHex: tpl.colorHex,
      enabled: Boolean(tpl.defaultSelected),
      customName: tpl.defaultName,
      openingBalance: "",
    }));
    setVaultConfig(initialVaults);
    setInitialized(true);
  }, [data, initialized]);

  const user = data?.user;
  const alreadyCompleted = Boolean(user?.onboardingCompleted || user?.onboardingSkipped);

  const handleToggleModule = (key) => {
    setSelectedModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleVaultChange = (key, field, value) => {
    setVaultConfig((prev) =>
      prev.map((v) => (v.key === key ? { ...v, [field]: value } : v))
    );
  };

  const handleSubmit = async (mode) => {
    setError("");
    setSubmittingMode(mode);

    try {
      const payload =
        mode === "SKIP"
          ? { mode: "SKIP" }
          : {
              mode: "INTERVIEW",
              baseCurrency,
              modules: Object.entries(selectedModules)
                .filter(([, checked]) => Boolean(checked))
                .map(([key]) => key),
              starterVaults: vaultConfig.map((v) => ({
                key: v.key,
                enabled: v.enabled,
                customName: v.customName.trim() || v.defaultName,
                openingBalance: Number(v.openingBalance || 0),
              })),
            };

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const rawText = await res.text();
      let json = {};
      try {
        json = rawText ? JSON.parse(rawText) : {};
      } catch {
        json = {};
      }

      if (!res.ok || !json.success) {
        setError(json.error || `Failed to save workspace setup (HTTP ${res.status}).`);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });

      enqueueToast(
        mode === "SKIP"
          ? "Default starter setup applied. Ready to record transactions!"
          : "Personalized workspace ready!",
        { severity: "success" }
      );
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err?.message || "Failed to save onboarding setup.");
    } finally {
      setSubmittingMode(null);
    }
  };

  return {
    data,
    isLoading,
    initialized,
    user,
    alreadyCompleted,
    baseCurrency,
    setBaseCurrency,
    selectedModules,
    vaultConfig,
    submittingMode,
    error,
    infoAnchor,
    setInfoAnchor,
    handleToggleModule,
    handleVaultChange,
    handleSubmit,
  };
}
