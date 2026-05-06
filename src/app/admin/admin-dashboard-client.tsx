"use client";

import type { PortfolioContent } from "@/data/portfolio-content";
import { Save, LogOut, Plus, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Section = "profile" | "socials" | "skills" | "experience" | "projects" | "security" | "json";
type SecurityStatus = {
  env: {
    resendApiKey: boolean;
    websocketUrl: string;
    websocketEnvFallback: string;
    umamiDomain: string;
    umamiSiteIdConfigured: boolean;
    adminPasswordConfigured: boolean;
    adminSessionSecretConfigured: boolean;
    realtimeAdminSecretConfigured: boolean;
  };
};

const sections: { id: Section; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "socials", label: "Socials" },
  { id: "skills", label: "Tech Stack" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "security", label: "Security" },
  { id: "json", label: "Raw JSON" },
];

const inputClass =
  "w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-white/30";
const labelClass = "text-xs font-medium uppercase tracking-wider text-white/50";

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className={labelClass}>{label}</span>
      <input className={inputClass} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />;
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="grid gap-2">
      <span className={labelClass}>{label}</span>
      <textarea className={inputClass} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export default function AdminDashboardClient() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [content, setContent] = useState<PortfolioContent | null>(null);
  const [active, setActive] = useState<Section>("profile");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [security, setSecurity] = useState<SecurityStatus | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    nextPassword: "",
    confirmPassword: "",
  });

  const projectSkillOptions = useMemo(
    () => [
      "next",
      "chakra",
      "node",
      "python",
      "prisma",
      "postgres",
      "mongo",
      "express",
      "reactQuery",
      "shadcn",
      "aceternity",
      "tailwind",
      "docker",
      "yjs",
      "firebase",
      "sockerio",
      "js",
      "ts",
      "vue",
      "react",
      "sanity",
      "spline",
      "gsap",
      "framerMotion",
      "supabase",
    ],
    []
  );

  async function loadContent() {
    setLoading(true);
    const session = await fetch("/api/admin/session").then((res) => res.json());
    setAuthenticated(session.authenticated);

    if (session.authenticated) {
      const nextContent = await fetch("/api/admin/portfolio").then((res) => res.json());
      const securityStatus = await fetch("/api/admin/security").then((res) => res.json());
      setContent(nextContent);
      setSecurity(securityStatus);
      setRawJson(JSON.stringify(nextContent, null, 2));
    }

    setLoading(false);
  }

  useEffect(() => {
    loadContent();
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setStatus("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      setStatus("Invalid password.");
      return;
    }

    setPassword("");
    await loadContent();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setContent(null);
    setSecurity(null);
  }

  async function save() {
    if (!content) return;
    setSaving(true);
    setStatus("");

    let payload: PortfolioContent = content;
    if (active === "json") {
      try {
        payload = JSON.parse(rawJson);
      } catch {
        setStatus("Raw JSON is invalid.");
        setSaving(false);
        return;
      }
    }

    const response = await fetch("/api/admin/portfolio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!response.ok) {
      setStatus("Save failed.");
      return;
    }

    setContent(payload);
    setRawJson(JSON.stringify(payload, null, 2));
    setStatus("Saved. Refresh the portfolio page to see changes.");
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setStatus("");

    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      setStatus("New passwords do not match.");
      return;
    }

    const response = await fetch("/api/admin/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: passwordForm.currentPassword,
        nextPassword: passwordForm.nextPassword,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus(result.error || "Password change failed.");
      return;
    }

    setPasswordForm({ currentPassword: "", nextPassword: "", confirmPassword: "" });
    setAuthenticated(false);
    setContent(null);
    setSecurity(null);
    setStatus("Password changed. Login again with your new password.");
  }

  function updateContent(next: PortfolioContent) {
    setContent(next);
    setRawJson(JSON.stringify(next, null, 2));
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    );
  }

  if (!authenticated || !content) {
    return (
      <main className="min-h-screen grid place-items-center bg-[hsl(222,84%,5%)] px-4 text-white">
        <form onSubmit={login} className="w-full max-w-sm rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <h1 className="font-display text-3xl">Portfolio Admin</h1>
          <p className="mt-2 text-sm text-white/50">Login to edit your portfolio content.</p>
          <div className="mt-6">
            <Field label="Password" value={password} onChange={setPassword} placeholder="Enter admin password" type="password" />
          </div>
          {status && <p className="mt-3 text-sm text-red-300">{status}</p>}
          <button className="mt-6 w-full rounded-md bg-white px-4 py-2 text-sm font-semibold text-black" type="submit">
            Login
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[hsl(222,84%,5%)] px-4 py-24 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-white/40">Dashboard</p>
            <h1 className="font-display text-4xl md:text-6xl">Portfolio Admin</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-black">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-2 text-sm">
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>

        {status && <p className="mt-4 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">{status}</p>}

        <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="flex gap-2 overflow-x-auto lg:flex-col">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActive(section.id)}
                className={`rounded-md px-4 py-2 text-left text-sm transition ${
                  active === section.id ? "bg-white text-black" : "border border-white/10 text-white/70 hover:bg-white/[0.06]"
                }`}
              >
                {section.label}
              </button>
            ))}
          </aside>

          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4 md:p-6">
            {active === "profile" && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name" value={content.profile.author} onChange={(author) => updateContent({ ...content, profile: { ...content.profile, author } })} />
                <Field label="Role" value={content.profile.role} onChange={(role) => updateContent({ ...content, profile: { ...content.profile, role } })} />
                <Field label="SEO Title" value={content.profile.title} onChange={(title) => updateContent({ ...content, profile: { ...content.profile, title } })} />
                <Field label="Email" value={content.profile.email} onChange={(email) => updateContent({ ...content, profile: { ...content.profile, email } })} />
                <Field label="Website" value={content.profile.site} onChange={(site) => updateContent({ ...content, profile: { ...content.profile, site } })} />
                <Field label="Resume URL" value={content.profile.resumeUrl} onChange={(resumeUrl) => updateContent({ ...content, profile: { ...content.profile, resumeUrl } })} />
                <Field label="GitHub Username" value={content.profile.githubUsername} onChange={(githubUsername) => updateContent({ ...content, profile: { ...content.profile, githubUsername } })} />
                <Field label="GitHub Repo" value={content.profile.githubRepo} onChange={(githubRepo) => updateContent({ ...content, profile: { ...content.profile, githubRepo } })} />
                <div className="md:col-span-2">
                  <TextArea label="Short Description" value={content.profile.descriptionShort} onChange={(descriptionShort) => updateContent({ ...content, profile: { ...content.profile, descriptionShort } })} />
                </div>
                <div className="md:col-span-2">
                  <TextArea label="Long Description" rows={5} value={content.profile.descriptionLong} onChange={(descriptionLong) => updateContent({ ...content, profile: { ...content.profile, descriptionLong } })} />
                </div>
                <div className="md:col-span-2">
                  <TextArea label="Keywords, comma separated" value={content.profile.keywords.join(", ")} onChange={(keywords) => updateContent({ ...content, profile: { ...content.profile, keywords: keywords.split(",").map((item) => item.trim()).filter(Boolean) } })} />
                </div>
              </div>
            )}

            {active === "socials" && (
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(content.social).map(([key, value]) => (
                  <Field
                    key={key}
                    label={key}
                    value={value}
                    onChange={(nextValue) => updateContent({ ...content, social: { ...content.social, [key]: nextValue } })}
                  />
                ))}
              </div>
            )}

            {active === "skills" && (
              <div className="grid gap-4">
                <button
                  className="inline-flex w-fit items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm"
                  onClick={() => updateContent({ ...content, skills: [...content.skills, { id: Date.now(), name: "new-skill", label: "New Skill", shortDescription: "", color: "#ffffff", icon: "" }] })}
                >
                  <Plus className="h-4 w-4" />
                  Add Skill
                </button>
                {content.skills.map((skill, index) => (
                  <div key={`${skill.name}-${index}`} className="grid gap-3 rounded-md border border-white/10 p-4 md:grid-cols-3">
                    <Field label="Key" value={skill.name} onChange={(name) => {
                      const skills = [...content.skills];
                      skills[index] = { ...skill, name };
                      updateContent({ ...content, skills });
                    }} />
                    <Field label="Label" value={skill.label} onChange={(label) => {
                      const skills = [...content.skills];
                      skills[index] = { ...skill, label };
                      updateContent({ ...content, skills });
                    }} />
                    <Field label="Color" value={skill.color} onChange={(color) => {
                      const skills = [...content.skills];
                      skills[index] = { ...skill, color };
                      updateContent({ ...content, skills });
                    }} />
                    <div className="md:col-span-3">
                      <Field label="Icon URL" value={skill.icon} onChange={(icon) => {
                        const skills = [...content.skills];
                        skills[index] = { ...skill, icon };
                        updateContent({ ...content, skills });
                      }} />
                    </div>
                    <div className="md:col-span-3">
                      <TextArea label="Keyboard Description" value={skill.shortDescription} onChange={(shortDescription) => {
                        const skills = [...content.skills];
                        skills[index] = { ...skill, shortDescription };
                        updateContent({ ...content, skills });
                      }} />
                    </div>
                    <button className="inline-flex w-fit items-center gap-2 text-sm text-red-300" onClick={() => updateContent({ ...content, skills: content.skills.filter((_, skillIndex) => skillIndex !== index) })}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}

            {active === "experience" && (
              <div className="grid gap-4">
                <button className="inline-flex w-fit items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm" onClick={() => updateContent({ ...content, experience: [...content.experience, { id: Date.now(), startDate: "", endDate: "", title: "New Experience", company: "", description: [], skills: [] }] })}>
                  <Plus className="h-4 w-4" />
                  Add Experience
                </button>
                {content.experience.map((experience, index) => (
                  <div key={experience.id} className="grid gap-3 rounded-md border border-white/10 p-4 md:grid-cols-2">
                    {(["title", "company", "startDate", "endDate"] as const).map((field) => (
                      <Field key={field} label={field} value={experience[field]} onChange={(value) => {
                        const nextExperience = [...content.experience];
                        nextExperience[index] = { ...experience, [field]: value };
                        updateContent({ ...content, experience: nextExperience });
                      }} />
                    ))}
                    <div className="md:col-span-2">
                      <TextArea label="Description, one point per line" rows={6} value={experience.description.join("\n")} onChange={(description) => {
                        const nextExperience = [...content.experience];
                        nextExperience[index] = { ...experience, description: description.split("\n").map((item) => item.trim()).filter(Boolean) };
                        updateContent({ ...content, experience: nextExperience });
                      }} />
                    </div>
                    <div className="md:col-span-2">
                      <TextArea label="Skill keys, comma separated" value={experience.skills.join(", ")} onChange={(skills) => {
                        const nextExperience = [...content.experience];
                        nextExperience[index] = { ...experience, skills: skills.split(",").map((item) => item.trim()).filter(Boolean) };
                        updateContent({ ...content, experience: nextExperience });
                      }} />
                    </div>
                    <button className="inline-flex w-fit items-center gap-2 text-sm text-red-300" onClick={() => updateContent({ ...content, experience: content.experience.filter((_, expIndex) => expIndex !== index) })}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}

            {active === "projects" && (
              <div className="grid gap-4">
                <p className="text-sm text-white/50">Available project skill keys: {projectSkillOptions.join(", ")}</p>
                <button className="inline-flex w-fit items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm" onClick={() => updateContent({ ...content, projects: [...content.projects, { id: `project-${Date.now()}`, category: "New", title: "New Project", src: "", live: "", github: "", featured: true, frontendSkills: [], backendSkills: [] }] })}>
                  <Plus className="h-4 w-4" />
                  Add Project
                </button>
                {content.projects.map((project, index) => (
                  <div key={project.id} className="grid gap-3 rounded-md border border-white/10 p-4 md:grid-cols-2">
                    {(["id", "title", "category", "src", "live", "github"] as const).map((field) => (
                      <Field key={field} label={field} value={String(project[field] ?? "")} onChange={(value) => {
                        const projects = [...content.projects];
                        projects[index] = { ...project, [field]: value };
                        updateContent({ ...content, projects });
                      }} />
                    ))}
                    <label className="flex items-center gap-2 text-sm text-white/70">
                      <input type="checkbox" checked={project.featured} onChange={(event) => {
                        const projects = [...content.projects];
                        projects[index] = { ...project, featured: event.target.checked };
                        updateContent({ ...content, projects });
                      }} />
                      Show on portfolio
                    </label>
                    <TextArea label="Frontend skill keys" value={project.frontendSkills.join(", ")} onChange={(skills) => {
                      const projects = [...content.projects];
                      projects[index] = { ...project, frontendSkills: skills.split(",").map((item) => item.trim()).filter(Boolean) };
                      updateContent({ ...content, projects });
                    }} />
                    <TextArea label="Backend skill keys" value={project.backendSkills.join(", ")} onChange={(skills) => {
                      const projects = [...content.projects];
                      projects[index] = { ...project, backendSkills: skills.split(",").map((item) => item.trim()).filter(Boolean) };
                      updateContent({ ...content, projects });
                    }} />
                    <button className="inline-flex w-fit items-center gap-2 text-sm text-red-300" onClick={() => updateContent({ ...content, projects: content.projects.filter((_, projectIndex) => projectIndex !== index) })}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}

            {active === "security" && (
              <div className="grid gap-6">
                <div className="grid gap-4 rounded-md border border-white/10 bg-black/20 p-4">
                  <div>
                    <h2 className="font-display text-2xl">Public Runtime Settings</h2>
                    <p className="mt-1 text-sm text-white/50">
                      These values are allowed to be visible in the browser. Save after editing, then refresh the portfolio page.
                    </p>
                  </div>
                  <Field
                    label="WebSocket URL"
                    value={content.settings.websocketUrl}
                    placeholder="https://your-realtime-server.com"
                    onChange={(websocketUrl) => updateContent({ ...content, settings: { ...content.settings, websocketUrl } })}
                  />
                  <p className="text-xs text-white/35">
                    Local development uses http://localhost:4000. After deployment, set this to your deployed Socket.IO backend URL.
                  </p>
                </div>

                <div className="rounded-md border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                    <h2 className="font-display text-2xl">Secret Status</h2>
                  </div>
                  <p className="mt-2 text-sm text-white/50">
                    Secret values are never shown here. This page only tells you whether each private setting is configured.
                  </p>

                  <div className="mt-4 grid gap-3 text-sm">
                    <div className="flex items-center justify-between gap-4 rounded-md border border-white/10 px-3 py-2">
                      <span>Resend email API key</span>
                      <span className="inline-flex items-center gap-2 text-white/60">
                        <StatusDot ok={Boolean(security?.env.resendApiKey)} />
                        {security?.env.resendApiKey ? "Configured" : "Missing"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-md border border-white/10 px-3 py-2">
                      <span>Admin session secret</span>
                      <span className="inline-flex items-center gap-2 text-white/60">
                        <StatusDot ok={Boolean(security?.env.adminSessionSecretConfigured)} />
                        {security?.env.adminSessionSecretConfigured ? "Configured" : "Missing"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-md border border-white/10 px-3 py-2">
                      <span>Realtime admin secret</span>
                      <span className="inline-flex items-center gap-2 text-white/60">
                        <StatusDot ok={Boolean(security?.env.realtimeAdminSecretConfigured)} />
                        {security?.env.realtimeAdminSecretConfigured ? "Configured" : "Missing"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-md border border-white/10 px-3 py-2">
                      <span>Admin fallback password in env</span>
                      <span className="inline-flex items-center gap-2 text-white/60">
                        <StatusDot ok={Boolean(security?.env.adminPasswordConfigured)} />
                        {security?.env.adminPasswordConfigured ? "Configured" : "Missing"}
                      </span>
                    </div>
                    <div className="grid gap-1 rounded-md border border-white/10 px-3 py-2">
                      <span>Active WebSocket URL</span>
                      <span className="break-all text-white/50">{security?.env.websocketUrl || "Not configured"}</span>
                      <span className="text-xs text-white/35">
                        This is public because the browser needs the real URL to connect.
                      </span>
                    </div>
                    <div className="grid gap-1 rounded-md border border-white/10 px-3 py-2">
                      <span>NEXT_PUBLIC_WS_URL env fallback</span>
                      <span className="break-all text-white/50">{security?.env.websocketEnvFallback || "Not configured"}</span>
                    </div>
                    <div className="grid gap-1 rounded-md border border-white/10 px-3 py-2">
                      <span>Analytics</span>
                      <span className="break-all text-white/50">
                        {security?.env.umamiDomain || "Domain missing"} / {security?.env.umamiSiteIdConfigured ? "Site ID configured" : "Site ID missing"}
                      </span>
                    </div>
                  </div>
                </div>

                <form onSubmit={changePassword} className="grid gap-4 rounded-md border border-white/10 bg-black/20 p-4 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <h2 className="font-display text-2xl">Change Admin Password</h2>
                    <p className="mt-1 text-sm text-white/50">
                      After changing it, you will be logged out and the new password will be stored locally outside Git.
                    </p>
                  </div>
                  <Field
                    label="Current Password"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(currentPassword) => setPasswordForm((form) => ({ ...form, currentPassword }))}
                  />
                  <Field
                    label="New Password"
                    type="password"
                    value={passwordForm.nextPassword}
                    onChange={(nextPassword) => setPasswordForm((form) => ({ ...form, nextPassword }))}
                  />
                  <Field
                    label="Confirm New Password"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(confirmPassword) => setPasswordForm((form) => ({ ...form, confirmPassword }))}
                  />
                  <button className="inline-flex w-fit items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-black md:col-span-3" type="submit">
                    Change Password
                  </button>
                </form>
              </div>
            )}

            {active === "json" && <TextArea label="Full content JSON" rows={26} value={rawJson} onChange={setRawJson} />}
          </section>
        </div>
      </div>
    </main>
  );
}
