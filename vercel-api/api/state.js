import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*"

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin)
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body
  if (typeof req.body === "string") return JSON.parse(req.body || "{}")

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const rawBody = Buffer.concat(chunks).toString("utf8")
  return rawBody ? JSON.parse(rawBody) : {}
}

async function ensureSchema() {
  await sql`
    create table if not exists app_state (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `
}

export default async function handler(req, res) {
  setCorsHeaders(res)

  if (req.method === "OPTIONS") {
    res.status(204).end()
    return
  }

  if (!process.env.DATABASE_URL) {
    res.status(500).json({ error: "DATABASE_URL no esta configurada en Vercel." })
    return
  }

  try {
    await ensureSchema()

    if (req.method === "GET") {
      const rows = await sql`select data, updated_at from app_state where id = 'main' limit 1`
      res.status(200).json(rows[0] || { data: null, updated_at: null })
      return
    }

    if (req.method === "PUT" || req.method === "POST") {
      const body = await readBody(req)
      const data = body.data

      if (!data || typeof data !== "object") {
        res.status(400).json({ error: "El cuerpo debe tener la forma { data: {...} }." })
        return
      }

      const rows = await sql`
        insert into app_state (id, data, updated_at)
        values ('main', ${JSON.stringify(data)}::jsonb, now())
        on conflict (id)
        do update set data = excluded.data, updated_at = now()
        returning updated_at
      `

      res.status(200).json({ ok: true, updated_at: rows[0].updated_at })
      return
    }

    res.setHeader("Allow", "GET, PUT, POST, OPTIONS")
    res.status(405).json({ error: "Metodo no permitido." })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error interno de la API." })
  }
}
