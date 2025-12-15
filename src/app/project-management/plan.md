 Project Management Page for Dev Studio

     Overview

     Create a full-featured Project Management page at /project-management in dev-studio-5000 with tabs for
     organizing all project data. This helps Susan stay organized by project and prepares for Tiffany
     (tester) to report bugs.

     ---
     Page Structure

     Two Views:

     1. Project List View (default)

     /project-management
     ├── Header: "Project Management" + "Add Project" button
     └── Project Cards Grid
         └── Each card shows at a glance:
             ├── Name, Slug, Description
             ├── Droplet name + IP address
             ├── Port numbers (dev/test/prod)
             ├── Build number / version
             └── Click → opens Project Detail View

     2. Project Detail View (when project selected)

     /project-management?project=slug
     ├── Back button (← All Projects)
     ├── Project Header
     │   ├── Name, Description
     │   ├── Droplet: name + IP
     │   ├── Ports: dev | test | prod
     │   ├── Server path, Git repo
     │   └── Build #, File structure link
     │
     ├── Tab Bar: Todos | Docs | Tables | Schemas | Code Changes | Notepad | Bug Reports
     └── Tab Content

     ---
     Files to Create

     IMPORTANT: All files self-contained in src/app/project-management/ - NO shared components folder

     src/app/project-management/
     ├── page.tsx                    # Main page (list view + detail view)
     ├── types.ts                    # TypeScript types for this feature
     ├── components/
     │   ├── ProjectCard.tsx         # Card for list view (shows at-a-glance info)
     │   ├── ProjectHeader.tsx       # Header for detail view
     │   ├── ProjectTabs.tsx         # Tab bar component
     │   └── ProjectForm.tsx         # Add/Edit project modal
     └── tabs/
         ├── TodosTab.tsx            # Todos list with status badges
         ├── DocsTab.tsx             # Documentation viewer/editor
         ├── TablesTab.tsx           # Database tables for this project
         ├── SchemasTab.tsx          # Schema definitions
         ├── CodeChangesTab.tsx      # Commits log with build numbers
         ├── NotepadTab.tsx          # Freeform notes for project
         └── BugsTab.tsx             # Bug reports (for Tiffany)

     ---
     Database: New Table for Bugs

     CREATE TABLE dev_ai_bugs (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       project_path TEXT NOT NULL,
       title TEXT NOT NULL,
       description TEXT,
       severity TEXT DEFAULT 'medium',  -- critical, high, medium, low
       status TEXT DEFAULT 'open',      -- open, investigating, fixed, wont_fix, duplicate
       reported_by TEXT,                -- 'tiffany', 'manual', 'claude'
       assigned_to TEXT,                -- who's working on it
       steps_to_reproduce TEXT,
       expected_behavior TEXT,
       actual_behavior TEXT,
       environment TEXT,                -- dev, test, prod
       screenshot_url TEXT,
       related_file TEXT,
       related_todo_id UUID,
       fix_session_id UUID,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW(),
       resolved_at TIMESTAMPTZ
     );

     CREATE INDEX idx_dev_ai_bugs_project ON dev_ai_bugs(project_path);
     CREATE INDEX idx_dev_ai_bugs_status ON dev_ai_bugs(status);

     ---
     Bugs API (for Tiffany - future 24/7 tester)

     susan-5403/src/routes/bugs.js - Susan stores the bugs, Tiffany reports them

     POST /api/bug           - Report a new bug (Tiffany will call this)
     GET  /api/bugs          - Get bugs (filter by project, status, severity)
     GET  /api/bug/:id       - Get specific bug
     PATCH /api/bug/:id      - Update bug (status, assignment, etc.)
     DELETE /api/bug/:id     - Delete bug
     GET /api/bugs/stats     - Bug statistics by project

     ---
     Data Flow

     1. Project Selection: Click project in sidebar → set selectedProject
     2. Data Fetch: When project selected, call Susan's /api/project-data?projectPath=...
     3. Tab Content: Each tab displays filtered data for that project
     4. CRUD Operations: Each tab has add/edit/delete for its data type
     5. Bug Reports: Tiffany (future) will POST to /api/bug with test results

     ---
     UI Design

     Color Scheme (Dark Theme)

     - Background: bg-gray-900
     - Sidebar: bg-gray-800
     - Cards: bg-gray-800 with border-gray-700
     - Active tab: border-b-2 border-blue-500
     - Status badges:
       - Pending: bg-yellow-600/20 text-yellow-400
       - In Progress: bg-blue-600/20 text-blue-400
       - Completed: bg-green-600/20 text-green-400
       - Critical: bg-red-600/20 text-red-400

     Icons (lucide-react)

     - Todos: CheckSquare
     - Docs: FileText
     - Tables: Table
     - Schemas: Database
     - Code Changes: GitCommit
     - Notepad: StickyNote
     - Bugs: Bug

     ---
     Implementation Steps

     Phase 1: Page Structure (all in src/app/project-management/)

     1. Create types.ts - TypeScript interfaces
     2. Create page.tsx - Main page (list view + detail view)
     3. Create components/ProjectCard.tsx - Card for list view
     4. Create components/ProjectHeader.tsx - Header for detail view
     5. Create components/ProjectTabs.tsx - Tab bar
     6. Create components/ProjectForm.tsx - Add/Edit modal

     Phase 2: Tab Components (all in src/app/project-management/tabs/)

     1. Create TodosTab.tsx - list todos, add/complete
     2. Create DocsTab.tsx - view/edit docs
     3. Create TablesTab.tsx - database tables
     4. Create SchemasTab.tsx - schema definitions
     5. Create CodeChangesTab.tsx - commits log with build numbers
     6. Create NotepadTab.tsx - freeform notes

     Phase 3: Bug Reporting

     1. Create dev_ai_bugs table in Supabase
     2. Create susan-5403/src/routes/bugs.js endpoints
     3. Create src/app/project-management/tabs/BugsTab.tsx - bug list and form
     4. Wire up to Susan's route index

     Phase 4: Polish

     1. Add loading states
     2. Add empty states ("No todos yet")
     3. Add search/filter within tabs
     4. Add pagination for large lists
     5. Deploy and test

     ---
     Key Files to Create/Modify

     All in dev-studio-5000/src/app/project-management/:
     1. page.tsx - Main page (list + detail views)
     2. types.ts - TypeScript interfaces
     3. components/ProjectCard.tsx - List view card
     4. components/ProjectHeader.tsx - Detail view header
     5. components/ProjectTabs.tsx - Tab bar
     6. components/ProjectForm.tsx - Add/Edit modal
     7. tabs/TodosTab.tsx
     8. tabs/DocsTab.tsx
     9. tabs/TablesTab.tsx
     10. tabs/SchemasTab.tsx
     11. tabs/CodeChangesTab.tsx
     12. tabs/NotepadTab.tsx
     13. tabs/BugsTab.tsx

     Susan API (separate project):
     14. susan-5403/src/routes/bugs.js (NEW)
     15. susan-5403/src/routes/index.js (add bugs route)

     ---
     Susan's Existing Endpoints (Already Available)

     - GET /api/todos?project=... - Todos
     - GET /api/docs?project=... - Documentation
     - GET /api/schemas - Database schemas
     - GET /api/decisions?project=... - Decisions
     - GET /api/query?project=... - Knowledge
     - GET /api/project-data?projectPath=... - All data aggregated

     ---
     Project Form Fields (from existing panel)

     - Name, Slug, Description
     - Droplet Name, Droplet IP
     - Server Path
     - Dev Port, Test Port, Prod Port
     - Git Repository
     - Table Prefix
     - Logo URL (optional)