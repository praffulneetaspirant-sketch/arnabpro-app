import { useState, useEffect, useCallback, useRef } from "react";
import { Lock, ChevronRight, ChevronLeft, Check, X, Clock, LogOut, Shield, BookOpen, Flag, Menu, User, Plus, Trash2, Save, Award, TrendingUp, Beaker, Dna, Atom } from "lucide-react";

// ---------- Design tokens ----------
// Primary: deep clinical teal (#0F5B52), Secondary: exam-blue (#1B5FA8)
// Accent (premium/CTA): warm amber (#E8A23D)  Success: #2FA66A  Danger: #C24545
// Background: #F6FAF9 (cool clinical white)  Ink: #0E211D

const SUBJECTS = [
  { id: "physics", name: "Physics", icon: Atom, color: "#1B5FA8" },
  { id: "chemistry", name: "Chemistry", icon: Beaker, color: "#0F5B52" },
  { id: "biology", name: "Biology", icon: Dna, color: "#2FA66A" },
];

const FONT_LINK_ID = "arnabpro-fonts";

function useFonts() {
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap";
    document.head.appendChild(link);
  }, []);
}

// ---------- Storage helpers ----------
async function loadShared(key, fallback) {
  try {
    const r = await window.storage.get(key, true);
    return r ? JSON.parse(r.value) : fallback;
  } catch {
    return fallback;
  }
}
async function saveShared(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), true);
  } catch (e) {
    console.error("storage error", e);
  }
}

const DEFAULT_CONTENT = {
  approach: {
    physics: "Master NCERT concepts first, then move to numericals. Focus on Mechanics, Electrodynamics and Modern Physics — they carry the most weight.",
    chemistry: "Split your time: Physical Chemistry needs formula practice, Organic needs reaction mapping, Inorganic needs NCERT line-by-line recall.",
    biology: "NCERT is everything. Read every line twice, make diagrams for Genetics and Human Physiology, and revise daily — Biology rewards repetition.",
  },
  common: "Follow a fixed daily revision cycle, attempt one full mock every week under real exam conditions, and analyse mistakes instead of just checking scores. Consistency beats intensity.",
};

export default function App() {
  useFonts();
  const [view, setView] = useState("home");
  const [user, setUser] = useState(null); // {email, name, plan, planExpiry}
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState({});
  const [questions, setQuestions] = useState([]);
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeSubject, setActiveSubject] = useState(null);
  const [activeTestType, setActiveTestType] = useState(null); // 'part' | 'full'
  const [testSession, setTestSession] = useState(null); // {qs, answers, startedAt}
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    (async () => {
      const [u, q, c, a] = await Promise.all([
        loadShared("arnabpro_users", {}),
        loadShared("arnabpro_questions", []),
        loadShared("arnabpro_content", DEFAULT_CONTENT),
        loadShared("arnabpro_attempts", []),
      ]);
      setUsers(u);
      setQuestions(q);
      setContent(c);
      setAttempts(a);
      setLoading(false);
    })();
  }, []);

  const persistUsers = async (next) => { setUsers(next); await saveShared("arnabpro_users", next); };
  const persistQuestions = async (next) => { setQuestions(next); await saveShared("arnabpro_questions", next); };
  const persistContent = async (next) => { setContent(next); await saveShared("arnabpro_content", next); };
  const persistAttempts = async (next) => { setAttempts(next); await saveShared("arnabpro_attempts", next); };

  const isPaid = user && user.plan && user.plan !== "free" && (!user.planExpiry || new Date(user.planExpiry) > new Date());

  const goHome = () => { setView("home"); setActiveSubject(null); setActiveTestType(null); };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F6FAF9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Sora, sans-serif" }}>
        <div style={{ color: "#0F5B52", fontWeight: 600 }}>Loading ArnabPro…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F6FAF9", fontFamily: "Sora, sans-serif", color: "#0E211D" }}>
      <TopBar user={user} isAdmin={isAdmin} goHome={goHome} setView={setView}
        onLogout={() => { setUser(null); setIsAdmin(false); goHome(); }} />

      {view === "home" && (
        <Home content={content} isPaid={isPaid} user={user}
          onPickSubject={(s) => { setActiveSubject(s); setView("subjectApproach"); }}
          onGetStarted={() => setView(user ? "testHub" : "signup")}
          onGoPricing={() => setView("pricing")}
        />
      )}

      {view === "login" && <Login users={users} onLogin={(u) => { setUser(u); setView("testHub"); }} goSignup={() => setView("signup")} />}
      {view === "signup" && <Signup users={users} persistUsers={persistUsers} onSignup={(u) => { setUser(u); setView("testHub"); }} goLogin={() => setView("login")} />}

      {view === "subjectApproach" && activeSubject && (
        <SubjectApproach subject={activeSubject} content={content} isPaid={isPaid}
          onBack={goHome}
          onStartTests={() => { if (!user) { setView("signup"); return; } setView("testTypeSelect"); }}
        />
      )}

      {view === "testHub" && (
        <TestHub isPaid={isPaid} user={user}
          onPickSubject={(s) => { setActiveSubject(s); setView("testTypeSelect"); }}
        />
      )}

      {view === "testTypeSelect" && activeSubject && (
        <TestTypeSelect subject={activeSubject} isPaid={isPaid} questions={questions}
          onBack={() => setView("testHub")}
          onPick={(type) => { setActiveTestType(type); setView("testList"); }}
        />
      )}

      {view === "testList" && activeSubject && activeTestType && (
        <TestList subject={activeSubject} type={activeTestType} questions={questions} isPaid={isPaid}
          onBack={() => setView("testTypeSelect")}
          onStart={(qs) => { setTestSession({ qs, answers: Array(qs.length).fill(null), marked: Array(qs.length).fill(false), startedAt: Date.now() }); setView("cbt"); }}
          onLockedClick={() => setView("pricing")}
        />
      )}

      {view === "cbt" && testSession && (
        <CBTTest session={testSession} subject={activeSubject}
          onSubmit={async (finalAnswers) => {
            let score = 0; const total = testSession.qs.length;
            testSession.qs.forEach((q, i) => { if (finalAnswers[i] === q.correct) score++; });
            const result = { email: user?.email || "guest", name: user?.name || "Guest", subject: activeSubject.id, type: activeTestType, paper: testSession.qs[0]?.paper || "", score, total, date: new Date().toISOString(), answers: finalAnswers, qs: testSession.qs };
            await persistAttempts([...attempts, result]);
            setLastResult(result);
            setTestSession(null);
            setView("result");
          }}
        />
      )}

      {view === "result" && lastResult && (
        <ResultView result={lastResult} onDashboard={() => setView("dashboard")} onHome={goHome} />
      )}

      {view === "dashboard" && user && (
        <Dashboard user={user} attempts={attempts.filter(a => a.email === user.email)} questions={questions} isPaid={isPaid} onGoPricing={() => setView("pricing")}
          onResume={(subj, type) => { setActiveSubject(SUBJECTS.find(s => s.id === subj)); setActiveTestType(type); setView("testList"); }} />
      )}

      {view === "pricing" && <Pricing user={user} onSubscribe={async (plan) => {
        if (!user) { setView("signup"); return; }
        const expiry = plan === "monthly" ? new Date(Date.now() + 30 * 86400000).toISOString() : new Date(Date.now() + 300 * 86400000).toISOString();
        const nextUser = { ...user, plan, planExpiry: expiry };
        const nextUsers = { ...users, [user.email]: nextUser };
        await persistUsers(nextUsers);
        setUser(nextUser);
        setView("dashboard");
      }} />}

      {view === "adminLogin" && <AdminLogin onSuccess={() => { setIsAdmin(true); setView("admin"); }} />}
      {view === "admin" && isAdmin && (
        <AdminPanel questions={questions} persistQuestions={persistQuestions}
          content={content} persistContent={persistContent}
          users={users} attempts={attempts} />
      )}

      <Footer setView={setView} />
    </div>
  );
}

// ---------- Shared bits ----------

function LockBadge() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FBEFDA", color: "#B5791C", fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 999 }}>
      <Lock size={12} /> Premium
    </span>
  );
}

function TopBar({ user, isAdmin, goHome, setView, onLogout }) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#0E211D", color: "#F6FAF9", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div onClick={goHome} style={{ cursor: "pointer", display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ fontFamily: "Sora, sans-serif", fontWeight: 800, fontSize: 19, letterSpacing: "-0.02em" }}>
          Arnab<span style={{ color: "#E8A23D" }}>Pro</span>
        </span>
        <span style={{ fontSize: 10, color: "#8FB8AE", letterSpacing: "0.06em", textTransform: "uppercase" }}>NEET Premium by Arnab</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {isAdmin ? (
          <button onClick={onLogout} style={pillBtn("#E8A23D", "#0E211D")}>Admin · Exit</button>
        ) : user ? (
          <>
            <button onClick={() => setView("dashboard")} style={pillBtnGhost()}>{user.name.split(" ")[0]}</button>
            <button onClick={onLogout} style={{ background: "none", border: "none", color: "#8FB8AE", cursor: "pointer" }}><LogOut size={18} /></button>
          </>
        ) : (
          <>
            <button onClick={() => setView("login")} style={pillBtnGhost()}>Log in</button>
            <button onClick={() => setView("signup")} style={pillBtn("#E8A23D", "#0E211D")}>Sign up</button>
          </>
        )}
      </div>
    </div>
  );
}

function pillBtn(bg, color) {
  return { background: bg, color, border: "none", borderRadius: 999, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" };
}
function pillBtnGhost() {
  return { background: "rgba(255,255,255,0.08)", color: "#F6FAF9", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 999, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
}

function Section({ children, bg }) {
  return <div style={{ padding: "40px 20px", background: bg || "transparent" }}>{children}</div>;
}

function Footer({ setView }) {
  return (
    <div style={{ background: "#0E211D", color: "#8FB8AE", padding: "28px 20px", fontSize: 13, textAlign: "center" }}>
      <div style={{ fontWeight: 700, color: "#F6FAF9", marginBottom: 4 }}>ArnabPro — NEET Premium by Arnab</div>
      <div>Structured tests. Honest scoring. One clear plan for NEET.</div>
      <div style={{ marginTop: 12, opacity: 0.6, cursor: "pointer" }} onClick={() => setView("adminLogin")}>admin</div>
    </div>
  );
}

// ---------- Home ----------

function Home({ content, isPaid, user, onPickSubject, onGetStarted, onGoPricing }) {
  return (
    <div>
      <Section>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: "30px 0 10px" }}>
          <div style={{ display: "inline-block", background: "#E7F2EE", color: "#0F5B52", fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 999, marginBottom: 16, letterSpacing: "0.03em" }}>
            NEET PREMIUM BY ARNAB
          </div>
          <h1 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 38, lineHeight: 1.15, margin: "0 0 14px", color: "#0E211D" }}>
            Prep like a pro. <span style={{ color: "#0F5B52" }}>Test like it's exam day.</span>
          </h1>
          <p style={{ color: "#4A5F5A", fontSize: 15.5, lineHeight: 1.6, margin: "0 0 26px" }}>
            Subject-wise part tests, full mocks in real CBT format, and a study approach built specifically for NEET — Physics, Chemistry and Biology.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onGetStarted} style={{ ...pillBtn("#0F5B52", "#fff"), padding: "12px 22px", fontSize: 14 }}>Start free test</button>
            <button onClick={onGoPricing} style={{ ...pillBtnGhostDark(), padding: "12px 22px", fontSize: 14 }}>See pricing</button>
          </div>
        </div>
      </Section>

      <Section bg="#fff">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <SectionLabel eyebrow="Choose a subject" title="Three subjects, one exam" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 14, marginTop: 20 }}>
            {SUBJECTS.map((s) => (
              <div key={s.id} onClick={() => onPickSubject(s)} style={{ cursor: "pointer", border: "1px solid #E4EEEB", borderRadius: 14, padding: "22px 16px", background: "#F6FAF9", transition: "transform .15s" }}>
                <s.icon size={26} color={s.color} />
                <div style={{ fontWeight: 700, marginTop: 10, fontSize: 15 }}>{s.name}</div>
                <div style={{ fontSize: 12.5, color: "#6B7D78", marginTop: 4 }}>Approach + Part &amp; Full tests</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <SectionLabel eyebrow="Strategy" title="The common approach" />
          <p style={{ color: "#4A5F5A", fontSize: 15, lineHeight: 1.7, marginTop: 10 }}>{content.common}</p>
        </div>
      </Section>

      <Section bg="#0E211D">
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <div style={{ color: "#8FB8AE", fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", marginBottom: 8 }}>GUIDANCE &amp; PRICING</div>
          <h2 style={{ color: "#fff", fontFamily: "'Source Serif 4', serif", fontSize: 26, margin: "0 0 20px" }}>One clean plan. No confusion.</h2>
          <button onClick={onGoPricing} style={{ ...pillBtn("#E8A23D", "#0E211D"), padding: "12px 24px", fontSize: 14 }}>View plans</button>
        </div>
      </Section>
    </div>
  );
}

function pillBtnGhostDark() {
  return { background: "#fff", color: "#0E211D", border: "1px solid #D8E3DF", borderRadius: 999, fontWeight: 700, cursor: "pointer" };
}

function SectionLabel({ eyebrow, title }) {
  return (
    <div>
      <div style={{ color: "#0F5B52", fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{eyebrow}</div>
      <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 24, margin: "6px 0 0", color: "#0E211D" }}>{title}</h2>
    </div>
  );
}

// ---------- Auth ----------

function fieldStyle() {
  return { width: "100%", padding: "11px 13px", borderRadius: 10, border: "1px solid #D8E3DF", fontSize: 14, fontFamily: "Sora, sans-serif", marginTop: 6, boxSizing: "border-box" };
}

function Signup({ users, persistUsers, onSignup, goLogin }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [err, setErr] = useState("");
  const submit = async () => {
    if (!name || !email || !password) { setErr("Fill every field."); return; }
    if (users[email]) { setErr("An account with this email already exists."); return; }
    const newUser = { name, email, password, plan: "free", planExpiry: null };
    const nextUsers = { ...users, [email]: newUser };
    await persistUsers(nextUsers);
    onSignup(newUser);
  };
  return (
    <AuthCard title="Create your account" sub="Start with free tests, upgrade anytime.">
      <label style={labelStyle()}>Name<input style={fieldStyle()} value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" /></label>
      <label style={labelStyle()}>Email<input style={fieldStyle()} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      <label style={labelStyle()}>Password<input type="password" style={fieldStyle()} value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" /></label>
      {err && <div style={errStyle()}>{err}</div>}
      <button onClick={submit} style={{ ...pillBtn("#0F5B52", "#fff"), width: "100%", padding: "12px 0", marginTop: 14, fontSize: 14 }}>Sign up</button>
      <div style={switchStyle()}>Already have an account? <span onClick={goLogin} style={linkStyle()}>Log in</span></div>
    </AuthCard>
  );
}

function Login({ users, onLogin, goSignup }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [err, setErr] = useState("");
  const submit = () => {
    const u = users[email];
    if (!u || u.password !== password) { setErr("Email or password is incorrect."); return; }
    onLogin(u);
  };
  return (
    <AuthCard title="Welcome back" sub="Log in to continue your prep.">
      <label style={labelStyle()}>Email<input style={fieldStyle()} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      <label style={labelStyle()}>Password<input type="password" style={fieldStyle()} value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" /></label>
      {err && <div style={errStyle()}>{err}</div>}
      <button onClick={submit} style={{ ...pillBtn("#0F5B52", "#fff"), width: "100%", padding: "12px 0", marginTop: 14, fontSize: 14 }}>Log in</button>
      <div style={switchStyle()}>New here? <span onClick={goSignup} style={linkStyle()}>Create an account</span></div>
    </AuthCard>
  );
}

function AuthCard({ title, sub, children }) {
  return (
    <Section>
      <div style={{ maxWidth: 360, margin: "10px auto", background: "#fff", border: "1px solid #E4EEEB", borderRadius: 16, padding: 26 }}>
        <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 22, margin: "0 0 4px" }}>{title}</h2>
        <p style={{ color: "#6B7D78", fontSize: 13, margin: "0 0 18px" }}>{sub}</p>
        {children}
      </div>
    </Section>
  );
}
function labelStyle() { return { display: "block", fontSize: 12.5, fontWeight: 600, color: "#33453F", marginTop: 12 }; }
function errStyle() { return { color: "#C24545", fontSize: 12.5, marginTop: 10, background: "#FBEAEA", padding: "8px 10px", borderRadius: 8 }; }
function switchStyle() { return { fontSize: 12.5, color: "#6B7D78", marginTop: 16, textAlign: "center" }; }
function linkStyle() { return { color: "#0F5B52", fontWeight: 700, cursor: "pointer" }; }

// ---------- Subject approach ----------

function SubjectApproach({ subject, content, isPaid, onBack, onStartTests }) {
  const text = content.approach[subject.id] || "";
  const preview = isPaid ? text : text.slice(0, 80) + (text.length > 80 ? "…" : "");
  return (
    <Section>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <BackLink onClick={onBack} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <subject.icon size={22} color={subject.color} />
          <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 24, margin: 0 }}>{subject.name} approach</h2>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E4EEEB", borderRadius: 14, padding: 20, marginTop: 16, position: "relative" }}>
          <p style={{ color: "#33453F", fontSize: 14.5, lineHeight: 1.7, margin: 0, filter: isPaid ? "none" : "none" }}>{preview}</p>
          {!isPaid && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <LockBadge /> <span style={{ fontSize: 12.5, color: "#6B7D78" }}>Full strategy unlocks with Premium</span>
            </div>
          )}
        </div>
        <button onClick={onStartTests} style={{ ...pillBtn("#0F5B52", "#fff"), width: "100%", padding: "13px 0", marginTop: 18, fontSize: 14 }}>
          Go to {subject.name} tests
        </button>
      </div>
    </Section>
  );
}

function BackLink({ onClick }) {
  return <div onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#6B7D78", fontSize: 13, cursor: "pointer" }}><ChevronLeft size={16} /> Back</div>;
}

// ---------- Test hub / selection ----------

function TestHub({ isPaid, onPickSubject }) {
  return (
    <Section>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <SectionLabel eyebrow="Test series" title="Pick a subject to begin" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 14, marginTop: 20 }}>
          {SUBJECTS.map((s) => (
            <div key={s.id} onClick={() => onPickSubject(s)} style={{ cursor: "pointer", border: "1px solid #E4EEEB", borderRadius: 14, padding: "22px 16px", background: "#fff" }}>
              <s.icon size={26} color={s.color} />
              <div style={{ fontWeight: 700, marginTop: 10, fontSize: 15 }}>{s.name}</div>
              <div style={{ fontSize: 12.5, color: "#6B7D78", marginTop: 4 }}>Part Test · Full Test</div>
            </div>
          ))}
        </div>
        {!isPaid && (
          <div style={{ marginTop: 18, fontSize: 12.5, color: "#6B7D78", display: "flex", alignItems: "center", gap: 6 }}>
            <Lock size={13} /> On the free plan, 1 Part Test per subject is open. Full Tests need Premium.
          </div>
        )}
      </div>
    </Section>
  );
}

function TestTypeSelect({ subject, isPaid, questions, onBack, onPick }) {
  const partCount = questions.filter(q => q.subject === subject.id && q.type === "part").length;
  const fullCount = questions.filter(q => q.subject === subject.id && q.type === "full").length;
  return (
    <Section>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <BackLink onClick={onBack} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, marginBottom: 16 }}>
          <subject.icon size={22} color={subject.color} />
          <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 22, margin: 0 }}>{subject.name} tests</h2>
        </div>
        <TypeCard title="Part Test" desc="Short, topic-wise tests to build accuracy." count={partCount} locked={false} onClick={() => onPick("part")} />
        <TypeCard title="Full Test" desc="Complete subject mock, real exam length." count={fullCount} locked={!isPaid} onClick={() => onPick("full")} />
      </div>
    </Section>
  );
}

function TypeCard({ title, desc, count, locked, onClick }) {
  return (
    <div onClick={onClick} style={{ cursor: "pointer", background: "#fff", border: "1px solid #E4EEEB", borderRadius: 14, padding: 18, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>{title} {locked && <LockBadge />}</div>
        <div style={{ fontSize: 12.5, color: "#6B7D78", marginTop: 3 }}>{desc}</div>
        <div style={{ fontSize: 11.5, color: "#9BADA7", marginTop: 4 }}>{count} question{count !== 1 ? "s" : ""} available</div>
      </div>
      <ChevronRight size={18} color="#9BADA7" />
    </div>
  );
}

function TestList({ subject, type, questions, isPaid, onBack, onStart, onLockedClick }) {
  const qs = questions.filter(q => q.subject === subject.id && q.type === type);
  const locked = type === "full" && !isPaid;

  // Group questions by paper name so separate 180-question papers stay separate tests
  const papers = {};
  qs.forEach(q => {
    const key = q.paper || "Untitled paper";
    if (!papers[key]) papers[key] = [];
    papers[key].push(q);
  });
  const paperNames = Object.keys(papers);

  return (
    <Section>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <BackLink onClick={onBack} />
        <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 22, margin: "10px 0 16px" }}>{subject.name} — {type === "part" ? "Part Test" : "Full Test"}</h2>
        {paperNames.length === 0 ? (
          <EmptyState text="No questions added yet for this test. Ask the admin to add some from the admin panel." />
        ) : locked ? (
          <div onClick={onLockedClick} style={{ cursor: "pointer", background: "#FBEFDA", border: "1px solid #F0D9AE", borderRadius: 14, padding: 20, textAlign: "center" }}>
            <Lock size={20} color="#B5791C" />
            <div style={{ fontWeight: 700, marginTop: 8, color: "#7A5313" }}>Full Test is a Premium feature</div>
            <div style={{ fontSize: 12.5, color: "#8A6B2E", marginTop: 4 }}>Tap to see plans and unlock</div>
          </div>
        ) : (
          <div>
            {paperNames.map(name => (
              <div key={name} style={{ background: "#fff", border: "1px solid #E4EEEB", borderRadius: 14, padding: 18, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
                  <div style={{ fontSize: 12.5, color: "#6B7D78", marginTop: 2 }}>{papers[name].length} questions</div>
                </div>
                <button onClick={() => onStart(papers[name])} style={{ ...pillBtn("#0F5B52", "#fff"), padding: "10px 16px", fontSize: 13 }}>Start</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

function EmptyState({ text }) {
  return <div style={{ background: "#fff", border: "1px dashed #D8E3DF", borderRadius: 14, padding: 24, textAlign: "center", color: "#6B7D78", fontSize: 13.5 }}>{text}</div>;
}

// ---------- CBT test taking ----------

function CBTTest({ session, subject, onSubmit }) {
  const { qs } = session;
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState(session.answers);
  const [marked, setMarked] = useState(session.marked);
  const [timeLeft, setTimeLeft] = useState((qs[0]?.timerMinutes ? qs[0].timerMinutes * 60 : qs.length * 60));
  const [showPalette, setShowPalette] = useState(false);
  const submittedRef = useRef(false);

  const doSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmit(answers);
  }, [answers, onSubmit]);

  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) { clearInterval(t); doSubmit(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [doSubmit]);

  const q = qs[idx];
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");

  const setAns = (optIdx) => {
    const next = [...answers]; next[idx] = optIdx; setAnswers(next);
  };
  const toggleMark = () => { const next = [...marked]; next[idx] = !next[idx]; setMarked(next); };

  const statusOf = (i) => {
    if (answers[i] !== null && marked[i]) return "answeredMarked";
    if (marked[i]) return "marked";
    if (answers[i] !== null) return "answered";
    return "unattempted";
  };
  const colorFor = { answered: "#2FA66A", marked: "#8B5FBF", answeredMarked: "#8B5FBF", unattempted: "#D8E3DF" };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 90px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #E4EEEB", borderRadius: 12, padding: "10px 14px" }}>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{subject.name} · Q{idx + 1}/{qs.length}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: timeLeft < 60 ? "#C24545" : "#0F5B52", fontSize: 14 }}>
          <Clock size={15} /> {mm}:{ss}
        </div>
        <button onClick={() => setShowPalette(s => !s)} style={{ background: "none", border: "none", color: "#33453F", cursor: "pointer" }}><Menu size={20} /></button>
      </div>

      {showPalette && (
        <div style={{ background: "#fff", border: "1px solid #E4EEEB", borderRadius: 12, padding: 14, marginTop: 10, display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
          {qs.map((_, i) => (
            <div key={i} onClick={() => { setIdx(i); setShowPalette(false); }}
              style={{ background: colorFor[statusOf(i)], color: statusOf(i) === "unattempted" ? "#33453F" : "#fff", borderRadius: 6, height: 30, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, cursor: "pointer", border: i === idx ? "2px solid #0E211D" : "none" }}>
              {i + 1}
            </div>
          ))}
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #E4EEEB", borderRadius: 14, padding: 20, marginTop: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6, marginBottom: 16 }}>{q.question}</div>
        {q.options.map((opt, i) => (
          <div key={i} onClick={() => setAns(i)} style={{
            border: answers[idx] === i ? "2px solid #0F5B52" : "1px solid #E4EEEB",
            background: answers[idx] === i ? "#E7F2EE" : "#fff",
            borderRadius: 10, padding: "11px 14px", marginBottom: 9, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 10
          }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", border: "1.5px solid " + (answers[idx] === i ? "#0F5B52" : "#B7C7C2"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, background: answers[idx] === i ? "#0F5B52" : "transparent", color: answers[idx] === i ? "#fff" : "#6B7D78" }}>
              {String.fromCharCode(65 + i)}
            </span>
            {opt}
          </div>
        ))}
        <div onClick={toggleMark} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: marked[idx] ? "#8B5FBF" : "#6B7D78", fontSize: 12.5, marginTop: 8, cursor: "pointer" }}>
          <Flag size={13} /> {marked[idx] ? "Marked for review" : "Mark for review"}
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #E4EEEB", padding: "10px 16px", display: "flex", gap: 10, justifyContent: "space-between", maxWidth: 720, margin: "0 auto" }}>
        <button disabled={idx === 0} onClick={() => setIdx(i => i - 1)} style={{ ...pillBtnGhostDark(), padding: "10px 16px", opacity: idx === 0 ? 0.4 : 1 }}>Previous</button>
        {idx === qs.length - 1 ? (
          <button onClick={doSubmit} style={{ ...pillBtn("#C24545", "#fff"), padding: "10px 20px" }}>Submit test</button>
        ) : (
          <button onClick={() => setIdx(i => i + 1)} style={{ ...pillBtn("#0F5B52", "#fff"), padding: "10px 20px" }}>Save &amp; Next</button>
        )}
      </div>
    </div>
  );
}

// ---------- Result ----------

function ResultView({ result, onDashboard, onHome }) {
  const pct = Math.round((result.score / result.total) * 100);
  return (
    <Section>
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <Award size={34} color="#E8A23D" />
        <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 24, margin: "10px 0 4px" }}>Test submitted</h2>
        <div style={{ fontSize: 42, fontWeight: 800, color: "#0F5B52", margin: "10px 0" }}>{result.score}/{result.total}</div>
        <div style={{ color: "#6B7D78", fontSize: 13.5 }}>{pct}% correct</div>

        <div style={{ background: "#fff", border: "1px solid #E4EEEB", borderRadius: 14, padding: 18, marginTop: 20, textAlign: "left" }}>
          {result.qs.map((q, i) => {
            const correct = result.answers[i] === q.correct;
            return (
              <div key={i} style={{ padding: "9px 0", borderBottom: i < result.qs.length - 1 ? "1px solid #F0F4F2" : "none", fontSize: 13 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {correct ? <Check size={16} color="#2FA66A" style={{ flexShrink: 0, marginTop: 2 }} /> : <X size={16} color="#C24545" style={{ flexShrink: 0, marginTop: 2 }} />}
                  <span style={{ color: "#33453F" }}>{q.question}</span>
                </div>
                {!correct && <div style={{ fontSize: 12, color: "#2FA66A", marginLeft: 24, marginTop: 3 }}>Correct: {q.options[q.correct]}</div>}
                {q.explanation && <div style={{ fontSize: 12, color: "#6B7D78", marginLeft: 24, marginTop: 2 }}>{q.explanation}</div>}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "center" }}>
          <button onClick={onDashboard} style={{ ...pillBtn("#0F5B52", "#fff"), padding: "11px 18px" }}>View dashboard</button>
          <button onClick={onHome} style={{ ...pillBtnGhostDark(), padding: "11px 18px" }}>Home</button>
        </div>
      </div>
    </Section>
  );
}

// ---------- Dashboard ----------

function Dashboard({ user, attempts, questions, isPaid, onGoPricing, onResume }) {
  const sorted = [...attempts].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Build list of all distinct papers that exist, and mark which the student hasn't attempted yet
  const allPapers = {};
  questions.forEach(q => {
    const key = `${q.subject}|${q.type}|${q.paper || "Untitled paper"}`;
    if (!allPapers[key]) allPapers[key] = { subject: q.subject, type: q.type, paper: q.paper || "Untitled paper", count: 0 };
    allPapers[key].count++;
  });
  const attemptedKeys = new Set(attempts.map(a => `${a.subject}|${a.type}|${a.paper || "Untitled paper"}`));
  const pending = Object.values(allPapers).filter(p => !attemptedKeys.has(`${p.subject}|${p.type}|${p.paper}`));

  return (
    <Section>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 22, margin: 0 }}>Hi, {user.name.split(" ")[0]}</h2>
            <div style={{ fontSize: 12.5, color: "#6B7D78", marginTop: 3 }}>{isPaid ? `Premium — active till ${new Date(user.planExpiry).toLocaleDateString()}` : "Free plan"}</div>
          </div>
          {!isPaid && <button onClick={onGoPricing} style={pillBtn("#E8A23D", "#0E211D")}>Upgrade</button>}
        </div>

        <div style={{ marginTop: 22, fontSize: 13, fontWeight: 700, color: "#33453F" }}>Pending tests ({pending.length})</div>
        {pending.length === 0 ? (
          <div style={{ marginTop: 8 }}><EmptyState text={questions.length === 0 ? "No tests added yet." : "You're all caught up — no pending tests."} /></div>
        ) : (
          <div style={{ marginTop: 10 }}>
            {pending.map((p, i) => {
              const locked = p.type === "full" && !isPaid;
              return (
                <div key={i} onClick={() => onResume(p.subject, p.type)} style={{ cursor: "pointer", background: "#fff", border: "1px solid #E4EEEB", borderRadius: 12, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, textTransform: "capitalize", display: "flex", alignItems: "center", gap: 6 }}>{p.paper} {locked && <LockBadge />}</div>
                    <div style={{ fontSize: 11.5, color: "#9BADA7", marginTop: 2, textTransform: "capitalize" }}>{p.subject} · {p.type === "part" ? "Part Test" : "Full Test"} · {p.count} questions</div>
                  </div>
                  <ChevronRight size={16} color="#9BADA7" />
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 22, fontSize: 13, fontWeight: 700, color: "#33453F" }}>Test history</div>
        {sorted.length === 0 ? (
          <div style={{ marginTop: 8 }}><EmptyState text="No tests attempted yet. Go take one!" /></div>
        ) : (
          <div style={{ marginTop: 10 }}>
            {sorted.map((a, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #E4EEEB", borderRadius: 12, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, textTransform: "capitalize" }}>{a.paper ? a.paper : `${a.subject} · ${a.type === "part" ? "Part Test" : "Full Test"}`}</div>
                  <div style={{ fontSize: 11.5, color: "#9BADA7", marginTop: 2 }}>{new Date(a.date).toLocaleString()}</div>
                </div>
                <div style={{ fontWeight: 800, color: "#0F5B52", fontSize: 15 }}>{a.score}/{a.total}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

// ---------- Pricing ----------

function Pricing({ user, onSubscribe }) {
  return (
    <Section>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <SectionLabel eyebrow="Guidance & Pricing" title="One clean plan for NEET" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 16, marginTop: 20 }}>
          <PlanCard title="Monthly" price="₹500" period="/ month" features={["All Part Tests", "1 Full Test / subject / month", "Subject approach previews"]}
            onClick={() => onSubscribe("monthly")} />
          <PlanCard title="Till NEET" price="₹3,500" period="one-time" highlight
            features={["Everything provided", "Unlimited Part & Full Tests", "Complete subject strategies", "Full test history & analysis"]}
            onClick={() => onSubscribe("tillneet")} />
        </div>
        {user?.plan && user.plan !== "free" && (
          <div style={{ marginTop: 16, fontSize: 12.5, color: "#0F5B52", fontWeight: 600 }}>You're currently on the {user.plan === "monthly" ? "Monthly" : "Till NEET"} plan.</div>
        )}
      </div>
    </Section>
  );
}

function PlanCard({ title, price, period, features, highlight, onClick }) {
  return (
    <div style={{ background: highlight ? "#0E211D" : "#fff", color: highlight ? "#fff" : "#0E211D", border: highlight ? "none" : "1px solid #E4EEEB", borderRadius: 16, padding: 22, position: "relative" }}>
      {highlight && <div style={{ position: "absolute", top: -10, right: 16, background: "#E8A23D", color: "#0E211D", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999 }}>BEST VALUE</div>}
      <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
      <div style={{ marginTop: 8 }}><span style={{ fontSize: 28, fontWeight: 800 }}>{price}</span> <span style={{ fontSize: 12.5, color: highlight ? "#8FB8AE" : "#6B7D78" }}>{period}</span></div>
      <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, margin: "8px 0", alignItems: "flex-start" }}>
            <Check size={15} color={highlight ? "#E8A23D" : "#2FA66A"} style={{ flexShrink: 0, marginTop: 2 }} /> {f}
          </li>
        ))}
      </ul>
      <button onClick={onClick} style={{ ...pillBtn(highlight ? "#E8A23D" : "#0F5B52", highlight ? "#0E211D" : "#fff"), width: "100%", padding: "11px 0", marginTop: 14 }}>Choose {title}</button>
    </div>
  );
}

// ---------- PDF parsing helpers ----------

function ensurePdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve();
    };
    script.onerror = () => reject(new Error("Could not load PDF reader."));
    document.head.appendChild(script);
  });
}

async function extractPdfText(file) {
  await ensurePdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(" ") + "\n";
  }
  return text;
}

// Best-effort split of raw PDF text into numbered questions with A–D options.
// PDFs vary a lot in formatting, so this is a starting point — always review before saving.
function parseQuestionsFromText(rawText) {
  const clean = " " + rawText.replace(/\r/g, " ").replace(/\u00A0/g, " ").replace(/\s+/g, " ");
  const parts = clean.split(/\s(\d{1,3})[.)]\s+(?=[A-Za-z(])/);
  const out = [];
  for (let i = 1; i < parts.length; i += 2) {
    const chunk = (parts[i + 1] || "").trim();
    if (!chunk) continue;
    const optRegex = /\(?([A-D])\)?[.)]\s+/g;
    const marks = [...chunk.matchAll(optRegex)];
    if (marks.length < 2) continue; // not enough options found, skip
    const qText = chunk.slice(0, marks[0].index).trim();
    const opts = { A: "", B: "", C: "", D: "" };
    for (let m = 0; m < marks.length; m++) {
      const letter = marks[m][1];
      const start = marks[m].index + marks[m][0].length;
      const end = m + 1 < marks.length ? marks[m + 1].index : chunk.length;
      opts[letter] = chunk.slice(start, end).trim();
    }
    if (qText && opts.A && opts.B && opts.C && opts.D) {
      out.push({ question: qText, options: [opts.A, opts.B, opts.C, opts.D], correct: null, explanation: "" });
    }
  }
  return out;
}

// Answer key text like "1. B", "1) (B)", "1 - B" per line/entry, in order.
function parseAnswerKeyFromText(rawText) {
  const map = {};
  const regex = /(\d{1,3})[.)\-:]\s*\(?([A-D])\)?/g;
  let m;
  while ((m = regex.exec(rawText))) map[m[1]] = "ABCD".indexOf(m[2]);
  return map;
}



function AdminLogin({ onSuccess }) {
  const [pass, setPass] = useState(""); const [err, setErr] = useState("");
  return (
    <AuthCard title="Admin access" sub="For Arnab only.">
      <label style={labelStyle()}>Passcode<input type="password" style={fieldStyle()} value={pass} onChange={e => setPass(e.target.value)} placeholder="Enter admin passcode" /></label>
      {err && <div style={errStyle()}>{err}</div>}
      <button onClick={() => pass === "arnab123" ? onSuccess() : setErr("Wrong passcode.")} style={{ ...pillBtn("#0F5B52", "#fff"), width: "100%", padding: "12px 0", marginTop: 14 }}>Enter admin panel</button>
      <div style={{ fontSize: 11.5, color: "#9BADA7", marginTop: 10 }}>Default passcode: arnab123 — change this in the code before sharing the app.</div>
    </AuthCard>
  );
}

function AdminPanel({ questions, persistQuestions, content, persistContent, users, attempts }) {
  const [tab, setTab] = useState("questions");
  return (
    <Section>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Shield size={20} color="#0F5B52" />
          <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 22, margin: 0 }}>Admin panel</h2>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {["questions", "content", "students", "results"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...(tab === t ? pillBtn("#0F5B52", "#fff") : pillBtnGhostDark()), padding: "8px 14px", fontSize: 12.5, textTransform: "capitalize" }}>{t}</button>
          ))}
        </div>
        {tab === "questions" && <AdminQuestions questions={questions} persistQuestions={persistQuestions} />}
        {tab === "content" && <AdminContent content={content} persistContent={persistContent} />}
        {tab === "students" && <AdminStudents users={users} />}
        {tab === "results" && <AdminResults attempts={attempts} />}
      </div>
    </Section>
  );
}

function AdminQuestions({ questions, persistQuestions }) {
  const [mode, setMode] = useState("pdf"); // pdf | manual | bulk
  const [subject, setSubject] = useState("physics");
  const [type, setType] = useState("part");
  const [paper, setPaper] = useState("");
  const [timerMinutes, setTimerMinutes] = useState(60);

  const existingPapers = [...new Set(questions.filter(q => q.subject === subject && q.type === type).map(q => q.paper).filter(Boolean))];

  const removeQuestion = async (id) => {
    await persistQuestions(questions.filter(q => q.id !== id));
  };

  const saveExtracted = async (rows) => {
    const toSave = rows.filter(r => r.correct !== null).map(r => ({
      id: Date.now() + Math.random(), subject, type, paper, timerMinutes: Number(timerMinutes) || 60,
      question: r.question, options: r.options, correct: r.correct, explanation: r.explanation || "",
    }));
    if (toSave.length) await persistQuestions([...questions, ...toSave]);
    return toSave.length;
  };

  return (
    <div>
      <div style={{ background: "#fff", border: "1px solid #E4EEEB", borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>1. Paper details</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <select value={subject} onChange={e => setSubject(e.target.value)} style={selectStyle()}>
            {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={type} onChange={e => setType(e.target.value)} style={selectStyle()}>
            <option value="part">Part Test</option>
            <option value="full">Full Test</option>
          </select>
        </div>
        <input value={paper} onChange={e => setPaper(e.target.value)} placeholder={`Paper name, e.g. "Physics Full Test - Paper 1"`} style={fieldStyle()} />
        <label style={{ ...labelStyle(), marginTop: 10 }}>Test duration (minutes)
          <input type="number" min="1" value={timerMinutes} onChange={e => setTimerMinutes(e.target.value)} style={{ ...fieldStyle(), maxWidth: 140 }} />
        </label>
        {existingPapers.length > 0 && (
          <div style={{ fontSize: 11.5, color: "#9BADA7", marginTop: 8 }}>Existing papers here: {existingPapers.join(", ")}</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["pdf", "Upload PDF"], ["manual", "Manual"], ["bulk", "Bulk paste"]].map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)} style={{ ...(mode === m ? pillBtn("#0F5B52", "#fff") : pillBtnGhostDark()), padding: "8px 14px", fontSize: 12.5 }}>{label}</button>
        ))}
      </div>

      {mode === "pdf" && <PdfUploadMode paper={paper} onSave={saveExtracted} />}
      {mode === "manual" && <ManualAddMode paper={paper} timerMinutes={timerMinutes} questions={questions} persistQuestions={persistQuestions} subject={subject} type={type} />}
      {mode === "bulk" && <BulkPasteMode paper={paper} timerMinutes={timerMinutes} questions={questions} persistQuestions={persistQuestions} subject={subject} type={type} />}

      <div style={{ fontWeight: 700, fontSize: 14, margin: "20px 0 8px" }}>All questions ({questions.length})</div>
      {questions.length === 0 ? <EmptyState text="No questions yet." /> : questions.map(q => (
        <div key={q.id} style={{ background: "#fff", border: "1px solid #E4EEEB", borderRadius: 10, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12.5 }}>
            <span style={{ textTransform: "capitalize", fontWeight: 700, color: "#0F5B52" }}>{q.subject} · {q.type} · {q.paper || "—"} · {q.timerMinutes || 60} min</span><br />
            {q.question.slice(0, 60)}{q.question.length > 60 ? "…" : ""}
          </div>
          <button onClick={() => removeQuestion(q.id)} style={{ background: "none", border: "none", color: "#C24545", cursor: "pointer", flexShrink: 0 }}><Trash2 size={16} /></button>
        </div>
      ))}
    </div>
  );
}

function PdfUploadMode({ paper, onSave }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  const handleQuestionPdf = async (file) => {
    if (!file) return;
    setStatus("Reading question PDF…");
    try {
      const text = await extractPdfText(file);
      const parsed = parseQuestionsFromText(text);
      setRows(parsed);
      setStatus(parsed.length ? `Found ${parsed.length} questions — review below before saving.` : "Couldn't detect numbered questions automatically. Try Manual or Bulk paste instead.");
    } catch (e) {
      setStatus("Couldn't read that PDF. If it's a scanned/image PDF, text extraction won't work — try Manual entry instead.");
    }
  };

  const handleSolutionSource = async (file) => {
    if (!file) return;
    setStatus("Reading solution PDF…");
    try {
      const text = await extractPdfText(file);
      const key = parseAnswerKeyFromText(text);
      setRows(prev => prev.map((r, i) => key[i + 1] !== undefined ? { ...r, correct: key[i + 1] } : r));
      setStatus("Answer key applied where matched — please verify each one below.");
    } catch (e) {
      setStatus("Couldn't read the solution PDF. Set correct answers manually below.");
    }
  };

  const updateRow = (i, patch) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!paper) { setStatus("Set a paper name above first."); return; }
    const n = await onSave(rows);
    setSavedMsg(`Saved ${n} question(s) to "${paper}".`);
    setRows([]);
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #E4EEEB", borderRadius: 14, padding: 18 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>2. Upload question PDF</div>
      <div style={{ fontSize: 11.5, color: "#6B7D78", marginBottom: 8 }}>Works best on text-based PDFs with numbered questions (1. 2. 3…) and A/B/C/D options.</div>
      <input type="file" accept="application/pdf" onChange={e => handleQuestionPdf(e.target.files[0])} style={{ fontSize: 13 }} />

      <div style={{ fontWeight: 700, fontSize: 14, margin: "18px 0 4px" }}>3. Solution — PDF or manual</div>
      <div style={{ fontSize: 11.5, color: "#6B7D78", marginBottom: 8 }}>Upload an answer-key PDF (e.g. "1. B, 2. D…") to auto-fill correct answers, or just set them manually in the review list below.</div>
      <input type="file" accept="application/pdf" onChange={e => handleSolutionSource(e.target.files[0])} style={{ fontSize: 13 }} />

      {status && <div style={{ fontSize: 12.5, color: "#0F5B52", marginTop: 12, background: "#E7F2EE", padding: "8px 12px", borderRadius: 8 }}>{status}</div>}

      {rows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>4. Review &amp; fix before saving ({rows.length})</div>
          {rows.map((r, i) => (
            <div key={i} style={{ border: "1px solid #E4EEEB", borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <textarea value={r.question} onChange={e => updateRow(i, { question: e.target.value })} style={{ ...fieldStyle(), marginTop: 0, minHeight: 44, resize: "vertical" }} />
                <button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: "#C24545", cursor: "pointer", flexShrink: 0 }}><Trash2 size={16} /></button>
              </div>
              {r.options.map((o, oi) => (
                <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <input type="radio" checked={r.correct === oi} onChange={() => updateRow(i, { correct: oi })} />
                  <input value={o} onChange={e => { const opts = [...r.options]; opts[oi] = e.target.value; updateRow(i, { options: opts }); }} style={{ ...fieldStyle(), marginTop: 0 }} />
                </div>
              ))}
              <input value={r.explanation} onChange={e => updateRow(i, { explanation: e.target.value })} placeholder="Explanation for this answer (optional)" style={{ ...fieldStyle(), marginTop: 8, fontSize: 12.5 }} />
              {r.correct === null && <div style={{ fontSize: 11.5, color: "#C24545", marginTop: 6 }}>Pick the correct option — this one won't be saved until you do.</div>}
            </div>
          ))}
          <button onClick={save} style={{ ...pillBtn("#0F5B52", "#fff"), padding: "11px 18px", marginTop: 4 }}>Save reviewed questions to "{paper || "…"}"</button>
        </div>
      )}
      {savedMsg && <div style={{ fontSize: 12.5, color: "#2FA66A", marginTop: 10, fontWeight: 600 }}>{savedMsg}</div>}
    </div>
  );
}

function ManualAddMode({ paper, timerMinutes, questions, persistQuestions, subject, type }) {
  const [question, setQuestion] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");

  const addQuestion = async () => {
    if (!question || !paper || opts.some(o => !o)) return;
    const q = { id: Date.now() + Math.random(), subject, type, paper, timerMinutes: Number(timerMinutes) || 60, question, options: opts, correct, explanation };
    await persistQuestions([...questions, q]);
    setQuestion(""); setOpts(["", "", "", ""]); setCorrect(0); setExplanation("");
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #E4EEEB", borderRadius: 14, padding: 18 }}>
      <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Question text" style={{ ...fieldStyle(), minHeight: 60, resize: "vertical" }} />
      {opts.map((o, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input type="radio" checked={correct === i} onChange={() => setCorrect(i)} />
          <input value={o} onChange={e => { const n = [...opts]; n[i] = e.target.value; setOpts(n); }} placeholder={`Option ${String.fromCharCode(65 + i)}`} style={{ ...fieldStyle(), marginTop: 0 }} />
        </div>
      ))}
      <input value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Explanation (optional)" style={{ ...fieldStyle(), marginTop: 8 }} />
      <div style={{ fontSize: 11.5, color: "#9BADA7", marginTop: 6 }}>Uses the paper name and duration set above.</div>
      <button onClick={addQuestion} disabled={!paper} style={{ ...pillBtn("#0F5B52", "#fff"), padding: "10px 16px", marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, opacity: paper ? 1 : 0.5 }}><Plus size={15} /> Add question</button>
    </div>
  );
}

function BulkPasteMode({ paper, timerMinutes, questions, persistQuestions, subject, type }) {
  const [bulk, setBulk] = useState("");
  const addBulk = async () => {
    if (!paper) return;
    const lines = bulk.split("\n").map(l => l.trim()).filter(Boolean);
    const parsed = [];
    for (const line of lines) {
      const parts = line.split("|").map(p => p.trim());
      if (parts.length < 6) continue;
      const [q, a, b, c, d, ans] = parts;
      const correctIdx = "ABCD".indexOf(ans.toUpperCase());
      if (correctIdx === -1) continue;
      parsed.push({ id: Date.now() + Math.random(), subject, type, paper, timerMinutes: Number(timerMinutes) || 60, question: q, options: [a, b, c, d], correct: correctIdx, explanation: "" });
    }
    if (parsed.length) { await persistQuestions([...questions, ...parsed]); setBulk(""); }
  };
  return (
    <div style={{ background: "#fff", border: "1px solid #E4EEEB", borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 11.5, color: "#6B7D78", marginBottom: 8 }}>
        One question per line, separated by "|":<br />
        <code style={{ fontSize: 11 }}>Question | Option A | Option B | Option C | Option D | CorrectLetter</code>
      </div>
      <textarea value={bulk} onChange={e => setBulk(e.target.value)} placeholder={"What is the SI unit of force? | Newton | Joule | Watt | Pascal | A"} style={{ ...fieldStyle(), minHeight: 110, resize: "vertical", fontFamily: "monospace", fontSize: 12.5 }} />
      <button onClick={addBulk} disabled={!paper} style={{ ...pillBtn("#0F5B52", "#fff"), padding: "10px 16px", marginTop: 10, opacity: paper ? 1 : 0.5 }}>Add all from text</button>
    </div>
  );
}

// ---------- Admin (legacy content/students/results) ----------

function selectStyle() { return { flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #D8E3DF", fontSize: 13, fontFamily: "Sora, sans-serif" }; }

function AdminContent({ content, persistContent }) {
  const [local, setLocal] = useState(content);
  const [saved, setSaved] = useState(false);
  const save = async () => { await persistContent(local); setSaved(true); setTimeout(() => setSaved(false), 1500); };
  return (
    <div style={{ background: "#fff", border: "1px solid #E4EEEB", borderRadius: 14, padding: 18 }}>
      {SUBJECTS.map(s => (
        <div key={s.id} style={{ marginBottom: 14 }}>
          <label style={labelStyle()}>{s.name} approach
            <textarea value={local.approach[s.id]} onChange={e => setLocal({ ...local, approach: { ...local.approach, [s.id]: e.target.value } })} style={{ ...fieldStyle(), minHeight: 70, resize: "vertical" }} />
          </label>
        </div>
      ))}
      <label style={labelStyle()}>Common approach
        <textarea value={local.common} onChange={e => setLocal({ ...local, common: e.target.value })} style={{ ...fieldStyle(), minHeight: 70, resize: "vertical" }} />
      </label>
      <button onClick={save} style={{ ...pillBtn("#0F5B52", "#fff"), padding: "10px 18px", marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><Save size={15} /> {saved ? "Saved!" : "Save content"}</button>
    </div>
  );
}

function AdminStudents({ users }) {
  const list = Object.values(users);
  return list.length === 0 ? <EmptyState text="No students signed up yet." /> : (
    <div style={{ background: "#fff", border: "1px solid #E4EEEB", borderRadius: 14, overflow: "hidden" }}>
      {list.map((u, i) => (
        <div key={i} style={{ padding: "12px 16px", borderBottom: i < list.length - 1 ? "1px solid #F0F4F2" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{u.name}</div>
            <div style={{ fontSize: 11.5, color: "#9BADA7" }}>{u.email}</div>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: u.plan === "free" ? "#9BADA7" : "#0F5B52", textTransform: "capitalize" }}>{u.plan}</span>
        </div>
      ))}
    </div>
  );
}

function AdminResults({ attempts }) {
  const sorted = [...attempts].sort((a, b) => new Date(b.date) - new Date(a.date));
  return sorted.length === 0 ? <EmptyState text="No test attempts yet." /> : (
    <div style={{ background: "#fff", border: "1px solid #E4EEEB", borderRadius: 14, overflow: "hidden" }}>
      {sorted.map((a, i) => (
        <div key={i} style={{ padding: "12px 16px", borderBottom: i < sorted.length - 1 ? "1px solid #F0F4F2" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.name} <span style={{ fontWeight: 400, color: "#9BADA7" }}>· {a.email}</span></div>
            <div style={{ fontSize: 11.5, color: "#9BADA7", textTransform: "capitalize" }}>{a.subject} · {a.type} · {new Date(a.date).toLocaleString()}</div>
          </div>
          <div style={{ fontWeight: 800, color: "#0F5B52" }}>{a.score}/{a.total}</div>
        </div>
      ))}
    </div>
  );
}
