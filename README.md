# UHV Cell portal (uhv.hkbkce.in)

The Universal Human Values Cell website of HKBK College of Engineering, with an on-page admin editor
that works like the one on hkbkce.in.

- Visitors see exactly the original pages. Content comes from Supabase (the same project as hkbkce.in,
  tables `uhvportal_content` and `uhvportal_history`, storage bucket `uhv`).
- If the database cannot be reached, pages fall back to the built-in content in `templates/`.

## Environment variables (Vercel → Project `uhv` → Settings → Environment Variables)

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | `https://elhxrjkasyzjkyazutgi.supabase.co` |
| `SUPABASE_SECRET_KEY` | the Supabase **secret** key, same value as `SUPABASE_SECRET_KEY` in the hkbkce.in project |
| `ADMIN_USERNAME` | the sign-in name, e.g. `admin` |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of your password (see below) |
| `SESSION_SECRET` | a random string of 32+ characters, e.g. from `openssl rand -base64 48` |

After adding or changing them, redeploy (Deployments → ⋯ → Redeploy).
Changing the password or `SESSION_SECRET` signs out every open admin session.

### Create the password hash

```bash
npm install
npm run admin:hash
```

Type the new password (at least 12 characters; it is hidden while typing) and copy the printed hash into
`ADMIN_PASSWORD_HASH`. The password itself is never stored anywhere.

## Signing in and editing

1. Open the site and click the small **Admin** link at the bottom right of the footer (or go to `/admin/login`).
2. Sign in. A slim bar appears at the top: *Signed in as admin · Edit page · Undo · History · Sign out*.
3. Click **✏️ Edit page** to turn editing on (editable areas get a dashed outline on hover; links do not open while editing).
4. **Text**: click any heading, paragraph, name or label, type, then press **Enter** or click outside to save
   (**Shift+Enter** for a new line, **Esc** to cancel). "Saved ✓" appears in the bar.
5. **Event card photos (Home)**: click the picture area → *Add/Replace photo* → crop and zoom → *Use this photo*, or *Remove photo*.
6. **People (Team)**: each card has **✏️ Edit** and **🗑️ Delete**. Edit makes the photo, name, designation and department
   editable on the card (click the photo to change it, or *Remove photo*), then **Save** or **Cancel**.
   Delete asks "Delete this person?". Use **➕ Add new** at the end of a group to add someone.
7. **Event photo galleries (Activities)**: **➕ Add photos** (choose several at once), click *Add caption…* under a photo,
   drag photos to reorder, **✕** to delete.
8. **Undo** reverses your last change (press again to go further back). **History** lists the last 30 changes;
   *Restore previous version* reverses that one change only. A restore can itself be undone.
9. Click **Sign out** when done.

Uploads: JPG, PNG or WebP up to 5 MB each. Photos are resized and compressed in the browser before upload.

## Security

- One admin account; the password is stored only as a bcrypt hash. The session is a signed, httpOnly cookie (7 days).
- Every save, upload, undo, restore and history route checks the session on the server, and only accepts requests from
  this site's own pages. Five wrong passwords lock sign-in for 15 minutes.
- Edited text is cleaned on the server (only simple formatting such as bold, italics, links and line breaks is kept).
- Uploads are checked by type and by the file's own bytes; only JPG/PNG/WebP up to 5 MB.
- Visitors are never sent the editor code.

## Project layout

```
api/            Vercel Functions: page (renders pages), login, logout, session, save, upload, history, undo, restore
lib/            config, session, sanitize, db (Supabase), render (fills templates), revert (History restore)
templates/      the five pages; editable parts are marked with data-e / data-num / data-img / data-list
public/         static files (CSS, JS, admin login page)
scripts/        dev server, seed (copy content into the database), admin:hash, tag-templates (one-time)
tests/          npm test
```

## Local development

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run seed                 # copies page content into the database (only missing keys; never overwrites edits)
npm run dev                  # http://localhost:3000
npm test
```

`npm run seed -- --reset` wipes all UHV content and history and copies the original page content again.
