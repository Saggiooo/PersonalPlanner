use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_workspace_tables",
            sql: r#"
          CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            accent TEXT NOT NULL DEFAULT '#8A6A52',
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS board_columns (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            position INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
          );

          CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT NOT NULL,
            column_id TEXT NOT NULL,
            title TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            effort TEXT NOT NULL DEFAULT 'Focus',
            lane TEXT NOT NULL DEFAULT 'general',
            position INTEGER NOT NULL,
            start_date TEXT,
            due_date TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (column_id) REFERENCES board_columns(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_board_columns_project
          ON board_columns(project_id, position);

          CREATE INDEX IF NOT EXISTS idx_tasks_project
          ON tasks(project_id, position);

          CREATE INDEX IF NOT EXISTS idx_tasks_column
          ON tasks(column_id, position);
        "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_column_colors",
            sql: r#"
          ALTER TABLE board_columns
          ADD COLUMN color TEXT NOT NULL DEFAULT '#5450ff';
        "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_task_checklist_items",
            sql: r#"
          CREATE TABLE IF NOT EXISTS task_checklist_items (
            id TEXT PRIMARY KEY NOT NULL,
            task_id TEXT NOT NULL,
            label TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            position INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_checklist_task
          ON task_checklist_items(task_id, position);
        "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_project_icons",
            sql: r#"
          ALTER TABLE projects
          ADD COLUMN icon TEXT NOT NULL DEFAULT '🗂️';
        "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_project_parent",
            sql: r#"
          ALTER TABLE projects
          ADD COLUMN parent_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;

          CREATE INDEX IF NOT EXISTS idx_projects_parent
          ON projects(parent_project_id, created_at);
        "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "add_board_column_icons",
            sql: r#"
          ALTER TABLE board_columns
          ADD COLUMN icon TEXT NOT NULL DEFAULT 'circle-solid';
        "#,
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:organizer.db", migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
