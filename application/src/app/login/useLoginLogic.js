import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";

function buildWarmWelcomeToast(user) {
  const displayName = user?.fullName || user?.username || "there";
  const prevRaw = user?.previousLoginAt;

  if (!prevRaw) {
    return {
      title: `Welcome, ${displayName}! ✨`,
      message: "Glad to have you on board. Let's build effortless financial clarity together!",
    };
  }

  const prevDate = new Date(prevRaw);
  const diffMs = Math.max(0, Date.now() - prevDate.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const formattedPrev = prevDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  if (diffDays < 1) {
    return {
      title: `Welcome back, ${displayName}! 👋`,
      message: "Great to see you again today — your vaults and quick action cards are ready.",
    };
  }

  if (diffDays <= 7) {
    return {
      title: `Welcome back, ${displayName}! ✨`,
      message: `It's been ${diffDays} day${diffDays > 1 ? "s" : ""} since your last visit (${formattedPrev}). Great to see you keeping your financial rhythm!`,
    };
  }

  return {
    title: `Welcome back, ${displayName} — we missed you! 🌟`,
    message: `It's been ${diffDays} days since your last sign-in (${formattedPrev}). Take a quick moment to review or audit your vaults!`,
  };
}

export function useLoginLogic() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const enqueueToast = useLedgerStore((s) => s.enqueueToast);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [infoAnchor, setInfoAnchor] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          password,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || "Sign in failed. Please check your credentials.");
        return;
      }

      const loggedInUser = json.data?.user;
      await queryClient.clear();

      const welcome = buildWarmWelcomeToast(loggedInUser);
      enqueueToast(welcome.message, {
        title: welcome.title,
        variant: "welcome",
        duration: 6500,
      });

      if (loggedInUser?.mustChangePassword) {
        router.replace("/force-password-change");
      } else if (!loggedInUser?.onboardingCompleted && !loggedInUser?.onboardingSkipped) {
        router.replace("/onboarding");
      } else {
        router.replace("/");
      }
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please verify your local connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    username,
    setUsername,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    error,
    submitting,
    infoAnchor,
    setInfoAnchor,
    handleSubmit,
  };
}
