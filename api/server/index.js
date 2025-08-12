const Database = require("better-sqlite3");
const express = require("express");
const { json } = require("body-parser");
const { resolve, extname } = require("path");
const multer = require("multer");
const fs = require("fs");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 42060;
const dbPath = resolve(__dirname, "notes.db");
const uploadsDir = resolve(__dirname, "uploads");

const db = new Database(dbPath);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

db.prepare(
  "CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, content TEXT)",
).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id TEXT,
    filename TEXT,
    original_name TEXT,
    file_path TEXT,
    file_size INTEGER,
    mime_type TEXT,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (note_id) REFERENCES notes (id)
  )
`).run();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const ext = extname(file.originalname);
    const filename = `${timestamp}_${Math.random().toString(36).substring(2)}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

app.use(json());
app.use(cors());

app.get("/note/:id", (req, res) => {
  const row = db
    .prepare("SELECT content FROM notes WHERE id = ?")
    .get(req.params.id);
  res.send({ content: row?.content || "" });
});

app.post("/note/:id", (req, res) => {
  db.prepare("REPLACE INTO notes (id, content) VALUES (?, ?)").run(
    req.params.id,
    req.body.content || "",
  );
  res.send({ status: "ok" });
});

app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { noteName } = req.body;
    if (!noteName) {
      return res.status(400).json({ error: "Note name is required" });
    }

    const note = db.prepare("SELECT * FROM notes WHERE id = ?").get(noteName);

    if (!note) {
      db.prepare("INSERT INTO notes (id, content) VALUES (?, ?)").run(noteName, "");
    }

    const fileData = {
      note_id: noteName,
      filename: req.file.filename,
      original_name: req.file.originalname,
      file_path: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype
    };

    const stmt = db.prepare(`
      INSERT INTO files (note_id, filename, original_name, file_path, file_size, mime_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      fileData.note_id,
      fileData.filename,
      fileData.original_name,
      fileData.file_path,
      fileData.file_size,
      fileData.mime_type
    );

    res.json({
      success: true,
      fileId: result.lastInsertRowid,
      filename: fileData.original_name,
      size: fileData.file_size
    });

  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.get("/files/:noteId", (req, res) => {
  try {
    const files = db
      .prepare(`
        SELECT id, original_name, file_size, mime_type, upload_date 
        FROM files 
        WHERE note_id = ? 
        ORDER BY upload_date DESC
      `)
      .all(req.params.noteId);

    res.json({ files });
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

app.get("/file/:fileId", (req, res) => {
  try {
    const file = db
      .prepare("SELECT filename, original_name, file_path, mime_type FROM files WHERE id = ?")
      .get(req.params.fileId);

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: "File not found on disk" });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
    res.setHeader('Content-Type', file.mime_type);
    
    res.sendFile(resolve(file.file_path));
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "Download failed" });
  }
});

app.delete("/file/:fileId", (req, res) => {
  try {
    console.log("Deleting file", req.params.fileId);
    const file = db
      .prepare("SELECT file_path FROM files WHERE id = ?")
      .get(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }
    db.prepare("DELETE FROM files WHERE id = ?").run(req.params.fileId);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Delete failed" });
  }
});


app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);
