# Planck v1 Specification

A lesson planning and scheduling tool for UK secondary Physics teachers.

## Overview

Planck helps Physics teachers plan lesson sequences (modules) and schedule them across classes on a configurable timetable. It supports UK exam specifications for both GCSE and A-Level, handles holidays and absences with automatic lesson rescheduling, and provides flexible calendar views.

## Core Concepts

### Exam Specifications

Predefined UK exam board specifications for Physics:

- **GCSE**: AQA, OCR Gateway, OCR 21st Century, Edexcel, WJEC/Eduqas
- **A-Level**: AQA, OCR A, OCR B, Edexcel, WJEC/Eduqas

Each specification contains:

- Hierarchical structure of topics and sub-topics
- Spec point references (e.g., "4.1.1.2")
- Content statements from the specification

Specifications are read-only reference data. Documentation (PDFs, mark schemes, etc.) can be attached to specifications.

### Classes

A class represents a teaching group with the following properties:

| Field         | Required | Description                                       |
| ------------- | -------- | ------------------------------------------------- |
| Name          | Yes      | Display name (e.g., "11X/Ph1", "Year 12 Physics") |
| Year Group    | Yes      | Academic year (7-13)                              |
| Exam Spec     | Yes      | Reference to an exam specification                |
| Academic Year | Yes      | e.g., 2024-25                                     |
| Student Count | No       | Number of students                                |
| Room          | No       | Default teaching room                             |
| Notes         | No       | Free-text notes                                   |

Documentation can be attached to classes (e.g., class lists, seating plans).

### Timetable Configuration

The timetable is configurable per academic year:

| Setting         | Options          | Default     |
| --------------- | ---------------- | ----------- |
| Timetable Type  | 1-week or 2-week | 1-week      |
| Periods per Day | 1-10             | 6           |
| Days per Week   | 1-7              | 5 (Mon-Fri) |

For 2-week timetables, weeks are labelled "Week A" and "Week B".

### Timetable Slots

Each class is assigned to one or more timetable slots:

- A slot is defined by: day, period(s), and week (for 2-week timetables)
- **Double periods**: Two consecutive periods can be linked as a double
- A class can have multiple slots per week (e.g., 3x singles + 1x double)

### Modules

A module is a planned sequence of lessons for a topic. Modules are reusable templates that get copied when assigned to a class.

Module properties:

| Field       | Required | Description                                 |
| ----------- | -------- | ------------------------------------------- |
| Name        | Yes      | Module title (e.g., "Forces and Motion")    |
| Description | No       | Overview of the module                      |
| Target Spec | No       | Which exam spec this module is designed for |

A module contains an ordered list of **lessons**.

### Lessons (within a Module)

Each lesson in a module has:

| Field       | Required | Description                           |
| ----------- | -------- | ------------------------------------- |
| Title       | Yes      | Lesson title                          |
| Content     | No       | Markdown-formatted lesson notes       |
| Spec Points | No       | Links to specification points covered |
| Duration    | No       | Number of periods (default: 1)        |

Documentation can be attached to individual lessons (e.g., worksheets, slides, practical sheets).

### Scheduled Lessons

When a module is assigned to a class, its lessons become **scheduled lessons** - concrete instances placed on the calendar. Scheduled lessons:

- Are independent copies (changes don't affect the source module)
- Occupy specific calendar dates based on the class's timetable slots
- Can be edited individually from either module view or calendar view
- Inherit all properties from the source lesson

### Calendar Events

The calendar can contain:

1. **Scheduled Lessons** - From assigned modules
2. **School Holidays** - Term breaks, bank holidays (auto-shift lessons)
3. **School Closures** - INSET days, snow days (auto-shift lessons)
4. **Teacher Absences** - Personal absence, affects all classes (auto-shift lessons)

When a holiday, closure, or absence is added that overlaps with scheduled lessons, all affected lessons automatically cascade forward to the next available slots.

## User Workflows

### Setting Up a New Academic Year

1. Configure timetable settings (1/2 week, periods per day)
2. Import or adjust UK term dates template
3. Add any known INSET days or school closures
4. Create classes and assign exam specifications
5. Set timetable slots for each class

### Creating a Module

1. Create new module with name and optional description
2. Add lessons in sequence with titles and markdown content
3. Link lessons to relevant spec points
4. Mark lessons requiring double periods
5. Attach resources (files/links) to module or individual lessons

### Assigning a Module to a Class

1. Select a class
2. Choose a module to assign
3. Select start point:
   - Specific date, or
   - "Next available slot" (auto-fill from first free slot)
4. System creates scheduled lessons, filling timetable slots sequentially
5. Module content is copied (independent from source)

### Managing the Calendar

#### Adding Holidays/Closures

1. Add event (holiday, closure, or absence)
2. Specify date(s) affected
3. System automatically shifts affected lessons forward
4. All subsequent lessons cascade accordingly

#### Pushing Lessons Forward/Back

1. Select a scheduled lesson
2. Choose "Push forward" or "Push back"
3. Lesson moves to next/previous available slot
4. All subsequent lessons cascade in the same direction

#### Editing Scheduled Lessons

Lessons can be edited from:

- **Calendar view**: Click on a lesson to edit
- **Class view**: See all scheduled lessons for a class
- **Module instance view**: See the sequence as assigned to a class

Edits affect only that scheduled instance, not the source module.

## Views

### Calendar Views

Flexible scope with toggle between:

- **Day view**: Single day with all periods
- **Week view**: One or two weeks (matching timetable type)
- **Term view**: Overview of entire term

Calendar shows:

- Scheduled lessons (colour-coded by class)
- Holidays and closures (greyed out)
- Absences (marked distinctly)

### Class View

For a selected class:

- Class details and timetable slots
- All scheduled lessons in chronological order
- Progress through assigned modules
- Attached documentation

### Module Library

- List of all created modules
- Filter by target specification
- View/edit module templates
- See which classes a module has been assigned to

### Specification Browser

- Browse exam specifications by board and level
- View topic hierarchy and spec points
- See which lessons/modules link to each spec point
- Access attached specification documents

## Data Model (Simplified)

```
ExamSpec (predefined)
  └── Topics
       └── SpecPoints

Class
  ├── exam_spec_id
  ├── timetable_slots[]
  └── attachments[]

Module (template)
  ├── lessons[]
  │    ├── spec_point_links[]
  │    └── attachments[]
  └── attachments[]

ModuleAssignment
  ├── class_id
  ├── module_id (source)
  └── scheduled_lessons[] (copies)
       ├── calendar_date
       ├── spec_point_links[]
       └── attachments[]

CalendarEvent
  ├── type: holiday | closure | absence
  ├── date_range
  └── affects: all_classes

TimetableConfig
  ├── academic_year
  ├── weeks: 1 | 2
  ├── periods_per_day
  └── days_per_week

TimetableSlot
  ├── class_id
  ├── day
  ├── period_start
  ├── period_end (for doubles)
  └── week (A | B | null)

Attachment
  ├── type: file | link
  ├── entity_type: class | module | lesson | spec
  ├── entity_id
  └── file_path | url
```

## Academic Year Support

### Term Date Templates

UK academic year templates provide suggested dates:

- Autumn term (September - December)
- Spring term (January - March/April)
- Summer term (April - July)
- Half-term breaks
- Bank holidays

Templates are starting points that can be adjusted to match the specific school's calendar.

## Authentication

For v1, this is a single-user application. The existing Better Auth setup can be simplified or retained for future multi-user expansion, but no user management features are needed.

## Technical Notes

> **Note**: The tech stack (SvelteKit, Svelte 5, shadcn-svelte, Drizzle, SQLite, Bun) is documented in `CLAUDE.md`, which is the single source of truth for development setup and tooling.

### Exam Specification Data

Predefined specifications will be seeded data, stored in the database but marked as read-only. Structure will be parsed from official specification documents.

### File Attachments

- Stored locally in a configurable directory
- Database stores file metadata and path references
- Support for common document types (PDF, DOCX, PPTX, images)

### Responsive Design

The web interface must be fully responsive and functional on mobile devices:

- All core features accessible on mobile (viewing calendar, editing lessons, adding events)
- Touch-friendly UI elements (appropriate tap targets, swipe gestures where suitable)
- Adaptive layouts that work from phone screens to desktop monitors
- Calendar views optimised for smaller screens (e.g., day view as default on mobile)
- shadcn-svelte components provide good baseline responsiveness

## Out of Scope for v1

The following are explicitly not included in this version:

- Multi-user support and sharing
- Lesson progress/completion tracking
- Student-facing features
- Integration with school MIS systems
- Automatic spec point coverage analysis
- Native mobile app (responsive web is supported)
- Export/print functionality
- Collaboration features

## Success Criteria

The v1 release should allow a teacher to:

1. Set up their timetable for an academic year
2. Create classes linked to exam specifications
3. Build a library of reusable lesson modules
4. Assign modules to classes with automatic calendar population
5. Navigate flexibly between calendar views
6. Add holidays and absences with automatic lesson rescheduling
7. Edit and rearrange lessons as needed
8. Attach relevant documents to specs, classes, modules, and lessons
9. Use the application on mobile devices with full functionality
