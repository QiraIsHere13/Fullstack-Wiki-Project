const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { authRequired } = require("./authMiddleware");

const app = express();
app.use(cors());
app.use(express.json());

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeCategory(category) {
  const allowed = new Set(["world", "character", "item", "system"]);
  const c = String(category || "world").trim().toLowerCase();
  return allowed.has(c) ? c : "world";
}

function isOwnerOrAdmin(articleCreatedBy, user) {
  const isOwner = String(articleCreatedBy) === String(user?.id);
  const isAdmin = !!user?.is_admin;
  return isOwner || isAdmin;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "backend is running" });
});

app.get("/api/db-test", async (req, res) => {
  try {
    const r = await db.query("SELECT NOW() as now");
    res.json({ ok: true, now: r.rows[0].now });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ ok: false, error: "username, email, password required" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ ok: false, error: "password must be at least 8 chars" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const r = await db.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, created_at, is_admin`,
      [String(username).trim(), String(email).trim().toLowerCase(), passwordHash]
    );

    res.status(201).json({ ok: true, user: r.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ ok: false, error: "username or email already exists" });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email and password required" });
    }

    const r = await db.query(
      `SELECT id, username, email, password_hash, is_admin
       FROM users WHERE email = $1`,
      [String(email).trim().toLowerCase()]
    );

    const user = r.rows[0];
    if (!user) return res.status(401).json({ ok: false, error: "invalid credentials" });

    const match = await bcrypt.compare(String(password), user.password_hash);
    if (!match) return res.status(401).json({ ok: false, error: "invalid credentials" });

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, is_admin: !!user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      ok: true,
      token,
      user: { id: user.id, username: user.username, email: user.email, is_admin: !!user.is_admin },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/me", authRequired, (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.get("/api/articles", async (req, res) => {
  try {
    const qCategory = String(req.query.category || "").trim();
    const qSort = String(req.query.sort || "updated").toLowerCase();
    const orderBy = qSort === "title" ? "title ASC" : "updated_at DESC";

    if (qCategory) {
      const category = normalizeCategory(qCategory);
      const r = await db.query(
        `SELECT id, slug, title, category, created_by, created_at, updated_at
         FROM articles WHERE category = $1 ORDER BY ${orderBy}`,
        [category]
      );
      return res.json({ ok: true, items: r.rows });
    }

    const r = await db.query(
      `SELECT id, slug, title, category, created_by, created_at, updated_at
       FROM articles ORDER BY ${orderBy}`
    );
    res.json({ ok: true, items: r.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/articles/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const r = await db.query(
      `SELECT a.id, a.slug, a.title, a.category, a.created_by, a.created_at, a.updated_at, a.current_revision_id,
              ar.content
       FROM articles a
       LEFT JOIN article_revisions ar ON ar.id = a.current_revision_id
       WHERE a.slug = $1`,
      [slug]
    );

    const row = r.rows[0];
    if (!row) return res.status(404).json({ ok: false, error: "article not found" });

    res.json({
      ok: true,
      article: {
        id: row.id,
        slug: row.slug,
        title: row.title,
        category: row.category,
        created_by: row.created_by,
        content: row.content || "",
        current_revision_id: row.current_revision_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/articles/:slug/revisions", async (req, res) => {
  try {
    const { slug } = req.params;
    const a = await db.query(`SELECT id FROM articles WHERE slug = $1`, [slug]);
    const article = a.rows[0];
    if (!article) return res.status(404).json({ ok: false, error: "article not found" });

    const r = await db.query(
      `SELECT ar.id, ar.created_at, ar.summary, u.username AS editor
       FROM article_revisions ar
       LEFT JOIN users u ON u.id = ar.editor_id
       WHERE ar.article_id = $1
       ORDER BY ar.created_at DESC`,
      [article.id]
    );

    res.json({ ok: true, items: r.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/revisions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await db.query(
      `SELECT ar.id, ar.article_id, ar.created_at, ar.summary, ar.content, u.username AS editor
       FROM article_revisions ar
       LEFT JOIN users u ON u.id = ar.editor_id
       WHERE ar.id = $1`,
      [id]
    );

    const row = r.rows[0];
    if (!row) return res.status(404).json({ ok: false, error: "revision not found" });

    res.json({
      ok: true,
      revision: {
        id: row.id,
        article_id: row.article_id,
        created_at: row.created_at,
        summary: row.summary,
        editor: row.editor,
        content: row.content || "",
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/articles/:slug/restore/:revisionId", authRequired, async (req, res) => {
  const client = await db.connect();
  try {
    const { slug, revisionId } = req.params;
    await client.query("BEGIN");

    const a = await client.query(`SELECT id, created_by FROM articles WHERE slug = $1`, [slug]);
    const article = a.rows[0];
    if (!article) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "article not found" });
    }

    if (!isOwnerOrAdmin(article.created_by, req.user)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const old = await client.query(
      `SELECT content FROM article_revisions WHERE id = $1 AND article_id = $2`,
      [revisionId, article.id]
    );
    const oldRev = old.rows[0];
    if (!oldRev) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "revision not found" });
    }

    const rev = await client.query(
      `INSERT INTO article_revisions (article_id, editor_id, content, summary)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [article.id, req.user.id, oldRev.content, `Restore from revision ${revisionId}`]
    );

    await client.query(
      `UPDATE articles SET current_revision_id = $1, updated_at = NOW() WHERE id = $2`,
      [rev.rows[0].id, article.id]
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

app.post("/api/articles", authRequired, async (req, res) => {
  const client = await db.connect();
  try {
    const { title, content, category } = req.body || {};
    if (!title || !content) {
      return res.status(400).json({ ok: false, error: "title and content required" });
    }

    const slug = slugify(title);
    if (!slug) {
      return res.status(400).json({ ok: false, error: "invalid title" });
    }

    const finalCategory = normalizeCategory(category);

    await client.query("BEGIN");

    const a = await client.query(
      `INSERT INTO articles (slug, title, category, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, slug, title, category, created_by, created_at, updated_at`,
      [slug, String(title).trim(), finalCategory, req.user.id]
    );

    const rev = await client.query(
      `INSERT INTO article_revisions (article_id, editor_id, content, summary)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [a.rows[0].id, req.user.id, String(content), "Initial creation"]
    );

    await client.query(
      `UPDATE articles SET current_revision_id = $1, updated_at = NOW() WHERE id = $2`,
      [rev.rows[0].id, a.rows[0].id]
    );

    await client.query("COMMIT");
    res.status(201).json({ ok: true, article: a.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res.status(409).json({ ok: false, error: "slug already exists" });
    }
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

app.put("/api/articles/:id", authRequired, async (req, res) => {
  const client = await db.connect();
  try {
    const { id } = req.params;
    const { content, summary } = req.body || {};
    if (!content) {
      return res.status(400).json({ ok: false, error: "content required" });
    }

    await client.query("BEGIN");

    const a = await client.query(`SELECT id, created_by FROM articles WHERE id = $1`, [id]);
    const article = a.rows[0];
    if (!article) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "article not found" });
    }

    if (!isOwnerOrAdmin(article.created_by, req.user)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const rev = await client.query(
      `INSERT INTO article_revisions (article_id, editor_id, content, summary)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [id, req.user.id, String(content), summary ? String(summary).slice(0, 300) : null]
    );

    await client.query(
      `UPDATE articles SET current_revision_id = $1, updated_at = NOW() WHERE id = $2`,
      [rev.rows[0].id, id]
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

app.delete("/api/articles/:id", authRequired, async (req, res) => {
  const client = await db.connect();
  try {
    const { id } = req.params;
    await client.query("BEGIN");

    const a = await client.query(`SELECT id, created_by FROM articles WHERE id = $1`, [id]);
    const article = a.rows[0];
    if (!article) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "article not found" });
    }

    if (!isOwnerOrAdmin(article.created_by, req.user)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    await client.query(`UPDATE articles SET current_revision_id = NULL WHERE id = $1`, [id]);
    await client.query(`DELETE FROM article_revisions WHERE article_id = $1`, [id]);
    await client.query(`DELETE FROM articles WHERE id = $1`, [id]);

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
