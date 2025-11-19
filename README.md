**Project Overview**

- **Short:** Smart Deals Server is a Node.js + Express backend for an auction-style marketplace. It provides product CRUD, bidding APIs, and user management. Firebase is used for authentication (Firebase Admin) and MongoDB Atlas for data storage.

**Main Technologies**

- **Runtime:** `Node.js`
- **Framework:** `Express`
- **Database:** `MongoDB Atlas` (official `mongodb` driver)
- **Auth:** `Firebase Admin SDK` for server-side token verification
- **Dev tooling:** `nodemon` for local development

**Main Features**

- **User management:** create and store users
- **Products:** create, read, update, delete products
- **Bids:** place bids and fetch bids per product
- **Authentication:** Verify Firebase ID tokens for protected endpoints
- **Pagination / sorting:** latest products and bid sorting (by price)

**Dependencies**

- **Express**: web framework
- **cors**: Cross-Origin Resource Sharing
- **dotenv**: load environment variables
- **mongodb**: MongoDB Node driver
- **firebase-admin**: Firebase Admin SDK
- **nodemon** (dev): auto-restart during development

**Environment variables**

- **`DB_USER`**: MongoDB Atlas username
- **`DB_PASS`**: MongoDB Atlas password
- **`PORT`**: server port (default `3000`)
- **`JWT_SECRET`**: (if used elsewhere)
- **`FIREBASE_SERVICE_ACCOUNT`** _(optional)_: full Firebase service-account JSON (string). Prefer not to commit.
- **`FIREBASE_SERVICE_ACCOUNT_B64`** _(recommended)_: base64-encoded service-account JSON. The app supports decoding this on startup.

Security notes: Never commit `smart-deals-firebase-admin-key.json` or a populated `.env` to GitHub. Use the environment variables in your host (Render, Vercel, etc.). If a key was pushed, rotate it immediately in Firebase.

**Run locally**

- Install dependencies:

```
# PowerShell
npm install
```

- Generate base64 from your Firebase key (optional):

```
# PowerShell (from project root)
$b = [Convert]::ToBase64String([IO.File]::ReadAllBytes("smart-deals-firebase-admin-key.json"))
$b | Out-File firebase_b64.txt -Encoding ascii
# Copy content of firebase_b64.txt into .env or into Render secret
```

- Start locally (using `.env` for development):

```
# PowerShell
nodemon index.js
```

- If you prefer to write the decoded JSON locally before running:

```
# PowerShell (decode from env or file)
[IO.File]::WriteAllBytes('smart-deals-firebase-admin-key.json', [Convert]::FromBase64String($env:FIREBASE_SERVICE_ACCOUNT_B64))
nodemon index.js
```

**Deploy to Render (quick steps)**

- Push code to GitHub (ensure secret files are untracked):

```
git rm --cached smart-deals-firebase-admin-key.json
# ensure .gitignore contains the key and .env
git add .gitignore
git commit -m "Ignore sensitive keys"
git push origin main
```

- On Render dashboard → Service → Environment:
  - Add `DB_USER`, `DB_PASS`, `JWT_SECRET`, and `FIREBASE_SERVICE_ACCOUNT_B64` (paste the base64 string)
- Start command (no file write required):
  - `node index.js`
- (Optional) If you need a physical JSON file on the instance, use a Start Command that decodes env before running:

```
# Render start command (bash/sh)
sh -lc 'echo "$FIREBASE_SERVICE_ACCOUNT_B64" | base64 --decode > smart-deals-firebase-admin-key.json && node index.js'
```

**If GitHub rejects your push (secret scanning)**

- Create a mirror backup (already recommended):

```
git clone --mirror <repo-url> ../repo-backup.git
```

- Remove secret from history using `git-filter-repo` or BFG and force-push (this rewrites history; follow the docs and rotate keys afterwards).

**Live link & relevant links**

- **Live API:** (add your Render service URL here after deploy)
- **Repository:** `https://github.com/MD-Saadman-Fuad/Smart-Deals-Server`
- **Render docs:** https://render.com/docs
- **Firebase Console:** https://console.firebase.google.com/
- **MongoDB Atlas:** https://cloud.mongodb.com/

**License**

- Add your license here (e.g., MIT)

---

If you want, I can:

- Add an `assets/screenshot.png` placeholder file and commit it,
- Create a small `scripts/decode-firebase.js` helper to decode base64 to a file,
- Or commit and push these README changes for you. Let me know which.
