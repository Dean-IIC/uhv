import { adminConfig } from "../lib/config.js";
import { sendJson } from "../lib/http.js";
import { isAdminRequest } from "../lib/session.js";

export default function handler(req, res) {
  sendJson(res, 200, { admin: isAdminRequest(req), configured: adminConfig().ready });
}
