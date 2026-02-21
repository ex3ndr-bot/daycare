import { migration20260219ImportFiles } from "./20260219_import_files.js";
import { migration20260219Initial } from "./20260219_initial.js";
import { migration20260220AddTasks } from "./20260220_add_tasks.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260220ImportTasks } from "./20260220_import_tasks.js";
import { migration20260220UsersBootstrap } from "./20260220_users_bootstrap.js";
import { migration20260221BackfillCronUsers } from "./20260221_backfill_cron_users.js";
import type { Migration } from "./migrationTypes.js";

export const migrations: Migration[] = [
    migration20260219Initial,
    migration20260219ImportFiles,
    migration20260220AddUsers,
    migration20260220UsersBootstrap,
    migration20260220AddTasks,
    migration20260220ImportTasks,
    migration20260221BackfillCronUsers
];
