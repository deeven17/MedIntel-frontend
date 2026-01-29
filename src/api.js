const API_URL = "http://localhost:8000";

async function parseResponse(res) {
  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    body = null;
  }

  if (res.ok) return { ok: true, data: body };

  let err;
  if (Array.isArray(body)) {
    err = body.map(e => `${e.loc?.join(".")}: ${e.msg}`).join("; ");
  } else if (typeof body === "object" && body !== null) {
    err = body.detail || body.message || JSON.stringify(body);
  } else {
    err = res.statusText;
  }

  return { ok: false, error: err, status: res.status, data: body };
}

export async function apiPostForm(path, data) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseResponse(res);
}
