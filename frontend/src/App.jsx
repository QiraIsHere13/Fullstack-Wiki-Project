import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = "http://localhost:5000/api";

const CATEGORIES = [
  { key: "world", label: "Worlds" },
  { key: "character", label: "Characters" },
  { key: "item", label: "Items" },
  { key: "system", label: "Systems" },
];

function getToken() {
  return localStorage.getItem("token") || "";
}
function setToken(t) {
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d || "");
  }
}

export default function App() {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 900);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [token, setTokenState] = useState(getToken());
  const isAuthed = !!token;

  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("qira@test.com");
  const [loginPassword, setLoginPassword] = useState("password123");
  const [authMsg, setAuthMsg] = useState("");

  const [mode, setMode] = useState("login");
  const [regUsername, setRegUsername] = useState("qira");
  const [regEmail, setRegEmail] = useState("qira@test.com");
  const [regPassword, setRegPassword] = useState("password123");
  const [regMsg, setRegMsg] = useState("");

  const [category, setCategory] = useState("character");
  const [sort, setSort] = useState("updated");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");

  const [selectedSlug, setSelectedSlug] = useState("");
  const [article, setArticle] = useState(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("character");
  const [newContent, setNewContent] = useState("");
  const [createMsg, setCreateMsg] = useState("");

  const [editContent, setEditContent] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editMsg, setEditMsg] = useState("");

  const [revisions, setRevisions] = useState([]);
  const [revLoading, setRevLoading] = useState(false);
  const [revError, setRevError] = useState("");
  const [selectedRevisionId, setSelectedRevisionId] = useState("");
  const [revisionDetail, setRevisionDetail] = useState(null);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [revisionError, setRevisionError] = useState("");
  const [restoreMsg, setRestoreMsg] = useState("");
  const [restoring, setRestoring] = useState(false);

  const [deleteMsg, setDeleteMsg] = useState("");
  const [deleting, setDeleting] = useState(false);

  const authHeaders = useMemo(() => {
    return isAuthed ? { Authorization: `Bearer ${token}` } : {};
  }, [isAuthed, token]);

  const isCurrentRevision = useMemo(() => {
    const currentId = article?.current_revision_id;
    return (revId) => !!currentId && String(currentId) === String(revId);
  }, [article?.current_revision_id]);

  const canManage = useMemo(() => {
    if (!isAuthed) return false;
    if (!me?.id) return false;
    if (!article) return false;
    const isOwner = String(me.id) === String(article.created_by);
    const isAdmin = !!me.is_admin;
    return isOwner || isAdmin;
  }, [isAuthed, me?.id, me?.is_admin, article?.created_by, article]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const t = String(it.title || "").toLowerCase();
      const s = String(it.slug || "").toLowerCase();
      return t.includes(q) || s.includes(q);
    });
  }, [items, search]);

  useEffect(() => {
    setNewCategory(category);
  }, [category]);

  async function fetchMe(activeToken) {
    const t = activeToken ?? token;
    if (!t) {
      setMe(null);
      return;
    }
    setMeLoading(true);
    try {
      const res = await fetch(`${API}/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load /me");
      setMe(data.user);
    } catch {
      setMe(null);
    } finally {
      setMeLoading(false);
    }
  }

  useEffect(() => {
    fetchMe(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function login(e) {
    e?.preventDefault?.();
    setAuthMsg("");
    setRegMsg("");

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Login failed");

      setToken(data.token);
      setTokenState(data.token);
      setAuthMsg("✅ Login success");
      await fetchMe(data.token);
    } catch (err) {
      setAuthMsg(`❌ ${err.message}`);
    }
  }

  async function register(e) {
    e?.preventDefault?.();
    setRegMsg("");
    setAuthMsg("");

    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Register failed");

      setRegMsg("✅ Register success. Silakan login.");
      setMode("login");
      setLoginEmail(regEmail);
      setLoginPassword(regPassword);
    } catch (err) {
      setRegMsg(`❌ ${err.message}`);
    }
  }

  function logout() {
    setToken("");
    setTokenState("");
    setMe(null);
    setAuthMsg("Logged out");
  }

  async function loadList(cat) {
    setListLoading(true);
    setListError("");
    setItems([]);
    setSelectedSlug("");
    setArticle(null);
    setArticleError("");
    setEditMsg("");
    setCreateMsg("");
    setSearch("");
    setDeleteMsg("");

    setRevisions([]);
    setRevError("");
    setSelectedRevisionId("");
    setRevisionDetail(null);
    setRevisionError("");
    setRestoreMsg("");

    try {
      const res = await fetch(`${API}/articles?category=${cat}&sort=${sort}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load list");
      setItems(data.items || []);
    } catch (err) {
      setListError(err.message);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    loadList(category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort]);

  async function loadRevisions(slug) {
    if (!slug) return;

    setRevLoading(true);
    setRevError("");
    setRevisions([]);
    setSelectedRevisionId("");
    setRevisionDetail(null);
    setRevisionError("");
    setRestoreMsg("");
    setDeleteMsg("");

    try {
      const res = await fetch(`${API}/articles/${slug}/revisions`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load revisions");
      setRevisions(data.items || []);
    } catch (err) {
      setRevError(err.message);
    } finally {
      setRevLoading(false);
    }
  }

  async function openRevision(revId) {
    if (!revId) return;
    setSelectedRevisionId(String(revId));
    setRevisionLoading(true);
    setRevisionError("");
    setRevisionDetail(null);
    setRestoreMsg("");
    setDeleteMsg("");

    try {
      const res = await fetch(`${API}/revisions/${revId}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load revision detail");
      setRevisionDetail(data.revision);
    } catch (err) {
      setRevisionError(err.message);
    } finally {
      setRevisionLoading(false);
    }
  }

  async function restoreRevision(revId) {
    setRestoreMsg("");
    setDeleteMsg("");
    if (!isAuthed) return setRestoreMsg("❌ Login dulu untuk restore.");
    if (!article?.created_by) return setRestoreMsg("❌ Artikel belum siap.");
    if (!canManage) return setRestoreMsg("❌ Hanya owner/admin yang bisa restore.");
    if (!selectedSlug) return setRestoreMsg("❌ Tidak ada artikel dipilih.");
    if (!revId) return setRestoreMsg("❌ Pilih revision dulu.");

    setRestoring(true);
    try {
      const res = await fetch(`${API}/articles/${selectedSlug}/restore/${revId}`, {
        method: "POST",
        headers: { ...authHeaders },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Restore failed");

      setRestoreMsg("✅ Restored. Artikel sekarang memakai revision baru.");
      await openArticle(selectedSlug, { keepRevisionPanel: true });
      await loadRevisions(selectedSlug);
    } catch (err) {
      setRestoreMsg(`❌ ${err.message}`);
    } finally {
      setRestoring(false);
    }
  }

  async function openArticle(slug, opts = {}) {
    setSelectedSlug(slug);
    setArticleLoading(true);
    setArticleError("");
    setArticle(null);
    setEditMsg("");
    setRestoreMsg("");
    setDeleteMsg("");

    try {
      const res = await fetch(`${API}/articles/${slug}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load article");
      setArticle(data.article);
      setEditContent(data.article.content || "");
      setEditSummary("");

      if (!opts.keepRevisionPanel) {
        await loadRevisions(slug);
      }
    } catch (err) {
      setArticleError(err.message);
    } finally {
      setArticleLoading(false);
    }
  }

  async function createArticle(e) {
    e?.preventDefault?.();
    setCreateMsg("");
    setDeleteMsg("");

    if (!isAuthed) return setCreateMsg("❌ Please login first.");
    if (!newTitle.trim() || !newContent.trim()) return setCreateMsg("❌ title and content required");

    try {
      const res = await fetch(`${API}/articles`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          category: newCategory,
          content: newContent,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Create failed");

      setCreateMsg("✅ Created");
      setNewTitle("");
      setNewContent("");

      setCategory(data.article.category);
      await loadList(data.article.category);
      await openArticle(data.article.slug);
    } catch (err) {
      setCreateMsg(`❌ ${err.message}`);
    }
  }

  async function saveEdit(e) {
    e?.preventDefault?.();
    setEditMsg("");
    setDeleteMsg("");

    if (!isAuthed) return setEditMsg("❌ Please login first.");
    if (!article?.id) return setEditMsg("❌ No article selected.");
    if (!canManage) return setEditMsg("❌ Hanya owner/admin yang bisa edit.");
    if (!editContent.trim()) return setEditMsg("❌ content required");

    try {
      const res = await fetch(`${API}/articles/${article.id}`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent, summary: editSummary }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Edit failed");

      setEditMsg("✅ Saved (new revision created)");
      await openArticle(article.slug);
      await loadList(category);
    } catch (err) {
      setEditMsg(`❌ ${err.message}`);
    }
  }

  async function deleteArticle() {
    setDeleteMsg("");
    setRestoreMsg("");

    if (!isAuthed) return setDeleteMsg("❌ Login dulu untuk delete.");
    if (!article?.id) return setDeleteMsg("❌ Tidak ada artikel dipilih.");
    if (!canManage) return setDeleteMsg("❌ Hanya owner/admin yang bisa delete.");

    const ok = window.confirm(
      `Yakin ingin menghapus artikel "${article.title}"?\n\nTindakan ini tidak bisa dibatalkan.`
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`${API}/articles/${article.id}`, {
        method: "DELETE",
        headers: { ...authHeaders },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Delete failed");

      setDeleteMsg("✅ Artikel dihapus");

      setArticle(null);
      setSelectedSlug("");
      setRevisions([]);
      setRevisionDetail(null);
      setSelectedRevisionId("");

      await loadList(category);
    } catch (err) {
      setDeleteMsg(`❌ ${err.message}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      style={{
        width: "100%",
        margin: 0,
        padding: "16px",
        fontFamily: "system-ui",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: isNarrow ? "column" : "row",
          alignItems: isNarrow ? "stretch" : "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Fullstack Wiki</h1>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Register/Login → Create → List → Read → Edit(owner/admin) → Revisions → Restore(owner/admin) → Delete(owner/admin)
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: isNarrow ? "space-between" : "flex-end",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.8 }}>
            Status: {isAuthed ? "✅ logged in" : "❌ not logged in"}
          </span>

          {isAuthed && (
            <span style={{ fontSize: 12, opacity: 0.85 }}>
              {meLoading ? "loading user..." : me ? `as ${me.username}${me.is_admin ? " (admin)" : ""}` : ""}
            </span>
          )}

          {isAuthed && (
            <button
              onClick={logout}
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {!isAuthed && (
        <section
          style={{
            marginTop: 16,
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button
              onClick={() => setMode("login")}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: mode === "login" ? "#111" : "white",
                color: mode === "login" ? "white" : "#111",
                cursor: "pointer",
              }}
            >
              Login
            </button>
            <button
              onClick={() => setMode("register")}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: mode === "register" ? "#111" : "white",
                color: mode === "register" ? "white" : "#111",
                cursor: "pointer",
              }}
            >
              Register
            </button>
          </div>

          {mode === "login" && (
            <>
              <h3 style={{ marginTop: 0 }}>Login</h3>
              <form
                onSubmit={login}
                style={{
                  display: "grid",
                  gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr auto",
                  gap: 8,
                }}
              >
                <input
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="email"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
                <input
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="password"
                  type="password"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    cursor: "pointer",
                  }}
                >
                  Login
                </button>
              </form>

              {authMsg && <div style={{ marginTop: 8, fontSize: 13 }}>{authMsg}</div>}
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                (Token disimpan di <code>localStorage</code> supaya tidak perlu login ulang tiap refresh.)
              </div>
            </>
          )}

          {mode === "register" && (
            <>
              <h3 style={{ marginTop: 0 }}>Register</h3>
              <form
                onSubmit={register}
                style={{
                  display: "grid",
                  gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr 1fr auto",
                  gap: 8,
                }}
              >
                <input
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="username"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
                <input
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="email"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
                <input
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="password (min 8 chars)"
                  type="password"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    cursor: "pointer",
                  }}
                >
                  Register
                </button>
              </form>

              {regMsg && <div style={{ marginTop: 8, fontSize: 13 }}>{regMsg}</div>}
            </>
          )}
        </section>
      )}

      <section style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                cursor: "pointer",
                background: category === c.key ? "#111" : "white",
                color: category === c.key ? "white" : "#111",
              }}
            >
              {c.label}
            </button>
          ))}

          <div style={{ marginLeft: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
            >
              <option value="updated">Latest (updated)</option>
              <option value="title">A–Z (title)</option>
            </select>
          </div>
        </div>
      </section>

      <main
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: isNarrow ? "1fr" : "minmax(320px, 420px) 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>List: {category}</h3>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title/slug..."
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              width: "100%",
              boxSizing: "border-box",
              marginBottom: 10,
            }}
          />

          {listLoading && <p>Loading...</p>}
          {listError && <p style={{ color: "crimson" }}>{listError}</p>}

          {!listLoading && !listError && items.length === 0 && <p style={{ opacity: 0.7 }}>No articles yet.</p>}

          {!listLoading && !listError && items.length > 0 && filteredItems.length === 0 && (
            <p style={{ opacity: 0.7 }}>No match for "{search}".</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredItems.map((it) => (
              <button
                key={it.id}
                onClick={() => openArticle(it.slug)}
                style={{
                  textAlign: "left",
                  padding: "10px 10px",
                  borderRadius: 12,
                  border: selectedSlug === it.slug ? "1px solid #111" : "1px solid #d0d0d0",
                  background: selectedSlug === it.slug ? "#111" : "#f3f4f6",
                  color: selectedSlug === it.slug ? "#fff" : "#111",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>{it.title}</div>
                <div
                  style={{
                    fontSize: 12,
                    opacity: selectedSlug === it.slug ? 0.9 : 0.85,
                    color: selectedSlug === it.slug ? "#e5e7eb" : "#374151",
                    marginTop: 2,
                  }}
                >
                  {it.slug} • {it.category}
                </div>
              </button>
            ))}
          </div>

          <hr style={{ margin: "16px 0" }} />

          <h3 style={{ margin: "0 0 8px" }}>Create Article</h3>
          <form onSubmit={createArticle} style={{ display: "grid", gap: 8 }}>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.key}
                </option>
              ))}
            </select>

            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />

            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Content..."
              rows={6}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                resize: "vertical",
              }}
            />

            <button
              type="submit"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                cursor: "pointer",
              }}
            >
              Create
            </button>

            {createMsg && <div style={{ fontSize: 13 }}>{createMsg}</div>}
            {!isAuthed && <div style={{ fontSize: 12, opacity: 0.7 }}>Login dulu untuk create.</div>}
          </form>
        </div>

        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16, minHeight: 320 }}>
          <h3 style={{ marginTop: 0 }}>Article</h3>

          {!selectedSlug && <p style={{ opacity: 0.7 }}>Click an article from the list.</p>}
          {articleLoading && <p>Loading article...</p>}
          {articleError && <p style={{ color: "crimson" }}>{articleError}</p>}

          {article && (
            <>
              <h2 style={{ margin: "6px 0" }}>{article.title}</h2>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
                category: <b>{article.category}</b> • slug: <b>{article.slug}</b>
              </div>

              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
                owner: <b>{String(article.created_by || "")}</b>{" "}
                {canManage && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: "1px solid #111",
                      background: "#111",
                      color: "#fff",
                      fontWeight: 800,
                      letterSpacing: 0.2,
                    }}
                  >
                    YOU CAN MANAGE
                  </span>
                )}
              </div>

              <h4 style={{ margin: "12px 0 6px" }}>Preview (Current)</h4>
              <div
                style={{
                  lineHeight: 1.65,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  background: "#111827",
                  color: "#f9fafb",
                  overflowX: "auto",
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: (props) => <a {...props} style={{ color: "#93c5fd" }} />,
                    code: (props) => (
                      <code
                        {...props}
                        style={{
                          background: "#1f2937",
                          padding: "2px 6px",
                          borderRadius: 6,
                        }}
                      />
                    ),
                    pre: (props) => (
                      <pre
                        {...props}
                        style={{
                          background: "#0b1220",
                          padding: 12,
                          borderRadius: 12,
                          overflowX: "auto",
                        }}
                      />
                    ),
                  }}
                >
                  {article.content || ""}
                </ReactMarkdown>
              </div>

              <hr style={{ margin: "16px 0" }} />

              <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0 }}>Revisions</h3>
                    <button
                      onClick={() => loadRevisions(selectedSlug)}
                      style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}
                    >
                      Refresh
                    </button>
                  </div>

                  {revLoading && <p style={{ marginTop: 10 }}>Loading revisions...</p>}
                  {revError && <p style={{ color: "crimson", marginTop: 10 }}>{revError}</p>}
                  {!revLoading && !revError && revisions.length === 0 && (
                    <p style={{ opacity: 0.7, marginTop: 10 }}>No revisions.</p>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    {revisions.map((r) => {
                      const active = String(r.id) === String(selectedRevisionId);
                      const current = isCurrentRevision(r.id);

                      return (
                        <button
                          key={r.id}
                          onClick={() => openRevision(r.id)}
                          style={{
                            textAlign: "left",
                            padding: "10px 10px",
                            borderRadius: 12,
                            border: active ? "1px solid #111" : "1px solid #d0d0d0",
                            background: active ? "#111" : "#f3f4f6",
                            color: active ? "#fff" : "#111",
                            cursor: "pointer",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              flexWrap: "wrap",
                              fontWeight: 800,
                            }}
                          >
                            <span>#{r.id}</span>

                            {current && (
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  border: active ? "1px solid rgba(255,255,255,0.35)" : "1px solid #111",
                                  background: active ? "rgba(255,255,255,0.12)" : "#111",
                                  color: "#fff",
                                  fontWeight: 800,
                                  letterSpacing: 0.2,
                                }}
                              >
                                CURRENT
                              </span>
                            )}

                            <span style={{ fontWeight: 600, opacity: active ? 0.9 : 0.8 }}>
                              {r.summary || "(no summary)"}
                            </span>
                          </div>

                          <div style={{ fontSize: 12, marginTop: 4, opacity: active ? 0.9 : 0.75 }}>
                            {fmtDate(r.created_at)} • {r.editor || "unknown"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>Revision Viewer</h3>

                  {!selectedRevisionId && <p style={{ opacity: 0.7 }}>Klik salah satu revision untuk lihat isinya.</p>}
                  {revisionLoading && <p>Loading revision...</p>}
                  {revisionError && <p style={{ color: "crimson" }}>{revisionError}</p>}

                  {revisionDetail && (
                    <>
                      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
                        <b>#{revisionDetail.id}</b> • {fmtDate(revisionDetail.created_at)} •{" "}
                        {revisionDetail.editor || "unknown"}
                        <div style={{ marginTop: 4 }}>
                          summary: <b>{revisionDetail.summary || "(no summary)"}</b>
                        </div>
                      </div>

                      <div
                        style={{
                          lineHeight: 1.65,
                          padding: 12,
                          borderRadius: 12,
                          border: "1px solid #d1d5db",
                          background: "#0b1220",
                          color: "#f9fafb",
                          overflowX: "auto",
                          marginBottom: 10,
                        }}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: (props) => <a {...props} style={{ color: "#93c5fd" }} />,
                            code: (props) => (
                              <code
                                {...props}
                                style={{
                                  background: "#1f2937",
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                }}
                              />
                            ),
                            pre: (props) => (
                              <pre
                                {...props}
                                style={{
                                  background: "#050913",
                                  padding: 12,
                                  borderRadius: 12,
                                  overflowX: "auto",
                                }}
                              />
                            ),
                          }}
                        >
                          {revisionDetail.content || ""}
                        </ReactMarkdown>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          onClick={() => restoreRevision(revisionDetail.id)}
                          disabled={!isAuthed || restoring || !canManage}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            cursor: isAuthed && canManage ? "pointer" : "not-allowed",
                            opacity: !isAuthed || !canManage ? 0.6 : 1,
                          }}
                        >
                          {restoring ? "Restoring..." : "Restore this revision"}
                        </button>

                        {!isAuthed && <span style={{ fontSize: 12, opacity: 0.7 }}>Login dulu untuk restore.</span>}
                        {isAuthed && !canManage && (
                          <span style={{ fontSize: 12, opacity: 0.7 }}>Hanya owner/admin yang bisa restore.</span>
                        )}
                      </div>

                      {restoreMsg && <div style={{ marginTop: 8, fontSize: 13 }}>{restoreMsg}</div>}
                    </>
                  )}
                </div>
              </div>

              <hr style={{ margin: "16px 0" }} />

              <h3 style={{ marginTop: 0 }}>Edit Article</h3>
              <form onSubmit={saveEdit} style={{ display: "grid", gap: 8 }}>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    resize: "vertical",
                  }}
                />
                <input
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  placeholder="Summary (optional) e.g. Fix typo"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
                <button
                  type="submit"
                  disabled={!isAuthed || !canManage}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    cursor: isAuthed && canManage ? "pointer" : "not-allowed",
                    opacity: !isAuthed || !canManage ? 0.6 : 1,
                  }}
                >
                  Save Edit
                </button>
                {editMsg && <div style={{ fontSize: 13 }}>{editMsg}</div>}
                {!isAuthed && <div style={{ fontSize: 12, opacity: 0.7 }}>Login dulu untuk save edit.</div>}
                {isAuthed && !canManage && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Hanya owner/admin yang bisa edit.</div>
                )}
              </form>

              <hr style={{ margin: "16px 0" }} />

              <h3 style={{ margin: 0, color: "crimson" }}>Danger Zone</h3>
              <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={deleteArticle}
                  disabled={!isAuthed || deleting || !canManage}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid crimson",
                    background: "#fee2e2",
                    color: "crimson",
                    cursor: isAuthed && canManage ? "pointer" : "not-allowed",
                    opacity: !isAuthed || !canManage ? 0.6 : 1,
                  }}
                >
                  {deleting ? "Deleting..." : "Delete Article"}
                </button>

                {!isAuthed && <span style={{ fontSize: 12, opacity: 0.7 }}>Login dulu untuk delete.</span>}
                {isAuthed && !canManage && (
                  <span style={{ fontSize: 12, opacity: 0.7 }}>Hanya owner/admin yang bisa delete.</span>
                )}
              </div>

              {deleteMsg && <div style={{ marginTop: 8, fontSize: 13 }}>{deleteMsg}</div>}
            </>
          )}
        </div>
      </main>

      <footer style={{ marginTop: 18, fontSize: 12, opacity: 0.65 }}>
        Tip: kalau halaman direfresh, token tetap ada (localStorage). Logout untuk menghapus token.
      </footer>
    </div>
  );
}
