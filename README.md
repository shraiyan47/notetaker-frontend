# FrontendNote - Secure Note-Taking Application Frontend

A functional, template-free frontend built with vanilla HTML, CSS, and JavaScript designed to interact directly with the Note-Taker REST API backend.

## Features Implemented

1. **Authentication & Roles**:
   - Register (Name, Email, Password, Interests).
   - Login with JWT stored in `localStorage`.
   - Role-Based UI Display: Regular `user` vs. `admin`.

2. **Note Management (User & Admin)**:
   - Create new notes.
   - Edit / Update own notes.
   - Delete own notes.
   - List notes with pagination (Admin can see all users' notes, regular user sees only their own).

3. **Public Posts & Lookup Aggregation (Scenario 2)**:
   - Create public posts.
   - View posts belonging to any specific user retrieved via MongoDB `$lookup` aggregation pipeline.
   - Includes pagination.

4. **Admin User Management**:
   - List all users with pagination.
   - Add new users (specify role: user or admin).
   - Edit user profile details.
   - Delete users (which cascades and deletes their notes/posts).

5. **Admin Group by Interests Aggregation (Scenario 1)**:
   - View users grouped by interest tags via MongoDB single `$aggregate` pipeline.
   - Includes pagination support.

## How to Run

1. **Start the Backend API:**
   ```bash
   cd API
   npm run dev
   # or: node src/server.js
   ```
   Backend will run on `http://localhost:5000`.

2. **Open the Frontend:**
   - Simply double click or open `FrontendNote/index.html` in any browser, or use a local static server like `npx serve FrontendNote` or Python's `python -m http.server`.
