"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type PageState = "checking" | "ready" | "invalid" | "done" | "unavailable";

export default function ResetPasswordPage() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [pageState, setPageState] = useState<PageState>("checking");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    let invalidTimer: number | undefined;
    try {
      const client = createClient();
      setSupabase(client);
      const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" || session) {
          if (invalidTimer) window.clearTimeout(invalidTimer);
          setEmail(session?.user.email ?? "");
          setPageState("ready");
        }
      });
      void client.auth.getSession().then(({ data }) => {
        if (!active) return;
        if (data.session) {
          setEmail(data.session.user.email ?? "");
          setPageState("ready");
        } else {
          invalidTimer = window.setTimeout(() => {
            if (active) setPageState("invalid");
          }, 900);
        }
      }).catch(() => { if (active) setPageState("unavailable"); });
      return () => {
        active = false;
        if (invalidTimer) window.clearTimeout(invalidTimer);
        authListener.subscription.unsubscribe();
      };
    } catch {
      setPageState("unavailable");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("password_confirm"))) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage("El enlace venció o ya fue utilizado. Solicita otro desde Ingresar.");
      setPageState("invalid");
      return;
    }
    setPageState("done");
    setMessage("Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.");
  }

  return <main className="reset-page">
    <section className="reset-card" aria-labelledby="reset-title">
      <div className="brand-crest reset-mark">LP</div>
      <p className="eyebrow">SEGURIDAD DE LA CUENTA</p>
      <h1 id="reset-title">Restablecer contraseña</h1>
      {pageState === "checking" && <p className="muted">Validando el enlace de recuperación…</p>}
      {pageState === "ready" && <>
        <p className="muted">{email ? `Cuenta: ${email}` : "Escribe una contraseña nueva para tu cuenta."}</p>
        <form className="form-stack" onSubmit={submit}>
          <label>Nueva contraseña<input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" /></label>
          <label>Confirma la contraseña<input name="password_confirm" type="password" required minLength={8} autoComplete="new-password" placeholder="Repite la contraseña" /></label>
          {message && <p className="auth-message" role="alert">{message}</p>}
          <button className="btn btn-gold full" disabled={busy}>{busy ? "Guardando…" : "Guardar contraseña nueva"}</button>
        </form>
      </>}
      {pageState === "invalid" && <div className="reset-status"><p className="auth-message" role="status">{message || "El enlace de recuperación no es válido o ya venció."}</p><p className="muted">Solicita un enlace nuevo desde el acceso de tu cuenta.</p><Link className="btn btn-dark full" href="/?view=perfil">Volver a LigaPro</Link></div>}
      {pageState === "unavailable" && <div className="reset-status"><p className="auth-message" role="alert">No se pudo conectar con Supabase. Recarga la página e inténtalo otra vez.</p><Link className="btn btn-dark full" href="/?view=perfil">Volver a LigaPro</Link></div>}
      {pageState === "done" && <div className="reset-status"><p className="auth-message" role="status">{message}</p><Link className="btn btn-dark full" href="/?view=perfil">Ir a iniciar sesión</Link></div>}
      <p className="auth-footnote">LigaPro nunca te pedirá compartir tu contraseña por correo.</p>
    </section>
  </main>;
}
