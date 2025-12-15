# Project Management - Folder Structure

> Last Updated: December 2024
> Status: Active
> Owner: Susan (AI Librarian)

## Overview

This folder contains the Project Management feature for Dev Studio. It allows tracking todos, documentation, database schemas, code changes, notes, and bug reports per project.

---

## File Structure

```
project-management/
├── STRUCTURE.md           # This file - folder documentation
├── page.tsx               # Full-page view (standalone /project-management route)
├── ProjectManagementPanel.tsx  # Panel view (embedded in main Dev Studio)
├── types.ts               # TypeScript interfaces and tab config
│
├── components/            # Reusable UI components
│   ├── ProjectCard.tsx    # Card for project list view
│   ├── ProjectHeader.tsx  # Header showing project info in detail view
│   ├── ProjectTabs.tsx    # Tab bar navigation
│   └── ProjectForm.tsx    # Add/Edit project modal form
│
└── tabs/                  # Tab content components
    ├── TodosTab.tsx       # ACTIVE - Todo list management
    ├── DocsTab.tsx        # ACTIVE - Documentation viewer/editor
    ├── DatabaseTab.tsx    # ACTIVE - Database tables & schemas (merged)
    ├── CodeChangesTab.tsx # ACTIVE - Git commit history log
    ├── NotepadTab.tsx     # ACTIVE - Freeform project notes
    ├── BugsTab.tsx        # ACTIVE - Bug reports (for Tiffany)
    ├── TablesTab.tsx      # DEPRECATED - Merged into DatabaseTab
    └── SchemasTab.tsx     # DEPRECATED - Merged into DatabaseTab
```

---

## File Status Legend

| Status | Meaning |
|--------|---------|
| ACTIVE | In use, maintained |
| DEPRECATED | Replaced, pending deletion |
| ABANDONED | Not in use, can be deleted |
| WIP | Work in progress |

---

## Detailed File Documentation

### Root Files

| File | Status | Purpose |
|------|--------|---------|
| `page.tsx` | ACTIVE | Standalone page at `/project-management` route. Full-screen view with header, project list, and detail view. Uses Next.js App Router. |
| `ProjectManagementPanel.tsx` | ACTIVE | Compact panel version that embeds in Dev Studio's browser preview area. Shows when clicking gear icon in sidebar. |
| `types.ts` | ACTIVE | TypeScript interfaces for Project, Todo, Doc, Bug, Note, CodeChange. Also exports `TabType` union and `TABS` config array. |
| `STRUCTURE.md` | ACTIVE | This documentation file. Susan maintains this. |

### Components

| File | Status | Purpose |
|------|--------|---------|
| `ProjectCard.tsx` | ACTIVE | Card component showing project at-a-glance info in list view. Shows name, droplet, ports, build number. |
| `ProjectHeader.tsx` | ACTIVE | Header component for detail view. Shows full project info with edit button. |
| `ProjectTabs.tsx` | ACTIVE | Tab bar with icons. Renders TABS from types.ts. Uses lucide-react icons. |
| `ProjectForm.tsx` | ACTIVE | Modal form for creating/editing projects. Fields: name, slug, description, droplet, ports, git repo, etc. |

### Tabs

| File | Status | Purpose | Susan's API |
|------|--------|---------|-------------|
| `TodosTab.tsx` | ACTIVE | Todo list with priorities and status. CRUD operations. | `/api/todos`, `/api/todo` |
| `DocsTab.tsx` | ACTIVE | Documentation viewer/editor. Categories: general, setup, api, architecture, deployment. | `/api/docs`, `/api/doc` |
| `DatabaseTab.tsx` | ACTIVE | **MERGED** - Shows tables with columns, generates CREATE TABLE SQL. Replaces TablesTab + SchemasTab. | `/api/tables`, `/api/table/:name/columns` |
| `CodeChangesTab.tsx` | ACTIVE | Commit log showing hash, message, author, files changed, build number. Read-only display. | `/api/code-changes` |
| `NotepadTab.tsx` | ACTIVE | Freeform notes for project. Simple title + content. | `/api/notes`, `/api/note` |
| `BugsTab.tsx` | ACTIVE | Bug reports with severity, status, steps to reproduce. Tiffany (tester) posts bugs here. | `/api/bugs`, `/api/bug` |
| `TablesTab.tsx` | DEPRECATED | Old tables-only view. Functionality merged into DatabaseTab. DELETE WHEN READY. | - |
| `SchemasTab.tsx` | DEPRECATED | Old schemas-only view. Functionality merged into DatabaseTab. DELETE WHEN READY. | - |

---

## Susan's API Endpoints

All endpoints accessed via proxy: `/api/susan/{endpoint}`

### Project Management Tabs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/todos?project=` | GET | Get todos for project |
| `/api/todo` | POST | Create todo |
| `/api/todo/:id` | PATCH | Update todo |
| `/api/todo/:id` | DELETE | Delete todo |
| `/api/docs?project=` | GET | Get documentation |
| `/api/doc` | POST | Create doc |
| `/api/doc/:id` | PATCH | Update doc |
| `/api/doc/:id` | DELETE | Delete doc |
| `/api/tables?prefix=` | GET | List database tables |
| `/api/table/:name/columns` | GET | Get table columns |
| `/api/code-changes?project=` | GET | Get commit log |
| `/api/code-change` | POST | Log a commit |
| `/api/notes?project=` | GET | Get notepad entries |
| `/api/note` | POST | Create note |
| `/api/note/:id` | PATCH | Update note |
| `/api/note/:id` | DELETE | Delete note |
| `/api/bugs?project=` | GET | Get bug reports |
| `/api/bug` | POST | Report bug |
| `/api/bug/:id` | PATCH | Update bug status |
| `/api/bug/:id` | DELETE | Delete bug |

### Susan's Library (File Storage)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/files?project_slug=` | GET | List all files |
| `/api/file` | POST | Upload file (base64) |
| `/api/file` | DELETE | Delete file |
| `/api/files/organize` | POST | Move file between categories |
| `/api/files/categories` | GET | Get filing categories |
| `/api/files/stats` | GET | Library statistics |

### Filing Categories

```
{project_slug}/
├── bugs/          # Bug screenshots and evidence
├── docs/          # Documentation files, PDFs, exports
├── screenshots/   # UI captures, before/after shots
├── assets/        # Logos, images, design files
├── discoveries/   # Things Susan finds during analysis
├── exports/       # Data exports, reports, backups
└── misc/          # Everything else
```

---

## Database Tables (Supabase)

| Table | Purpose |
|-------|---------|
| `dev_ai_projects` | Project registry |
| `dev_ai_todos` | Todo items |
| `dev_ai_docs` | Documentation entries |
| `dev_ai_bugs` | Bug reports |
| `dev_ai_notes` | Notepad entries |
| `dev_ai_code_changes` | Commit log |
| `dev_ai_schemas` | Cataloged table schemas |

---

## Notes for Susan

1. **Keep this file updated** when adding/removing/modifying files
2. **Mark files as DEPRECATED** before deleting - gives warning period
3. **Track abandoned experiments** so they can be cleaned up
4. **Document API changes** in the endpoints table
5. **Filing system** - Use consistent categories for uploaded files

---

## Change Log

| Date | Change | By |
|------|--------|----|
| Dec 2024 | Initial structure created | Claude |
| Dec 2024 | Merged TablesTab + SchemasTab → DatabaseTab | Claude |
| Dec 2024 | Added Susan's Library file storage | Claude |
